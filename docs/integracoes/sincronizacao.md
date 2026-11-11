# Carga inicial, alterações e consistência

> Cursores, snapshots, revisões e log descritos aqui são requisitos de implementação da API externa. A base atual não oferece essas garantias somente com `atualizado_em`.

## Arquitetura de leitura

O integrador consulta dados locais já importados. Nenhum GET externo deverá iniciar consulta ao ERP, reprocessamento ou recarga de estoque. A coleta continua em seu worker; a API externa terá admissão e pool próprios para preservar painel e sincronização.

```text
ERP → Coletor autorizado → Banco do tenant
                              │ transação confirmada
                              ▼
                      Projeção externa + outbox
                         │               │
                         ▼               ▼
                 GET /v1/...        Fila de webhooks
                         │               │
                         └──────→ Sistema integrador
```

Reprocessamentos, complementos fiscais/pagamentos e cancelamentos precisam passar pelo mesmo mecanismo de revisão. Alteração relevante para o contrato externo gera nova revisão, mesmo que o código da operação permaneça igual. Uma reconsulta idêntica não deve gerar novo evento somente porque `atualizado_em` ou o horário de consulta interno mudou.

## Duas espécies de cursor

| Cursor | Origem | Validade proposta | Ao expirar |
| --- | --- | --- | --- |
| De listagem | Primeira consulta por filtros | Snapshot congelado por 30 minutos | 410 `CURSOR_EXPIRED`; reiniciar a janela e fazer upsert |
| De alterações | Checkpoint inicial ou página do log | Posição ainda presente na retenção de 30 dias | 410; novo bootstrap e reconciliação |

Ambos são opacos, assinados e vinculados a tenant, cliente, recurso, filial, filtros e revisão das permissões. Não contêm segredo reutilizável. Alterar escopo, filial ou limite durante continuação da lista invalida a consulta. Uma concessão revogada não continua acessível por um cursor antigo.

Snapshot congelado exige armazenamento versionado/materialização da projeção. Não manter uma transação PostgreSQL aberta durante os 30 minutos de navegação do cliente. A ordem das vendas será crescente por data, código da operação e tipo; produtos por ID; filiais por ID; estoques/variações por SKU. O cursor resolve a posição sem OFFSET crescente.

## Bootstrap seguro

Para cada recurso e filial autorizada:

1. Obtenha o checkpoint inicial **antes** da carga: `GET /v1/alteracoes?recurso=vendas&filial_id=1001&posicao=atual`. Essa resposta não traz eventos; seu `cursor_proximo` representa o ponto inicial C0.
2. Persista C0. Cadastre/ative webhook nesse momento se desejar notificações; não aguarde terminar a carga para começar a acumular eventos.
3. Leia vendas em janelas de até 31 dias e todas as páginas de cada janela. Para estoque/produtos/filiais, percorra os snapshots correspondentes.
4. Faça upsert local por tenant + identidade do recurso, guardando a revisão externa.
5. Ao terminar as janelas, consuma o log desde C0 até `tem_mais=false`. Alterações ocorridas durante a carga não se perdem; revisões antigas não sobrescrevem as novas.
6. Salve o cursor da página somente depois de persistir seus registros. Continue polling periódico, mesmo com webhook.

Se a carga levar mais que a retenção do log, não existe garantia de recuperação por aquele C0: será necessário refazer bootstrap/reconciliação. Para volume muito maior, uma exportação assíncrona consistente pode ser desenhada em fase posterior; este contrato não promete endpoint de exportação ainda inexistente.

## Consultar alterações

```bash
curl --get "$BASE/v1/alteracoes" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode 'filial_id=1001' \
  --data-urlencode 'recurso=vendas' \
  --data-urlencode "cursor=$CURSOR_SALVO" \
  --data-urlencode 'limite=100'
```

Na primeira chamada use `posicao=atual`, sem cursor. Depois disso, cursor é obrigatório e `posicao` deve ser omitido. Os dois parâmetros são mutuamente exclusivos. O recurso determina o escopo: vendas, filiais, produtos ou estoques exigem suas permissões respectivas. Manter checkpoint independente por recurso/filial/concessão.

O log retorna o `cursor_proximo` mesmo sem novidades. Se `tem_mais=false`, persistir a continuação e esperar ao menos 60 segundos antes de novo polling. Esse intervalo é uma recomendação inicial ao consumidor, não garantia da latência da coleta. Se `tem_mais=true`, continuar respeitando a cota, sem criar dezenas de chamadas paralelas.

As ações são `upsert`, `cancelada` e `ausente`. `ausente` representa tombstone do estoque; venda cancelada continua consultável dentro do escopo. Não há exclusão física silenciosa das vendas nessa API.

## Revisão e ordem de chegada

`versao` identifica a revisão monotônica de um recurso. É uma string inteira e não o `trans_id` do ERP. IDs de eventos são UUIDs e também não servem como ordenação.

```text
Seu banco tem versão 12.
Chega evento da versão 11 → ignorar aplicação, mas registrar deduplicação.
Chega evento da versão 13 → buscar a venda atual.
A consulta já devolve versão 14 → aplicar a versão 14, não regredir para 13.
```

A notificação captura um cabeçalho mínimo daquela revisão; o GET fornece o estado atual e pode estar mais recente. Se o registro do evento aponta revisão maior que a disponível na réplica/projeção de leitura, aguardar convergência e tentar novamente; não marcar o evento como completamente aplicado com dados mais antigos.

Dentro de uma transação local do consumidor, substituir os dados daquela revisão e registrar evento/cursor. Para itens e pagamentos, terminar a coleção da mesma revisão antes de publicar a troca local. Um banco local deve guardar ao menos `resource_id`, `resource_version`, `last_event_id`, payload/projeção e o namespace da origem.

## Por que atualizado_em sozinho não resolve

O timestamp interno pode mudar em reimportações idênticas. Complementos e identidade de clientes possuem rotinas próprias; cancelamentos ficam em tabela separada. Filtrar apenas o dia da venda ou um `MAX(atualizado_em)` ignora parte dessas mudanças e pode pular transações concorrentes.

A implementação precisa produzir a revisão e um registro durável de alteração de forma atômica com a atualização da projeção. O publicador só expõe entradas confirmadas, em uma ordem segura de publicação. Uma sequência PostgreSQL obtida antes do commit pode conter lacunas/transações ainda abertas: não avançar o high-water mark cegamente para `MAX(nextval)` e perder um commit posterior com número menor. Usar publicação pós-commit serializada ou outro mecanismo que comprove essa propriedade.

## Cancelamentos tardios, fiscal e backfill

Venda importada hoje pode corresponder a um dia antigo. Nota fiscal ou pagamento preenchido depois gera `venda.atualizada`. Cancelamento efetivo muda a situação da mesma identidade, não cria receita negativa fictícia. Evento importado de uma venda já cancelada deve publicar a revisão cancelada; não anunciar venda ativa intermediária que nunca existiu na projeção confirmada.

Na carga histórica inicial, usar `origem_carga=historica`. O cadastro de webhook começa no ponto de ativação e, por padrão, não dispara milhões de vendas antigas já existentes. O consumidor recupera histórico pelo GET/log; reenvio histórico em massa precisa de uma operação explícita e controlada, fora do escopo inicial.

## Recuperação e reconciliação

| Situação | Recuperação |
| --- | --- |
| Processo caiu após salvar dados, antes de salvar cursor | Repetir página; upsert por revisão e deduplicação evitam repetição de efeito |
| Webhook chegou duas vezes | Confirmar novamente sem reaplicar efeito |
| Webhook chegou fora de ordem | Aplicar somente revisão maior |
| Consumidor perdeu vários eventos | Ler o log desde o último cursor confirmado |
| Cursor expirou | Recomeçar a janela/bootstrap, usando estado local para reconciliação |
| Permissão foi reduzida | Parar acesso aos recursos revogados; invalidar cursores e entregas |
| SKU sumiu da carga completa | Desativar a posição atual pelo tombstone; não gerar movimento/zeragem |
| Fonte está atrasada | Exibir frescor e aguardar; não preencher valores por inferência |

Programar uma reconciliação periódica de janelas recentes e de estoque completo, dentro das cotas, ajuda a detectar falhas do próprio consumidor. Ela não substitui homologação com o ERP nem permite ultrapassar a retenção prometida sem novo bootstrap.
