#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker compose --env-file .env --env-file .env.integracoes \
  -f compose.yaml -f compose.override.yaml \
  -f deploy/integracoes.compose.yaml -f deploy/integracoes-hostgator.yaml "$@"
