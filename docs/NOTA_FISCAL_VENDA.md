# Nota fiscal nos detalhes da venda

Publicado no piloto em 11/11/2026.

Em **Movimentações → Ver detalhes** e **Conferência → Ver detalhes**, a seção **Nota fiscal** mostra:

| Campo da LISTAVENDAS | Rótulo | Persistência em `operacoes.complementos` |
| --- | --- | --- |
| `numero_nota` | Número da nota | `nota_fiscal.numero_nota` |
| `modelo` | Modelo | `nota_fiscal.modelo` |
| `idnfe` | IDNFE | `nota_fiscal.idnfe` |
| `status` | Status da nota (ERP) | `nota_fiscal.status` |

O retorno real usa nomes em minúsculas. Consulta de leitura a ITUPEVA em 10/11/2026 confirmou os quatro campos em cinco operações: número/modelo numéricos, IDNFE textual e status nulo em todas. Evidência agregada, sem identificadores fiscais ou clientes: `validacao-fonte-nota-fiscal.json`. Repetir com `node --env-file=.env scripts/verificar-fonte-nota-fiscal.mjs`; `NOTA_FISCAL_FILIAL` e `NOTA_FISCAL_DIA` permitem escolher a amostra.

Identificadores são salvos como texto, preservando zeros à esquerda recebidos como texto e a precisão do IDNFE. Números sem precisão inteira, objetos e textos acima de 500 caracteres são rejeitados. Campo nulo/vazio aparece como **Não informado**; uma operação antiga sem o grupo fiscal aparece como **Aguardando importação**. O status é mostrado como recebido, sem mapear códigos para autorizado/cancelado nem alterar a situação da venda. Nenhum acesso a SEFAZ, DANFE ou interpretação do IDNFE foi acrescentado.

Novas importações e reprocessamentos trazem os campos pela LISTAVENDAS existente. O preenchimento gradual de complementos passa a selecionar também operações sem `nota_fiscal`, respeitando lotes de até três dias por filial, espera e retentativa existentes. Em operações já preenchidas, acrescenta somente grupos ausentes: preserva pagamentos, frete/cortesia existentes, valores, itens, cancelamentos e checkpoints. Preenchimento exclusivamente fiscal preserva também a conciliação. Cabeçalho ou itens divergentes bloqueiam a atualização para revisão. Reprocessamento Admin continua disponível para buscar versões posteriores da nota.

Os dados ficam no JSONB existente, sem migration ou novas rotas. A API mantém autorização de filial/vendedor; abrir detalhes consulta somente o banco do tenant. O layout quebra identificadores longos no celular e usa texto seguro, sem interpretar HTML.

Validação: 74 testes unitários, 76 testes de integração em PostgreSQL 16 temporário/isolado, Chrome sintético em 1280/390 px e regressão da cortesia zero. Evidências: `validacao-nota-fiscal.json` e `validacao-nota-fiscal-ui.json`. A validação local não comprova publicação nem preenchimento do histórico de produção.

Para publicar, seguir `deploy/README.md`: construir API/worker atualizados, preservar imagens anteriores, pausar ambos para backup coordenado, publicar API saudável e retomar somente o worker remoto. Nenhuma migration ou alteração de banco/Nginx/rotina Talk é necessária. O histórico será preenchido gradualmente; nulidade do status não deve ser interpretada como autorização fiscal.


## Publicação validada — 11/11/2026

Publicado e validado em **11/11/2026**, backup `backup-20261111T122541Z-Gpm2lu` e imagens de retorno preservadas. Saúde, login, 15 filiais, conteúdo fiscal e computador/celular conferidos. Hashes de vendas, itens, cancelamentos e checkpoints iguais na troca; amostra fiscal preservou também pagamentos, frete/cortesia e conciliação. Worker remoto retomado e local desativado; outros serviços e timer Talk preservados. Evidência: `validacao-nota-fiscal-producao.json`.

Amostra dirigida de ITUPEVA em 10/11 preenchida pela rotina existente, com o worker contínuo pausado e comparação dos hashes antes/depois. O restante do histórico segue os lotes automáticos; esta entrega não declara cobertura fiscal completa. A configuração privada, o Nginx e os serviços vizinhos foram preservados. A última execução dos relatórios diários já estava com falha antes da publicação; o timer segue ativo, sem reenvio manual.

Conferência posterior: **358 de 31.192 operações** com grupo fiscal, 30.834 ainda aguardando. O worker segue ativo sem reinícios; há retentativas por validação de cliente e divergência de itens, além de outros códigos sem diagnóstico nesta entrega. Não forçar preenchimento de operações divergentes.
