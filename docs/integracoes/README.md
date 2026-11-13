# API de Integrações

Referência para integrar sistemas a dados de vendas, filiais, produtos e estoque. A API oferece consultas REST, acompanhamento incremental de alterações e notificações de vendas por webhook.

## Endereço e versão

```text
https://api-varejo.aeropostale.joinnetwork.com.br
```

Os recursos utilizam o prefixo `/v1`. A especificação [OpenAPI 3.1](../../apis/integracoes.openapi.json) descreve parâmetros, esquemas e respostas do contrato 0.1.0. Os exemplos usam dados fictícios.

## Primeiros passos

1. Solicite uma credencial de integração, com as filiais e os escopos necessários ao seu sistema.
2. Gere um par de chaves RSA de pelo menos 2048 bits. Mantenha a chave privada no seu serviço e registre a chave pública e seu identificador `kid`.
3. Gere uma prova `private_key_jwt` e obtenha um token em `POST /oauth/token`.
4. Envie o token no header `Authorization: Bearer` das consultas.
5. Percorra as páginas e armazene a versão de cada recurso. Para atualização contínua, utilize o log de alterações.

A disponibilidade de webhooks depende da habilitação da integração e da verificação do destino HTTPS. Configure o recebimento e valide a assinatura antes de ativar uma inscrição.

## Escolha do fluxo

| Necessidade | Recurso indicado |
| --- | --- |
| Consultar um registro ou período | Consultas REST |
| Carregar dados pela primeira vez | Listagens paginadas e checkpoint inicial |
| Manter uma base atualizada | Log incremental de alterações |
| Receber notificações de vendas | Webhooks assinados, com reconciliação pelo log |

As consultas comerciais são de leitura. O gerenciamento de webhooks altera somente as inscrições da própria integração.

## Referência

| Guia | Conteúdo |
| --- | --- |
| [Autenticação](autenticacao.md) | Credenciais, JWT, escopos, limites e erros |
| [Consultas REST](consultas.md) | Rotas, filtros, paginação e interpretação das respostas |
| [Sincronização](sincronizacao.md) | Carga inicial, cursores e atualização incremental |
| [Webhooks](webhooks.md) | Inscrições, assinatura, recebimento e reenvio |
| [Dicionário de campos](dicionario.md) | Tipos, presença, formatos e valores aceitos |

## Convenções

Identificadores e versões são strings; preserve seu valor integral. Valores monetários são strings inteiras em centavos de BRL. Saldos são strings decimais. Utilize aritmética exata para esses valores.

Datas civis seguem `YYYY-MM-DD`, no fuso `America/Sao_Paulo`. Instantes seguem RFC 3339, com indicação de fuso. Campos nulos, omitidos e coleções vazias têm significados distintos, descritos em cada recurso.

Respostas podem receber novas propriedades. Implemente o consumidor para tolerar campos adicionais e mantenha credenciais fora de logs. Em solicitações de suporte, informe o `X-Request-Id` da resposta.
