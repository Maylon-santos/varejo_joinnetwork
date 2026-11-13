# Autenticação e acesso

A API utiliza OAuth 2.0 Client Credentials com autenticação `private_key_jwt` e assinatura RS256. Cada integração recebe um `client_id`, escopos e filiais autorizadas. O fluxo é destinado a serviços que protegem sua chave privada.

## Credenciais e chaves

Registre a chave pública e seu `kid` antes de solicitar tokens. Utilize RSA de pelo menos 2048 bits; mantenha a chave privada exclusivamente no backend do integrador. Cada ambiente deve utilizar credenciais próprias.

A prova JWT autentica a emissão do token e é válida por até 60 segundos, para uso único. O `access_token` retornado é uma credencial opaca, válida por 900 segundos, utilizada nas consultas. Na rotação planejada, as chaves podem coexistir por até 24 horas. Em caso de comprometimento, solicite a revogação imediata.

## Prova JWT

| Parte | Campo | Valor/regra deste perfil |
| --- | --- | --- |
| Header | `alg` | Exatamente `RS256` |
| Header | `typ` | `JWT` |
| Header | `kid` | Identificador da chave pública previamente registrada |
| Payload | `iss` | Igual ao `client_id` |
| Payload | `sub` | Igual ao `client_id` |
| Payload | `aud` | Exatamente `https://api-varejo.aeropostale.joinnetwork.com.br/oauth/token` |
| Payload | `iat` | Unix timestamp atual em segundos |
| Payload | `exp` | Maior que `iat`, no máximo `iat + 60` |
| Payload | `jti` | UUID aleatório novo em toda tentativa |

O servidor verifica assinatura, cliente ativo, chave válida, público pretendido, janela temporal e uso único de `jti`. A tolerância de relógio aplicada é de 30 segundos. Gere uma nova prova em cada tentativa, inclusive após falha de comunicação.

O [RFC 7523](https://www.rfc-editor.org/rfc/rfc7523.html) define o uso do JWT na autenticação OAuth. Os tempos, algoritmo único e proteção obrigatória contra repetição acima são decisões deste contrato.

## Trocar a prova por token

```bash
curl --request POST \
  'https://api-varejo.aeropostale.joinnetwork.com.br/oauth/token' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode 'scope=vendas:ler filiais:ler produtos:ler estoques:ler' \
  --data-urlencode 'client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer' \
  --data-urlencode "client_assertion=$CLIENT_ASSERTION"
```

```json
{
  "access_token": "TOKEN_OPACO_DEMONSTRATIVO_NAO_UTILIZAVEL",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "vendas:ler filiais:ler produtos:ler estoques:ler"
}
```

Não registrar o formulário, o JWT ou o token em logs, traces, histórico de terminal compartilhado ou capturas. Em ambiente compartilhado, prefira fornecer o formulário por stdin a uma biblioteca HTTP; os exemplos cURL mostram a sintaxe, mas argumentos de processos podem ser visíveis no sistema operacional.

As respostas do token incluem `Cache-Control: no-store`. Falhas usam o formato OAuth, por exemplo `{"error":"invalid_client","error_description":"Autenticação do cliente inválida"}`. A resposta não informa a existência do cliente ou da chave. O recurso protegido usa outro envelope de erro, descrito abaixo.

## Escopos e isolamento

| Escopo | Autoriza | Dependência / restrição |
| --- | --- | --- |
| `filiais:ler` | Cadastros das filiais concedidas | Não descobre filiais não atribuídas |
| `vendas:ler` | Cabeçalhos, valores, itens, pagamentos e nota fiscal | Sem nomes/contatos pessoais por padrão |
| `vendas:pessoas:ler` | Nomes e snapshots pessoais vinculados à venda | Exige também `vendas:ler` e `incluir_pessoas=true` |
| `produtos:ler` | Cadastro e variações vinculados à filial | Não concede saldo automaticamente |
| `estoques:ler` | Saldo por SKU/filial | Resposta pode conter identidade mínima do SKU; não concede todo o catálogo |
| `webhooks:ler` | Inscrições e metadados de entregas próprias | Exige também `vendas:ler` |
| `webhooks:gerenciar` | Criar, testar, alterar, rotacionar e reenviar | Exige também `vendas:ler`; não permite alterar vendas |

O pedido de token não amplia permissões. Escopo desconhecido ou fora da concessão resulta em `invalid_scope`, sem concessão parcial silenciosa. A organização é definida pela credencial. O parâmetro `tenant_id` não é aceito para selecionar outra organização.

Toda consulta, página, replay e entrega de webhook revalida cliente ativo, escopos e filiais atuais. As respostas contêm somente recursos autorizados para a credencial.

Filial explicitamente não concedida resulta em 403. Um objeto que não exista dentro do escopo concedido resulta em 404, sem revelar sua existência em outra filial ou tenant. A lista retorna somente recursos autorizados. Revogar filiais invalida cursores anteriores e cancela entregas pendentes que perderam autorização.

## Tokens, revogação e limites

O token de acesso é opaco, tem validade de 900 segundos e não possui refresh token. Reutilize-o até próximo da expiração; renove com margem de 60 segundos. Após revogação da credencial, novas requisições são recusadas. Apresente o token somente no header `Authorization`.

| Operação | Limite |
| --- | --- |
| Leituras por integração | 60 requisições por minuto, com burst de 10 |
| Leituras compartilhadas por organização | 120 requisições por minuto |
| Concorrência por integração | 2 requisições |
| Emissão de token | 6 tentativas por minuto por integração; 30 por IP |
| Gerenciamento de webhooks | 10 operações por minuto por integração |
| Página de consulta | Padrão 100 registros; máximo 200 |
| Período de vendas | Até 31 dias civis inclusivos |
| Snapshot de listagem | 30 minutos |
| Log de alterações e reenvio de eventos | Retenção de 30 dias |
| Corpo enviado | Máximo de 64 KiB |
| Resposta de leitura | Máximo de 2 MiB; reduza a página quando necessário |
| Inscrições de webhook | Até 3 por integração |

Limites compartilhados também podem resultar em HTTP 429. Respeite os headers de limite e `Retry-After`, mesmo que sua integração ainda não tenha atingido a cota individual.

## Headers, saturação e retentativa do consumidor

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
Retry-After: 30
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1794398430
X-Request-Id: 11111111-1111-4111-8111-111111111111
Cache-Control: no-store
```

Os `X-RateLimit-*` são headers deste produto, não uma alegação de conformidade com um padrão de headers de limite. Em limites de concorrência, o saldo da janela pode continuar positivo. `Retry-After` indica a espera mínima. O uso de 429 segue o [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html#section-4).

Em GET, aplicar espera exponencial limitada com jitter e um orçamento de retentativas. Respeitar `Retry-After` em 429/503. Não repetir 400/403/404/410 sem corrigir a causa; em 401, renovar token no máximo uma vez. Requisições mutáveis de webhook exigem `Idempotency-Key` e não devem ser repetidas com chave nova depois de uma resposta perdida.

## Erros de recursos

Formato `application/problem+json`, baseado em [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html). `status` repete o HTTP, `code` é estável para automação e `request_id` permite suporte sem anexar dados comerciais.

| HTTP | Código de exemplo | Ação do integrador |
| --- | --- | --- |
| 400 | `INVALID_QUERY` | Corrigir filtro, janela, parâmetro duplicado/desconhecido ou cursor malformado |
| 401 | `INVALID_TOKEN` | Renovar uma vez; investigar revogação/chave se persistir |
| 403 | `INSUFFICIENT_SCOPE`, `BRANCH_NOT_ALLOWED` | Solicitar concessão correta, sem tentar outros tenants |
| 404 | `RESOURCE_NOT_FOUND` | Conferir identidade dentro do escopo |
| 405 | `METHOD_NOT_ALLOWED` | Usar o método documentado |
| 406 | `NOT_ACCEPTABLE` | Solicitar JSON suportado |
| 409 | `IDEMPOTENCY_CONFLICT` | Mesma chave com corpo diferente; não trocar para mascarar duplicidade |
| 409 | `RESOURCE_NOT_READY` | Coleção ainda pendente; observar cobertura e tentar mais tarde com backoff |
| 410 | `CURSOR_EXPIRED`, `REPLAY_EXPIRED` | Refazer bootstrap/reconciliação dentro da retenção |
| 412 | `RESOURCE_VERSION_CHANGED` | Reabrir detalhe/ETag e reiniciar coleção ou alteração de configuração |
| 413 | `REQUEST_TOO_LARGE` | Reduzir corpo enviado |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Corrigir Content-Type |
| 422 | `VALIDATION_ERROR`, `RESPONSE_TOO_LARGE` | Corrigir dados; para resposta, reduzir página/ler filhos |
| 429 | `RATE_LIMIT_EXCEEDED` | Aguardar Retry-After e reduzir concorrência |
| 500 | `INTERNAL_ERROR` | Retentativa limitada em leitura; informar request_id |
| 503 | `SERVICE_BUSY` | Backoff e Retry-After; não disparar carga paralela |
