# Operações para conferência — quantidade e valor dos itens

A carga inicial de ITUPEVA foi importada até 09/09/2026. As cinco operações abaixo foram preservadas com status `quantidade_divergente`. O importador não removeu itens nem ajustou totais automaticamente.

Todas são do tipo S e da filial 30098297. “Diferença monetária” significa soma dos itens + ajuste do cabeçalho − valor final informado pelo ERP.

| Data | Operação | Quantidade cabeçalho | Quantidade itens | Total ERP | Diferença monetária |
|---|---|---:|---:|---:|---:|
| 2026-05-19 | 30816297 | 3 | 5 | R$ 509,97 | R$ 299,98 |
| 2026-05-24 | 30817402 | 4 | 6 | R$ 619,96 | R$ 199,98 |
| 2026-06-27 | 30824570 | 2 | 3 | R$ 324,94 | R$ 399,90 |
| 2026-06-28 | 30824900 | 2 | 3 | R$ 337,50 | R$ 167,50 |
| 2026-07-07 | 30826165 | 8 | 10 | R$ 1.499,83 | R$ 579,80 |

- [x] **Maylon / ERP:** operações confirmadas como erros do ERP em registro de 10/09/2026 (horário de São Paulo). Evidência: [validacao-erros-erp.json](validacao-erros-erp.json). O painel identifica `erro_erp_confirmado` e mantém quantidades e valores do cabeçalho. A classificação original `quantidade_divergente` permanece armazenada para rastreabilidade. Não foi comprovada correção do retorno dos itens na origem.

Após correção, reconsultar especificamente essas datas. Elas são anteriores à janela recente do worker, portanto não serão atualizadas apenas pelo polling normal. O histórico importado não equivale à homologação final dos indicadores.

**Resposta de Maylon:**
