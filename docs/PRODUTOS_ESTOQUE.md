# Produtos, estoque e indicadores — R19

## Regras confirmadas por Maylon

Em 15/09/2026, Maylon confirmou que `desconto` no item é **percentual**: `20` significa **20%**. A interface apresenta `%`, mas mantém os preços importados e não reaplica o desconto. Zero é um percentual informado; ausência continua desconhecida. A confirmação não define automaticamente o desconto no cabeçalho, bruto/líquido, frete, cortesia ou tratamento de devoluções (R22).

O `saldo` da consulta de estoque **já desconta reservas**. Apresentar como saldo disponível informado pelo ERP. Não subtrair `reservas`, `empenho` ou outros campos novamente. Saldos negativos são preservados e sinalizados; saldo ausente não vira zero.

## Como consultar

1. Abrir **Produtos e estoque** e escolher a loja pelo código.
2. Em **Catálogo e estoque atual**, buscar por código, nome, SKU ou código de barras; filtrar saldo positivo, zero, negativo ou não informado. A posição independe de datas de venda.
3. A lista mostra miniatura quando disponível; usar **Ver detalhes** para consultar SKU, cor, tamanho, código de barras, classificação e atualização do produto. Classificação ainda não carregada fica identificada.
4. Em **Produtos vendidos no período**, aplicar loja e datas. Produtos/SKUs são ordenados por peças vendidas, com quantidade de vendas, subtotal dos itens, desconto médio informado e cobertura.

O estoque é uma posição sincronizada, não uma reserva nem uma garantia de disponibilidade instantânea. A tela informa última atualização, falhas e posição com mais de 30 minutos. Recarregar consulta o banco local; não faz chamada ao ERP. Não há baixa, reserva ou alteração de estoque nesta entrega.

## Indicadores e limites

- Somente operações `S` não canceladas, considerando tanto a operação quanto os cancelamentos importados.
- Filial, período e vendedor autorizado são aplicados **antes** de agrupar, contar ou paginar. Vendas vê somente seus próprios resultados.
- Agrupar por SKU; quando ausente, pelo código do produto. Sem ambos, preservar a identidade do item, sem unir produtos desconhecidos.
- Peças: soma da quantidade dos itens. Vendas por produto: operações distintas que contêm aquele SKU. Somar essa coluna entre produtos pode contar a mesma venda mais de uma vez.
- Subtotal: `Σ(quantidade × preco_centavos)`, sem descontar novamente. Não equivale ao valor final do cabeçalho nem recebe o rótulo de faturamento bruto/líquido. Uma divergência original entre cabeçalho e itens continua possível.
- Desconto médio informado: `Σ(quantidade × desconto_percentual) / Σ(quantidade com desconto informado)`. Um desconto zero participa; ausência não participa. Mostrar quantas peças têm informação. Exemplo: duas peças a 20% e uma a 0% → 13,3333%; uma quarta peça sem informação não altera a média e reduz cobertura a 3/4.
- R25 acompanha complementação de preços/descontos do histórico. R11 continua aguardando conferência mensal/anual por Maylon; a publicação não representa homologação.

## Acesso

`produtos:ler` libera catálogo da filial autorizada; `estoque:ler` libera saldos e seus filtros, e depende de produtos. Indicadores também exigem `vendas:ler`. O cadastro da loja é compartilhado entre os usuários autorizados ao recurso; os resultados comerciais continuam sujeitos à restrição do vendedor. Somente Admin recebe os novos recursos automaticamente; outros cargos são configurados em **Permissões**.

## Fontes e persistência

Contrato validado por consultas de leitura na Locaweb: `docs/validacao-contrato-produtos-estoque.json`.

- `millenium_eco/produtos/saldodeestoque`: `filial` e `trans_id`. Carga inicial completa e incremental por filial; envelope e contagem conferidos, paginação não suportada é rejeitada.
- `MILLENIUM!JOINNETWORK.VAREJO.CONSULTAPRODUTOS`: `produto` interno. Classificação limitada a coleção, departamento, grupo, categoria, grade e marca. Não há contrato de cursor incremental confirmado para o cadastro; atualizar por ID com intervalo mínimo de um dia após sucesso.
- `cadastro_produtos`: código, descrição, classificação e estado de atualização.
- `estoque_atual`: filial/SKU, saldo, versão e data recebidas, presença na última carga completa.
- `estoque_historico`: observações por filial/SKU/trans_id desde o início da coleta. Não reconstrói estoque histórico anterior à implantação; não há relatório histórico de estoque nesta entrega.
- `sync_estoques`: cursor independente por filial, último sucesso, última carga completa e retentativa.

O worker prioriza vendas/cancelamentos, depois até duas filiais com estoque vencido por rodada, até cinco cadastros de produto, complementos e identidade de clientes. ERP é consultado sequencialmente. Cooldown de estoque usa o intervalo configurado (seis minutos no piloto); a frequência efetiva depende da duração da rodada. Revisita as filiais com sucesso mais antigo e aplica backoff em falhas. Não há promessa de atualização de todas as filiais a cada seis minutos.

Incremental relê `cursor - 1` para proteger a borda. Gravação de estoque/histórico e cursor ocorre na mesma transação; falhas não avançam cursor nem alteram vendas. Releitura é idempotente, versões antigas não substituem novas e mudança de saldo com o mesmo trans_id é rejeitada. Há reconciliação completa após um dia. SKU ausente nessa carga fica fora do catálogo e dos resumos atuais. O valor anterior permanece salvo para auditoria, sem fabricar zero. SKU presente com saldo null continua visível como desconhecido.

Limites de resposta: 45 segundos e 32 MiB; qualquer truncamento, filial incorreta ou SKU conflitante invalida o lote. Tokens e dados individuais não aparecem nos relatórios de validação versionados. Os backups existentes abrangem as novas tabelas.

## API e operação

- `GET /api/v1/produtos?filial=ID&busca=texto&saldo=todos&pagina=1` — 30 itens por página. Saldo: `todos`, `positivo`, `zero`, `negativo`, `desconhecido`.
- `GET /api/v1/produtos/indicadores?filial=ID&inicio=AAAA-MM-DD&fim=AAAA-MM-DD&busca=texto&pagina=1` — até 366 dias, 30 produtos por página.
- Consultas desconhecidas/duplicadas são rejeitadas. Leitura em transação consistente, com timeout e identidade do tenant conferida.
- Migrations aditivas `control/006_produtos_estoque.sql` e `tenant/011_produtos_estoque.sql`.
- Carga operacional: `scripts/sincronizar-estoques.mjs`, exclusivamente com o worker remoto pausado. Adquire o mesmo lock global e compara hashes de operações, itens e checkpoints antes/depois. Filiais com erro ficam pendentes para retomada pelo worker.
- Testes: `npm test`, `npm run test:integration`, `scripts/verificar-produtos-ui.mjs`, `scripts/verificar-complementos-ui.mjs`. Validação pública de leitura: `scripts/verificar-produtos-producao.mjs`.


## Origem e recarga pendente — 16/09/2026

A rota efetivamente em uso continua `millenium_eco/produtos/saldodeestoque`, com `filial` e `trans_id`. **Não há filtro tipo_prod na requisição**: a tentativa `tipo_prod=AC` retornou HTTP 400 por parâmetro não suportado. Os códigos foram confirmados por Maylon: AC acabado, SE serviço, MP matéria-prima e MC material de consumo.

A rota `MILLENIUM!JOINNETWORK.VAREJO.CONSULTAESTOQUES` ajustada já exclui o material de consumo informado, mas só recebe a filial e filtros pontuais: rejeitou `trans_id`, e não retorna identificação completa do produto. [Contrato a completar](../apis/estoque-custom.md). A limpeza/nova carga solicitada ainda não ocorreu. O comando `--completa` está preparado e testado localmente, aguardando origem compatível para implantação no worker. Não se deve substituir posição salva por uma resposta incompleta.

Fotos do catálogo são obtidas de itens de vendas do mesmo SKU/produto, dentro da filial/vendedor autorizados. Não há consulta ao ERP ao abrir os detalhes. Sem referência permitida, manter indicação de imagem ausente. O saldo e filtros de saldo continuam exigindo `estoque:ler`.
