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

O piloto continua limitado a ITUPEVA. Homologação de indicadores, expansão para outras filiais e SaaS são etapas separadas. O limitador da API atual usa o IP de conexão do proxy: limites ficam compartilhados entre os usuários neste piloto, devendo ser revisados antes da expansão.
