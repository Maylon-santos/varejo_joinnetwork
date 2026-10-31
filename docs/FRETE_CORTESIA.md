# Frete e cortesia na conferência

Implementado em 31/10/2026 após a análise da venda indicada por Maylon: cortesia numérica zero acionava `regra_pendente` mesmo com quantidade e valores conferidos. Zero explícito passa a significar ausência de cortesia. Isso não homologa cortesia não zerada, frete não zerado, bruto/líquido ou devoluções (R22).

## Regra e campos

- Cortesia ausente/nula ou zero numérico/textual decimal (`0`, `0.00`) permite a conferência normal de quantidade, preços × quantidades e ajuste, mantendo a tolerância de ±R$ 0,02. Não aprova divergências de valor/peças nem ajuste ausente.
- Cortesia não zerada e formatos não confirmados (booleanos, vazio, objetos/textos) continuam em `regra_pendente`. Frete não zerado também permanece pendente.
- Detalhes exibem **Frete** e **Cortesia**, junto dos campos atuais. Zero aparece como **Sem cortesia (0)**. Frete nulo aparece como **Não informado**, sem ser convertido em zero.
- Dados antigos sem os campos exibem **Aguardando importação**, distinguindo falta de carga de uma resposta nula do ERP.

Os campos são aditivos no JSON `operacao.complementos`: `frete_centavos` (texto de centavos ou null) e `cortesia_informada` (valor/tipo recebido ou null). Persistidos na importação normal e no reprocessamento, com a autorização de vendas já existente. **Sem migration ou alteração dos valores comerciais.** A API não consulta o ERP ao abrir detalhes.

## Histórico

O preenchimento gradual de complementos agora inclui registros sem esses dois campos. Reutiliza os lotes de até três dias por filial e a espera/backoff existentes; complementos totalmente ausentes mantêm prioridade. Não adiciona outro worker ou cron.

Em um registro já preenchido, compara cabeçalho e associa itens por identidade/quantidade/preço antes de acrescentar somente frete/cortesia. Preserva pagamentos, clientes, preços, quantidades, valores, cancelamentos e checkpoints. Uma divergência com o retorno atual interrompe o dia para revisão; não força aprovação. `regra_pendente` é recalculada somente com dados comerciais equivalentes e a regra atual. Nenhum registro antigo é liberado por presumir que o campo ausente fosse zero.

## Validação e publicação

72 testes unitários, 73 de integração PostgreSQL em schemas isolados e navegador com dados sintéticos. Cenários: zero/nulo, valores não zerados, formatos não homologados, diferenças de peças/valor, ajuste ausente, campos via API, reprocessamento e saída do filtro de pendências, preenchimento legado sem alterar pagamentos/itens e rejeição de cabeçalho divergente. Interface em 1280 e 390 px, sem erros JS ou transbordamento. Evidência: `docs/validacao-cortesia-ui.json`.

Construir API/worker atualizados. Antes de publicar, guardar imagens anteriores e fazer backup com ambos pausados, conforme `deploy/README.md`. Não requer migrations, Nginx ou dependências novas. Reprocessar a venda indicada pela rotina administrativa existente e verificar `conciliada`, campos e totais preservados. Não executar carga histórica em massa; o histórico segue gradual. Manter worker local desativado e preservar a rotina diária Talk.

Retorno: imagens anteriores compatíveis com os campos JSON aditivos; parar o worker atualizado antes de reverter. A versão anterior volta a tratar cortesia zero como pendente quando importar/reprocessar. Os campos e recibos permanecem no banco/backups.


### Publicado e verificado — 31/10/2026

API/worker publicados com backup `backup-20261031T220134Z-4D11RO` e imagens anteriores preservadas. Hashes dos campos comerciais, itens, cancelamentos e checkpoints idênticos antes/depois da troca. API saudável e worker remoto retomado; worker local desativado. Timer de relatórios Talk preservado ativo.

A venda indicada foi conferida pelo painel público: conciliada, fora do filtro de pendências, frete não informado e cortesia zero visíveis. Comparação com o snapshot privado anterior confirmou valores, peças e itens preservados. Computador/celular sem transbordamento ou erros JS. Evidência: `docs/validacao-cortesia-producao.json`; capturas comerciais permanecem em `artifacts/deploy/`, fora do Git. R22 não foi encerrada pelas composições restantes.
