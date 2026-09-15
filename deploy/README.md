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
