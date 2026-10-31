# Tipo do produto pelo cadastro

Implementação em 31/10/2026, após confirmar `tipo_prod: AC` no retorno de `MILLENIUM!JOINNETWORK.VAREJO.CONSULTAPRODUTOS` e receber autorização para classificar e reprocessar o estoque.

## Origem e regra

- Saldo continua vindo de `millenium_eco/produtos/saldodeestoque`, com filial e trans_id. Nenhum filtro tipo_prod é enviado ao ERP.
- Tipo principal vem do cadastro consultado por **produto**, ID interno. Persistido em `cadastro_produtos.tipo_prod` pela migration aditiva 018; todas as cores/tamanhos/SKUs usam o vínculo `estoque_atual.produto = cadastro_produtos.produto`.
- Tipo efetivo é `COALESCE(cadastro.tipo_prod, estoque.tipo_prod)`: cadastro confirmado tem prioridade e o retorno do saldo continua como alternativa. Se ambos estiverem ausentes, permanece **Tipo não informado**; nunca presumir AC pelo nome/categoria.
- Filtros, contagem de desconhecidos, lista, paginação e total de saldo usam o mesmo tipo efetivo. Detalhes mostram o tipo do produto; API retorna `tipo_prod_origem` como cadastro, estoque ou null.
- Nova carga de estoque sem tipo não apaga a classificação cadastral. Falha/ausência de cadastro no ERP preserva os dados anteriores e registra retentativa; não classifica o produto por inferência.

## Reprocessamento autorizado

```sh
node scripts/reprocessar-estoque.mjs --executar
```

Executar somente no servidor, com backup prévio e worker contínuo pausado. O script adquire o mesmo lock global do worker e verifica o tenant. Recarrega integralmente as filiais autorizadas (até duas tentativas por filial), preservando maior cursor e a posição anterior em falha. Consulta uma vez cada produto distinto presente nessas filiais, em lotes sequenciais de até vinte, usando o enriquecimento existente. Atualiza tipo e metadados cadastrais do ERP, sem duplicar consultas por cor/tamanho.

Resultados e falhas de cadastro ficam em `artifacts/estoque-cadastro/`, fora do Git; `ESTOQUE_RELATORIO_DIR` pode escolher uma subpasta privada dessa árvore. Campos comerciais, itens de vendas, cancelamentos e checkpoints são comparados por hash antes/depois. Não inicia worker local, não altera permissões/filiais autorizadas nem solicita envios Talk.

Cadastro não retornado ou sem tipo continua explícito na cobertura final. Produtos ausentes na recarga de estoque ficam fora da posição atual, com histórico preservado; saldo nulo, zero e negativo conservam seus significados.

## Validação e operação

73 testes unitários e 74 de integração PostgreSQL em schemas isolados. Cobrem importação AC/SE/MP/MC, ausência sem inferência, vínculo de múltiplos SKUs por produto, totais/paginação, negativos/nulos, isolamento, prioridade cadastral, alternativa do estoque, nova recarga e falhas preservando classificação. Navegador com dados sintéticos valida a origem cadastral no filtro AC e nos detalhes, saldo total, permissões e computador/celular sem transbordamento. Evidência `docs/validacao-produtos-ui.json`.

Publicação exige API e worker novos, backup e migration tenant 018 antes de iniciar os serviços atualizados. Guardar imagens anteriores. Retorno às imagens anteriores é compatível com a coluna aditiva, mas volta a filtrar somente pelo tipo do estoque. Preservar o worker remoto único e a rotina de relatórios Talk. A classificação/recarga não homologa estoque histórico, ERP financeiro, outras filiais ou cargos.
