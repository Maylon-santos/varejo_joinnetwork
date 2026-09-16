# Contrato para carga e atualização do estoque

## Rota e situação em 16/09/2026

Maylon ajustou `MILLENIUM!JOINNETWORK.VAREJO.CONSULTAESTOQUES` para excluir materiais de consumo. Consulta de ITUPEVA apenas com `filial` retornou 3.946 SKUs e não retornou a bobina de código `050051` / SKU `30197580_0_0_U`.

A sincronização atual usa `millenium_eco/produtos/saldodeestoque`, enviando somente **filial e trans_id**, sem filtro tipo_prod. O teste com `tipo_prod=AC` retornou HTTP 400: “Parameter tipo_prod not found in millenium_eco.produtos.saldodeestoque”. A troca permanente depende de ampliar o contrato da rota customizada: enviar `trans_id` retornou HTTP 400, “Parameter trans_id not found”. O retorno atual contém somente `trans_id`, `primeira_entrada`, `data_atualizacao`, `sku` e `saldo`.

## Tipos confirmados por Maylon

| tipo_prod | Significado |
| --- | --- |
| AC | Acabado — incluir no estoque apresentado |
| SE | Serviço — excluir |
| MP | Matéria-prima — excluir |
| MC | Material de consumo — excluir |

Não foi configurado um parâmetro que a API rejeita. O filtro `tipo_prod = 'AC'` deve ficar na consulta customizada do ERP (como informado por Maylon), ou ser exposto como parâmetro suportado por uma rota completa. A alternativa preparada abaixo é ampliar a consulta customizada, que já exclui o material.

## Entrada necessária

```text
GET /api/MILLENIUM!JOINNETWORK.VAREJO.CONSULTAESTOQUES?filial=ID&trans_id=0
```

- `filial`: obrigatória. Todos os registros precisam pertencer à filial solicitada.
- `trans_id`: inteiro, opcional com padrão zero. Zero solicita todos os SKUs elegíveis; nos incrementais, retornar os registros com `trans_id >= valor informado`.
- Aplicar o filtro de produto acabado tanto na carga completa quanto no incremental.
- Preservar saldos zero, negativos e nulos dos produtos elegíveis. Não confundir produto acabado com produto que tem saldo positivo.
- Uma resposta vazia é válida somente quando não houver registros elegíveis. Erros não devem ser transformados em listas vazias.

## Retorno esperado — exemplo fictício

```json
{
  "odata.count": 1,
  "value": [
    {
      "filial": 1,
      "produto": 9,
      "cod_produto": "CAM-EXEMPLO",
      "desc_produto": "Camiseta de exemplo",
      "sku": "9_2_0_M",
      "cor": "2",
      "tamanho": "M",
      "barra": "7890000000000",
      "saldo": 3,
      "trans_id": 20,
      "data_atualizacao": "/Date(1789516800000-180)/"
    }
  ]
}
```

Campos obrigatórios para identificação: `filial`, `produto` (ID interno), `cod_produto`, `desc_produto`, `sku`, `trans_id`. `saldo` deve existir, podendo ser null quando desconhecido. `cor`, `tamanho`, `barra` e `data_atualizacao` podem ser null quando não informados. O saldo segue a regra já confirmada: disponível, com reservas já descontadas.

Retornar o conjunto completo e `odata.count` igual à quantidade retornada. Se houver paginação, definir antes o contrato de próxima página; o importador atual rejeita respostas truncadas ou com nextLink para evitar uma limpeza incorreta.

## Validação antes da troca

1. Conferir carga completa em uma filial, campos, contagem, ausência da bobina e manutenção de saldos zero/negativos.
2. Consultar novamente com `trans_id = maior transação - 1`: nenhuma linha pode vir abaixo desse limite e a borda deve reaparecer.
3. Comparar o saldo de uma variação conhecida com o ERP.
4. Trocar a origem, fazer backup e recarga completa das 14 filiais com o worker remoto pausado. A troca da posição deve ser atômica por filial: falha preserva a cópia anterior.
5. Conferir ausência de materiais no catálogo e nos resumos atuais, preservação de vendas/checkpoints e retomada do único worker remoto.

Itens que deixam de retornar em uma carga completa confirmada ficam fora do catálogo atual. O histórico observado e as vendas permanecem preservados. Cursor continua independente por filial.
