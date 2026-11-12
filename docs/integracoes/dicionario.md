# Dicionário de campos

> Contrato 0.1.0 implementado e testado em ambiente isolado. Ainda não publicado. Confira operacao.md para ativação e limites conhecidos.

Todos os exemplos são fictícios. Obrigatório significa presença da chave no contrato; uma chave obrigatória pode aceitar null. Campos pessoais opcionais são omitidos quando não autorizados. Clientes devem tolerar propriedades novas em respostas.

## Paginacao

Página de um snapshot estável; não calcula total global.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `limite` | integer | obrigatória | novo | Máximo solicitado; padrão 100, teto 200. minimum=1. maximum=200. |
| `quantidade` | integer | obrigatória | novo | Registros efetivamente retornados nesta página. minimum=0. maximum=200. |
| `tem_mais` | boolean | obrigatória | novo | Há outra página no mesmo snapshot. |
| `cursor_proximo` | string / null | obrigatória | novo | Cursor opaco, assinado e vinculado ao cliente, permissões, filtros e snapshot. Null ao terminar. maxLength=4096. |

## MetaConsulta

Metadados da camada externa implementada.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `request_id` | string | obrigatória | novo | Identificador para suporte e correlação, sem credenciais. format="uuid". |
| `gerado_em` | string | obrigatória | novo | Instante de produção da resposta, não da venda. format="date-time". |
| `snapshot_id` | string / null | obrigatória | novo | Identificador da projeção estável nas listas. Null em leitura pontual. |
| `snapshot_expira_em` | string / null | obrigatória | novo | Validade de 30 minutos do snapshot das listas; null em leitura pontual. format="date-time". |
| `recurso_versao` | string / null | obrigatória | novo | Revisão da venda nas listas de itens/pagamentos. Null nas demais consultas. pattern="^\\d{1,30}$". |

## Cobertura

Disponibilidade de partes de uma venda; não é homologação comercial.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `itens` | string | obrigatória | novo | Estado do detalhamento dos itens. enum=["disponivel", "pendente"]. |
| `pagamentos` | string | obrigatória | novo | Estado dos complementos de pagamento. enum=["disponivel", "pendente"]. |
| `nota_fiscal` | string | obrigatória | novo | Grupo importado pode conter campos nulos. enum=["disponivel", "pendente"]. |
| `pessoas` | string | obrigatória | novo | Distingue restrição de permissão, pendência e resposta disponível. enum=["restrito", "pendente", "disponivel"]. |
| `complementos_importados_em` | string / null | obrigatória | operacoes.complementos_importados_em | Última importação dos complementos. Null se ausente. format="date-time". |

## Sincronizacao

Frescor da origem local. Indicadores propostos sobre dados já armazenados.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `ultimo_sucesso_em` | string / null | obrigatória | sync_status.ultimo_sucesso ou sync_estoques.ultimo_sucesso | Última consulta bem-sucedida do recurso/filial. format="date-time". |
| `consultado_em` | string / null | obrigatória | estoque_atual.consultado_em | Instante em que esta posição foi observada pelo coletor. format="date-time". |
| `data_atualizacao_erp` | string / null | obrigatória | estoque_atual.data_atualizacao_erp | Atualização informada pelo ERP; não é hora da venda. format="date-time". |
| `ultima_carga_completa_em` | string / null | obrigatória | sync_estoques.ultima_carga_completa | Última carga completa de estoque. format="date-time". |
| `desatualizado` | boolean | obrigatória | novo | Sem sucesso há mais de 30 minutos ou sem sucesso conhecido; limiar proposto. |
| `estado` | string | obrigatória | novo | Não expõe mensagens internas do ERP. enum=["ok", "atrasado", "erro", "sem_carga"]. |

## Contato

Disponível somente com vendas:pessoas:ler e incluir_pessoas=true.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `tipo` | string | obrigatória | clientes[].contatos[].tipo | Tipo informado na normalização. enum=["Celular", "WhatsApp", "Telefone"]. |
| `ddd` | string | obrigatória | clientes[].contatos[].ddd | DDD como recebido; não presume país. maxLength=200. |
| `telefone` | string | obrigatória | clientes[].contatos[].telefone | Número textual; não usar como identidade do cliente. maxLength=200. |

## ClienteVenda

Snapshot do cliente da operação, não um cadastro mestre.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `cliente_codigo` | string / null | obrigatória | operacoes.clientes[].cliente_codigo | Código ERP; null se não informado. Não gerar código por nome/telefone. pattern="^\\d{1,30}$". |
| `nome` | string | obrigatória | operacoes.clientes[].nome | Nome na resposta importada; pode conter texto de ausência. maxLength=200. |
| `aniversario_mm_dd` | string / null | obrigatória | operacoes.clientes[].aniversario_mm_dd | Somente mês/dia. Não contém ano de nascimento. pattern="^\\d{2}-\\d{2}$". |
| `contatos` | array de Contato | obrigatória | operacoes.clientes[].contatos | Contatos disponíveis no snapshot. |

## Vendedor

Nome é opcional por permissão; código não concede acesso a outras vendas.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `codigo` | string / null | obrigatória | operacoes.vendedor_codigo | Código textual do vendedor único identificado; null quando ausente/ambíguo. |
| `nome` | string / null | opcional / condicional | operacoes.vendedor_nome | Omitido sem vendas:pessoas:ler e incluir_pessoas=true; null se autorizado mas sem dado. |

## NotaFiscal

Estado fiscal recebido, sem tradução de códigos ou validação na SEFAZ.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `numero_nota` | string / null | obrigatória | complementos.nota_fiscal.numero_nota | Número preservado como texto, inclusive zeros recebidos. maxLength=500. |
| `modelo` | string / null | obrigatória | complementos.nota_fiscal.modelo | Modelo textual; não traduz automaticamente para NF-e/NFC-e. maxLength=500. |
| `idnfe` | string / null | obrigatória | complementos.nota_fiscal.idnfe | Identificador fiscal como recebido. Não assumir que todo valor seja chave de acesso de 44 dígitos. maxLength=500. |
| `status` | string / null | obrigatória | complementos.nota_fiscal.status | Código/estado original do ERP; null não significa autorizado. maxLength=500. |

## CondicaoPagamento

Condição comercial; não comprova recebimento ou liquidação.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string / null | obrigatória | complementos.condicoes_pgto | Identificador recebido. maxLength=500. |
| `codigo` | string / null | obrigatória | complementos.codigo_condicaopgto | Código da condição. maxLength=500. |
| `descricao` | string / null | obrigatória | complementos.desc_condicoes_pgto | Descrição recebida. maxLength=500. |

## Conferencia

Comparação aritmética limitada às regras confirmadas no projeto.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `situacao` | string | obrigatória | operacoes.conciliacao + marcação de erro ERP | Classificação efetiva; erro_erp_confirmado mantém valores originais. enum=["pendente", "conciliada", "quantidade_divergente", "divergente", "contrato_incompleto", "regra_pendente", "nao_elegivel", "erro_erp_confirmado"]. |
| `tolerancia_centavos` | string | obrigatória | regra atual de conciliação | Tolerância inclusiva de dois centavos em ambos os sentidos. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. const="2". pattern="^-?\\d+$". |
| `erro_erp_confirmado` | boolean | obrigatória | operacoes.erro_erp_confirmado_por IS NOT NULL | Marcação administrativa existente; não revela usuário responsável. |
| `homologacao_comercial` | string | obrigatória | R11/R22 | A conferência aritmética não representa homologação mensal/anual. const="nao_declarada". |

## VendaResumo

Cabeçalho retornado na lista e na referência de eventos.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string | obrigatória | novo | Identidade estável no tenant: vnd_{filial_id}_{tipo_operacao}_{cod_operacao}. Não é segredo. pattern="^vnd_\\d+_[A-Z]+_\\d+$". |
| `filial_id` | string | obrigatória | operacoes.filial | ID interno da filial, não seu código de exibição. pattern="^\\d{1,30}$". |
| `cod_operacao` | string | obrigatória | operacoes.cod_operacao | Código ERP. A unicidade exige filial + tipo + código. pattern="^\\d{1,30}$". |
| `tipo_operacao` | string | obrigatória | operacoes.tipo_operacao | S=saída/venda; E=entrada. Entrada não é devolução automaticamente. enum=["S", "E"]. |
| `data_operacao` | string | obrigatória | operacoes.data_operacao | Dia civil da operação em America/Sao_Paulo; a fonte não confirma hora real. format="date". |
| `hora_venda` | string / null | obrigatória | não disponível: R29 | Reservado para origem homologada; no estado atual deve ser null. Nunca derivar da importação. const=null. |
| `quantidade` | integer | obrigatória | operacoes.quantidade | Peças do cabeçalho. Pode divergir da soma dos itens. minimum=0. |
| `valor_final_centavos` | string | obrigatória | operacoes.valor_final_centavos | Valor final do cabeçalho, preservado. Não chamar de líquido homologado. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `cancelada` | boolean | obrigatória | operacoes.cancelada OR EXISTS cancelamentos | Cancelamento efetivo: cabeçalho ou evento de cancelamento ativo. |
| `vendedor` | Vendedor | obrigatória | operacoes.vendedor_codigo/vendedor_nome | Identificação disponível; nome exige permissão específica. |
| `evento_codigo` | string / null | obrigatória | operacoes.evento_codigo | Código do evento ERP; não determina sozinho o sinal financeiro. |
| `conferencia` | Conferencia | obrigatória | novo: camada externa | Conferência, não homologação de faturamento. |
| `versao` | string | obrigatória | novo | Revisão monotônica do recurso externo, não é trans_id do ERP. pattern="^\\d{1,30}$". |
| `atualizado_em` | string | obrigatória | novo | Instante de publicação desta revisão externa. Não reutilizar cada reimportação como alteração comercial. format="date-time". |

## Venda

Detalhe sem arrays volumosos; itens/pagamentos possuem endpoints paginados.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string | obrigatória | novo | Identidade estável no tenant: vnd_{filial_id}_{tipo_operacao}_{cod_operacao}. Não é segredo. pattern="^vnd_\\d+_[A-Z]+_\\d+$". |
| `filial_id` | string | obrigatória | operacoes.filial | ID interno da filial, não seu código de exibição. pattern="^\\d{1,30}$". |
| `cod_operacao` | string | obrigatória | operacoes.cod_operacao | Código ERP. A unicidade exige filial + tipo + código. pattern="^\\d{1,30}$". |
| `tipo_operacao` | string | obrigatória | operacoes.tipo_operacao | S=saída/venda; E=entrada. Entrada não é devolução automaticamente. enum=["S", "E"]. |
| `data_operacao` | string | obrigatória | operacoes.data_operacao | Dia civil da operação em America/Sao_Paulo; a fonte não confirma hora real. format="date". |
| `hora_venda` | string / null | obrigatória | não disponível: R29 | Reservado para origem homologada; no estado atual deve ser null. Nunca derivar da importação. const=null. |
| `quantidade` | integer | obrigatória | operacoes.quantidade | Peças do cabeçalho. Pode divergir da soma dos itens. minimum=0. |
| `valor_final_centavos` | string | obrigatória | operacoes.valor_final_centavos | Valor final do cabeçalho, preservado. Não chamar de líquido homologado. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `cancelada` | boolean | obrigatória | operacoes.cancelada OR EXISTS cancelamentos | Cancelamento efetivo: cabeçalho ou evento de cancelamento ativo. |
| `vendedor` | Vendedor | obrigatória | operacoes.vendedor_codigo/vendedor_nome | Identificação disponível; nome exige permissão específica. |
| `evento_codigo` | string / null | obrigatória | operacoes.evento_codigo | Código do evento ERP; não determina sozinho o sinal financeiro. |
| `conferencia` | Conferencia | obrigatória | novo: camada externa | Conferência, não homologação de faturamento. |
| `versao` | string | obrigatória | novo | Revisão monotônica do recurso externo, não é trans_id do ERP. pattern="^\\d{1,30}$". |
| `atualizado_em` | string | obrigatória | novo | Instante de publicação desta revisão externa. Não reutilizar cada reimportação como alteração comercial. format="date-time". |
| `ajuste_centavos` | string / null | obrigatória | operacoes.ajuste_centavos | Ajuste monetário da operação; null é ausência, não zero. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `subtotal_itens_centavos` | string / null | obrigatória | operacoes.subtotal_itens_centavos | Soma dos preços recebidos × quantidades. Não reaplica desconto. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `frete_centavos` | string / null | obrigatória | complementos.frete_centavos | Frete recebido; null não deve ser presumido zero. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `cortesia_informada` | string / number / boolean / null | obrigatória | complementos.cortesia_informada | Valor original, sem presumir unidade monetária. Zero numérico/textual foi confirmado como ausência de cortesia; demais composições pendentes. |
| `nota_fiscal` | NotaFiscal / null | obrigatória | complementos.nota_fiscal | Null enquanto o grupo não foi importado; objeto com nulos quando importado sem valores. |
| `condicao_pagamento` | CondicaoPagamento / null | obrigatória | complementos | Null quando complementos ausentes. |
| `cobertura` | Cobertura | obrigatória | novo: camada externa | Cobertura de cada parte da operação. |
| `cancelada_em` | string / null | obrigatória | cancelamentos.data_cancelou | Data/hora do evento de cancelamento, quando existente. format="date-time". |
| `clientes` | array / null de ClienteVenda | opcional / condicional | operacoes.clientes | Omitido sem permissão e opt-in. Null=pending; []=fonte sem cliente. |
| `itens_url` | string | obrigatória | novo | Rota relativa paginada; usar ETag em If-Match. format="uri-reference". |
| `pagamentos_url` | string | obrigatória | novo | Rota relativa paginada; usar ETag em If-Match. format="uri-reference". |

## ItemVenda

Snapshot de item na venda; preço não é uma tabela atual do catálogo.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `ordem` | integer | obrigatória | operacao_itens.ordem | Posição importada, baseada em zero. Pode mudar no reprocessamento; atualizar coleção inteira da revisão. minimum=0. |
| `sku` | string / null | obrigatória | operacao_itens.sku | SKU textual; null se a fonte não informou. |
| `cod_produto` | string / null | obrigatória | operacao_itens.cod_produto | Código comercial, não necessariamente o ID interno produto. |
| `descricao` | string / null | obrigatória | operacao_itens.descricao | Descrição no momento importado. |
| `quantidade` | integer | obrigatória | operacao_itens.quantidade | Quantidade inteira positiva. minimum=1. |
| `preco_centavos` | string | obrigatória | operacao_itens.preco_centavos | Preço unitário recebido usado no subtotal. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `preco_tabela_centavos` | string / null | obrigatória | operacao_itens.preco_tabela_centavos | Preço de tabela informado nesse item. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `preco_aplicado_centavos` | string / null | obrigatória | operacao_itens.preco_aplicado_centavos | Preço aplicado informado nesse item; não substituir automaticamente preco_centavos. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `desconto_percentual_informado` | string / null | obrigatória | operacao_itens.desconto_informado | Percentual textual: 20 significa 20%. Informativo; não reaplicar. pattern="^-?\\d+(\\.\\d+)?$". |
| `subtotal_centavos` | string | obrigatória | derivado de operacao_itens | Quantidade × preco_centavos, calculado exatamente. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `imagem_disponivel` | boolean | obrigatória | derivado de operacao_itens.imagem_url | Existe referência de imagem autorizada. URL bruta não será publicada nesta versão. |

## Pagamento

Lançamento importado, não confirmação de liquidação.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `ordem` | integer | obrigatória | novo | Posição baseada em zero nesta revisão; não é identificador financeiro durável. minimum=0. |
| `origem` | string / null | obrigatória | complementos.lancamentos[].origem | Origem recebida. |
| `n_documento` | string / null | obrigatória | complementos.lancamentos[].n_documento | Documento/parcela como recebido. |
| `data_emissao` | string / null | obrigatória | complementos.lancamentos[].data_emissao | Dia de emissão normalizado em São Paulo. format="date". |
| `data_vencimento` | string / null | obrigatória | complementos.lancamentos[].data_vencimento | Dia de vencimento; não comprova pagamento. format="date". |
| `desc_tipopgto` | string / null | obrigatória | complementos.lancamentos[].desc_tipopgto | Descrição da modalidade. |
| `nsu` | string / null | obrigatória | complementos.lancamentos[].nsu | NSU textual; não é número de cartão. |
| `valor_inicial_centavos` | string / null | obrigatória | complementos.lancamentos[].valor_inicial_centavos | Valor inicial recebido; parcelas não devem duplicar o total da venda. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `desc_gerador` | string / null | opcional / condicional | complementos.lancamentos[].desc_gerador | Omitido sem permissão de pessoas e opt-in. |
| `historico` | string / null | opcional / condicional | complementos.lancamentos[].historico | Texto livre potencialmente pessoal; omitido sem permissão de pessoas e opt-in. |

## Filial

Cadastro mínimo disponível; lista limitada às filiais concedidas ao cliente.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string | obrigatória | cadastro_filiais.filial | ID interno da filial. pattern="^\\d{1,30}$". |
| `codigo` | string / null | obrigatória | cadastro_filiais.cod_filial | Código de exibição, por exemplo LOJA-DEMO. |
| `fantasia` | string / null | obrigatória | cadastro_filiais.fantasia | Nome fantasia importado. |
| `trans_id_origem` | string / null | obrigatória | cadastro_filiais.trans_id | Cursor cadastral recebido. Não serve como cursor externo. pattern="^\\d{1,30}$". |
| `versao` | string | obrigatória | novo | Revisão da projeção externa. pattern="^\\d{1,30}$". |
| `atualizado_em` | string | obrigatória | novo | Instante desta revisão externa. format="date-time". |

## ClassificacaoItem

Dimensão cadastral: código e descrição podem estar ausentes.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `codigo` | string / null | obrigatória | cadastro_produtos.classificacao.<dimensao>.codigo | Código textual da dimensão. |
| `descricao` | string / null | obrigatória | cadastro_produtos.classificacao.<dimensao>.descricao | Descrição textual da dimensão. |

## ClassificacaoProduto

Seis dimensões efetivamente persistidas pelo importador.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `colecao` | ClassificacaoItem | obrigatória | cadastro_produtos.classificacao.colecao | Classificação de colecao. |
| `departamento` | ClassificacaoItem | obrigatória | cadastro_produtos.classificacao.departamento | Classificação de departamento. |
| `grupo` | ClassificacaoItem | obrigatória | cadastro_produtos.classificacao.grupo | Classificação de grupo. |
| `categoria` | ClassificacaoItem | obrigatória | cadastro_produtos.classificacao.categoria | Classificação de categoria. |
| `grade` | ClassificacaoItem | obrigatória | cadastro_produtos.classificacao.grade | Classificação de grade. |
| `marca` | ClassificacaoItem | obrigatória | cadastro_produtos.classificacao.marca | Classificação de marca. |

## Produto

Produto básico; visível somente se vinculado à filial autorizada solicitada.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string | obrigatória | cadastro_produtos.produto | ID interno do produto. Não confundir com código comercial. pattern="^\\d{1,30}$". |
| `codigo` | string | obrigatória | cadastro_produtos.cod_produto | Código comercial. |
| `descricao` | string | obrigatória | cadastro_produtos.descricao | Descrição cadastral. |
| `tipo_prod` | string / null | obrigatória | cadastro_produtos.tipo_prod | Tipo cadastral principal: AC/SE/MP/MC ou outro código recebido. Null=ausente. O fallback por estoque pertence à variação. maxLength=20. |
| `classificacao` | ClassificacaoProduto | obrigatória | novo: camada externa | Coleção, departamento, grupo, categoria, grade e marca. |
| `trans_id_origem` | string / null | obrigatória | cadastro_produtos.trans_id | Transação cadastral recebida, não cursor externo. pattern="^\\d{1,30}$". |
| `cadastro_consultado_em` | string / null | obrigatória | cadastro_produtos.enriquecido_em | Último enriquecimento cadastral bem-sucedido. format="date-time". |
| `cadastro_disponivel` | boolean | obrigatória | derivado de cadastro_produtos.enriquecido_em | Existe cadastro enriquecido; false não equivale a produto inexistente. |
| `versao` | string | obrigatória | novo | Revisão da camada externa. pattern="^\\d{1,30}$". |
| `atualizado_em` | string | obrigatória | novo | Instante da revisão externa. format="date-time". |

## Variacao

Identidade por filial e SKU; não agrupar tamanhos/cores ao integrar estoque.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `filial_id` | string | obrigatória | estoque_atual.filial | Filial da variação autorizada. pattern="^\\d{1,30}$". |
| `produto_id` | string | obrigatória | estoque_atual.produto | ID interno do produto básico. pattern="^\\d{1,30}$". |
| `sku` | string | obrigatória | estoque_atual.sku | SKU exato, preservando caixa e caracteres. Codificar com percent-encoding em path. minLength=1. maxLength=200. |
| `cor` | string / null | obrigatória | estoque_atual.cor | Cor textual. |
| `tamanho` | string / null | obrigatória | estoque_atual.tamanho | Tamanho textual. |
| `codigo_barras` | string / null | obrigatória | estoque_atual.barra | Código de barras textual; preservar zeros à esquerda. |
| `tipo_prod` | string / null | obrigatória | cadastro_produtos.tipo_prod / estoque_atual.tipo_prod | COALESCE(tipo cadastral, tipo retornado no saldo). maxLength=20. |
| `tipo_prod_origem` | string / null | obrigatória | derivado da prioridade cadastral | Origem da classificação efetiva; null quando desconhecida. enum=["cadastro", "estoque", null]. |
| `presente_ultima_carga` | boolean | obrigatória | estoque_atual.presente_ultima_carga | False é ausência na última carga completa, não estoque zero. |

## Estoque

Posição atual; não representa abertura/movimentos históricos.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `filial_id` | string | obrigatória | estoque_atual.filial | Filial da variação autorizada. pattern="^\\d{1,30}$". |
| `produto_id` | string | obrigatória | estoque_atual.produto | ID interno do produto básico. pattern="^\\d{1,30}$". |
| `sku` | string | obrigatória | estoque_atual.sku | SKU exato, preservando caixa e caracteres. Codificar com percent-encoding em path. minLength=1. maxLength=200. |
| `cor` | string / null | obrigatória | estoque_atual.cor | Cor textual. |
| `tamanho` | string / null | obrigatória | estoque_atual.tamanho | Tamanho textual. |
| `codigo_barras` | string / null | obrigatória | estoque_atual.barra | Código de barras textual; preservar zeros à esquerda. |
| `tipo_prod` | string / null | obrigatória | cadastro_produtos.tipo_prod / estoque_atual.tipo_prod | COALESCE(tipo cadastral, tipo retornado no saldo). maxLength=20. |
| `tipo_prod_origem` | string / null | obrigatória | derivado da prioridade cadastral | Origem da classificação efetiva; null quando desconhecida. enum=["cadastro", "estoque", null]. |
| `presente_ultima_carga` | boolean | obrigatória | estoque_atual.presente_ultima_carga | False é ausência na última carga completa, não estoque zero. |
| `saldo_disponivel` | string / null | obrigatória | estoque_atual.saldo | Decimal exato, pode ser negativo ou null. Já desconta reservas. Ausência na carga completa deve retornar null. pattern="^-?\\d{1,14}(\\.\\d{1,6})?$". |
| `reservas_ja_descontadas` | boolean | obrigatória | regra confirmada do saldo | Regra confirmada para esta origem; não subtrair reservas outra vez. const=true. |
| `sincronizacao` | Sincronizacao | obrigatória | novo: camada externa | Frescor da posição e da coleta por filial. |
| `versao` | string | obrigatória | novo | Revisão externa do par filial/SKU. pattern="^\\d{1,30}$". |
| `atualizado_em` | string | obrigatória | novo | Instante da revisão externa. format="date-time". |

## Alteracao

Registro durável e ordenado por publicação confirmada; sem dados pessoais.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string | obrigatória | novo | ID do evento, usado também no webhook quando aplicável. format="uuid". |
| `recurso` | string | obrigatória | novo | Recurso alterado. enum=["vendas", "filiais", "produtos", "estoques"]. |
| `recurso_id` | string | obrigatória | novo | Identidade do recurso dentro do tenant. Em estoque é ID opaco estável do par filial/SKU. |
| `filial_id` | string | obrigatória | novo | Filial autorizada desta projeção. pattern="^\\d{1,30}$". |
| `acao` | string | obrigatória | novo | Ausente é tombstone de estoque; não é zeragem. enum=["upsert", "cancelada", "ausente"]. |
| `versao` | string | obrigatória | novo | Versão monotônica do recurso. Aplicar somente se maior que a versão local. pattern="^\\d{1,30}$". |
| `registrado_em` | string | obrigatória | novo | Instante de publicação local, não data/hora da venda ERP. format="date-time". |
| `consulta_url` | string | obrigatória | novo | Rota relativa para consultar a versão atual; pode estar mais recente que o evento. format="uri-reference". |

## PaginaAlteracoes

Continuação do log; cursor retorna mesmo em página vazia.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `limite` | integer | obrigatória | novo | Limite de eventos nesta página. minimum=1. maximum=200. |
| `quantidade` | integer | obrigatória | novo | Quantidade efetiva. minimum=0. maximum=200. |
| `tem_mais` | boolean | obrigatória | novo | Há eventos já publicados a continuar lendo. |
| `cursor_proximo` | string | obrigatória | novo | Salvar somente após persistir a página. Continua válido para polling sem novidades. maxLength=4096. |

## MetaAlteracoes

Não utiliza snapshot de listagem com TTL de 30 minutos.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `request_id` | string | obrigatória | novo | Correlação. format="uuid". |
| `gerado_em` | string | obrigatória | novo | Instante da resposta. format="date-time". |
| `retencao_dias` | integer | obrigatória | novo | Retenção proposta do log de alterações. const=30. |

## Problem

Erro RFC 9457; sem SQL, stack traces, segredos ou IDs de outros tenants.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `type` | string | obrigatória | novo | URN estável que identifica a classe de problema. format="uri". |
| `title` | string | obrigatória | novo | Descrição curta. |
| `status` | integer | obrigatória | novo | Código HTTP igual ao status da resposta. minimum=400. maximum=599. |
| `detail` | string | obrigatória | novo | Orientação segura para corrigir a requisição. |
| `instance` | string | obrigatória | novo | Identificador desta ocorrência. format="uri". |
| `code` | string | obrigatória | novo | Código estável para automação, por exemplo CURSOR_EXPIRED. |
| `request_id` | string | obrigatória | novo | Mesmo valor do header X-Request-Id. format="uuid". |
| `campos` | array de object | opcional / condicional | novo | Erros pontuais opcionais; valores sensíveis não aparecem. |

## TokenRequest

Client Credentials com autenticação private_key_jwt; não usa senha de usuário.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `grant_type` | string | obrigatória | novo | Fluxo servidor a servidor. const="client_credentials". |
| `client_id` | string | obrigatória | novo | Identidade da integração cadastrada. minLength=1. maxLength=128. |
| `scope` | string | obrigatória | novo | Escopos separados por espaço; somente subconjunto concedido. minLength=1. maxLength=512. |
| `client_assertion_type` | string | obrigatória | novo | Tipo da prova assinada. const="urn:ietf:params:oauth:client-assertion-type:jwt-bearer". |
| `client_assertion` | string | obrigatória | novo | JWT assinado RS256 com kid registrado, iss=sub=client_id, aud exato do token endpoint, iat/exp e jti único. minLength=32. maxLength=8192. |

## TokenResponse

Access token opaco com 15 minutos; não é o JWT da prova de cliente.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `access_token` | string | obrigatória | novo | Segredo transitório de ao menos 256 bits; valor demonstrativo nos exemplos. |
| `token_type` | string | obrigatória | novo | Tipo de apresentação. const="Bearer". |
| `expires_in` | integer | obrigatória | novo | Validade em segundos. const=900. |
| `scope` | string | obrigatória | novo | Escopos efetivamente concedidos. |

## OAuthError

Erros do token seguem OAuth, sem o envelope Problem dos recursos.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `error` | string | obrigatória | novo | Código OAuth. enum=["invalid_request", "invalid_client", "invalid_scope", "unsupported_grant_type", "temporarily_unavailable"]. |
| `error_description` | string | obrigatória | novo | Descrição segura; não revela existência de chave/cliente. |

## WebhookRequest

Inscrição do próprio cliente, com destino aprovado e subconjunto de filiais.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `nome` | string | obrigatória | novo | Nome operacional, sem credenciais. minLength=1. maxLength=120. |
| `url` | string | obrigatória | novo | HTTPS, porta 443, hostname previamente autorizado; sem userinfo, query ou fragmento. maxLength=2048. format="uri". |
| `eventos` | array de string | obrigatória | novo | Tipos de venda a receber. |
| `filiais` | array de string | obrigatória | novo | IDs concedidos ao cliente. Ampliação exige nova aprovação. |
| `ativo` | boolean | obrigatória | novo | Só permite ativação após teste assinado confirmado. Na criação deve ser false. |

## WebhookCriacaoRequest

Criação somente desativada; o teste precede a ativação.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `nome` | string | obrigatória | novo | Nome operacional, sem credenciais. minLength=1. maxLength=120. |
| `url` | string | obrigatória | novo | HTTPS, porta 443, hostname previamente autorizado; sem userinfo, query ou fragmento. maxLength=2048. format="uri". |
| `eventos` | array de string | obrigatória | novo | Tipos de venda a receber. |
| `filiais` | array de string | obrigatória | novo | IDs concedidos ao cliente. Ampliação exige nova aprovação. |
| `ativo` | boolean | obrigatória | novo | Obrigatoriamente false na criação. const=false. |

## Webhook

Configuração pública da inscrição; GET nunca retorna o segredo.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string | obrigatória | novo | Identificador da inscrição. format="uuid". |
| `nome` | string | obrigatória | novo | Nome operacional, sem credenciais. minLength=1. maxLength=120. |
| `url` | string | obrigatória | novo | HTTPS, porta 443, hostname previamente autorizado; sem userinfo, query ou fragmento. maxLength=2048. format="uri". |
| `eventos` | array de string | obrigatória | novo | Tipos de venda a receber. |
| `filiais` | array de string | obrigatória | novo | IDs concedidos ao cliente. Ampliação exige nova aprovação. |
| `ativo` | boolean | obrigatória | novo | Só permite ativação após teste assinado confirmado. Na criação deve ser false. |
| `estado` | string | obrigatória | novo | Estado operacional. enum=["pendente_verificacao", "ativo", "pausado", "desativado"]. |
| `verificado_em` | string / null | obrigatória | novo | Último teste do destino confirmado. format="date-time". |
| `criado_em` | string | obrigatória | novo | Cadastro da inscrição. format="date-time". |
| `atualizado_em` | string | obrigatória | novo | Última configuração. format="date-time". |
| `versao` | string | obrigatória | novo | Versão da configuração para controle de concorrência. pattern="^\\d{1,30}$". |

## WebhookComSegredo

Somente resposta à criação/rotação, incluindo repetição idempotente por até 24h.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `webhook` | Webhook | obrigatória | novo: camada externa | Configuração resultante. |
| `signing_secret` | string | obrigatória | novo | whsec_ + base64 padrão de 32 bytes aleatórios. Nunca confundir com access_token. pattern="^whsec_[A-Za-z0-9+/]{43}=$". |
| `chave_anterior_valida_ate` | string / null | obrigatória | novo | Sobreposição de 24h na rotação; null na criação. format="date-time". |

## ReferenciaVenda

Snapshot mínimo capturado na revisão do evento; sem clientes, contatos ou nomes.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string | obrigatória | novo | Identidade estável no tenant: vnd_{filial_id}_{tipo_operacao}_{cod_operacao}. Não é segredo. pattern="^vnd_\\d+_[A-Z]+_\\d+$". |
| `filial_id` | string | obrigatória | operacoes.filial | ID interno da filial, não seu código de exibição. pattern="^\\d{1,30}$". |
| `cod_operacao` | string | obrigatória | operacoes.cod_operacao | Código ERP. A unicidade exige filial + tipo + código. pattern="^\\d{1,30}$". |
| `tipo_operacao` | string | obrigatória | operacoes.tipo_operacao | Webhooks da primeira versão notificam somente S. const="S". |
| `cancelada` | boolean | obrigatória | operacoes.cancelada OR EXISTS cancelamentos | Cancelamento efetivo: cabeçalho ou evento de cancelamento ativo. |
| `quantidade` | integer | obrigatória | operacoes.quantidade | Peças do cabeçalho. Pode divergir da soma dos itens. minimum=0. |
| `valor_final_centavos` | string | obrigatória | operacoes.valor_final_centavos | Valor final do cabeçalho, preservado. Não chamar de líquido homologado. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `consulta_url` | string | obrigatória | novo | GET protegido; retorna estado atual, possivelmente mais recente. format="uri-reference". |

## EventoVenda

Notificação assinada. Os arrays completos são consultados pela API.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string | obrigatória | novo | UUID imutável, igual a webhook-id. format="uuid". |
| `tipo` | string | obrigatória | novo | Importação local, atualização relevante ou cancelamento efetivo. enum=["venda.importada", "venda.atualizada", "venda.cancelada"]. |
| `schema_version` | string | obrigatória | novo | Versão do payload de webhook, separada da revisão do recurso. const="1.0". |
| `criado_em` | string | obrigatória | novo | Publicação local após confirmação da transação; não hora ERP. format="date-time". |
| `recurso_versao` | string | obrigatória | novo | Revisão da venda do snapshot mínimo. pattern="^\\d{1,30}$". |
| `origem_carga` | string | obrigatória | novo | Distingue importação inicial e rotina contínua. enum=["historica", "continua", "reprocessamento"]. |
| `campos_alterados` | array de string | obrigatória | novo | Caminhos públicos alterados; nenhum valor pessoal. |
| `data` | ReferenciaVenda | obrigatória | novo: camada externa | Dados mínimos desta revisão. |

## EventoTeste

Teste assinado que não representa venda real.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string | obrigatória | novo | Mesmo webhook-id. format="uuid". |
| `tipo` | string | obrigatória | novo | Evento de verificação. const="webhook.teste". |
| `schema_version` | string | obrigatória | novo | Versão do payload. const="1.0". |
| `criado_em` | string | obrigatória | novo | Instante do teste. format="date-time". |
| `data` | object | obrigatória | novo | Somente confirmação do teste. |

## Entrega

Metadados de entrega, sem segredos ou corpo de resposta do destinatário.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string | obrigatória | novo | Identificador do ciclo de entrega para esta inscrição. format="uuid". |
| `webhook_id` | string | obrigatória | novo | Inscrição proprietária. format="uuid". |
| `evento_id` | string | obrigatória | novo | Evento imutável; permanece no reenvio. format="uuid". |
| `estado` | string | obrigatória | novo | Estado de entrega, não processamento comercial do consumidor. enum=["na_fila", "enviando", "aceita", "aguardando_retry", "falha_permanente", "expirada"]. |
| `tentativas` | integer | obrigatória | novo | Tentativas deste ciclo automático. minimum=0. maximum=10. |
| `ultimo_http_status` | integer / null | obrigatória | novo | Status HTTP ou null em erro de transporte. minimum=100. maximum=599. |
| `proxima_tentativa_em` | string / null | obrigatória | novo | Programação ou null se finalizado. format="date-time". |
| `criado_em` | string | obrigatória | novo | Primeira inclusão na fila. format="date-time". |
| `finalizado_em` | string / null | obrigatória | novo | Fim do ciclo, se houve. format="date-time". |

## AceiteFila

202 confirma fila persistida, não envio/entrega.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `id` | string | obrigatória | novo | Identificador da solicitação. format="uuid". |
| `estado` | string | obrigatória | novo | Estado inicial. const="na_fila". |

## ListaFilial

Envelope paginado de Filial.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | array de Filial | obrigatória | novo | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## ListaProduto

Envelope paginado de Produto.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | array de Produto | obrigatória | novo | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## ListaVariacao

Envelope paginado de Variacao.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | array de Variacao | obrigatória | novo | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## ListaEstoque

Envelope paginado de Estoque.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | array de Estoque | obrigatória | novo | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## ListaVendaResumo

Envelope paginado de VendaResumo.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | array de VendaResumo | obrigatória | novo | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## ListaItemVenda

Envelope paginado de ItemVenda.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | array de ItemVenda | obrigatória | novo | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## ListaPagamento

Envelope paginado de Pagamento.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | array de Pagamento | obrigatória | novo | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## ListaWebhook

Envelope paginado de Webhook.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | array de Webhook | obrigatória | novo | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## ListaEntrega

Envelope paginado de Entrega.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | array de Entrega | obrigatória | novo | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## RespostaFilial

Envelope pontual de Filial.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | Filial | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## RespostaProduto

Envelope pontual de Produto.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | Produto | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## RespostaEstoque

Envelope pontual de Estoque.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | Estoque | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## RespostaVenda

Envelope pontual de Venda.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | Venda | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## RespostaWebhook

Envelope pontual de Webhook.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | Webhook | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |

## ListaAlteracoes

Log incremental, incluindo cancelamentos e ausência de SKU.

| Campo | Tipo | Presença | Origem / disponibilidade | Descrição e restrições |
| --- | --- | --- | --- | --- |
| `data` | array de Alteracao | obrigatória | novo | Eventos ordenados por publicação confirmada. |
| `paginacao` | PaginaAlteracoes | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaAlteracoes | obrigatória | novo: camada externa | Objeto referenciado; consultar seção correspondente. |
