#!/bin/sh
set -eu
# Executar dentro do container. Não imprime senhas.
export PGPASSWORD="$CONTROL_DB_PASSWORD"
psql -h 127.0.0.1 -U varejo_control -d varejo_control -v ON_ERROR_STOP=1 <<'SQL'
SELECT current_database(), current_user;
BEGIN;
CREATE TABLE verificacao_temporaria (id integer PRIMARY KEY);
INSERT INTO verificacao_temporaria VALUES (1);
SELECT count(*) AS escrita_leitura_ok FROM verificacao_temporaria;
ROLLBACK;
SQL
if psql -h 127.0.0.1 -U varejo_control -d varejo_aeropostale -c 'SELECT 1' >/dev/null 2>&1; then
  echo 'ERRO: usuário central acessou banco do tenant'; exit 1
fi
export PGPASSWORD="$TENANT_DB_PASSWORD"
psql -h 127.0.0.1 -U varejo_aeropostale -d varejo_aeropostale -v ON_ERROR_STOP=1 <<'SQL'
SELECT current_database(), current_user;
BEGIN;
CREATE TABLE verificacao_temporaria (id integer PRIMARY KEY);
INSERT INTO verificacao_temporaria VALUES (1);
SELECT count(*) AS escrita_leitura_ok FROM verificacao_temporaria;
ROLLBACK;
SQL
if psql -h 127.0.0.1 -U varejo_aeropostale -d varejo_control -c 'SELECT 1' >/dev/null 2>&1; then
  echo 'ERRO: usuário do tenant acessou banco central'; exit 1
fi
echo 'Autenticação, leitura, escrita e bloqueio de acesso cruzado: OK'
