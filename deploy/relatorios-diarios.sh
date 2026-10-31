#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/aeropostale-varejo
# Configuração privada: destino único autorizado e credenciais do remetente.
set -a
source .env.relatorios
set +a
exec 9>artifacts/exportacoes-csv/diario.lock
flock -n 9 || exit 0
# Mesma imagem da API, sem iniciar worker. Monta somente o diretório privado de saída.
docker compose run --rm --no-deps -v "$PWD/artifacts/exportacoes-csv:/app/artifacts/exportacoes-csv" api node scripts/exportar-relatorios.mjs > artifacts/exportacoes-csv/ultimo-lote.json
pasta=$(python3 -c 'import json; print(json.load(open("artifacts/exportacoes-csv/ultimo-lote.json"))["saida"])')
python3 scripts/enviar-relatorios.py "${pasta/#\/app/$PWD}"
