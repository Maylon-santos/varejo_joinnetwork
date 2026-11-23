#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
args=(--env-file .env --env-file .env.integracoes)
if [[ -f .env.notificacoes ]]; then args+=(--env-file .env.notificacoes); fi
args+=(-f compose.yaml -f compose.override.yaml -f deploy/integracoes.compose.yaml -f deploy/integracoes-hostgator.yaml)
if [[ -f .env.notificacoes ]]; then args+=(-f deploy/notificacoes.compose.yaml); fi
exec docker compose "${args[@]}" "$@"
