# Autenticação, autorização e limites

> Implementado e testado isoladamente. Nenhum cliente real foi provisionado. Consulte [operação e ativação](operacao.md).

## Identidade de máquina, separada do painel

Cada integração terá seu próprio `client_id`, um tenant fixo, filiais concedidas, escopos e estado ativo/revogado. O fluxo é OAuth 2.0 Client Credentials, destinado a sistemas capazes de proteger credenciais. A autenticação do cliente será `private_key_jwt`, com prova assimétrica RS256. Isso segue a preferência por autenticação assimétrica da [BCP de segurança OAuth](https://www.rfc-editor.org/rfc/rfc9700.html#section-2.5).

São dois objetos diferentes:

| Objeto | Quem produz | Para que serve | Validade |
| --- | --- | --- | --- |
| Prova `client_assertion` JWT | Seu sistema, com a chave privada | Autenticar a troca em `/oauth/token` | No máximo 60 segundos, uso único |
| `access_token` opaco | Plataforma | Autorizar chamadas aos recursos | 900 segundos |

O token de acesso não deve ser decodificado como JWT. Não haverá refresh token nesse fluxo. Reutilize o access token em memória e solicite outro perto da expiração, com margem de 60 segundos e exclusão mútua para evitar uma tempestade de renovações.

## Cadastro e ciclo de vida de chaves

1. Um responsável interno autoriza tenant, filiais e finalidade antes da criação do cliente. Nenhum cadastro público concede acesso automaticamente.
2. A chave privada permanece no integrador; a plataforma guarda a chave pública, `kid`, datas de validade e trilha de aprovação.
3. O algoritmo aceito inicialmente será RS256; chaves RSA devem ter ao menos 2048 bits. Não aceitar `alg=none`, algoritmos simétricos ou escolha livre pelo JWT.
4. A consulta de chave ocorre no cadastro local pelo par cliente/`kid`. Não buscar `jku`/`x5u` arbitrários recebidos no token.
5. Cada ambiente tem cliente e par de chaves próprios. Troca planejada aceita duas chaves públicas durante até 24 horas; comprometimento exige revogação imediata, sem período de tolerância.
6. A política administrativa inicial propõe revisão de acesso a cada 90 dias e rotação planejada de chaves em até 180 dias. São parâmetros do produto, a confirmar operacionalmente; não exigências dos RFCs.

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

O servidor verificará assinatura, cliente ativo, chave válida, público pretendido, janela temporal e uso único de `jti`. A tolerância de relógio aplicada é de 30 segundos; `jti` deve ficar bloqueado por pelo menos 120 segundos após o aceite. Renovar a prova em retentativas do token. Rejeitar reutilização mesmo quando o pedido anterior terminou sem o consumidor receber a resposta.

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

As respostas do token terão `Cache-Control: no-store`. Falhas usam o formato OAuth, por exemplo `{"error":"invalid_client","error_description":"Autenticação do cliente inválida"}`. Não detalhar se o cliente ou `kid` existe. O recurso protegido usa outro envelope de erro, descrito abaixo.

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

O pedido de token não amplia permissões. Escopo desconhecido ou fora da concessão resulta em `invalid_scope`, sem concessão parcial silenciosa. O tenant é resolvido pelo cadastro da credencial. Um `tenant_id` enviado em header/query/body não troca de banco ou de tenant e será rejeitado como parâmetro não suportado.

Toda consulta, página, replay e entrega de webhook revalida cliente ativo, escopos e filiais atuais. Filtrar depois de carregar dados de todos os tenants não é aceitável. Os filtros entram na própria consulta ao banco e na seleção do outbox. A identidade do cliente será propagada de forma confiável à camada de dados.

Filial explicitamente não concedida resulta em 403. Um objeto que não exista dentro do escopo concedido resulta em 404, sem revelar sua existência em outra filial ou tenant. A lista retorna somente recursos autorizados. Revogar filiais invalida cursores anteriores e cancela entregas pendentes que perderam autorização.

## Administração e trilha de acesso

O [console de integrações](administracao.md) implementa gestão delegada por tenant, clientes, concessões, chaves públicas, auditoria e métricas. O acesso humano exige habilitação explícita, senha e TOTP; é separado do OAuth de máquina. O papel global SuperAdmin continua evolução. Ver [operação](operacao.md).

## Tokens e revogação

O access token deverá ter pelo menos 256 bits aleatórios, armazenado no servidor somente por hash. A autorização será consultada a cada requisição; no desenho inicial não haverá cache que mantenha acesso após revogação. Em múltiplas instâncias, o estado precisa ser compartilhado. Uma chamada já autorizada/em execução pode terminar; novas chamadas e entregas devem falhar após a revogação confirmada.

Chaves de criptografia, tokens do ERP e credenciais dos bancos nunca aparecerão na API externa. Tokens não serão aceitos em URL, cookie ou corpo de consulta. Consumidores de navegador devem acessar seu próprio backend; a chave privada não pertence a JavaScript de frontend ou aplicativo distribuído.

Mutual TLS e tokens vinculados ao certificado podem ser acrescentados em uma fase posterior de maior exigência. Não são capacidades implementadas ou requisitos ocultos nos exemplos da primeira versão.

## Política inicial de limites

Os valores abaixo formam uma configuração de partida, não um teste de capacidade do servidor. Todos os limites aplicáveis são cumulativos; atingir qualquer um bloqueia a operação. Homologação de carga deverá confirmar ou reduzir estes números antes de produção.

| Dimensão | Limite aplicado | Comportamento |
| --- | --- | --- |
| Leituras por cliente | 60 por minuto, burst de 10 | Bucket compartilhado entre rotas e tokens do cliente |
| Leituras por tenant | 120 por minuto | Um integrador não ocupa todo o tenant |
| Leituras por instância | 240 por minuto | Proteção adicional da capacidade compartilhada |
| Concorrência por cliente / tenant / instância | 2 / 4 / 8 requisições | 429 quando a admissão não estiver disponível |
| Tráfego por IP real de integração | 120 por minuto | Defesa adicional; não substitui limite por identidade |
| Token endpoint | 6 tentativas/minuto por cliente e 30/minuto por IP | Inclui falhas; evita trabalho criptográfico sem limite |
| Administração de webhook | 10 operações/minuto por cliente | Também respeita os limites gerais |
| Tamanho da página | Padrão 100, máximo 200 | Não fazer expansão de coleções em listas de vendas |
| Período de vendas | Até 31 dias civis inclusivos | Dividir mês/ano em janelas; não disponibilizar varredura ilimitada |
| Busca de produtos | 2 a 100 caracteres | Consulta parametrizada e índices próprios |
| Snapshot de listagem | 30 minutos | 410 após expiração; reiniciar a janela |
| Retenção do log/replay | 30 dias | 410 quando a continuação saiu da retenção |
| SQL / HTTP | 3 / 10 segundos | Cancelar consulta ao abortar cliente e devolver erro controlado |
| Corpo de administração / resposta de leitura | 64 KiB / 2 MiB | Não truncar dados; reduzir página ou separar filhos |
| Inscrições por cliente | 3 destinos | Ativação somente após verificação |
| Entrega webhook | 1/s por destino, uma chamada em voo por destino | Worker isolado com até 2 entregas concorrentes no início |

O limitador externo precisa de contador compartilhado/atômico entre instâncias, evitando que vários tokens multipliquem a cota do mesmo cliente. Falha no mecanismo de admissão retorna 503 com espera; não deve abrir acesso sem limite. O número de conexões e pool de leitura precisa ser separado do painel/worker; iniciar com pool total de quatro conexões para o serviço externo e fila de admissão limitada.

O IP só pode vir da conexão confiável ou de cabeçalho reescrito por proxy conhecido. Não confiar em `X-Forwarded-For` arbitrário. Os atuais limites em memória por IP do painel não implementam a política externa.

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

Eventos pessoais, bodies, tokens e assinatura não devem ser registrados integralmente em observabilidade. Registrar identidade da integração, rota parametrizada, request_id, duração, status e decisão de autorização. A política de retenção dos metadados de auditoria deve ser aprovada antes da operação; 90 dias é uma proposta inicial, não declaração de conformidade legal.
