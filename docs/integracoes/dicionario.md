# Dicionário de campos

Contrato 0.1.0. Referência de campos das requisições, respostas e eventos da API.

Todos os exemplos são fictícios. Obrigatório significa presença da chave no contrato; uma chave obrigatória pode aceitar null. Campos pessoais opcionais são omitidos quando não autorizados. Clientes devem tolerar propriedades novas em respostas.

## Paginacao

Página de um snapshot estável; não calcula total global.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `limite` | integer | obrigatória | Máximo solicitado; padrão 100, teto 200. minimum=1. maximum=200. |
| `quantidade` | integer | obrigatória | Registros efetivamente retornados nesta página. minimum=0. maximum=200. |
| `tem_mais` | boolean | obrigatória | Há outra página no mesmo snapshot. |
| `cursor_proximo` | string / null | obrigatória | Cursor opaco, assinado e vinculado ao cliente, permissões, filtros e snapshot. Null ao terminar. maxLength=4096. |

## MetaConsulta

Metadados de identificação e consistência da resposta.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `request_id` | string | obrigatória | Identificador para suporte e correlação, sem credenciais. format="uuid". |
| `gerado_em` | string | obrigatória | Instante de produção da resposta, não da venda. format="date-time". |
| `snapshot_id` | string / null | obrigatória | Identificador da projeção estável nas listas. Null em leitura pontual. |
| `snapshot_expira_em` | string / null | obrigatória | Validade de 30 minutos do snapshot das listas; null em leitura pontual. format="date-time". |
| `recurso_versao` | string / null | obrigatória | Revisão da venda nas listas de itens/pagamentos. Null nas demais consultas. pattern="^\\d{1,30}$". |

## Cobertura

Disponibilidade das seções do detalhe da venda.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `itens` | string | obrigatória | Estado do detalhamento dos itens. enum=["disponivel", "pendente"]. |
| `pagamentos` | string | obrigatória | Estado dos complementos de pagamento. enum=["disponivel", "pendente"]. |
| `nota_fiscal` | string | obrigatória | Grupo importado pode conter campos nulos. enum=["disponivel", "pendente"]. |
| `pessoas` | string | obrigatória | Distingue restrição de permissão, pendência e resposta disponível. enum=["restrito", "pendente", "disponivel"]. |
| `complementos_importados_em` | string / null | obrigatória | Última importação dos complementos. Null se ausente. format="date-time". |

## Sincronizacao

Indicadores de atualização dos dados.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `ultimo_sucesso_em` | string / null | obrigatória | Última consulta bem-sucedida do recurso/filial. format="date-time". |
| `consultado_em` | string / null | obrigatória | Instante de observação desta posição. format="date-time". |
| `data_atualizacao_erp` | string / null | obrigatória | Instante de atualização informado pela origem. format="date-time". |
| `ultima_carga_completa_em` | string / null | obrigatória | Última carga completa de estoque. format="date-time". |
| `desatualizado` | boolean | obrigatória | Indica uma posição desatualizada ou sem atualização bem-sucedida conhecida. |
| `estado` | string | obrigatória | Situação da atualização dos dados. enum=["ok", "atrasado", "erro", "sem_carga"]. |

## Contato

Disponível somente com vendas:pessoas:ler e incluir_pessoas=true.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `tipo` | string | obrigatória | Tipo informado na normalização. enum=["Celular", "WhatsApp", "Telefone"]. |
| `ddd` | string | obrigatória | DDD como recebido; não presume país. maxLength=200. |
| `telefone` | string | obrigatória | Número textual; não usar como identidade do cliente. maxLength=200. |

## ClienteVenda

Snapshot do cliente da operação, não um cadastro mestre.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `cliente_codigo` | string / null | obrigatória | Código de referência do cliente; null quando indisponível. pattern="^\\d{1,30}$". |
| `nome` | string | obrigatória | Nome na resposta importada; pode conter texto de ausência. maxLength=200. |
| `aniversario_mm_dd` | string / null | obrigatória | Somente mês/dia. Não contém ano de nascimento. pattern="^\\d{2}-\\d{2}$". |
| `contatos` | array de Contato | obrigatória | Contatos disponíveis no snapshot. |

## Vendedor

Nome é opcional por permissão; código não concede acesso a outras vendas.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `codigo` | string / null | obrigatória | Código textual do vendedor único identificado; null quando ausente/ambíguo. |
| `nome` | string / null | opcional / condicional | Omitido sem vendas:pessoas:ler e incluir_pessoas=true; null se autorizado mas sem dado. |

## NotaFiscal

Estado fiscal recebido, sem tradução de códigos ou validação na SEFAZ.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `numero_nota` | string / null | obrigatória | Número preservado como texto, inclusive zeros recebidos. maxLength=500. |
| `modelo` | string / null | obrigatória | Modelo textual; não traduz automaticamente para NF-e/NFC-e. maxLength=500. |
| `idnfe` | string / null | obrigatória | Identificador fiscal como recebido. Não assumir que todo valor seja chave de acesso de 44 dígitos. maxLength=500. |
| `status` | string / null | obrigatória | Status fiscal informado; null quando indisponível. maxLength=500. |

## CondicaoPagamento

Condição comercial; não comprova recebimento ou liquidação.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string / null | obrigatória | Identificador recebido. maxLength=500. |
| `codigo` | string / null | obrigatória | Código da condição. maxLength=500. |
| `descricao` | string / null | obrigatória | Descrição recebida. maxLength=500. |

## Conferencia

Indicadores de consistência dos valores e quantidades da operação.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `situacao` | string | obrigatória | Classificação de consistência da operação. enum=["pendente", "conciliada", "quantidade_divergente", "divergente", "contrato_incompleto", "regra_pendente", "nao_elegivel", "erro_erp_confirmado"]. |
| `tolerancia_centavos` | string | obrigatória | Tolerância de comparação, expressa em centavos. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. const="2". pattern="^-?\\d+$". |
| `erro_erp_confirmado` | boolean | obrigatória | Indica uma divergência validada na origem, sem alterar os valores retornados. |
| `homologacao_comercial` | string | obrigatória | Estado de validação comercial. Nesta versão retorna nao_declarada. const="nao_declarada". |

## VendaResumo

Cabeçalho retornado na lista e na referência de eventos.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string | obrigatória | Identidade estável no tenant: vnd_{filial_id}_{tipo_operacao}_{cod_operacao}.  pattern="^vnd_\\d+_[A-Z]+_\\d+$". |
| `filial_id` | string | obrigatória | ID interno da filial, não seu código de exibição. pattern="^\\d{1,30}$". |
| `cod_operacao` | string | obrigatória | Código da operação; considerar também a filial e o tipo para identificar o registro. pattern="^\\d{1,30}$". |
| `tipo_operacao` | string | obrigatória | S=saída/venda; E=entrada. Entrada não é devolução automaticamente. enum=["S", "E"]. |
| `data_operacao` | string | obrigatória | Data civil da operação no fuso America/Sao_Paulo. format="date". |
| `hora_venda` | string / null | obrigatória | Campo reservado; retorna null nesta versão. const=null. |
| `quantidade` | integer | obrigatória | Peças do cabeçalho. Pode divergir da soma dos itens. minimum=0. |
| `valor_final_centavos` | string | obrigatória | Valor total informado para a operação. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `cancelada` | boolean | obrigatória | Indica se a venda está cancelada. |
| `vendedor` | Vendedor | obrigatória | Identificação disponível; nome exige permissão específica. |
| `evento_codigo` | string / null | obrigatória | Código de classificação da operação na origem. |
| `conferencia` | Conferencia | obrigatória | Indicadores de consistência da operação. |
| `versao` | string | obrigatória | Versão monotônica do recurso na API. pattern="^\\d{1,30}$". |
| `atualizado_em` | string | obrigatória | Instante de disponibilização desta versão do recurso. format="date-time". |

## Venda

Detalhe sem arrays volumosos; itens/pagamentos possuem endpoints paginados.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string | obrigatória | Identidade estável no tenant: vnd_{filial_id}_{tipo_operacao}_{cod_operacao}.  pattern="^vnd_\\d+_[A-Z]+_\\d+$". |
| `filial_id` | string | obrigatória | ID interno da filial, não seu código de exibição. pattern="^\\d{1,30}$". |
| `cod_operacao` | string | obrigatória | Código da operação; considerar também a filial e o tipo para identificar o registro. pattern="^\\d{1,30}$". |
| `tipo_operacao` | string | obrigatória | S=saída/venda; E=entrada. Entrada não é devolução automaticamente. enum=["S", "E"]. |
| `data_operacao` | string | obrigatória | Data civil da operação no fuso America/Sao_Paulo. format="date". |
| `hora_venda` | string / null | obrigatória | Campo reservado; retorna null nesta versão. const=null. |
| `quantidade` | integer | obrigatória | Peças do cabeçalho. Pode divergir da soma dos itens. minimum=0. |
| `valor_final_centavos` | string | obrigatória | Valor total informado para a operação. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `cancelada` | boolean | obrigatória | Indica se a venda está cancelada. |
| `vendedor` | Vendedor | obrigatória | Identificação disponível; nome exige permissão específica. |
| `evento_codigo` | string / null | obrigatória | Código de classificação da operação na origem. |
| `conferencia` | Conferencia | obrigatória | Indicadores de consistência da operação. |
| `versao` | string | obrigatória | Versão monotônica do recurso na API. pattern="^\\d{1,30}$". |
| `atualizado_em` | string | obrigatória | Instante de disponibilização desta versão do recurso. format="date-time". |
| `ajuste_centavos` | string / null | obrigatória | Ajuste monetário da operação; null é ausência, não zero. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `subtotal_itens_centavos` | string / null | obrigatória | Soma dos preços recebidos × quantidades. Não reaplica desconto. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `frete_centavos` | string / null | obrigatória | Frete recebido; null não deve ser presumido zero. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `cortesia_informada` | string / number / boolean / null | obrigatória | Informação de cortesia no formato recebido. Não possui unidade monetária definida neste contrato. |
| `nota_fiscal` | NotaFiscal / null | obrigatória | Null enquanto o grupo não foi importado; objeto com nulos quando importado sem valores. |
| `condicao_pagamento` | CondicaoPagamento / null | obrigatória | Null quando complementos ausentes. |
| `cobertura` | Cobertura | obrigatória | Cobertura de cada parte da operação. |
| `cancelada_em` | string / null | obrigatória | Data/hora do evento de cancelamento, quando existente. format="date-time". |
| `clientes` | array / null de ClienteVenda | opcional / condicional | Omitido sem permissão e opt-in. Null=pending; []=fonte sem cliente. |
| `itens_url` | string | obrigatória | Rota relativa paginada; usar ETag em If-Match. format="uri-reference". |
| `pagamentos_url` | string | obrigatória | Rota relativa paginada; usar ETag em If-Match. format="uri-reference". |

## ItemVenda

Snapshot de item na venda; preço não é uma tabela atual do catálogo.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `ordem` | integer | obrigatória | Posição importada, baseada em zero. Pode mudar no reprocessamento; atualizar coleção inteira da revisão. minimum=0. |
| `sku` | string / null | obrigatória | SKU textual; null se a fonte não informou. |
| `cod_produto` | string / null | obrigatória | Código comercial, não necessariamente o ID interno produto. |
| `descricao` | string / null | obrigatória | Descrição no momento importado. |
| `quantidade` | integer | obrigatória | Quantidade inteira positiva. minimum=1. |
| `preco_centavos` | string | obrigatória | Preço unitário recebido usado no subtotal. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `preco_tabela_centavos` | string / null | obrigatória | Preço de tabela informado nesse item. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `preco_aplicado_centavos` | string / null | obrigatória | Preço aplicado informado nesse item; não substituir automaticamente preco_centavos. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `desconto_percentual_informado` | string / null | obrigatória | Percentual textual: 20 significa 20%. Informativo; não reaplicar. pattern="^-?\\d+(\\.\\d+)?$". |
| `subtotal_centavos` | string | obrigatória | Quantidade × preco_centavos, calculado exatamente. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `imagem_disponivel` | boolean | obrigatória | Existe referência de imagem autorizada. URL bruta não será publicada nesta versão. |

## Pagamento

Lançamento importado, não confirmação de liquidação.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `ordem` | integer | obrigatória | Posição baseada em zero nesta revisão; não é identificador financeiro durável. minimum=0. |
| `origem` | string / null | obrigatória | Origem recebida. |
| `n_documento` | string / null | obrigatória | Documento/parcela como recebido. |
| `data_emissao` | string / null | obrigatória | Dia de emissão normalizado em São Paulo. format="date". |
| `data_vencimento` | string / null | obrigatória | Dia de vencimento; não comprova pagamento. format="date". |
| `desc_tipopgto` | string / null | obrigatória | Descrição da modalidade. |
| `nsu` | string / null | obrigatória | NSU textual; não é número de cartão. |
| `valor_inicial_centavos` | string / null | obrigatória | Valor inicial recebido; parcelas não devem duplicar o total da venda. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `desc_gerador` | string / null | opcional / condicional | Omitido sem permissão de pessoas e opt-in. |
| `historico` | string / null | opcional / condicional | Texto livre potencialmente pessoal; omitido sem permissão de pessoas e opt-in. |

## Filial

Cadastro mínimo disponível; lista limitada às filiais concedidas ao cliente.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string | obrigatória | ID interno da filial. pattern="^\\d{1,30}$". |
| `codigo` | string / null | obrigatória | Código de exibição, por exemplo LOJA-DEMO. |
| `fantasia` | string / null | obrigatória | Nome fantasia importado. |
| `trans_id_origem` | string / null | obrigatória | Cursor cadastral recebido. Não serve como cursor externo. pattern="^\\d{1,30}$". |
| `versao` | string | obrigatória | Revisão da projeção externa. pattern="^\\d{1,30}$". |
| `atualizado_em` | string | obrigatória | Instante desta revisão externa. format="date-time". |

## ClassificacaoItem

Dimensão cadastral: código e descrição podem estar ausentes.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `codigo` | string / null | obrigatória | Código textual da dimensão. |
| `descricao` | string / null | obrigatória | Descrição textual da dimensão. |

## ClassificacaoProduto

Classificações cadastrais do produto.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `colecao` | ClassificacaoItem | obrigatória | Classificação de colecao. |
| `departamento` | ClassificacaoItem | obrigatória | Classificação de departamento. |
| `grupo` | ClassificacaoItem | obrigatória | Classificação de grupo. |
| `categoria` | ClassificacaoItem | obrigatória | Classificação de categoria. |
| `grade` | ClassificacaoItem | obrigatória | Classificação de grade. |
| `marca` | ClassificacaoItem | obrigatória | Classificação de marca. |

## Produto

Produto básico; visível somente se vinculado à filial autorizada solicitada.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string | obrigatória | ID interno do produto. Não confundir com código comercial. pattern="^\\d{1,30}$". |
| `codigo` | string | obrigatória | Código comercial. |
| `descricao` | string | obrigatória | Descrição cadastral. |
| `tipo_prod` | string / null | obrigatória | Código de tipo cadastral do produto; null quando indisponível. maxLength=20. |
| `classificacao` | ClassificacaoProduto | obrigatória | Coleção, departamento, grupo, categoria, grade e marca. |
| `trans_id_origem` | string / null | obrigatória | Transação cadastral recebida, não cursor externo. pattern="^\\d{1,30}$". |
| `cadastro_consultado_em` | string / null | obrigatória | Último enriquecimento cadastral bem-sucedido. format="date-time". |
| `cadastro_disponivel` | boolean | obrigatória | Existe cadastro enriquecido; false não equivale a produto inexistente. |
| `versao` | string | obrigatória | Revisão da camada externa. pattern="^\\d{1,30}$". |
| `atualizado_em` | string | obrigatória | Instante da revisão externa. format="date-time". |

## Variacao

Identidade por filial e SKU; não agrupar tamanhos/cores ao integrar estoque.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `filial_id` | string | obrigatória | Filial da variação autorizada. pattern="^\\d{1,30}$". |
| `produto_id` | string | obrigatória | ID interno do produto básico. pattern="^\\d{1,30}$". |
| `sku` | string | obrigatória | SKU exato, preservando caixa e caracteres. Codificar com percent-encoding em path. minLength=1. maxLength=200. |
| `cor` | string / null | obrigatória | Cor textual. |
| `tamanho` | string / null | obrigatória | Tamanho textual. |
| `codigo_barras` | string / null | obrigatória | Código de barras textual; preservar zeros à esquerda. |
| `tipo_prod` | string / null | obrigatória | Código de tipo da variação. maxLength=20. |
| `tipo_prod_origem` | string / null | obrigatória | Referência da classificação da variação; null quando desconhecida. enum=["cadastro", "estoque", null]. |
| `presente_ultima_carga` | boolean | obrigatória | False é ausência na última carga completa, não estoque zero. |

## Estoque

Posição atual; não representa abertura/movimentos históricos.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `filial_id` | string | obrigatória | Filial da variação autorizada. pattern="^\\d{1,30}$". |
| `produto_id` | string | obrigatória | ID interno do produto básico. pattern="^\\d{1,30}$". |
| `sku` | string | obrigatória | SKU exato, preservando caixa e caracteres. Codificar com percent-encoding em path. minLength=1. maxLength=200. |
| `cor` | string / null | obrigatória | Cor textual. |
| `tamanho` | string / null | obrigatória | Tamanho textual. |
| `codigo_barras` | string / null | obrigatória | Código de barras textual; preservar zeros à esquerda. |
| `tipo_prod` | string / null | obrigatória | Código de tipo da variação. maxLength=20. |
| `tipo_prod_origem` | string / null | obrigatória | Referência da classificação da variação; null quando desconhecida. enum=["cadastro", "estoque", null]. |
| `presente_ultima_carga` | boolean | obrigatória | False é ausência na última carga completa, não estoque zero. |
| `saldo_disponivel` | string / null | obrigatória | Decimal exato, pode ser negativo ou null. Já desconta reservas. Ausência na carga completa deve retornar null. pattern="^-?\\d{1,14}(\\.\\d{1,6})?$". |
| `reservas_ja_descontadas` | boolean | obrigatória | Indica que o saldo disponível já considera as reservas. const=true. |
| `sincronizacao` | Sincronizacao | obrigatória | Indicadores de atualização da posição por filial. |
| `versao` | string | obrigatória | Revisão externa do par filial/SKU. pattern="^\\d{1,30}$". |
| `atualizado_em` | string | obrigatória | Instante da revisão externa. format="date-time". |

## Alteracao

Registro durável e ordenado por publicação confirmada; sem dados pessoais.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string | obrigatória | ID do evento, usado também no webhook quando aplicável. format="uuid". |
| `recurso` | string | obrigatória | Recurso alterado. enum=["vendas", "filiais", "produtos", "estoques"]. |
| `recurso_id` | string | obrigatória | Identidade do recurso dentro do tenant. Em estoque é ID opaco estável do par filial/SKU. |
| `filial_id` | string | obrigatória | Filial autorizada desta projeção. pattern="^\\d{1,30}$". |
| `acao` | string | obrigatória | Ausente é tombstone de estoque; não é zeragem. enum=["upsert", "cancelada", "ausente"]. |
| `versao` | string | obrigatória | Versão monotônica do recurso. Aplicar somente se maior que a versão local. pattern="^\\d{1,30}$". |
| `registrado_em` | string | obrigatória | Instante de disponibilização da alteração. format="date-time". |
| `consulta_url` | string | obrigatória | Rota relativa para consultar a versão atual; pode estar mais recente que o evento. format="uri-reference". |

## PaginaAlteracoes

Continuação do log; cursor retorna mesmo em página vazia.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `limite` | integer | obrigatória | Limite de eventos nesta página. minimum=1. maximum=200. |
| `quantidade` | integer | obrigatória | Quantidade efetiva. minimum=0. maximum=200. |
| `tem_mais` | boolean | obrigatória | Há eventos já publicados a continuar lendo. |
| `cursor_proximo` | string | obrigatória | Salvar somente após persistir a página. Continua válido para polling sem novidades. maxLength=4096. |

## MetaAlteracoes

Não utiliza snapshot de listagem com TTL de 30 minutos.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `request_id` | string | obrigatória | Correlação. format="uuid". |
| `gerado_em` | string | obrigatória | Instante da resposta. format="date-time". |
| `retencao_dias` | integer | obrigatória | Retenção do log de alterações em dias. const=30. |

## Problem

Erro estruturado conforme RFC 9457.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `type` | string | obrigatória | URN estável que identifica a classe de problema. format="uri". |
| `title` | string | obrigatória | Descrição curta. |
| `status` | integer | obrigatória | Código HTTP igual ao status da resposta. minimum=400. maximum=599. |
| `detail` | string | obrigatória | Orientação segura para corrigir a requisição. |
| `instance` | string | obrigatória | Identificador desta ocorrência. format="uri". |
| `code` | string | obrigatória | Código estável para automação, por exemplo CURSOR_EXPIRED. |
| `request_id` | string | obrigatória | Mesmo valor do header X-Request-Id. format="uuid". |
| `campos` | array de object | opcional / condicional | Erros pontuais opcionais; valores sensíveis não aparecem. |

## TokenRequest

Requisição de token com autenticação private_key_jwt.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `grant_type` | string | obrigatória | Fluxo servidor a servidor. const="client_credentials". |
| `client_id` | string | obrigatória | Identidade da integração cadastrada. minLength=1. maxLength=128. |
| `scope` | string | obrigatória | Escopos separados por espaço; somente subconjunto concedido. minLength=1. maxLength=512. |
| `client_assertion_type` | string | obrigatória | Tipo da prova assinada. const="urn:ietf:params:oauth:client-assertion-type:jwt-bearer". |
| `client_assertion` | string | obrigatória | JWT assinado RS256 com kid registrado, iss=sub=client_id, aud exato do token endpoint, iat/exp e jti único. minLength=32. maxLength=8192. |

## TokenResponse

Access token opaco com 15 minutos; não é o JWT da prova de cliente.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `access_token` | string | obrigatória | Segredo transitório de ao menos 256 bits; valor demonstrativo nos exemplos. |
| `token_type` | string | obrigatória | Tipo de apresentação. const="Bearer". |
| `expires_in` | integer | obrigatória | Validade em segundos. const=900. |
| `scope` | string | obrigatória | Escopos efetivamente concedidos. |

## OAuthError

Erros do token seguem OAuth, sem o envelope Problem dos recursos.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `error` | string | obrigatória | Código OAuth. enum=["invalid_request", "invalid_client", "invalid_scope", "unsupported_grant_type", "temporarily_unavailable"]. |
| `error_description` | string | obrigatória | Descrição segura; não revela existência de chave/cliente. |

## WebhookRequest

Inscrição do próprio cliente, com destino aprovado e subconjunto de filiais.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `nome` | string | obrigatória | Nome operacional, sem credenciais. minLength=1. maxLength=120. |
| `url` | string | obrigatória | HTTPS, porta 443, hostname previamente autorizado; sem userinfo, query ou fragmento. maxLength=2048. format="uri". |
| `eventos` | array de string | obrigatória | Tipos de venda a receber. |
| `filiais` | array de string | obrigatória | IDs concedidos ao cliente. Ampliação exige nova aprovação. |
| `ativo` | boolean | obrigatória | Só permite ativação após teste assinado confirmado. Na criação deve ser false. |

## WebhookCriacaoRequest

Criação somente desativada; o teste precede a ativação.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `nome` | string | obrigatória | Nome operacional, sem credenciais. minLength=1. maxLength=120. |
| `url` | string | obrigatória | HTTPS, porta 443, hostname previamente autorizado; sem userinfo, query ou fragmento. maxLength=2048. format="uri". |
| `eventos` | array de string | obrigatória | Tipos de venda a receber. |
| `filiais` | array de string | obrigatória | IDs concedidos ao cliente. Ampliação exige nova aprovação. |
| `ativo` | boolean | obrigatória | Obrigatoriamente false na criação. const=false. |

## Webhook

Configuração pública da inscrição; GET nunca retorna o segredo.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string | obrigatória | Identificador da inscrição. format="uuid". |
| `nome` | string | obrigatória | Nome operacional, sem credenciais. minLength=1. maxLength=120. |
| `url` | string | obrigatória | HTTPS, porta 443, hostname previamente autorizado; sem userinfo, query ou fragmento. maxLength=2048. format="uri". |
| `eventos` | array de string | obrigatória | Tipos de venda a receber. |
| `filiais` | array de string | obrigatória | IDs concedidos ao cliente. Ampliação exige nova aprovação. |
| `ativo` | boolean | obrigatória | Só permite ativação após teste assinado confirmado. Na criação deve ser false. |
| `estado` | string | obrigatória | Estado operacional. enum=["pendente_verificacao", "ativo", "pausado", "desativado"]. |
| `verificado_em` | string / null | obrigatória | Último teste do destino confirmado. format="date-time". |
| `criado_em` | string | obrigatória | Cadastro da inscrição. format="date-time". |
| `atualizado_em` | string | obrigatória | Última configuração. format="date-time". |
| `versao` | string | obrigatória | Versão da configuração para controle de concorrência. pattern="^\\d{1,30}$". |

## WebhookComSegredo

Somente resposta à criação/rotação, incluindo repetição idempotente por até 24h.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `webhook` | Webhook | obrigatória | Configuração resultante. |
| `signing_secret` | string | obrigatória | whsec_ + base64 padrão de 32 bytes aleatórios. Nunca confundir com access_token. pattern="^whsec_[A-Za-z0-9+/]{43}=$". |
| `chave_anterior_valida_ate` | string / null | obrigatória | Sobreposição de 24h na rotação; null na criação. format="date-time". |

## ReferenciaVenda

Snapshot mínimo capturado na revisão do evento; sem clientes, contatos ou nomes.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string | obrigatória | Identidade estável no tenant: vnd_{filial_id}_{tipo_operacao}_{cod_operacao}.  pattern="^vnd_\\d+_[A-Z]+_\\d+$". |
| `filial_id` | string | obrigatória | ID interno da filial, não seu código de exibição. pattern="^\\d{1,30}$". |
| `cod_operacao` | string | obrigatória | Código da operação; considerar também a filial e o tipo para identificar o registro. pattern="^\\d{1,30}$". |
| `tipo_operacao` | string | obrigatória | Webhooks da primeira versão notificam somente S. const="S". |
| `cancelada` | boolean | obrigatória | Indica se a venda está cancelada. |
| `quantidade` | integer | obrigatória | Peças do cabeçalho. Pode divergir da soma dos itens. minimum=0. |
| `valor_final_centavos` | string | obrigatória | Valor total informado para a operação. Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float. pattern="^-?\\d+$". |
| `consulta_url` | string | obrigatória | GET protegido; retorna estado atual, possivelmente mais recente. format="uri-reference". |

## EventoVenda

Notificação assinada. Os arrays completos são consultados pela API.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string | obrigatória | UUID imutável, igual a webhook-id. format="uuid". |
| `tipo` | string | obrigatória | Tipo de notificação da venda. enum=["venda.importada", "venda.atualizada", "venda.cancelada"]. |
| `schema_version` | string | obrigatória | Versão do payload de webhook, separada da revisão do recurso. const="1.0". |
| `criado_em` | string | obrigatória | Instante de disponibilização do evento. format="date-time". |
| `recurso_versao` | string | obrigatória | Revisão da venda do snapshot mínimo. pattern="^\\d{1,30}$". |
| `origem_carga` | string | obrigatória | Distingue importação inicial e rotina contínua. enum=["historica", "continua", "reprocessamento"]. |
| `campos_alterados` | array de string | obrigatória | Caminhos públicos alterados; nenhum valor pessoal. |
| `data` | ReferenciaVenda | obrigatória | Dados mínimos desta revisão. |

## EventoTeste

Teste assinado que não representa venda real.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string | obrigatória | Mesmo webhook-id. format="uuid". |
| `tipo` | string | obrigatória | Evento de verificação. const="webhook.teste". |
| `schema_version` | string | obrigatória | Versão do payload. const="1.0". |
| `criado_em` | string | obrigatória | Instante do teste. format="date-time". |
| `data` | object | obrigatória | Somente confirmação do teste. |

## Entrega

Metadados de entrega, sem segredos ou corpo de resposta do destinatário.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string | obrigatória | Identificador do ciclo de entrega para esta inscrição. format="uuid". |
| `webhook_id` | string | obrigatória | Inscrição proprietária. format="uuid". |
| `evento_id` | string | obrigatória | Evento imutável; permanece no reenvio. format="uuid". |
| `estado` | string | obrigatória | Estado de entrega, não processamento comercial do consumidor. enum=["na_fila", "enviando", "aceita", "aguardando_retry", "falha_permanente", "expirada"]. |
| `tentativas` | integer | obrigatória | Tentativas deste ciclo automático. minimum=0. maximum=10. |
| `ultimo_http_status` | integer / null | obrigatória | Status HTTP ou null em erro de transporte. minimum=100. maximum=599. |
| `proxima_tentativa_em` | string / null | obrigatória | Programação ou null se finalizado. format="date-time". |
| `criado_em` | string | obrigatória | Primeira inclusão na fila. format="date-time". |
| `finalizado_em` | string / null | obrigatória | Fim do ciclo, se houve. format="date-time". |

## AceiteFila

202 confirma fila persistida, não envio/entrega.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `id` | string | obrigatória | Identificador da solicitação. format="uuid". |
| `estado` | string | obrigatória | Estado inicial. const="na_fila". |

## ListaFilial

Envelope paginado de Filial.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | array de Filial | obrigatória | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## ListaProduto

Envelope paginado de Produto.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | array de Produto | obrigatória | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## ListaVariacao

Envelope paginado de Variacao.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | array de Variacao | obrigatória | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## ListaEstoque

Envelope paginado de Estoque.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | array de Estoque | obrigatória | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## ListaVendaResumo

Envelope paginado de VendaResumo.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | array de VendaResumo | obrigatória | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## ListaItemVenda

Envelope paginado de ItemVenda.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | array de ItemVenda | obrigatória | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## ListaPagamento

Envelope paginado de Pagamento.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | array de Pagamento | obrigatória | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## ListaWebhook

Envelope paginado de Webhook.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | array de Webhook | obrigatória | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## ListaEntrega

Envelope paginado de Entrega.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | array de Entrega | obrigatória | Itens desta página. |
| `paginacao` | Paginacao | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## RespostaFilial

Envelope pontual de Filial.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | Filial | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## RespostaProduto

Envelope pontual de Produto.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | Produto | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## RespostaEstoque

Envelope pontual de Estoque.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | Estoque | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## RespostaVenda

Envelope pontual de Venda.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | Venda | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## RespostaWebhook

Envelope pontual de Webhook.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | Webhook | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaConsulta | obrigatória | Objeto referenciado; consultar seção correspondente. |

## ListaAlteracoes

Log incremental, incluindo cancelamentos e ausência de SKU.

| Campo | Tipo | Presença | Descrição e restrições |
| --- | --- | --- | --- |
| `data` | array de Alteracao | obrigatória | Eventos ordenados por publicação confirmada. |
| `paginacao` | PaginaAlteracoes | obrigatória | Objeto referenciado; consultar seção correspondente. |
| `meta` | MetaAlteracoes | obrigatória | Objeto referenciado; consultar seção correspondente. |
