# Sincronização incremental

Utilize listagens para a carga inicial e o log de alterações para manter os dados atualizados. Webhooks podem antecipar notificações de vendas; o log permite recuperar alterações e reconciliar o estado local.

## Cursores e validade

| Tipo | Uso | Validade | Recuperação |
| --- | --- | --- | --- |
| Listagem | Percorrer uma consulta com filtros fixos | Snapshot de 30 minutos | Reiniciar a consulta após HTTP 410 |
| Alterações | Continuar a partir de um checkpoint | Retenção de 30 dias | Refazer a carga inicial após HTTP 410 |

Cursores são opacos e vinculados à credencial, às permissões e aos filtros. Não os decodifique nem altere seus componentes. Mantenha os mesmos parâmetros durante a paginação. Uma redução de permissões pode invalidar a continuação.

## Carga inicial

Execute o fluxo para cada recurso e filial autorizada:

1. Obtenha o checkpoint inicial com `GET /v1/alteracoes?recurso=vendas&filial_id=1001&posicao=atual`. A resposta não contém eventos; guarde `paginacao.cursor_proximo` como C0.
2. Leia todas as páginas do recurso. Para vendas, divida o período em janelas de até 31 dias civis.
3. Grave os registros por identidade e versão, aceitando somente versões superiores às já armazenadas.
4. Consuma o log desde C0 até receber `tem_mais=false`. Esse passo recupera alterações ocorridas durante a carga.
5. Salve a continuação somente após persistir os registros da página. Mantenha um checkpoint independente por recurso e filial.

Conclua o processo dentro da retenção do log. Se o checkpoint expirar, reinicie a carga e reconcilie os dados locais.

## Consultar alterações

```bash
curl --get "$BASE/v1/alteracoes" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode 'filial_id=1001' \
  --data-urlencode 'recurso=vendas' \
  --data-urlencode "cursor=$CURSOR_SALVO" \
  --data-urlencode 'limite=100'
```

Use `posicao=atual` apenas para obter o checkpoint inicial. Nas chamadas seguintes, envie `cursor` e omita `posicao`. Os parâmetros são mutuamente exclusivos. O escopo exigido corresponde ao recurso consultado: `vendas:ler`, `filiais:ler`, `produtos:ler` ou `estoques:ler`.

O log retorna `cursor_proximo` mesmo sem novidades. Quando `tem_mais=false`, salve a continuação e aguarde pelo menos 60 segundos antes de consultar novamente. Esse intervalo é uma recomendação de polling, sem garantia de latência de atualização. Quando houver mais páginas, prossiga dentro dos limites da credencial.

Veja um [exemplo de resposta](exemplos/alteracoes.json) e o [consumidor em Node.js](exemplos/consumir-alteracoes.mjs).

## Ações e versões

| Ação | Tratamento |
| --- | --- |
| `upsert` | Consultar o recurso e incluir ou atualizar a versão local |
| `cancelada` | Atualizar a situação da venda, preservando sua identidade |
| `ausente` | Remover a posição atual de estoque do conjunto disponível; não gerar saldo zero ou movimento |

`versao` é uma string inteira monotônica por recurso. Compare seu valor numericamente, com precisão integral. O UUID do evento e os timestamps não substituem a versão nem o cursor.

Eventos podem se repetir ou chegar fora de ordem. Se a versão local é 12, um evento da versão 11 não deve sobrescrevê-la. Ao receber a versão 13, a consulta pode retornar a versão 14; aplique a versão efetivamente recebida.

## Consistência de coleções

Para itens e pagamentos de uma venda, obtenha o ETag do detalhe e envie `If-Match` ao iniciar a leitura da coleção. Percorra todas as páginas da mesma revisão antes de substituir o conjunto local. Em HTTP 412, reabra o detalhe e reinicie essa leitura.

Persista os dados e o checkpoint na mesma transação local, quando possível. Se o processo falhar antes de gravar a continuação, repetir a página deve produzir o mesmo estado, sem duplicar efeitos.

## Recuperação

| Situação | Ação recomendada |
| --- | --- |
| Página recebida novamente | Atualizar por identidade e versão |
| Notificação duplicada | Confirmar o recebimento sem repetir o processamento |
| Notificação fora de ordem | Preservar a versão mais recente |
| Falha temporária do consumidor | Retomar pelo último checkpoint confirmado |
| Cursor expirado | Refazer a carga inicial e reconciliar o estado local |
| Permissão revogada | Interromper o acesso ao recurso correspondente |
| Dados desatualizados | Considerar os indicadores de atualização e tentar novamente com espera |

Mantenha reconciliação periódica dentro das cotas, inclusive quando utilizar webhooks. Para acompanhar alterações, utilize o log; filtros por data de operação ou `atualizado_em` não substituem checkpoints.
