# Webhooks de vendas

## Eventos e conteúdo

| Tipo | Quando é emitido | O que não significa |
| --- | --- | --- |
| `venda.importada` | Primeira disponibilização de uma operação S | Não confirma que a venda ocorreu naquele instante |
| `venda.atualizada` | Atualização dos dados da venda | Não é uma nova venda ou nova receita |
| `venda.cancelada` | Atualização da situação para cancelada | Não é estorno financeiro ou cancelamento fiscal confirmado |
| `webhook.teste` | Teste assinado do destino | Não corresponde a operação comercial |

As inscrições de venda abrangem operações S. O contrato da inscrição inicial não possui filtro para solicitar operações E; portanto E não será disparado por webhook na primeira versão. O log e as consultas REST podem tratar E explicitamente. O evento preserva `tipo_operacao=S` para identificação completa, sem classificar E como devolução.

O evento de venda contém UUID, tipo, versão do schema, instante de publicação, revisão da venda, origem da carga, campos públicos alterados e um cabeçalho mínimo. Não envia clientes, nomes, contatos, textos pessoais ou todas as linhas de itens/pagamentos. Consulte a venda pela URL relativa protegida para obter seus detalhes. Essa escolha limita exposição e tamanho, mantendo o recebimento simples.

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "tipo": "venda.atualizada",
  "schema_version": "1.0",
  "criado_em": "2026-11-11T12:00:00Z",
  "recurso_versao": "12",
  "origem_carga": "continua",
  "campos_alterados": ["nota_fiscal"],
  "data": {
    "id": "vnd_1001_S_900001",
    "filial_id": "1001",
    "cod_operacao": "900001",
    "tipo_operacao": "S",
    "cancelada": false,
    "quantidade": 2,
    "valor_final_centavos": "18000",
    "consulta_url": "/v1/vendas/vnd_1001_S_900001"
  }
}
```

Os bytes do corpo permanecem imutáveis entre tentativas e reenvios do mesmo evento. A assinatura e seu timestamp são novos em cada tentativa. A consulta pode devolver uma revisão mais recente; aplicar a revisão efetivamente recebida sem regredir dados.

## Inscrição e ativação

O envio de eventos requer habilitação da integração e verificação do destino. Uma inscrição criada não inicia entregas automaticamente.

| Método | Rota | Resultado |
| --- | --- | --- |
| GET | `/v1/webhooks` | Inscrições do próprio cliente |
| POST | `/v1/webhooks` | Cria inscrição desativada e retorna segredo |
| GET | `/v1/webhooks/{webhook_id}` | Configuração sem segredo + ETag |
| PUT | `/v1/webhooks/{webhook_id}` | Substitui configuração com If-Match |
| POST | `/v1/webhooks/{webhook_id}/testes` | Enfileira teste; 202 não comprova entrega |
| POST | `/v1/webhooks/{webhook_id}/rotacionar-segredo` | Nova chave com sobreposição de 24h |
| GET | `/v1/webhooks/{webhook_id}/entregas` | Metadados, status e tentativas |
| POST | `/v1/webhooks/{webhook_id}/entregas/{entrega_id}/reenviar` | Novo ciclo do mesmo evento, dentro da retenção |

Leitura exige `webhooks:ler` e `vendas:ler`. Mudanças exigem `webhooks:gerenciar` e `vendas:ler`. Todas são restritas às inscrições do cliente autenticado. Identificadores de outra integração não dão acesso às suas entregas.

```http
POST /v1/webhooks
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: 44444444-4444-4444-8444-444444444444

{
  "nome": "Integracao demonstrativa",
  "url": "https://integrador.example.com/webhooks/joinnetwork",
  "eventos": ["venda.importada", "venda.atualizada", "venda.cancelada"],
  "filiais": ["1001"],
  "ativo": false
}
```

O fluxo exige cadastro do hostname aprovado, criação desativada, configuração do segredo no consumidor, envio do teste assinado, confirmação 2xx do teste e ativação por PUT usando o ETag atual. O teste apenas prova conectividade/posse operacional do destino e da chave naquele momento; não concede novas filiais ou escopos.

Alterar URL ou ampliar filiais exige nova validação e, se necessário, aprovação. Não permitir uma inscrição ativa apontar para URL não verificada. Desativação é feita por PUT com `ativo=false`, preservando auditoria e histórico de entregas.

## Idempotência das operações

Toda operação mutável exige `Idempotency-Key` UUID, vinculada a cliente, método, rota e hash do corpo canônico. Repetição idêntica retorna o mesmo resultado por 24h; corpo diferente na mesma chave gera 409. Para PUT e rotação, também exigir `If-Match` da configuração.

Na repetição idempotente, o resultado anterior é resolvido antes de rejeitar o ETag antigo, pois aquela alteração já pode ter sido concluída. Em uma operação nova, ETag divergente gera 412. Esse detalhe evita que uma resposta perdida transforme uma criação em duplicidade ou uma rotação em perda de chave.

O segredo é retornado somente na resposta de criação/rotação, incluindo a reprodução idempotente autorizada por até 24h. Não aparece em GET, logs ou listagens.

## Assinatura

Adota-se o formato [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md): headers `webhook-id`, `webhook-timestamp` e `webhook-signature`, com HMAC-SHA256. O segredo tem prefixo `whsec_` seguido de base64 padrão de 32 bytes aleatórios.

```text
key = base64_decode(signing_secret sem o prefixo "whsec_")
signed_bytes = UTF8(webhook-id + "." + webhook-timestamp + ".") + raw_body
digest = HMAC_SHA256(key, signed_bytes)
webhook-signature = "v1," + base64_encode(digest)
```

```http
POST /webhooks/joinnetwork HTTP/1.1
Content-Type: application/json
webhook-id: 22222222-2222-4222-8222-222222222222
webhook-timestamp: 1794398400
webhook-signature: v1,ASSINATURA_BASE64_DEMONSTRATIVA
```

Na rotação, o header pode ter duas assinaturas separadas por espaço, uma por chave em sobreposição. Tentar cada assinatura `v1` contra as chaves configuradas e aceitar somente um match de tamanho correto, com comparação em tempo constante.

O timestamp deve ser um inteiro em segundos e ficar a até 300 segundos do relógio do consumidor, inclusive no futuro. O consumidor deve sincronizar o relógio. Um replay legítimo após dias recebe timestamp novo, mas mantém evento/payload; a checagem temporal não elimina a necessidade de deduplicar o ID.

## Receber de forma durável

1. Aplicar limite de 64 KiB ao corpo e ler os bytes originais, antes de parsear JSON. Na primeira versão, não usar compressão de request no webhook.
2. Validar presença/formato dos headers, timestamp e assinatura sobre os bytes exatos. Não reserializar JSON para verificar.
3. Parsear o evento e verificar `id` igual a `webhook-id`, tipo/schema aceitos e filial esperada.
4. Abrir transação no banco local. Inserir evento numa inbox com unicidade por inscrição/origem + event_id e enfileirar trabalho durável na mesma transação.
5. Commitar e só então responder 204/200/202. Se o evento já existir, confirmar 2xx sem criar novo efeito.
6. Processar em background, buscar a venda com token próprio e aplicar somente revisão maior.

O prazo total da requisição é de dez segundos; o consumidor deve buscar responder em até dois. Não executar processamento demorado ou disparar efeitos externos antes da confirmação durável. Se a inbox não puder ser persistida, responder 503. Confirmar 2xx antes de persistir pode perder a notificação definitivamente.

Exemplos verificáveis: [verificador Node.js](exemplos/verificar-webhook.mjs), [verificador Python](exemplos/verificar_webhook.py) e [inbox SQL](exemplos/inbox.sql). Os verificadores demonstram apenas autenticação; a transação/inbox e a fila precisam ser implementadas no seu serviço. Não usar um Set em memória como garantia de idempotência em produção.

## Entrega, ordem e retentativas

A entrega segue o modelo **pelo menos uma vez**, dentro da retenção e do orçamento de tentativas. Isso permite duplicatas; não promete entrega se o destino ficar indisponível além desse orçamento. Não há garantia de ordem global ou por venda. Aplicação por revisão e reconciliação pelo log são obrigatórias para consistência.

O ciclo possui até dez tentativas, contando a primeira imediata. As seguintes ocorrem aproximadamente em 1 min, 5 min, 15 min, 1 h, 3 h, 6 h, 12 h, 24 h e 48 h desde o início, com jitter de até 20% e teto operacional de 72 horas. Os intervalos podem variar conforme a disponibilidade do destino e os limites aplicados.

| Resultado do consumidor | Ação do emissor |
| --- | --- |
| 2xx | Marcar como aceita; comprova aceite HTTP, não processamento comercial |
| Timeout, falha de transporte, 408, 425, 429 ou 5xx | Reenfileirar dentro do orçamento |
| 429/503 com Retry-After | Respeitar espera, limitada a uma hora por indicação e combinada com o atraso programado |
| 400, 404, 405, 413, 415, 422 e demais 4xx | Falha permanente da tentativa; corrigir destino/payload antes de replay |
| 401/403 | Pausar inscrição para revisar segredo/permissão; manter evidência segura |
| 410 | Desativar destino encerrado |
| 3xx | Não seguir redirecionamento; exigir revisão da URL e novo teste |

O circuito do destino abre após dez falhas transitórias consecutivas e suspende novas chamadas por um minuto, com aumento até cinco minutos se a falha persistir. Eventos continuam duráveis na fila. Recuperação do circuito não reinicia o orçamento de tentativas de cada entrega.

Cada destino recebe até uma chamada por segundo, com uma entrega em andamento por vez. Mantenha o recebimento rápido e encaminhe o processamento para uma fila local.

## Replay e retenção

Eventos ficam disponíveis para reenvio por 30 dias. Ao reenviar, revalidar cliente, escopos, filiais e destino verificado. O ID do evento e seus bytes não mudam; a entrega tem novo ciclo, timestamp e assinatura.

Uma entrega aceita não deve ser reenviada automaticamente só porque o consumidor não terminou seu trabalho. O consumidor controla sua fila local. Replay manual utiliza chave idempotente e é uma ação explícita, auditada. Depois da retenção, responder 410 e orientar reconciliação/carga pela API, sem fabricar evento antigo.

## Requisitos do destino

Use uma URL HTTPS na porta 443, com certificado válido e hostname previamente autorizado. A URL não pode conter credenciais, query string ou fragmento. Endereços IP literais e destinos de redes privadas, locais ou reservadas não são aceitos.

Redirecionamentos não são seguidos. Alterações de URL exigem novo teste de conectividade e assinatura. O segredo HMAC é exclusivo do webhook; não utilize o token OAuth como credencial do destinatário.
