> **Resolvido em 09/09/2026:** Maylon confirmou desconto de cabeçalho ausente no retorno anterior. Com os novos campos, ambas as operações conciliam exatamente: 459,88 + (−45,99) = 413,89; 389,98 + (−78,00) = 311,98. `v_acerto` é ajuste monetário com sinal; `acerto` é percentual e não deve ser descontado outra vez. Validação automatizada: 7 testes aprovados. Frete, cortesia, devoluções e definição final de bruto/líquido continuam sujeitos às respectivas regras.

# Operações para conferência de Maylon

09/09/2026. Extração pontual do JSON que acompanhava a pasta `teste`, feita para responder ao pedido de identificação das divergências. A pasta e seus dashboards foram desconsiderados como fonte aprovada do produto. Este registro não depende de sua permanência As respostas completas com cadastros foram retiradas desta versão para publicação no repositório. Os testes usam apenas campos monetários e quantidades, sem copiar esses cadastros.

Ambas as operações são da filial **30098297 (ITUPEVA)**, tipo **S**, evento **FR-02**, sem cancelamento na amostra. Datas convertidas para America/Sao_Paulo.

| Data | cod_operacao | Total da operação (`valor_final`) | Soma de quantidade × preço dos itens | Soma dos itens menos total |
|---|---|---:|---:|---:|
| 07/09/2026 | 30835576 | R$ 311,98 | R$ 389,98 | R$ 78,00 |
| 06/09/2026 | 30835456 | R$ 413,89 | R$ 459,88 | R$ 45,99 |

## Operação 30835576

| Produto | Quantidade | Preço unitário | Subtotal |
|---|---:|---:|---:|
| 98100201 | 1 | R$ 189,99 | R$ 189,99 |
| 98110201 | 1 | R$ 199,99 | R$ 199,99 |

## Operação 30835456

| Produto | Quantidade | Preço unitário | Subtotal |
|---|---:|---:|---:|
| 87120145 | 1 | R$ 189,99 | R$ 189,99 |
| 87130171-2 | 1 | R$ 189,99 | R$ 189,99 |
| 87138240-2 | 1 | R$ 79,90 | R$ 79,90 |

Nos cinco itens, `preco`, `preco_aplicado` e `preco_tabela` são iguais, e `desconto` é zero. Pode existir desconto no cabeçalho ou outra composição de valor não representada nos itens; isso é hipótese, não erro confirmado nem autorização para ajustar os dados.

- [x] **Maylon:** conferir estas operações no ERP e informar a origem das diferenças e o campo/regra correto de desconto.


## Correção confirmada

O desconto de cabeçalho ausente foi incorporado em `v_acerto`. As duas operações conciliam exatamente conforme as equações no início deste documento. Fixtures mínimas, sem cadastros pessoais, estão em `backend/tests/fixtures/descontos.json`.

Bruto/líquido, frete, cortesia e devoluções/trocas continuam sujeitos à definição e homologação das regras.
