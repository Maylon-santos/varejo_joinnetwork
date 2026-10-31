#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/aeropostale-varejo
exec 9>artifacts/exportacoes-csv/diario.lock
flock -n 9 || exit 0
# Serviço isolado, mesma imagem já existente; não reinicia API, banco ou worker.
docker compose -f compose.yaml -f deploy/relatorios.compose.yaml run --rm --no-deps relatorios-csv
