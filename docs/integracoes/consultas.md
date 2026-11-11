# Consultas REST e interpretação dos dados

> Todas as rotas deste capítulo pertencem ao contrato externo proposto. Não são aliases já disponíveis da API interna do painel.

## Endereço e envelope

```text
Base: https://api-varejo.aeropostale.joinnetwork.com.br
Token: POST /oauth/token
Recursos: /v1/...
Authorization: Bearer <access_token opaco>
Accept: application/json
```

As listas usam `data`, `paginacao` e `meta`. A lista vazia é 200 com `data: []`; não é 404. `paginacao.quantidade` informa somente a página, sem um COUNT global oneroso. Não modificar ou construir um cursor. Repetir os filtros originais exatamente ao continuar a mesma lista.

```json
{
  "data": [],
  "paginacao": {"limite": 100, "quantidade": 0, "tem_mais": false, "cursor_proximo": null},
  "meta": {
    "request_id": "11111111-1111-4111-8111-111111111111",
    "gerado_em": "2026-11-11T12:00:00Z",
    "snapshot_id": "snp_demo_001",
    "snapshot_expira_em": "2026-11-11T12:30:00Z",
    "recurso_versao": null
  }
}
```

Campos de metadados e revisões são novos componentes da proposta. Os timestamps de exemplo não devem ser usados como relógio para autenticação real.

## Catálogo de rotas

| Método | Rota | Escopo mínimo | Finalidade |
| --- | --- | --- | --- |
| POST | `/oauth/token` | Prova private_key_jwt | Obter access token |
| GET | `/v1/filiais` | `filiais:ler` | Filiais concedidas, paginadas |
| GET | `/v1/filiais/{filial_id}` | `filiais:ler` | Cadastro pontual |
| GET | `/v1/vendas` | `vendas:ler` | Cabeçalhos por filial/período |
| GET | `/v1/vendas/{venda_id}` | `vendas:ler` | Cabeçalho, fiscal e cobertura |
| GET | `/v1/vendas/{venda_id}/itens` | `vendas:ler` | Coleção de itens da revisão |
| GET | `/v1/vendas/{venda_id}/pagamentos` | `vendas:ler` | Lançamentos da revisão |
| GET | `/v1/produtos` | `produtos:ler` | Cadastro básico relacionado à filial |
| GET | `/v1/produtos/{produto_id}` | `produtos:ler` | Produto básico pontual |
| GET | `/v1/produtos/{produto_id}/variacoes` | `produtos:ler` | SKUs, cores, tamanhos e barras |
| GET | `/v1/estoques` | `estoques:ler` | Posição atual da filial por SKU |
| GET | `/v1/filiais/{filial_id}/estoques/{sku}` | `estoques:ler` | Saldo pontual/tombstone |
| GET | `/v1/alteracoes` | Escopo do recurso consultado | Log incremental e checkpoint |

As oito operações administrativas de webhooks estão detalhadas no [guia de webhooks](webhooks.md). Nesta versão não há endpoint de escrita em vendas, produtos ou estoque.

## Vendas: filtros e identidade

| Parâmetro | Obrigatório | Regra |
| --- | --- | --- |
| `filial_id` | Sim | ID concedido à integração |
| `inicio` | Sim | Dia inicial inclusivo em São Paulo |
| `fim` | Sim | Dia final inclusivo; diferença máxima de 30 dias, totalizando até 31 dias civis |
| `estado` | Não | `todas` por padrão; opções `ativas`, `canceladas` |
| `tipo_operacao` | Não | `S` por padrão; opções `E`, `todas` |
| `incluir_pessoas` | Não | False por padrão; exige escopo de pessoas quando true |
| `limite` | Não | 1 a 200; padrão 100 |
| `cursor` | Não na primeira página | Opaco, mesma consulta e mesmas permissões |

```bash
curl --get "$BASE/v1/vendas" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header 'Accept: application/json' \
  --data-urlencode 'filial_id=1001' \
  --data-urlencode 'inicio=2026-11-01' \
  --data-urlencode 'fim=2026-11-10' \
  --data-urlencode 'estado=todas' \
  --data-urlencode 'tipo_operacao=S' \
  --data-urlencode 'limite=100'
```

A identidade de uma venda é o conjunto **tenant + filial + tipo de operação + código de operação**. O ID externo proposto `vnd_1001_S_900001` codifica os três últimos componentes, mas não substitui autorização. O consumidor deve manter o namespace do tenant/credencial: o mesmo texto de ID em outro tenant não identifica a mesma venda.

Não usar número de nota, código de barras, nome de cliente ou código da operação isolado como chave única. A nota pode não estar preenchida e uma operação pode existir em filiais/tipos diferentes.

## Ler detalhe, itens e pagamentos sem misturar revisões

```http
GET /v1/vendas/vnd_1001_S_900001
Authorization: Bearer <token>

HTTP/1.1 200 OK
ETag: "vnd_1001_S_900001:12"
```

```http
GET /v1/vendas/vnd_1001_S_900001/itens?limite=100
Authorization: Bearer <token>
If-Match: "vnd_1001_S_900001:12"
```

O detalhe fornece `versao`, `itens_url` e `pagamentos_url`. Para abrir as coleções, envie o ETag recebido em `If-Match`. Se a venda mudou antes de iniciar o snapshot dos filhos, o servidor responde 412. Reabra o detalhe e reinicie a coleção inteira, sem misturar itens de versões diferentes.

Dentro do snapshot de filhos, as páginas ficam congeladas na revisão indicada por `meta.recurso_versao` por 30 minutos. A autorização continua sendo revalidada a cada página. `ordem` é uma posição nesta revisão, não identidade permanente do item. O consumidor deve substituir a coleção da revisão de maneira atômica após terminar todas as páginas.

Se itens/pagamentos estiverem pendentes de importação, não devolver uma lista vazia que pareça definitiva: a proposta prevê 409 `RESOURCE_NOT_READY`, orientando consultar `cobertura` e tentar mais tarde com backoff. Coleção conhecida e vazia é 200 com `data: []`. Um campo ausente na origem não deve ser inventado para permitir conferência.

Veja [venda completa](exemplos/venda.json), [itens](exemplos/itens.json) e [pagamentos](exemplos/pagamentos.json).

## Valores, desconto e conferência

O exemplo possui duas peças a `"10000"` centavos cada. O subtotal dos itens é `"20000"`, o ajuste é `"-2000"` e o cabeçalho informa `"18000"`. O desconto percentual informado no item continua sendo informativo; aplicá-lo outra vez mudaria indevidamente os dados.

```javascript
const subtotal = itens.reduce(
  (total, item) => total + BigInt(item.preco_centavos) * BigInt(item.quantidade),
  0n
);
// Só calcule se ajuste_centavos estiver informado.
const esperado = venda.ajuste_centavos === null
  ? null
  : subtotal + BigInt(venda.ajuste_centavos);
```

| Situação | Interpretação |
| --- | --- |
| `conciliada` | Quantidade e composição aritmética confirmadas na regra atual, com tolerância de até dois centavos |
| `quantidade_divergente` | Cabeçalho e soma das peças divergem |
| `divergente` | Diferença de valor acima da tolerância |
| `contrato_incompleto` | Falta ajuste necessário à comparação; não presumir zero |
| `regra_pendente` | Frete/cortesia ou composição ainda sem regra homologada |
| `nao_elegivel` | Cancelada ou operação fora da regra de venda S |
| `erro_erp_confirmado` | Cabeçalho aceito administrativamente, mantendo a divergência original |
| `pendente` | Conferência ainda não concluída |

Conciliação não certifica faturamento, liquidação financeira nem homologação mensal/anual. `valor_final_centavos` preserva o cabeçalho; não é uma coluna de líquido comercial homologado. Operações E não devem ser subtraídas como devolução sem classificação de evento e regra confirmada.

## Cancelamentos e campos fiscais

`cancelada` representa a combinação do cabeçalho e dos eventos de cancelamento importados. Uma venda já conhecida pode ser cancelada em data posterior, fora da janela original de `data_operacao`. Por isso, polling só das vendas de hoje perde correções: use o log incremental.

`cancelada_em` pode ser null mesmo com `cancelada=true` quando não existe data no evento importado. O cancelamento de uma venda e o `status` da nota fiscal são conceitos separados.

Número da nota, modelo, IDNFE e status são strings ou null. IDNFE não é automaticamente uma chave SEFAZ de 44 dígitos. O sistema atualmente não valida autorização fiscal nem emite DANFE. Histórico sem grupo fiscal tem `nota_fiscal=null` e cobertura pendente; grupo importado pode conter quatro campos nulos e cobertura disponível.

## Dados pessoais e pagamentos

Sem `vendas:pessoas:ler` e `incluir_pessoas=true`, omitir `clientes`, `vendedor.nome`, `pagamentos[].desc_gerador` e `pagamentos[].historico`. Não enviar esses campos como null para simular ausência da fonte; a omissão identifica a restrição. `cobertura.pessoas=restrito` ajuda o consumidor a distinguir os estados.

Com a concessão, `clientes=null` significa snapshot pendente e `clientes=[]` significa resposta conhecida sem cliente. O aniversário guarda apenas `MM-DD`, nunca o ano. A lista é um snapshot da venda, não um cadastro mestre deduplicado por telefone.

Os lançamentos fornecem origem, documento, emissão, vencimento, descrição de tipo, NSU e valor inicial. Não há estado de liquidação confirmado. Não somar parcelas e cabeçalho como se fossem receitas diferentes. Não há número de cartão, CVV ou autorização para armazenar dados de cartão nesta API.

## Filiais

```bash
curl "$BASE/v1/filiais?limite=100" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

`id` é o ID interno; `codigo` é o identificador de exibição e `fantasia` é o nome cadastral. `trans_id_origem` registra a transação de cadastro do ERP e não ordena revisões da API externa. Nome fantasia não é chave de vínculo e não concede acesso automaticamente.

O cadastro atual não persiste CNPJ, razão social ou endereço completo nesse modelo. A proposta não promete esses campos enquanto não houver importação e contrato aprovados.

## Produtos e variações

```bash
curl --get "$BASE/v1/produtos" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode 'filial_id=1001' \
  --data-urlencode 'tipo_prod=AC' \
  --data-urlencode 'limite=100'
```

As consultas de produto exigem `filial_id`, inclusive no detalhe. Um produto só fica visível se existir vínculo permitido com aquela filial. O cadastro básico utiliza o ID interno do produto, código comercial, descrição e seis classificações: coleção, departamento, grupo, categoria, grade e marca. Cada classificação contém código e descrição independentes, ambos anuláveis.

O produto básico contém o `tipo_prod` cadastral. A variação contém o tipo efetivo: cadastro como prioridade e tipo do saldo como alternativa. `tipo_prod_origem` informa `cadastro`, `estoque` ou null. O filtro de produtos por tipo seleciona produtos com pelo menos uma variação presente do tipo efetivo na filial; não presume um tipo cadastral inexistente.

Tipos confirmados: AC=acabado, SE=serviço, MP=matéria-prima, MC=material de consumo. Códigos novos do ERP devem ser preservados como texto; consumidores não devem quebrar se surgir um tipo ainda não traduzido. A filtragem inicial aceita os quatro conhecidos e `desconhecido`.

Uma variação é identificada pelo par filial/SKU e pode ter cor, tamanho e código de barras. Não substituir SKU por código do produto básico. Saldo exige `estoques:ler`; ter acesso ao catálogo não libera números de estoque.

Preços persistidos nos itens de venda são históricos daquela operação. Não existe preço atual do catálogo nesse cadastro. Referências brutas de foto não serão publicadas na primeira versão; `imagem_disponivel` apenas sinaliza a referência no item. Um serviço externo de imagens precisa de contrato e autorização próprios.

## Estoque: posição, ausência e frescor

```bash
curl --get "$BASE/v1/estoques" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode 'filial_id=1001' \
  --data-urlencode 'saldo=todos' \
  --data-urlencode 'incluir_ausentes=false'
```

| Campo/estado | Como tratar |
| --- | --- |
| `saldo_disponivel="12.000000"` | Decimal exato; use biblioteca decimal |
| `saldo_disponivel="0"` | Zero conhecido |
| `saldo_disponivel="-2.000000"` | Saldo negativo conhecido; não normalizar para zero |
| `saldo_disponivel=null` | Posição desconhecida, ou SKU ausente da carga completa |
| `presente_ultima_carga=false` | Tombstone: não está na posição atual; não representa saída de estoque ou zeragem |
| `reservas_ja_descontadas=true` | Não subtrair reservas novamente |
| `sincronizacao.desatualizado=true` | Último sucesso com mais de 30 minutos, ou nunca houve sucesso; dado não é em tempo real |

Listas excluem ausentes por padrão, mas o log incremental precisa informar a ausência. O consumidor deve desativar a posição atual do SKU quando receber esse tombstone. O detalhe poderá retornar o registro ausente, com saldo null, enquanto estiver retido e autorizado. Um SKU nunca conhecido dentro do escopo retorna 404.

`data_atualizacao_erp`, `consultado_em` e `ultimo_sucesso_em` têm origens diferentes. Atraso na coleta deve ser mostrado como atraso, sem substituir saldo por zero. Histórico observado de estoque não equivale a todos os movimentos nem à posição de qualquer data arbitrária; essa consulta histórica está fora da primeira versão.
