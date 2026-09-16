# Operação do piloto publicado

URL: https://aeropostale.joinnetwork.com.br
Servidor: alias SSH `localweb`. Diretório: `/opt/aeropostale-varejo`.

## Serviços

API e PostgreSQL publicados somente em loopback; Nginx atende o domínio com HTTPS. O worker remoto é o responsável pela sincronização. O worker local foi parado e `SYNC_ENABLED=false` foi salvo no `.env` local.

```sh
cd /opt/aeropostale-varejo
docker compose ps
docker compose logs --tail 30 sync-worker
curl -f https://aeropostale.joinnetwork.com.br/health
```

Não habilitar workers locais e remotos simultaneamente com bancos separados. O bloqueio PostgreSQL não é compartilhado entre esses bancos.

## Backup e recuperação

`bash deploy/backup.sh` gera dumps customizados de ambos os bancos, checksums SHA-256 e marcador COMPLETE. O diretório usa permissões privadas. Sessões Admin são excluídas dos dados do backup, exigindo novo login após restauração; usuários e hashes de senha são preservados.

O timer `aeropostale-backup.timer` executa diariamente às 03:30 UTC (00:30 de São Paulo), com até cinco minutos de variação. Verificar com `systemctl list-timers aeropostale-backup.timer` e `journalctl -u aeropostale-backup.service`. Os backups diários ficam em `/opt/aeropostale-varejo/backups`. Retenção ativa: 5 dias na Locaweb após confirmação externa e 90 dias no mabookhome, preservando sempre a última cópia completa. Há uma cópia inicial fora do servidor em `artifacts/deploy/backups` no computador de origem, ignorada pelo Git.

Os dumps são consistentes individualmente; não são um snapshot simultâneo entre os dois bancos. Para uma migração coordenada, pausar escritas/sincronização antes da cópia. O backup inicial foi restaurado nos bancos novos antes da publicação e conferido contra contagens, totais, hashes de operações/itens/cancelamentos, tenant e checkpoints da origem.

Para recuperar, usar uma instância isolada de PostgreSQL 17, criar os usuários e bancos com `database/init`, verificar SHA256SUMS e restaurar cada dump no banco correspondente com `pg_restore --no-owner --role=USUARIO --exit-on-error --single-transaction`. Conferir os dados com `deploy/conferencia.sql`, aplicar migrations e testar API/login antes de alterar o destino do Nginx. Nunca restaurar por cima da produção em uso. O script de backup não realiza restauração automaticamente.

## Atualizações e retorno

Antes de atualizar, fazer backup e registrar os IDs das imagens em uso. Transferir somente arquivos versionados; `.env`, importação e backups permanecem privados no servidor. Construir as imagens e aplicar migrations com:

```sh
docker compose build api sync-worker
docker compose run --rm --no-deps api node scripts/migrar.mjs
docker compose up -d --wait api
docker compose up -d sync-worker
```

A imagem da API inclui migrations e scripts administrativos. O provisionamento inicial não é executado a cada inicialização.

Se uma atualização falhar, manter o worker pausado e retornar a imagem anterior somente se compatível com o schema. Mudanças de schema incompatíveis exigem recuperação isolada a partir de backup e validação antes da troca. Não usar `docker compose down -v`: isso remove o volume de dados.

## HTTPS e verificação

Certificado emitido para o hostname exato, com vencimento inicial em 11/12/2026. Certbot usa webroot em `/var/www/letsencrypt`. O hook `aeropostale-nginx` valida e recarrega Nginx após renovação.

Verificação externa autenticada: `node --env-file=.env scripts/verificar-producao.mjs`, no computador que possui as credenciais Admin. Nunca imprimir token/senha. Opcionalmente `DEPLOY_VERIFY_IP` permite testar um IP preservando a verificação TLS do hostname.

Em 13/09/2026, Maylon confirmou o agrupamento das 14 filiais no mesmo tenant Aeropostale. Admin acessa as 14; o histórico das novas filiais é carregado gradualmente. ITUPEVA foi homologada por confirmação de Maylon; os totais das outras lojas e o SaaS permanecem etapas separadas. O limitador da API atual usa o IP de conexão do proxy: limites ficam compartilhados entre os usuários neste piloto, devendo ser revisados antes da expansão.

## Conferência da expansão

`node --env-file=.env scripts/verificar-filiais.mjs` verifica os cadastros ERP; `--retomar` repete somente os cadastros não confirmados no relatório anterior. São consultas de leitura, sem importação. A sincronização periódica usa `config/piloto.json`, com ITUPEVA primeiro e até sete dias por recurso/filial por rodada. O evento `lote_historico_concluido` significa que um lote terminou, não que o histórico está completo.

`node --env-file=.env scripts/verificar-producao.mjs` confere a lista autorizada, indicadores por filial, TLS, login e rejeição de filial não autorizada. A evidência inclui cobertura por filial; novas lojas continuam parciais até seus checkpoints cobrirem o período consultado.

Para preparar uma referência de homologação de ITUPEVA: `node --env-file=.env scripts/preparar-homologacao.mjs`. O relatório lê somente o painel, verifica somas e gera arquivos privados na central. `HOMOLOGACAO_INICIO` e `HOMOLOGACAO_FIM` mudam o período. Cada execução cria uma extração nova e preserva a ficha de aceite existente; não comprova, por si só, equivalência com o ERP. Atualize o HTML com `python3 scripts/gerar-central.py`.

## Implantação do cadastro incremental

Aplicar migrations antes de publicar a API que lê `cadastro_filiais`. Com o worker pausado, executar `docker compose run --rm --no-deps sync-worker node scripts/sincronizar-filiais.mjs` e confirmar os 14 cadastros antes de atualizar a API. Retomar o worker após a publicação. Backup do tenant inclui cadastro e cursor.

Acompanhar eventos `cadastro_filiais_sincronizado` e `cadastro_filiais_falhou`, além da tabela `sync_cadastro_filiais`. O cursor não substitui a autorização nem os checkpoints dos outros recursos.

## Kanban pessoal

Editar tarefas e estados em `config/roadmap.json`, então executar `python3 scripts/gerar-central.py`. O gerador atualiza somente o bloco delimitado `KANBAN` do roadmap e gera o quadro na central pessoal. Notas e edições pessoais anteriores são preservadas; o HTML continua ignorado pelo Git. O quadro é uma fotografia do planejamento, sem consulta automática ao servidor.

## Permissões por cargo — 14/09/2026

Fazer backup e aplicar `control/003_permissoes.sql` antes de subir a API nova. Não requer atualizar o worker. O Admin existente mantém suas credenciais e acesso completo. Testar `/auth/me`, `/acessos/perfis` e filiais após a atualização. O gerenciamento de permissões exige Admin; os demais usuários dependem dos recursos do cargo e vínculos cadastrados. Perfis e vínculos entram no backup central. A tela de cadastro de usuários continua em R13.

## Gestão de usuários — 14/09/2026

A API inclui a tela Usuários e as rotas `/acessos/usuarios` e `/acessos/vendedores`. Usa a migration de permissões já instalada; não há nova migration nesta entrega. Publicação com backup prévio e atualização somente da API. Cadastro, cargo, ativação, senha e vínculos ficam no banco central e no backup existente. Alterações de usuário revogam sessões anteriores. O próprio Admin não pode se alterar pela tela; outro Admin deve fazê-lo. Nenhum convite ou senha é enviado automaticamente.

## Teste isolado de recuperação — 14/09/2026

Executar `python3 scripts/verificar-backup.py CAMINHO_DO_BACKUP` no computador com Docker e imagem `postgres:17`. O script exige COMPLETE e os dois checksums corretos, rejeita links/manifestos inesperados e cria um container temporário sem rede, sem portas e com dados em tmpfs. Restaura os bancos com `--no-owner --no-acl --exit-on-error --single-transaction`, verifica identidades, registro, Admin ativo e ausência de sessões; remove o container ao terminar. Não utiliza URLs dos bancos nem acessa a produção. Limites do container: 1 CPU, 1 GB de memória e tmpfs de 1 GB; revisar esses limites quando o histórico crescer.

Relatório agregado: `docs/validacao-backup.json` (pode escolher outro caminho com `--relatorio`). Logs privados: `artifacts/deploy/varejo-restore-test-*/restore.log`. O teste verifica recuperação do backup indicado, sem comparação com a produção em alteração. Dumps e logs continuam fora do Git. Cinco testes de validação: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-verificar-backup.py`.

A restauração do backup de 14/09 às 11h56 UTC foi validada. Destino e política definidos posteriormente por Maylon: mabookhome, 5 dias na Locaweb e 90 dias no Mac. A política de 30 dias não foi aplicada.


## Cópia automática para mabookhome

Pasta no Mac: `/Users/maylonsantos/Backups/JoinNetwork/Aeropostale`. No Finder, usar ⌘⇧G e colar esse caminho. Cada backup contém `control.dump`, `tenant.dump`, `SHA256SUMS` e `COMPLETE`; os dumps são arquivos PostgreSQL para restauração.

O Mac busca os backups pela conexão SSH ao endereço público da Locaweb. Acesso ao Mac pelo alias `mabookhome` já funciona via rede Tailscale; não foi necessário instalar Tailscale no servidor. A chave privada exclusiva `~/.ssh/aeropostale_backup_ed25519` fica somente no Mac. O known_hosts dedicado foi copiado da conexão confiável existente; o coletor exige verificação estrita da identidade do servidor.

Na Locaweb, a chave pública tem `restrict` e comando forçado `/usr/bin/python3 /opt/aeropostale-varejo/deploy/exportar-backups.py`. O comando permite apenas `exportar-backups` e `confirmar-copias`; não libera shell, terminal ou encaminhamento de portas. O helper usa `scripts/backup_retencao.py`, valida os backups completos e limita a confirmação aos nomes e hashes existentes. O acesso deve continuar restrito ao reinstalar; nunca autorizar essa chave como login geral.

No Mac, `scripts/receber-backups-mac.py` e `scripts/backup_retencao.py` ficam em `Backups/JoinNetwork/Aeropostale/automacao/`, junto de `locaweb-known-hosts`. O coletor transfere os backups completos, aceita somente os quatro arquivos esperados, rejeita links e caminhos externos, confere o lote antes de publicar cópias novas e preserva cópias existentes diferentes para análise. Um lock impede execuções concorrentes. Não há exclusão por espelhamento. A transferência atual envia todos os backups completos ainda retidos na origem; somente as cópias novas são adicionadas ao destino.

`deploy/instalar-coleta-mac.py`, executado no Mac como o usuário do backup, mantém um bloco próprio no crontab, preservando as demais tarefas. Frequência definitiva: `17 * * * *`. O teste temporário por minuto foi removido após execuções automáticas confirmadas. Não exige sudo nem sessão gráfica. Quando o computador estiver desligado, dormindo ou sem internet, a tentativa ocorrerá no próximo horário em que puder executar; a rotina não acorda o Mac. Não houve alteração das configurações de energia.

Após conferir os hashes no destino, o Mac envia confirmação por SSH. O servidor então remove somente backups completos confirmados com mais de **5 dias**. Depois do sucesso remoto, o Mac remove cópias completas com mais de **90 dias**. Em ambos os lados, a última cópia completa é preservada. Idade calculada pelo timestamp UTC do nome do backup; cópias incompletas, diretórios inesperados, links e diretórios com arquivos adicionais não são apagados. Dados corrompidos interrompem a limpeza. Se a cópia/confirmacão externa falhar, a retenção remota não avança; o disco pode conservar backups além dos cinco dias até a conexão voltar.

Status local: `automacao/ultima-copia.json`; execuções e falhas: `automacao/coleta.log`. Status remoto: `/opt/aeropostale-varejo/backups/.confirmacao-mabookhome.json`. O JSON local representa a última execução bem-sucedida; conferir também sua data e o log para identificar falhas posteriores. Revogar o acesso removendo somente a chave pública identificada como `aeropostale-backup-mabookhome` do authorized_keys do servidor; desativar a coleta removendo somente o bloco JOINNETWORK AEROPOSTALE BACKUP do crontab do Mac. Preservar as outras chaves e tarefas.

Testes: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-receber-backups.py` e `PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-retencao-backups.py`, além do teste de integridade citado acima. A retenção foi testada com datas antigas sintéticas; a primeira execução real não precisou excluir arquivos.


## Complementos de vendas — 14/09/2026

Pausar o worker, fazer backup, construir API e worker e aplicar `tenant/007_complementos_venda.sql`. `scripts/preencher-complementos.mjs` preenche uma amostra (padrão ITUPEVA, 13/09/2026), adquire o lock exclusivo do worker e compara hashes dos dados comerciais antes/depois. `COMPLEMENTOS_FILIAL` e `COMPLEMENTOS_DIA` permitem outra amostra autorizada. Executar pela imagem do worker com o worker contínuo pausado; nunca habilitar o worker local.

Publicar API e retomar o worker remoto. A cada rodada, o worker prioriza vendas/cancelamentos e depois preenche até três dias históricos por filial, com cooldown/backoff. Verificar `complementos_preenchidos`, `complementos_falharam` e `sync_status`/recurso `complementos`. Conferir cobertura com `SELECT count(*) FILTER(WHERE complementos IS NULL) FROM operacoes`. A conclusão depende de pendências zero e revisão das divergências; abrir o detalhe não inicia consulta ERP.

O aviso de preço aplicado abaixo da tabela depende de desconto informado igual a zero; não aplica novas regras aos indicadores. Histórico e gerador das parcelas respeitam a permissão de clientes. Os novos campos entram no backup do tenant e na cópia automática já configurada para mabookhome.

## Clientes e aniversariantes — 14/09/2026

Aplicar `tenant/008_identidade_clientes.sql` antes de publicar API/worker. Backup e worker pausado durante a atualização. `scripts/preencher-identidade-clientes.mjs` é a amostra operacional protegida pelo lock global do worker: por padrão, ITUPEVA de 01 a 07/09. `CLIENTES_FILIAL`, `CLIENTES_INICIO` e `CLIENTES_FIM` permitem escolher até sete dias; compara hashes dos dados comerciais, itens e checkpoints antes/depois.

O worker contínuo faz a carga de identidade após vendas, cancelamentos e complementos: um dia por filial/rodada, cooldown de 360 segundos e backoff em falhas. `sync_status.recurso='clientes'` acompanha o estado e `operacoes.clientes_identidade_importada` registra cobertura, inclusive respostas sem cliente. Não executar o worker local. A carga não reseta checkpoints.

A rota `GET /api/v1/clientes` aceita os filtros comuns de filial/período/paginação, `busca` de até 100 caracteres e `mes` vazio ou `01` a `12`. Exige `clientes:ler` e `vendas:ler`. O agrupamento ocorre por código ERP depois da restrição de filial/período/vendedor. Contatos refletem o snapshot da movimentação mais recente nesse escopo. Não existe mesclagem por nome/telefone nem edição de cadastro nesta entrega. Aniversário persiste somente mês/dia; o ano não é necessário para esse filtro.

Validação da fonte (somente leitura, saída agregada): `node --env-file=.env scripts/verificar-fonte-clientes.mjs`, opcional `CLIENTES_DIA`. Validações de interface: `scripts/verificar-clientes-ui.mjs` com dados sintéticos isolados e `scripts/verificar-clientes-producao.mjs` no domínio público. Capturas ficam em `artifacts/deploy`, fora do Git. Cobertura histórica pendente no roadmap R26.

## Lista da Vez — R16.1

A API usa `tenant/009_fila_atendimento.sql` e `control/004_fila_permissoes.sql`. Pausar o worker e fazer backup antes da atualização coordenada. Construir a API, aplicar migrations, subir a API com verificação de saúde e retomar o worker existente; esta entrega não requer reconstruir o worker.

Somente Admin recebe automaticamente `fila:ler`, `fila:operar` e `fila:gerenciar`. Configurar os demais cargos na tela Permissões. Operar exige consultar; gerenciar exige operar e não pode ser concedido a perfil limitado às próprias vendas. Vendas continua vinculado ao código do vendedor em cada filial. A ordem da equipe pode ser consultada na filial autorizada, mas detalhes de atendimentos são retornados somente ao próprio operador ou gestor autorizado.

`GET /api/v1/fila?filial=ID&dia=AAAA-MM-DD` retorna jornada, ordem, disponibilidade, atendimentos abertos autorizados e eventual jornada anterior pendente. Candidatos para abertura/chegada são lidos do histórico local e retornados somente ao gestor. Não consulta ERP.

`POST /api/v1/fila` recebe `filial`, `dia`, `versao`, `requisicao` UUID e `acao`. Ações: `abrir` (lista ordenada `vendedores`), `chegada`, `pausar`, `retornar`, `ausente` (campo `vendedor`), `abordar` (`vendedor`, `modalidade` = `vez` ou `reservado`), `iniciar` (`atendimento` UUID), `concluir` (`atendimento`, `resultado` = `com_venda`, `sem_venda` ou `nao_iniciado`) e `fechar`. Pausa, ausência, reservado, conclusão sem venda e não iniciado exigem `motivo` com até 300 caracteres. Limite inicial: 60 participantes por jornada.

Cada mutação usa transação, lock por filial, versão otimista e histórico de eventos. Repetir exatamente a mesma requisição com o mesmo UUID/autor é idempotente; reutilizar o UUID com outros dados retorna conflito. A autorização é relida depois da espera pelo lock. Índices únicos impedem duas jornadas abertas na filial ou dois atendimentos abertos por vendedor. Fechar exige zero atendimentos abertos. Uma abordagem já existente pode prosseguir após a meia-noite; novos atendimentos começam somente no dia atual. A jornada anterior precisa encerrar antes da abertura da nova.

A fila registra resultado informado, sem confirmar venda automaticamente ou alterar ERP/comissões. Relatórios consolidados, movimento intenso e vínculo explícito com a operação ERP continuam em R16.2/R16.3. Backup PostgreSQL inclui automaticamente as novas tabelas e o histórico de eventos.

Verificação local completa: `node --env-file=.env scripts/verificar-fila-ui.mjs`, com Chrome e schemas temporários. Verificação pública somente de leitura: `node --env-file=.env scripts/verificar-fila-producao.mjs`; não cria jornadas reais. Capturas ficam em `artifacts/deploy`, fora do Git. Acompanhar códigos `FILA_DESATUALIZADA` (recarregar estado) e `FILA_JORNADA_PENDENTE` (resolver dia anterior), sem expor dados de atendimentos em logs.

## Relatórios e movimento intenso — R16.2

Atualizar somente a API. As migrations aditivas são `tenant/010_fila_relatorios_intenso.sql` e `control/005_fila_relatorios.sql`. Construir a nova imagem, pausar API/worker para a cópia coordenada, executar backup, aplicar migrations, subir API com verificação de saúde e retomar o worker existente. Não reconstruir nem ativar worker local.

`fila:relatorios` exige `fila:ler`, com concessão automática somente a Admin. Configurar outros cargos no gerenciador. Vendas continua limitado ao próprio código; gerente sem o recurso de relatórios continua podendo operar a jornada, mas não consultar relatórios.

`GET /api/v1/fila/relatorio?filial=ID&inicio=AAAA-MM-DD&fim=AAAA-MM-DD` aceita até 31 dias, `vendedor` opcional e `pagina` (30 registros por página). Totais por vendedor/dia, motivos e paginação usam o escopo antes da agregação. Retorna conversão informada e média ponderada dos concluídos; denominador zero retorna null. Disponibilidade é reconstruída pelos eventos desde a abertura/chegada, excluindo ocupação, pausa e ausência, até o fechamento ou o timestamp consistente da consulta. Datas representam a jornada, inclusive após meia-noite. Leitura em transação consistente e sem ERP.

`POST /api/v1/fila` aceita `acao=movimento_intenso`, `ativo` booleano e `motivo`. Exige gestão, mantém lock, versão e idempotência. Ativar exige jornada de hoje; desligar pode resolver jornada anterior. O modo flexibiliza apenas a vez, preserva a ocupação única e fica gravado em cada abordagem. Fechar a jornada desliga o modo; nova jornada começa normal. Eventos guardam responsável e motivo; a consulta das últimas 100 alterações do modo é exclusiva da gestão com permissão de relatório.

Validação sintética: `scripts/verificar-fila-relatorio-ui.mjs`. Validação pública somente de leitura: `scripts/verificar-fila-relatorio-producao.mjs`; não liga/desliga modo nem altera jornadas reais. Correções excepcionais do histórico dependem de definição; vínculo com ERP continua na R16.3.


## Produtos, estoque e indicadores — R19

Construir API e worker; pausar ambos para backup coordenado e aplicar migrations aditivas `control/006_produtos_estoque.sql` e `tenant/011_produtos_estoque.sql`. Subir a API saudável, executar `docker compose run --rm --no-deps sync-worker node scripts/sincronizar-estoques.mjs` com worker contínuo pausado e, depois, retomar **somente o worker remoto** atualizado. O script usa o lock global e compara hashes comerciais/checkpoints; consultas ERP são sequenciais. Falha parcial de filial preserva as outras e fica explícita para retentativa.

O worker prioriza vendas/cancelamentos, até duas filiais de estoque por rodada e cinco cadastros de produto, antes dos históricos de complementos/clientes. Cursor próprio por filial com sobreposição; atualização completa após um dia, sem transformar SKU ausente em saldo zero. Classificação do catálogo é gradual, com TTL diário após sucesso. A frequência efetiva depende da duração da rodada. A interface não chama o ERP.

Acompanhar `estoque_sincronizado`, `estoque_falhou`, `cadastro_produtos_atualizado`, `sync_estoques` e a cobertura de `cadastro_produtos.enriquecido_em`. Apenas Admin recebe `produtos:ler`/`estoque:ler`; liberar outros cargos no gerenciador. Backups e retenção existentes cobrem as novas tabelas.

Validar com `scripts/verificar-produtos-producao.mjs` (14 filiais, leitura) e conferir worker ativo. Preservar imagens anteriores para retorno compatível; schemas são aditivos. [Regras completas](../docs/PRODUTOS_ESTOQUE.md).


## Indicadores da Visão geral — R19.2

Entrega somente de API/interface, sem migrations ou reimportação. Construir a API, fazer backup e substituir a API com verificação de saúde; manter worker remoto ativo e local desabilitado. Novas rotas Top 20/resumo de estoque usam permissões existentes; indicadores/condições e participação de vendedores são aditivos.

Testes: `scripts/verificar-visao-geral-ui.mjs` com dados sintéticos, incluindo falha de foto na origem e vendedor restrito. Validação pública de leitura: `scripts/verificar-visao-geral-producao.mjs`, com totais de condições/mês conservados nas 14 filiais, fotos/ampliação e celular. As fotos usam a hospedagem de imagens já autorizada, com no máximo quatro downloads simultâneos no navegador. Alterar ordenação/página de vendedores não recarrega fotos do Top 20.

## Ajustes do ranking e Fantasia das filiais — 16/09/2026

Aplicar a migration tenant `012_fantasia_filiais.sql` com o worker pausado após backup. Ela acrescenta Fantasia e solicita uma releitura completa do cadastro de filiais pelo escopo, preservando o cursor cadastral e os checkpoints comerciais. Construir API e worker; executar `scripts/sincronizar-filiais.mjs` na nova imagem do worker, conferir preenchimento e então publicar ambos. O incremental passa a atualizar código e Fantasia juntos. A coluna é aditiva e compatível com retorno às imagens anteriores.

Top 20 aceita `ordenar=valor` (padrão) ou `ordenar=quantidade`; a seleção acontece antes do limite de 20. `/api/v1/produtos/detalhe` recebe filial, início, fim, chave exata do agrupamento e página; limita variações a 30 por página. Não consulta ERP ao abrir detalhes. Fotos mantêm ampliação; dados de estoque exigem permissão específica.

Validação: `npm test`, `npm run test:integration`, `node --env-file=.env scripts/verificar-visao-geral-ui.mjs` e, após publicação, `node --env-file=.env scripts/verificar-visao-geral-producao.mjs`. Este último registra `docs/validacao-ranking-produtos-producao.json`.

## Recarga e limpeza da apresentação de estoque — 16/09/2026

`node scripts/sincronizar-estoques.mjs --completa` solicita carga com cursor zero em todas as filiais, mantendo o maior cursor persistido. Executar somente com backup e worker contínuo pausado; o lock global protege contra duas sincronizações. Qualquer filial com erro deixa saída não zero e mantém a posição anterior daquela filial. Os hashes comerciais/checkpoints são conferidos antes/depois.

Catálogo e resumos atuais apresentam somente `presente_ultima_carga=true`; ausentes na carga completa ficam fora da apresentação e do enriquecimento cadastral, mantendo histórico/auditoria. Saldo nulo de um SKU retornado continua desconhecido, sem ser convertido em zero.

A rota customizada ajustada por Maylon precisa cumprir [o contrato da nova origem](../apis/estoque-custom.md) antes da troca definitiva. Não apontar o worker para uma resposta sem identificação dos produtos ou sem suporte ao cursor. As correções de interface e leitura do catálogo podem ser publicadas independentemente dessa troca.
