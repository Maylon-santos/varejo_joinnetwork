#!/bin/sh
# Exemplo de autenticação e consultas à API de Integrações.
# Não executar com set -x ou salvar tokens em logs compartilhados.
set -eu
: "${CLIENT_ID:?Configure a identidade da integração}"
: "${CLIENT_ASSERTION:?Gere uma prova nova com gerar_assertion.py}"
BASE=https://api-varejo.aeropostale.joinnetwork.com.br

# A resposta contém segredo transitório. Trate-a em memória e não faça echo em logs.
token_response=$(curl --fail-with-body --silent --show-error --max-time 10 \
  --request POST "$BASE/oauth/token" \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode 'scope=vendas:ler filiais:ler produtos:ler estoques:ler' \
  --data-urlencode 'client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer' \
  --data-urlencode "client_assertion=$CLIENT_ASSERTION")
ACCESS_TOKEN=$(printf '%s' "$token_response" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
unset token_response CLIENT_ASSERTION

# ID 1001 é fictício. Substitua por uma filial concedida à integração.
# Respostas comerciais vão para stdout por escolha do exemplo; redirecione a destino privado.
curl --fail-with-body --silent --show-error --max-time 10 \
  "$BASE/v1/filiais?limite=100" --header "Authorization: Bearer $ACCESS_TOKEN"
curl --fail-with-body --silent --show-error --max-time 10 --get \
  "$BASE/v1/vendas" --header "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode 'filial_id=1001' --data-urlencode 'inicio=2026-11-01' \
  --data-urlencode 'fim=2026-11-10' --data-urlencode 'estado=todas'
unset ACCESS_TOKEN
