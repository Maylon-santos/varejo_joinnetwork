#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=control_password="$CONTROL_DB_PASSWORD" \
  --set=tenant_password="$TENANT_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE varejo_control LOGIN PASSWORD %L', :'control_password') \gexec
SELECT format('CREATE ROLE varejo_aeropostale LOGIN PASSWORD %L', :'tenant_password') \gexec
CREATE DATABASE varejo_control OWNER varejo_control;
CREATE DATABASE varejo_aeropostale OWNER varejo_aeropostale;
REVOKE CONNECT ON DATABASE varejo_control FROM PUBLIC;
REVOKE CONNECT ON DATABASE varejo_aeropostale FROM PUBLIC;
GRANT CONNECT ON DATABASE varejo_control TO varejo_control;
GRANT CONNECT ON DATABASE varejo_aeropostale TO varejo_aeropostale;
SQL
