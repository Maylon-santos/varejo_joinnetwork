# Contrato de integração — levantamento técnico

## Atualização confirmada — 15/09/2026: desconto do item e estoque

Maylon confirmou: `desconto: 20` no nível do produto é **20%**. Exibir percentual, manter preços importados e não aplicar o desconto novamente. Ausência continua distinta de zero. Não extrapolar essa confirmação para ajustes do cabeçalho nem para regras ainda pendentes de bruto/líquido/devoluções (R22).

O `saldo` do estoque já desconta reservas; não subtrair reservas novamente. Contratos de produto, estoque por filial/SKU e cursor `trans_id` verificados pela Locaweb. Regras de cache, indicadores e limites em [Produtos e estoque](PRODUTOS_ESTOQUE.md); evidência em `validacao-contrato-produtos-estoque.json`. Esta atualização prevalece sobre descrições históricas de unidade desconhecida abaixo.


Atualizado em 09/09/2026. Fonte aprovada disponível: [rotas documentadas](../apis/rotas.md). Este documento registra o contrato observado e as lacunas; não declara integração testada.

## Recursos

| Recurso | Caminho relativo a `/api` | Filtros documentados | Retorno/limitações |
|---|---|---|---|
| Filiais | `/millenium!joinnetwork/varejo/listafiliais` | `cod_filial`, `filial`, `trans_id`; consulta total sem filtros | `value`, identificador `filial`, `trans_id` |
| Vendas | `/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDAS` | `filial` obrigatório; datas, código/tipo de operação e cancelamento opcionais | Exemplo atual contém itens, sem cabeçalho de venda, data, vendedor ou cursor |
| Produto | `/MILLENIUM!JOINNETWORK.VAREJO.CONSULTAPRODUTOS` | `cod_produto` ou `produto` | Cadastro e classificação; `trans_id` retornado não prova suporte a filtro incremental |
| Estoque de produto/SKU | `/MILLENIUM!JOINNETWORK.VAREJO.CONSULTAESTOQUES` | filial e produto ou SKU | Saldo, datas e `trans_id`; filtro incremental não documentado |
| Clientes | `/millenium!joinnetwork/varejo/clientes` | `cliente` | Cadastro e dados pessoais; listagem por aniversário não documentada |
| Saldo geral | `/millenium_eco/produtos/saldodeestoque` | `filial`, `trans_id` | SKU, reservas, saldo, cursor; custo nulo no exemplo |

Autenticação documentada: Basic. Usar somente no backend. Preservar a grafia dos caminhos até validar no servidor.

## Regras confirmadas por Maylon

- Venda tem `tipo_operacao = S`; o evento identifica a natureza da operação (exemplo FR-02, venda varejo cupom fiscal — franquia).
- Cada venda tem um vendedor.
- Mostrar valores bruto e líquido; suas composições ainda precisam ser esclarecidas.
- Carga inicial: 14 filiais de `config/piloto.json`, de 01/01/2026 a 09/09/2026. Após essa carga, continuar sincronizando novas operações; 09/09 não é limite permanente.

## Validações técnicas antes da importação

- [ ] Obter resposta de vendas com cabeçalho, data, vendedor, itens, cancelamento e valores bruto/líquido/descontos; atualizar o exemplo oficial local.
- [ ] Confirmar chave imutável da operação e dos itens. Não usar código do evento como chave de venda.
- [ ] Confirmar paginação, tamanho máximo de lote, ordenação, limites e se `odata.count` representa total ou página. Não assumir que uma resposta contém todo o período.
- [ ] Confirmar `trans_id` de vendas e semântica inclusiva/exclusiva do cursor nos endpoints que o suportam; testar alterações e cancelamentos tardios.
- [ ] Confirmar filtros de datas inclusivos/exclusivos e fuso, inclusive `/Date(...-180)/`.
- [ ] Validar transporte seguro e disponibilidade antes de transmitir credenciais; não houve chamada externa nesta etapa.
- [ ] Persistir lote e checkpoint atomicamente; repetir lote sem duplicar; só avançar após concluir a paginação.
- [ ] Se vendas não suportarem incremental, definir janela de reconsulta e reconciliação periódica a partir dos limites medidos.
- [ ] Definir como representar valores ausentes, números decimais, quantidades e itens sem vendedor; rejeitar/investigar inconsistências em vez de preencher silenciosamente.

## Talk

Conforme [talk.md](../apis/talk.md): POST JSON para `https://apitalk.joinnetwork.com.br/api/messages/send`, Bearer token, campos `number`, `body` e opções `userId`, `queueId`, `sendSignature`, `closeTicket`. Número deve conter país/DDD/número sem máscara. Destinatário e comportamento das opções ainda precisam ser configurados. Nenhuma mensagem foi enviada.

## Conversão e visitantes — proposta funcional para futura entrega

Começar, se aprovado, por registro manual de entradas por loja e faixa de horário, com correção auditada e orientação para não contar funcionários/reentradas como novos visitantes. Depois avaliar contador de entrada integrado; especificação e fornecedor ficam para essa etapa.

Não há medição disponível hoje. Até existir uma contagem validada, mostrar conversão como indisponível. Cupons ÷ entradas é uma proxy que deve ter esse nome; conversão de pessoas requer compradores ÷ visitantes na mesma janela e população. A futura fila pode medir atendimentos convertidos em venda, um indicador diferente de conversão de visitantes da loja.

## Atualização validada com os exemplos de Maylon — 09/09/2026

O relatório de divergências agora contém duas respostas completas de vendas fornecidas por Maylon, com cabeçalho, itens/SKU, vendedor e ajustes. O exemplo antigo de `apis/rotas.md` continua parcial; usar os campos das novas respostas como evidência complementar, sem presumir paginação ou incremental.

- `v_acerto`: valor monetário assinado do ajuste de cabeçalho; descontos observados −45,99 e −78,00.
- `acerto`: percentual do ajuste (−10 e −20 nos exemplos). Não reaplicar quando `v_acerto` já foi contabilizado.
- `v_frete` e `cortesia`: presentes e nulos nos exemplos; regra para valores preenchidos ainda não confirmada.
- Regra comprovada nesses dois casos: soma de `quantidade × preco` + `v_acerto` = `valor_final`.
- Usar centavos inteiros no cálculo; preservar o total informado pelo ERP e reportar diferenças, sem corrigi-lo silenciosamente.
- Subtotal dos itens não está automaticamente homologado como faturamento bruto: descontos de item e outras deduções exigem definição própria.

Implementação inicial isolada: `backend/src/reconciliar-venda.mjs`. Testes: `node --test backend/tests/reconciliar-venda.test.mjs`. Não há ainda servidor HTTP, conexão ao ERP, importação ou persistência. Casos com ajuste ausente, quantidade divergente ou frete/cortesia não homologados ficam explicitamente pendentes.

## Evidência de acesso — 09/09/2026

Consulta autenticada de `listafiliais` usando exatamente a base configurada por Maylon: HTTP 200, array `value` válido, uma filial retornada e ID solicitado 30098297 presente. Protocolo configurado HTTP. Validação não abrange vendas ou incremental.

## Validação real de vendas — 09/09/2026

Consulta de leitura à filial 30098297, de 06 a 07/09/2026, tipo S e cancelada F: **HTTP 200; 80 registros; `odata.count = 80`; 80 conciliações exatas**. As operações 30835456 e 30835576 retornaram os ajustes corrigidos. Nenhum ajuste ausente/nulo, nenhuma filial inesperada e nenhuma duplicidade de `(filial, cod_operacao)` neste lote.

Resposta completa de operações confirmada, com produtos, vendedor, valores e ajustes. Não foi retornado `trans_id` em nenhuma das 80 vendas; o envelope contém apenas `odata.count` e `value`. Isso não comprova que o endpoint não suporta filtro incremental ou paginação: seus parâmetros e limites ainda precisam ser validados. Igualdade de contagem nesta janela não garante completude para períodos maiores.

Evidência sem cadastros pessoais: [validacao-vendas.json](validacao-vendas.json). Script: `node --env-file=.env scripts/verificar-vendas.mjs`. A consulta não importou dados para banco, não alterou o ERP e não enviou mensagens. A conciliação prova a composição dos valores destes registros, não a definição comercial de bruto/líquido nem regras para devoluções, frete ou cortesia.

## Chave e sequência confirmadas na análise — 09/09/2026

Maylon definiu a chave da operação como **(cod_operacao, tipo_operacao, filial)**, dentro do banco do tenant. Os scripts passam a usar essa combinação para detectar duplicidades.

Consulta de ITUPEVA de 01 a 08/09/2026: 159 operações, sendo **154 vendas S e 5 entradas E**; nenhuma chave composta repetida. Separando por tipo e filial, não houve ID de uma data posterior menor que ID de data anterior. As inversões observadas ao misturar tipos eram entre sequências S e E. A resposta da API não está ordenada por código e há saltos na numeração do conjunto.

Isso indica crescimento por data nessa amostra, mas não prova sequência global, ordem de criação nem suporte a filtro “maior que”. A chave composta identifica a operação; não substitui cursor de atualização. Alterações e cancelamentos antigos ainda exigem reconsulta/reconciliação.

- [ ] **Maylon / ERP:** confirmar se `cod_operacao` é sempre crescente dentro de tipo e filial e se existe filtro para códigos maiores que o último importado. O filtro documentado de código exato não comprova essa capacidade.

Evidência: `docs/sequencia-cod-operacao.json` (na raiz do projeto).

## Atualização — cancelamentos em fluxo separado (09/09/2026)

- [x] **Maylon:** confirmar código crescente por tipo + filial. Essa confirmação está encerrada.
- [x] **Responsável técnico:** validar `LISTAVENDASCANCELADAS` com filial e datas: HTTP 200, operação 30836007/S retornada. Filial obtida do contexto da consulta, pois não vem no corpo.
- [x] **Responsável técnico:** preparar processamento idempotente de cancelamentos e testar repetição, isolamento de chaves, cancelamento antes da venda e rejeição de lote inválido. Total: 11 testes aprovados incluindo reconciliação.
- [ ] **Maylon:** confirmar se as datas do endpoint filtram `data_cancelou`. Pergunta apresentada durante a validação.
- [ ] **Responsável técnico:** integrar jobs independentes de novas operações e cancelamentos, com checkpoint persistente, sobreposição de datas, atualização dos indicadores e recuperação após falhas. Ainda não implementados o banco e o agendador.
- [ ] **Maylon / ERP:** informar suporte/parâmetro de filtro de código maior que o último e paginação/limites. Código crescente já confirmado não precisa ser validado novamente.

Plano detalhado: `docs/SINCRONIZACAO_VENDAS.md` na raiz do projeto. A solução está adequada para o fluxo de cancelamentos, condicionada à semântica do filtro pela data do cancelamento.

## Filtros de cancelamento confirmados — 09/09/2026

- [x] **Maylon:** disponibilizar `data_caninicial` e `data_canfinal`, específicos da data de cancelamento. Esta pendência está encerrada; não usar os filtros de data da venda para o job de cancelamentos.
- [x] **Responsável técnico:** validar consulta real com ambos os filtros em 09/09/2026: HTTP 200, cancelamento 30836007/S retornado. O endpoint agora também retorna `filial = 30098297`; validar contra a filial solicitada. Evidência atualizada em `docs/validacao-cancelamentos.json`.
- [x] **Responsável técnico:** implementar conector e ciclo em `backend/src/sincronizar-cancelamentos.mjs`, com validação de período/filial, recusa de resposta explicitamente incompleta, retomada com sobreposição e checkpoint solicitado apenas depois da gravação dos eventos.
- [x] **Responsável técnico:** executar 15 testes, todos aprovados. Incluem filtros novos, retorno fora do período, paginação indicada, retomada após intervalo e ordem de gravação.
- [ ] **Responsável técnico:** implementar adaptador PostgreSQL com transação real, isolamento por tenant, bloqueio de ciclos concorrentes e agendador. O ciclo atual depende de um repositório injetado; os testes não comprovam rollback de um banco real. Nenhum polling contínuo foi ativado.
- [ ] **Maylon:** preencher `CONTROL_DATABASE_URL` e `TENANT_DATABASE_URL` no `.env` para a conexão persistente, ou indicar que o PostgreSQL deve ser provisionado localmente. As duas variáveis ainda estão vazias.

As observações anteriores sobre filtros de datas ainda indefinidos e ausência de filial no retorno foram superadas por esta validação. Limites/paginação geral e busca de novas operações por código maior continuam em aberto; uma resposta completa de um evento não comprova limites gerais.
