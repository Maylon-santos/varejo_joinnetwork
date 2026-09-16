# Indicadores da Visão geral — modelos e pendências

Pedido de Maylon em 16/09/2026: usar os exemplos de resumo mensal, evento, pagamento, vendedor, marca e categoria como referência e começar pelo **Top 20 de produtos vendidos com fotos**. Maylon confirmou agrupamento por produto, somando tamanhos e cores; ordenar por peças vendidas.

## Avaliação dos modelos

Os modelos são úteis para conferir totais e explicar a composição das vendas. A Visão geral deve separar os resultados do período da posição atual de estoque e deixar claras as bases de cada percentual. O exemplo por evento deduz devolução das vendas; por isso a participação de vendas pode ultrapassar 100% do resultado líquido. O total do exemplo por tipo de pagamento difere dos quadros por evento/condição: sem conhecer o período e a natureza dos lançamentos, não é possível assumir que representam a mesma base.

As imagens são referências de apresentação, não homologação dos valores do painel. Peças dos itens podem divergir do cabeçalho em operações já sinalizadas para conferência. Não usar o saldo disponível atual para inventar estoque físico do início ou fim de um período.

## O que os dados atuais permitem

| Indicador | Apresentação e cálculo | Limite importante |
| --- | --- | --- |
| Top 20 produtos com fotos | Somar peças por `cod_produto`, reunindo cores/tamanhos; desempatar por subtotal e código. Mostrar peças, vendas distintas, subtotal e participação nas peças totais autorizadas. | Usa itens de vendas S não canceladas. Sem código, manter SKU; sem ambos, não unir itens desconhecidos. Subtotal não é faturamento líquido. |
| Fotos dos produtos | Foto persistida em um item de venda autorizado do mesmo produto/período, entregue pelo proxy autenticado; clique amplia. | Recurso `imagens:ler`. Se não houver foto ou a origem falhar, mostrar ausência; não inventar imagem. Quatro downloads simultâneos no navegador, cancelados ao trocar consulta/sair. |
| Resumo mensal | Somar a série diária do período, em centavos exatos: peças do cabeçalho, vendas distintas e valor das vendas. Total igual aos indicadores atuais. | Mês inicial/final pode ser parcial; meses sem vendas importadas não geram linha. A cobertura de sincronização continua visível. Não desconta devoluções sem regra aprovada. |
| Condição de pagamento | Agrupar o valor final da venda pela condição cadastrada, uma vez por operação. Participação sobre todas as vendas elegíveis no filtro. | Identificador estável mantém condições distintas mesmo com nomes iguais. Sem identificador, incluir em “Não informada”, com cobertura explícita. Não somar parcelas/recebimentos. |
| Participação por vendedor | Valor vendido pelo vendedor ÷ valor de todas as vendas autorizadas × 100. | Denominador calculado antes da paginação. Para acesso somente próprio, participação é relativa ao próprio escopo. Percentual sem denominador é “—”. |
| Saldo disponível atual por marca | Agrupar saldo conhecido por marca, com quantidade de SKUs, saldo ausente e negativos sinalizados. | Já desconta reservas. Produtos não classificados permanecem em “Sem classificação”. Não é estoque inicial/final nem extrato de movimentos. |
| Saldo disponível atual por categoria | Mesmo cálculo, agrupado por categoria. | Marca e categoria são cortes alternativos do mesmo estoque; não somar seus totais entre si. Saldo parcial e última atualização são explícitos. |

Todos os resultados comerciais respeitam empresa, filial, período, permissões e vendedor antes de agregar. Top 20 exige `produtos:ler` e `vendas:ler`; fotos também exigem `imagens:ler`. Resumo mensal/condições usa `indicadores:ler`; participação por vendedor usa `ranking:ler`. Estoque agrupado exige `produtos:ler` e `estoque:ler` e considera toda a filial autorizada, independentemente do período de vendas. A navegação da Visão geral mantém a exigência existente de indicadores ou ranking.

## Pendências — informação necessária por indicador

### Resumo por evento — vendas, devoluções e resultado líquido

- [ ] Obter cadastro/mapeamento de **código do evento → descrição e natureza**. Temos `evento_codigo`, mas não a descrição oficial nem a regra de sinal de todos os eventos.
- [ ] Definir quais eventos representam venda, devolução, troca, transferência, recebimento ou ajuste. Nem toda operação E pode ser tratada como devolução de venda.
- [ ] Confirmar os campos de valor/quantidade da devolução, se chegam positivos ou negativos e como se vinculam à venda original.
- [ ] Definir se a devolução entra pela data em que ocorreu ou reabre o período da venda original; tratar cancelamento da devolução e troca parcial.
- [ ] Confirmar a base do percentual: líquido após devoluções, vendas positivas ou outra referência. Valores acima de 100% podem ser legítimos na base líquida.
- [ ] Fornecer um exemplo de venda e devolução relacionadas e o resultado esperado no relatório ERP, guardando amostras comerciais na área privada. Dependência: R22 e validação R11.

### Resumo por tipo de pagamento — valores conciliados

- [ ] Identificar um código estável para o tipo de pagamento. Atualmente guardamos descrição, origem, documento, NSU, valor inicial, emissão e vencimento dos lançamentos.
- [ ] Definir quais origens/lançamentos são pagamentos da venda e quais são parcelas, títulos, adiantamentos, crédito de troca, reembolsos, taxas, juros ou troco.
- [ ] Obter identificador estável do lançamento e estado (cancelado/estornado/baixado), além do vínculo com venda/parcela. Evitar contar novamente a mesma obrigação financeira.
- [ ] Confirmar se o indicador mede valor contratado, valor efetivamente pago, recebível ou valor líquido de taxas; `valor_inicial` sozinho não resolve essas diferenças.
- [ ] Definir o filtro temporal: data da venda, emissão, vencimento ou recebimento.
- [ ] Validar venda com duas formas de pagamento e crédito parcelado. Precisamos do valor esperado por forma e do vínculo das parcelas para conciliar com o cabeçalho.

### Resumo por marca — estoque inicial, entradas, saídas e estoque final

- [ ] Obter posição histórica na abertura do período, por filial/SKU, com horário de corte. Os snapshots começaram na implantação da R19 e não reconstruem janeiro nem a abertura de dias anteriores.
- [ ] Obter contrato/endpoint de **todos os movimentos de estoque**: identidade, SKU/produto, filial de origem/destino, data/hora, quantidade, natureza, sinal, `trans_id` e cancelamento/estorno. Vendas e operações E isoladamente não comprovam todas as entradas e saídas.
- [ ] Incluir compras/recebimentos, transferências, vendas, devoluções, inventário, perdas e ajustes; validar quais alteram o saldo usado no relatório.
- [ ] Definir se o quadro é físico ou disponível. O saldo atual já exclui reservas; para conciliar disponível histórico, precisamos também do histórico das reservas/liberações, ou de snapshots compatíveis.
- [ ] Completar marca dos produtos e definir classificação na data do movimento ou classificação atual. Preservar “Sem classificação” até a cobertura estar completa.
- [ ] Homologar a equação estoque inicial + entradas − saídas = estoque final no mesmo período e base de saldo.

### Resumo por categoria — estoque inicial, entradas, saídas e estoque final

- [ ] Mesmas posições históricas e movimentos completos exigidos para marca, com a mesma base físico/disponível, cancelamentos e horários de corte.
- [ ] Completar o cadastro de categoria por produto e definir como tratar reclassificações durante o período.
- [ ] Validar se totais por categoria e marca fecham com a mesma posição geral, incluindo produtos ainda sem classificação. Não excluir linhas desconhecidas para forçar concordância.

### Faturamento bruto e líquido

- [ ] Definir o bruto: preço de tabela × quantidade, preço da venda antes de desconto ou outro campo oficial. O preço de tabela não deve ser automaticamente considerado bruto.
- [ ] Definir composição de desconto do cabeçalho, frete, cortesia, acréscimos e devoluções; reconciliar com `valor_final`.
- [x] Desconto do item já confirmado em percentual: `20` = `20%`. Não perguntar novamente nem reaplicar o desconto nos preços importados.
- [ ] Confirmar fórmulas com exemplos de venda comum, venda com ajustes e devolução. Dependência R22; conferência mensal/anual na R11.

### Cobertura do cadastro e das fotos

- [ ] Completar a classificação dos produtos em carga e revisar os cadastros que o endpoint ERP não retorna. Solicitar correção/mapeamento na origem quando necessário.
- [ ] Revisar produtos sem URL de foto ou com arquivo indisponível na hospedagem. Precisamos da imagem/URL correta associada ao código; a aplicação não substitui por foto de outro produto.
- [ ] Completar condições de pagamento do histórico (R25) e manter a quantidade sem identificação visível.

## Implementação e verificação

- `/api/v1/produtos/top?filial=ID&inicio=AAAA-MM-DD&fim=AAAA-MM-DD`: no máximo 20 produtos. Fotos são referências de itens autorizados, sem expor URLs de origem.
- `/api/v1/produtos/resumo-estoque?filial=ID`: marca/categoria, saldo conhecido, contagem desconhecida e estado de sincronização. Rejeita datas para não sugerir saldo histórico.
- `/api/v1/indicadores`: inclui condições de pagamento. Resumo mensal deriva da série diária já usada pelo gráfico, preservando centavos e o total.
- `/api/v1/ranking`: acrescenta participação no valor vendido, calculada sobre a população completa antes de paginar.
- Não exige migrations nem reimportação. Nenhuma consulta ERP de dados é disparada ao abrir os quadros; fotos usam a hospedagem já autorizada.
- Testes de integração: Top 20 entre mais de 20 produtos, variações, cancelamentos, entradas, foto do vendedor permitido, mês/condição, percentuais antes de paginar, estoque desconhecido e permissões. Navegador: fotos/ampliação, filtros, ausência de dados e desktop/celular.

## Entrega publicada — 16/09/2026

- [x] Top 20, resumo mensal, condições de pagamento, participação por vendedor e saldo atual por marca/categoria publicados na Visão geral.
- [x] 57 testes unitários e 52 de integração; interface no computador/celular, permissões e consultas públicas nas 14 filiais aprovadas. Ordenação numérica validada também no relatório anterior por SKU.
- [x] Backup `backup-20260916T041612Z-bZdNfh`; publicação somente da API, sem migrations e sem interromper o worker.
- [x] Na consulta anual de ITUPEVA em 16/09, 7 de 20 fotos carregaram. As outras 13 possuem URL, mas a hospedagem retorna **HTTP 404 (arquivo não encontrado)**, confirmado diretamente a partir do servidor. A API apresenta 502 para essa falha; os cartões mostram “Foto indisponível”.
- [ ] Corrigir as 13 imagens na origem. A relação de códigos/produtos está na central pessoal, em `docs/central/pendencias/fotos-top20-itupeva.md`, fora do Git. Contagem referente ao filtro e à data acima; pode mudar com as vendas.

Evidências: `docs/validacao-visao-geral.json`, `docs/validacao-visao-geral-ui.json`, `docs/validacao-visao-geral-producao.json` e `docs/validacao-fotos-top20.json`. As verificações técnicas não substituem a conferência mensal/anual com o ERP (R11).
