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

O timer `aeropostale-backup.timer` executa diariamente às 03:30 UTC (00:30 de São Paulo), com até cinco minutos de variação. Verificar com `systemctl list-timers aeropostale-backup.timer` e `journalctl -u aeropostale-backup.service`. Os backups diários ficam em `/opt/aeropostale-varejo/backups`. Não há exclusão automática; retenção e cópia externa recorrente ainda precisam ser definidas. Há uma cópia inicial fora do servidor em `artifacts/deploy/backups` no computador de origem, ignorada pelo Git.

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
