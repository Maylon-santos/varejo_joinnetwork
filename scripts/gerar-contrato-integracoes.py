#!/usr/bin/env python3
"""Gera documentação e contrato. Não provisiona serviços ou credenciais."""
from pathlib import Path
import copy
import json

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://api-varejo.aeropostale.joinnetwork.com.br'
SCHEMAS = {}

def ref(name, description=None, nullable=False, origin=None):
    value = {'$ref': '#/components/schemas/'+name}
    if nullable:
        value = {'anyOf': [value, {'type':'null'}]}
    if description:
        value['description'] = description
    if origin:
        value['x-origem'] = origin
    return value

def field(kind, description, origin='novo', nullable=False, **kw):
    return {'type':[kind,'null'] if nullable else kind,'description':description,'x-origem':origin,**kw}

def text(description, origin='novo', nullable=False, **kw):
    return field('string',description,origin,nullable,**kw)

def ident(description, origin='novo', nullable=False):
    return text(description,origin,nullable,pattern=r'^\d{1,30}$')

def money(description, origin='novo', nullable=False, **kw):
    return text(description+' Inteiro decimal em centavos de BRL; usar BigInt/Decimal, nunca float.',origin,nullable,pattern=r'^-?\d+$',**kw)

def date(description, origin='novo', nullable=False):
    return text(description,origin,nullable,format='date')

def timestamp(description, origin='novo', nullable=False):
    return text(description,origin,nullable,format='date-time')

def array(name, description, origin='novo', nullable=False):
    return field('array',description,origin,nullable,items=ref(name))

def obj(name, description, properties, optional=(), request=False):
    SCHEMAS[name]={'type':'object','description':description,'properties':properties,
        'required':[p for p in properties if p not in optional], 'additionalProperties':not request}
    return ref(name)

obj('Paginacao','Página de um snapshot estável; não calcula total global.',{
 'limite':field('integer','Máximo solicitado; padrão 100, teto 200.',minimum=1,maximum=200),
 'quantidade':field('integer','Registros efetivamente retornados nesta página.',minimum=0,maximum=200),
 'tem_mais':field('boolean','Há outra página no mesmo snapshot.'),
 'cursor_proximo':text('Cursor opaco, assinado e vinculado ao cliente, permissões, filtros e snapshot. Null ao terminar.',nullable=True,maxLength=4096)})
obj('MetaConsulta','Metadados de identificação e consistência da resposta.',{
 'request_id':text('Identificador para suporte e correlação, sem credenciais.',format='uuid'),
 'gerado_em':timestamp('Instante de produção da resposta, não da venda.'),
 'snapshot_id':text('Identificador da projeção estável nas listas. Null em leitura pontual.',nullable=True),
 'snapshot_expira_em':timestamp('Validade de 30 minutos do snapshot das listas; null em leitura pontual.',nullable=True),
 'recurso_versao':ident('Revisão da venda nas listas de itens/pagamentos. Null nas demais consultas.',nullable=True)})
obj('Cobertura','Disponibilidade das seções do detalhe da venda.',{
 'itens':text('Estado do detalhamento dos itens.',enum=['disponivel','pendente']),
 'pagamentos':text('Estado dos complementos de pagamento.',enum=['disponivel','pendente']),
 'nota_fiscal':text('Grupo importado pode conter campos nulos.',enum=['disponivel','pendente']),
 'pessoas':text('Distingue restrição de permissão, pendência e resposta disponível.',enum=['restrito','pendente','disponivel']),
 'complementos_importados_em':timestamp('Última importação dos complementos. Null se ausente.','operacoes.complementos_importados_em',True)})
obj('Sincronizacao','Indicadores de atualização dos dados.',{
 'ultimo_sucesso_em':timestamp('Última consulta bem-sucedida do recurso/filial.','sync_status.ultimo_sucesso ou sync_estoques.ultimo_sucesso',True),
 'consultado_em':timestamp('Instante de observação desta posição.','estoque_atual.consultado_em',True),
 'data_atualizacao_erp':timestamp('Instante de atualização informado pela origem.','estoque_atual.data_atualizacao_erp',True),
 'ultima_carga_completa_em':timestamp('Última carga completa de estoque.','sync_estoques.ultima_carga_completa',True),
 'desatualizado':field('boolean','Indica uma posição desatualizada ou sem atualização bem-sucedida conhecida.'),
 'estado':text('Situação da atualização dos dados.',enum=['ok','atrasado','erro','sem_carga'])})
obj('Contato','Disponível somente com vendas:pessoas:ler e incluir_pessoas=true.',{
 'tipo':text('Tipo informado na normalização.','clientes[].contatos[].tipo',enum=['Celular','WhatsApp','Telefone']),
 'ddd':text('DDD como recebido; não presume país.','clientes[].contatos[].ddd',maxLength=200),
 'telefone':text('Número textual; não usar como identidade do cliente.','clientes[].contatos[].telefone',maxLength=200)})
obj('ClienteVenda','Snapshot do cliente da operação, não um cadastro mestre.',{
 'cliente_codigo':ident('Código de referência do cliente; null quando indisponível.','operacoes.clientes[].cliente_codigo',True),
 'nome':text('Nome na resposta importada; pode conter texto de ausência.','operacoes.clientes[].nome',maxLength=200),
 'aniversario_mm_dd':text('Somente mês/dia. Não contém ano de nascimento.','operacoes.clientes[].aniversario_mm_dd',True,pattern=r'^\d{2}-\d{2}$'),
 'contatos':array('Contato','Contatos disponíveis no snapshot.','operacoes.clientes[].contatos')})
obj('Vendedor','Nome é opcional por permissão; código não concede acesso a outras vendas.',{
 'codigo':text('Código textual do vendedor único identificado; null quando ausente/ambíguo.','operacoes.vendedor_codigo',True),
 'nome':text('Omitido sem vendas:pessoas:ler e incluir_pessoas=true; null se autorizado mas sem dado.','operacoes.vendedor_nome',True)},optional=['nome'])
obj('NotaFiscal','Estado fiscal recebido, sem tradução de códigos ou validação na SEFAZ.',{
 'numero_nota':text('Número preservado como texto, inclusive zeros recebidos.','complementos.nota_fiscal.numero_nota',True,maxLength=500),
 'modelo':text('Modelo textual; não traduz automaticamente para NF-e/NFC-e.','complementos.nota_fiscal.modelo',True,maxLength=500),
 'idnfe':text('Identificador fiscal como recebido. Não assumir que todo valor seja chave de acesso de 44 dígitos.','complementos.nota_fiscal.idnfe',True,maxLength=500),
 'status':text('Status fiscal informado; null quando indisponível.','complementos.nota_fiscal.status',True,maxLength=500)})
obj('CondicaoPagamento','Condição comercial; não comprova recebimento ou liquidação.',{
 'id':text('Identificador recebido.','complementos.condicoes_pgto',True,maxLength=500),
 'codigo':text('Código da condição.','complementos.codigo_condicaopgto',True,maxLength=500),
 'descricao':text('Descrição recebida.','complementos.desc_condicoes_pgto',True,maxLength=500)})
obj('Conferencia','Indicadores de consistência dos valores e quantidades da operação.',{
 'situacao':text('Classificação de consistência da operação.','operacoes.conciliacao + marcação de erro ERP',enum=['pendente','conciliada','quantidade_divergente','divergente','contrato_incompleto','regra_pendente','nao_elegivel','erro_erp_confirmado']),
 'tolerancia_centavos':money('Tolerância de comparação, expressa em centavos.','regra atual de conciliação',const='2'),
 'erro_erp_confirmado':field('boolean','Indica uma divergência validada na origem, sem alterar os valores retornados.','operacoes.erro_erp_confirmado_por IS NOT NULL'),
 'homologacao_comercial':text('Estado de validação comercial. Nesta versão retorna nao_declarada.','R11/R22',const='nao_declarada')})
sale_fields={
 'id':text('Identidade estável no tenant: vnd_{filial_id}_{tipo_operacao}_{cod_operacao}. ',pattern=r'^vnd_\d+_[A-Z]+_\d+$'),
 'filial_id':ident('ID interno da filial, não seu código de exibição.','operacoes.filial'),
 'cod_operacao':ident('Código da operação; considerar também a filial e o tipo para identificar o registro.','operacoes.cod_operacao'),
 'tipo_operacao':text('S=saída/venda; E=entrada. Entrada não é devolução automaticamente.','operacoes.tipo_operacao',enum=['S','E']),
 'data_operacao':date('Data civil da operação no fuso America/Sao_Paulo.','operacoes.data_operacao'),
 'hora_venda':text('Campo reservado; retorna null nesta versão.','não disponível: R29',True,const=None),
 'quantidade':field('integer','Peças do cabeçalho. Pode divergir da soma dos itens.','operacoes.quantidade',minimum=0),
 'valor_final_centavos':money('Valor total informado para a operação.','operacoes.valor_final_centavos'),
 'cancelada':field('boolean','Indica se a venda está cancelada.','operacoes.cancelada OR EXISTS cancelamentos'),
 'vendedor':ref('Vendedor','Identificação disponível; nome exige permissão específica.',origin='operacoes.vendedor_codigo/vendedor_nome'),
 'evento_codigo':text('Código de classificação da operação na origem.','operacoes.evento_codigo',True),
 'conferencia':ref('Conferencia','Indicadores de consistência da operação.'),
 'versao':ident('Versão monotônica do recurso na API.'),
 'atualizado_em':timestamp('Instante de disponibilização desta versão do recurso.')}
obj('VendaResumo','Cabeçalho retornado na lista e na referência de eventos.',sale_fields)
obj('Venda','Detalhe sem arrays volumosos; itens/pagamentos possuem endpoints paginados.',{
 **copy.deepcopy(sale_fields),
 'ajuste_centavos':money('Ajuste monetário da operação; null é ausência, não zero.','operacoes.ajuste_centavos',True),
 'subtotal_itens_centavos':money('Soma dos preços recebidos × quantidades. Não reaplica desconto.','operacoes.subtotal_itens_centavos',True),
 'frete_centavos':money('Frete recebido; null não deve ser presumido zero.','complementos.frete_centavos',True),
 'cortesia_informada':{'description':'Informação de cortesia no formato recebido. Não possui unidade monetária definida neste contrato.','x-origem':'complementos.cortesia_informada','type':['string','number','boolean','null']},
 'nota_fiscal':ref('NotaFiscal','Null enquanto o grupo não foi importado; objeto com nulos quando importado sem valores.',True,'complementos.nota_fiscal'),
 'condicao_pagamento':ref('CondicaoPagamento','Null quando complementos ausentes.',True,'complementos'),
 'cobertura':ref('Cobertura','Cobertura de cada parte da operação.'),
 'cancelada_em':timestamp('Data/hora do evento de cancelamento, quando existente.','cancelamentos.data_cancelou',True),
 'clientes':array('ClienteVenda','Omitido sem permissão e opt-in. Null=pending; []=fonte sem cliente.','operacoes.clientes',True),
 'itens_url':text('Rota relativa paginada; usar ETag em If-Match.',format='uri-reference'),
 'pagamentos_url':text('Rota relativa paginada; usar ETag em If-Match.',format='uri-reference')},optional=['clientes'])
obj('ItemVenda','Snapshot de item na venda; preço não é uma tabela atual do catálogo.',{
 'ordem':field('integer','Posição importada, baseada em zero. Pode mudar no reprocessamento; atualizar coleção inteira da revisão.','operacao_itens.ordem',minimum=0),
 'sku':text('SKU textual; null se a fonte não informou.','operacao_itens.sku',True),
 'cod_produto':text('Código comercial, não necessariamente o ID interno produto.','operacao_itens.cod_produto',True),
 'descricao':text('Descrição no momento importado.','operacao_itens.descricao',True),
 'quantidade':field('integer','Quantidade inteira positiva.','operacao_itens.quantidade',minimum=1),
 'preco_centavos':money('Preço unitário recebido usado no subtotal.','operacao_itens.preco_centavos'),
 'preco_tabela_centavos':money('Preço de tabela informado nesse item.','operacao_itens.preco_tabela_centavos',True),
 'preco_aplicado_centavos':money('Preço aplicado informado nesse item; não substituir automaticamente preco_centavos.','operacao_itens.preco_aplicado_centavos',True),
 'desconto_percentual_informado':text('Percentual textual: 20 significa 20%. Informativo; não reaplicar.','operacao_itens.desconto_informado',True,pattern=r'^-?\d+(\.\d+)?$'),
 'subtotal_centavos':money('Quantidade × preco_centavos, calculado exatamente.','derivado de operacao_itens'),
 'imagem_disponivel':field('boolean','Existe referência de imagem autorizada. URL bruta não será publicada nesta versão.','derivado de operacao_itens.imagem_url')})
obj('Pagamento','Lançamento importado, não confirmação de liquidação.',{
 'ordem':field('integer','Posição baseada em zero nesta revisão; não é identificador financeiro durável.',minimum=0),
 'origem':text('Origem recebida.','complementos.lancamentos[].origem',True),
 'n_documento':text('Documento/parcela como recebido.','complementos.lancamentos[].n_documento',True),
 'data_emissao':date('Dia de emissão normalizado em São Paulo.','complementos.lancamentos[].data_emissao',True),
 'data_vencimento':date('Dia de vencimento; não comprova pagamento.','complementos.lancamentos[].data_vencimento',True),
 'desc_tipopgto':text('Descrição da modalidade.','complementos.lancamentos[].desc_tipopgto',True),
 'nsu':text('NSU textual; não é número de cartão.','complementos.lancamentos[].nsu',True),
 'valor_inicial_centavos':money('Valor inicial recebido; parcelas não devem duplicar o total da venda.','complementos.lancamentos[].valor_inicial_centavos',True),
 'desc_gerador':text('Omitido sem permissão de pessoas e opt-in.','complementos.lancamentos[].desc_gerador',True),
 'historico':text('Texto livre potencialmente pessoal; omitido sem permissão de pessoas e opt-in.','complementos.lancamentos[].historico',True)},optional=['desc_gerador','historico'])
obj('Filial','Cadastro mínimo disponível; lista limitada às filiais concedidas ao cliente.',{
 'id':ident('ID interno da filial.','cadastro_filiais.filial'),
 'codigo':text('Código de exibição, por exemplo LOJA-DEMO.','cadastro_filiais.cod_filial',True),
 'fantasia':text('Nome fantasia importado.','cadastro_filiais.fantasia',True),
 'trans_id_origem':ident('Cursor cadastral recebido. Não serve como cursor externo.','cadastro_filiais.trans_id',True),
 'versao':ident('Revisão da projeção externa.'),
 'atualizado_em':timestamp('Instante desta revisão externa.')})
obj('ClassificacaoItem','Dimensão cadastral: código e descrição podem estar ausentes.',{
 'codigo':text('Código textual da dimensão.','cadastro_produtos.classificacao.<dimensao>.codigo',True),
 'descricao':text('Descrição textual da dimensão.','cadastro_produtos.classificacao.<dimensao>.descricao',True)})
obj('ClassificacaoProduto','Classificações cadastrais do produto.',{
 k:ref('ClassificacaoItem','Classificação de '+k+'.',origin='cadastro_produtos.classificacao.'+k)
 for k in ['colecao','departamento','grupo','categoria','grade','marca']})
obj('Produto','Produto básico; visível somente se vinculado à filial autorizada solicitada.',{
 'id':ident('ID interno do produto. Não confundir com código comercial.','cadastro_produtos.produto'),
 'codigo':text('Código comercial.','cadastro_produtos.cod_produto'),
 'descricao':text('Descrição cadastral.','cadastro_produtos.descricao'),
 'tipo_prod':text('Código de tipo cadastral do produto; null quando indisponível.','cadastro_produtos.tipo_prod',True,maxLength=20),
 'classificacao':ref('ClassificacaoProduto','Coleção, departamento, grupo, categoria, grade e marca.'),
 'trans_id_origem':ident('Transação cadastral recebida, não cursor externo.','cadastro_produtos.trans_id',True),
 'cadastro_consultado_em':timestamp('Último enriquecimento cadastral bem-sucedido.','cadastro_produtos.enriquecido_em',True),
 'cadastro_disponivel':field('boolean','Existe cadastro enriquecido; false não equivale a produto inexistente.','derivado de cadastro_produtos.enriquecido_em'),
 'versao':ident('Revisão da camada externa.'),
 'atualizado_em':timestamp('Instante da revisão externa.')})
obj('Variacao','Identidade por filial e SKU; não agrupar tamanhos/cores ao integrar estoque.',{
 'filial_id':ident('Filial da variação autorizada.','estoque_atual.filial'),
 'produto_id':ident('ID interno do produto básico.','estoque_atual.produto'),
 'sku':text('SKU exato, preservando caixa e caracteres. Codificar com percent-encoding em path.','estoque_atual.sku',minLength=1,maxLength=200),
 'cor':text('Cor textual.','estoque_atual.cor',True),
 'tamanho':text('Tamanho textual.','estoque_atual.tamanho',True),
 'codigo_barras':text('Código de barras textual; preservar zeros à esquerda.','estoque_atual.barra',True),
 'tipo_prod':text('Código de tipo da variação.','cadastro_produtos.tipo_prod / estoque_atual.tipo_prod',True,maxLength=20),
 'tipo_prod_origem':text('Referência da classificação da variação; null quando desconhecida.','derivado da prioridade cadastral',True,enum=['cadastro','estoque',None]),
 'presente_ultima_carga':field('boolean','False é ausência na última carga completa, não estoque zero.','estoque_atual.presente_ultima_carga')})
obj('Estoque','Posição atual; não representa abertura/movimentos históricos.',{
 **copy.deepcopy(SCHEMAS['Variacao']['properties']),
 'saldo_disponivel':text('Decimal exato, pode ser negativo ou null. Já desconta reservas. Ausência na carga completa deve retornar null.','estoque_atual.saldo',True,pattern=r'^-?\d{1,14}(\.\d{1,6})?$'),
 'reservas_ja_descontadas':field('boolean','Indica que o saldo disponível já considera as reservas.','regra confirmada do saldo',const=True),
 'sincronizacao':ref('Sincronizacao','Indicadores de atualização da posição por filial.'),
 'versao':ident('Revisão externa do par filial/SKU.'),
 'atualizado_em':timestamp('Instante da revisão externa.')})
obj('Alteracao','Registro durável e ordenado por publicação confirmada; sem dados pessoais.',{
 'id':text('ID do evento, usado também no webhook quando aplicável.',format='uuid'),
 'recurso':text('Recurso alterado.',enum=['vendas','filiais','produtos','estoques']),
 'recurso_id':text('Identidade do recurso dentro do tenant. Em estoque é ID opaco estável do par filial/SKU.'),
 'filial_id':ident('Filial autorizada desta projeção.'),
 'acao':text('Ausente é tombstone de estoque; não é zeragem.',enum=['upsert','cancelada','ausente']),
 'versao':ident('Versão monotônica do recurso. Aplicar somente se maior que a versão local.'),
 'registrado_em':timestamp('Instante de disponibilização da alteração.'),
 'consulta_url':text('Rota relativa para consultar a versão atual; pode estar mais recente que o evento.',format='uri-reference')})
obj('PaginaAlteracoes','Continuação do log; cursor retorna mesmo em página vazia.',{
 'limite':field('integer','Limite de eventos nesta página.',minimum=1,maximum=200),
 'quantidade':field('integer','Quantidade efetiva.',minimum=0,maximum=200),
 'tem_mais':field('boolean','Há eventos já publicados a continuar lendo.'),
 'cursor_proximo':text('Salvar somente após persistir a página. Continua válido para polling sem novidades.',maxLength=4096)})
obj('MetaAlteracoes','Não utiliza snapshot de listagem com TTL de 30 minutos.',{
 'request_id':text('Correlação.',format='uuid'),
 'gerado_em':timestamp('Instante da resposta.'),
 'retencao_dias':field('integer','Retenção do log de alterações em dias.',const=30)})
obj('Problem','Erro estruturado conforme RFC 9457.',{
 'type':text('URN estável que identifica a classe de problema.',format='uri'),
 'title':text('Descrição curta.'),
 'status':field('integer','Código HTTP igual ao status da resposta.',minimum=400,maximum=599),
 'detail':text('Orientação segura para corrigir a requisição.'),
 'instance':text('Identificador desta ocorrência.',format='uri'),
 'code':text('Código estável para automação, por exemplo CURSOR_EXPIRED.'),
 'request_id':text('Mesmo valor do header X-Request-Id.',format='uuid'),
 'campos':field('array','Erros pontuais opcionais; valores sensíveis não aparecem.',items={'type':'object','properties':{'campo':{'type':'string'},'motivo':{'type':'string'}},'required':['campo','motivo']})},optional=['campos'])
obj('TokenRequest','Requisição de token com autenticação private_key_jwt.',{
 'grant_type':text('Fluxo servidor a servidor.',const='client_credentials'),
 'client_id':text('Identidade da integração cadastrada.',minLength=1,maxLength=128),
 'scope':text('Escopos separados por espaço; somente subconjunto concedido.',minLength=1,maxLength=512),
 'client_assertion_type':text('Tipo da prova assinada.',const='urn:ietf:params:oauth:client-assertion-type:jwt-bearer'),
 'client_assertion':text('JWT assinado RS256 com kid registrado, iss=sub=client_id, aud exato do token endpoint, iat/exp e jti único.',minLength=32,maxLength=8192)},request=True)
obj('TokenResponse','Access token opaco com 15 minutos; não é o JWT da prova de cliente.',{
 'access_token':text('Segredo transitório de ao menos 256 bits; valor demonstrativo nos exemplos.'),
 'token_type':text('Tipo de apresentação.',const='Bearer'),
 'expires_in':field('integer','Validade em segundos.',const=900),
 'scope':text('Escopos efetivamente concedidos.')})
obj('OAuthError','Erros do token seguem OAuth, sem o envelope Problem dos recursos.',{
 'error':text('Código OAuth.',enum=['invalid_request','invalid_client','invalid_scope','unsupported_grant_type','temporarily_unavailable']),
 'error_description':text('Descrição segura; não revela existência de chave/cliente.')})
events=['venda.importada','venda.atualizada','venda.cancelada']
obj('WebhookRequest','Inscrição do próprio cliente, com destino aprovado e subconjunto de filiais.',{
 'nome':text('Nome operacional, sem credenciais.',minLength=1,maxLength=120),
 'url':text('HTTPS, porta 443, hostname previamente autorizado; sem userinfo, query ou fragmento.',format='uri',maxLength=2048),
 'eventos':field('array','Tipos de venda a receber.',items={'type':'string','enum':events},minItems=1,maxItems=3,uniqueItems=True),
 'filiais':field('array','IDs concedidos ao cliente. Ampliação exige nova aprovação.',items={'type':'string','pattern':r'^\d{1,30}$'},minItems=1,maxItems=100,uniqueItems=True),
 'ativo':field('boolean','Só permite ativação após teste assinado confirmado. Na criação deve ser false.',default=False)},request=True)
obj('WebhookCriacaoRequest','Criação somente desativada; o teste precede a ativação.',{
 **copy.deepcopy(SCHEMAS['WebhookRequest']['properties']),
 'ativo':field('boolean','Obrigatoriamente false na criação.',const=False)},request=True)
obj('Webhook','Configuração pública da inscrição; GET nunca retorna o segredo.',{
 'id':text('Identificador da inscrição.',format='uuid'),
 **copy.deepcopy(SCHEMAS['WebhookRequest']['properties']),
 'estado':text('Estado operacional.',enum=['pendente_verificacao','ativo','pausado','desativado']),
 'verificado_em':timestamp('Último teste do destino confirmado.',nullable=True),
 'criado_em':timestamp('Cadastro da inscrição.'),
 'atualizado_em':timestamp('Última configuração.'),
 'versao':ident('Versão da configuração para controle de concorrência.')})
obj('WebhookComSegredo','Somente resposta à criação/rotação, incluindo repetição idempotente por até 24h.',{
 'webhook':ref('Webhook','Configuração resultante.'),
 'signing_secret':text('whsec_ + base64 padrão de 32 bytes aleatórios. Nunca confundir com access_token.',pattern=r'^whsec_[A-Za-z0-9+/]{43}=$'),
 'chave_anterior_valida_ate':timestamp('Sobreposição de 24h na rotação; null na criação.',nullable=True)})
obj('ReferenciaVenda','Snapshot mínimo capturado na revisão do evento; sem clientes, contatos ou nomes.',{
 'id':copy.deepcopy(sale_fields['id']),
 'filial_id':copy.deepcopy(sale_fields['filial_id']),
 'cod_operacao':copy.deepcopy(sale_fields['cod_operacao']),
 'tipo_operacao':text('Webhooks da primeira versão notificam somente S.','operacoes.tipo_operacao',const='S'),
 'cancelada':copy.deepcopy(sale_fields['cancelada']),
 'quantidade':copy.deepcopy(sale_fields['quantidade']),
 'valor_final_centavos':copy.deepcopy(sale_fields['valor_final_centavos']),
 'consulta_url':text('GET protegido; retorna estado atual, possivelmente mais recente.',format='uri-reference')})
obj('EventoVenda','Notificação assinada. Os arrays completos são consultados pela API.',{
 'id':text('UUID imutável, igual a webhook-id.',format='uuid'),
 'tipo':text('Tipo de notificação da venda.',enum=events),
 'schema_version':text('Versão do payload de webhook, separada da revisão do recurso.',const='1.0'),
 'criado_em':timestamp('Instante de disponibilização do evento.'),
 'recurso_versao':ident('Revisão da venda do snapshot mínimo.'),
 'origem_carga':text('Distingue importação inicial e rotina contínua.',enum=['historica','continua','reprocessamento']),
 'campos_alterados':field('array','Caminhos públicos alterados; nenhum valor pessoal.',items={'type':'string'},maxItems=100),
 'data':ref('ReferenciaVenda','Dados mínimos desta revisão.')})
obj('EventoTeste','Teste assinado que não representa venda real.',{
 'id':text('Mesmo webhook-id.',format='uuid'),
 'tipo':text('Evento de verificação.',const='webhook.teste'),
 'schema_version':text('Versão do payload.',const='1.0'),
 'criado_em':timestamp('Instante do teste.'),
 'data':field('object','Somente confirmação do teste.',properties={'mensagem':{'type':'string','const':'Teste de conectividade e assinatura'}},required=['mensagem'])})
obj('Entrega','Metadados de entrega, sem segredos ou corpo de resposta do destinatário.',{
 'id':text('Identificador do ciclo de entrega para esta inscrição.',format='uuid'),
 'webhook_id':text('Inscrição proprietária.',format='uuid'),
 'evento_id':text('Evento imutável; permanece no reenvio.',format='uuid'),
 'estado':text('Estado de entrega, não processamento comercial do consumidor.',enum=['na_fila','enviando','aceita','aguardando_retry','falha_permanente','expirada']),
 'tentativas':field('integer','Tentativas deste ciclo automático.',minimum=0,maximum=10),
 'ultimo_http_status':field('integer','Status HTTP ou null em erro de transporte.',nullable=True,minimum=100,maximum=599),
 'proxima_tentativa_em':timestamp('Programação ou null se finalizado.',nullable=True),
 'criado_em':timestamp('Primeira inclusão na fila.'),
 'finalizado_em':timestamp('Fim do ciclo, se houve.',nullable=True)})
obj('AceiteFila','202 confirma fila persistida, não envio/entrega.',{
 'id':text('Identificador da solicitação.',format='uuid'),
 'estado':text('Estado inicial.',const='na_fila')})

for item in ['Filial','Produto','Variacao','Estoque','VendaResumo','ItemVenda','Pagamento','Webhook','Entrega']:
    obj('Lista'+item,'Envelope paginado de '+item+'.',{
      'data':array(item,'Itens desta página.'),'paginacao':ref('Paginacao'),'meta':ref('MetaConsulta')})
for item in ['Filial','Produto','Estoque','Venda','Webhook']:
    obj('Resposta'+item,'Envelope pontual de '+item+'.',{'data':ref(item),'meta':ref('MetaConsulta')})
obj('ListaAlteracoes','Log incremental, incluindo cancelamentos e ausência de SKU.',{
 'data':array('Alteracao','Eventos ordenados por publicação confirmada.'),'paginacao':ref('PaginaAlteracoes'),'meta':ref('MetaAlteracoes')})

SCOPES={
 'vendas:ler':'Cabeçalhos, itens, pagamentos e dados fiscais sem pessoas.',
 'vendas:pessoas:ler':'Nomes, snapshots de clientes e textos pessoais, com opt-in; exige também vendas:ler.',
 'filiais:ler':'Cadastro das filiais explicitamente autorizadas.',
 'produtos:ler':'Catálogo/variações vinculados a filiais concedidas.',
 'estoques:ler':'Posições de saldo das filiais concedidas.',
 'webhooks:ler':'Consultar inscrições e entregas do próprio cliente; exige vendas:ler.',
 'webhooks:gerenciar':'Criar/testar/alterar/rotacionar/reencaminhar inscrições próprias; exige vendas:ler.'}
spec={'openapi':'3.1.0','info':{'title':'Join Network · API de Integrações Varejo','version':'0.1.0',
 'description':'Consultas de vendas, filiais, produtos e estoque, sincronização incremental e webhooks assinados. Autenticação OAuth 2.0 com private_key_jwt. Exemplos com dados fictícios. A disponibilidade de webhooks depende da habilitação da integração e da verificação do destino.'},
 'servers':[{'url':BASE,'description':'API de Integrações'}],
 'tags':[{'name':n} for n in ['Autenticacao','Vendas','Filiais','Produtos','Estoques','Alteracoes','Webhooks']],
 'security':[{'IntegracaoOAuth':[]}], 'paths':{}, 'components':{'securitySchemes':{
 'IntegracaoOAuth':{'type':'oauth2','description':'Client Credentials + private_key_jwt RS256 no token endpoint. O access token é opaco. O acesso é limitado à organização, às filiais e aos escopos da credencial.','flows':{'clientCredentials':{'tokenUrl':BASE+'/oauth/token','scopes':SCOPES}}},
 'WebhookSignature':{'type':'apiKey','in':'header','name':'webhook-signature','description':'HMAC-SHA256 Standard Webhooks: v1,BASE64; exige também webhook-id e webhook-timestamp. Não usa Bearer do destinatário.'}},'schemas':SCHEMAS}}

def param(name, description, schema=None, required=False, location='query'):
    return {'name':name,'in':location,'required':required,'description':description,'schema':schema or {'type':'string'}}
def path_id(name):return param(name,'Identidade do recurso no tenant da credencial.',required=True,location='path')
def page():return [param('limite','Padrão 100; máximo 200.',{'type':'integer','minimum':1,'maximum':200,'default':100}),param('cursor','Continuação opaca. Repetir filtros idênticos e não decodificar.',{'type':'string','maxLength':4096})]
def branch():return param('filial_id','Uma filial explicitamente concedida ao cliente.',{'type':'string','pattern':r'^\d{1,30}$'},True)
def persons():return param('incluir_pessoas','Exige vendas:pessoas:ler; false por padrão.',{'type':'boolean','default':False})
def header_match():return param('If-Match','ETag do detalhe para iniciar leitura de filhos ou alterar configuração. 412 em versão divergente.',required=True,location='header')
def idem():return param('Idempotency-Key','UUID obrigatório. Mesma operação/corpo retorna resultado anterior por 24h; corpo divergente resulta 409.',{'type':'string','format':'uuid'},True,'header')
def response(schema, description='Sucesso', media='application/json'):
    return {'description':description,'headers':{'X-Request-Id':{'schema':{'type':'string','format':'uuid'}},'X-RateLimit-Limit':{'description':'Limite aplicável de requisições por minuto.','schema':{'type':'integer'}},'X-RateLimit-Remaining':{'schema':{'type':'integer'}},'X-RateLimit-Reset':{'description':'Unix timestamp em segundos.','schema':{'type':'integer'}}},'content':{media:{'schema':ref(schema)}}}
def operation(path, method, summary, tag, scopes, schema, params=(), body=None, status='200', description=''):
    errors=['400','401','403','404','405','406','409','410','412','413','415','422','429','500','503']
    responses={status:response(schema)}
    for code in errors:
        responses[code]=response('Problem','Erro de contrato/permissão/limite; ver code e request_id.','application/problem+json')
    responses['401']['headers']['WWW-Authenticate']={'schema':{'type':'string'},'description':'Bearer challenge conforme a falha.'}
    responses['429']['headers']['Retry-After']={'schema':{'type':'integer','minimum':1},'description':'Segundos antes de tentar novamente.'}
    responses['503']['headers']['Retry-After']={'schema':{'type':'integer','minimum':1}}
    o={'summary':summary,'description':description or summary,'operationId':method+'_'+path.replace('/','_').replace('{','').replace('}','').replace('-','_'),'tags':[tag],
       'security':[{'IntegracaoOAuth':scopes}],'parameters':list(params),'responses':responses}
    if body:o['requestBody']={'required':True,'content':{'application/json':{'schema':ref(body)}}}
    spec['paths'].setdefault(path,{})[method]=o
    return o

o=operation('/oauth/token','post','Obter token de integração','Autenticacao',[],'TokenResponse',description='Autentica a integração por private_key_jwt e emite um token de acesso opaco.')
o['security']=[];o['requestBody']={'required':True,'content':{'application/x-www-form-urlencoded':{'schema':ref('TokenRequest')}}}
o['responses']={k:response('OAuthError','Erro OAuth') for k in ['400','401','429','503']};o['responses']['200']=response('TokenResponse')
o['responses']['429']['headers']['Retry-After']={'schema':{'type':'integer'}}
o['responses']['401']['headers']['WWW-Authenticate']={'schema':{'type':'string'}}
o['responses']['200']['headers']['Cache-Control']={'schema':{'type':'string','const':'no-store'}}
filters=[branch(),param('inicio','Primeiro dia civil, inclusivo.',{'type':'string','format':'date'},True),param('fim','Último dia civil, inclusivo. Até 31 dias por consulta.',{'type':'string','format':'date'},True),param('estado','Situação da venda; inclui ativas e canceladas por padrão.',{'type':'string','enum':['todas','ativas','canceladas'],'default':'todas'}),param('tipo_operacao','E não é devolução por inferência.',{'type':'string','enum':['S','E','todas'],'default':'S'}),persons(),*page()]
operation('/v1/vendas','get','Listar vendas e movimentações','Vendas',['vendas:ler'],'ListaVendaResumo',filters,description='Ordenação estável por data_operacao, cod_operacao e tipo_operacao crescentes no snapshot. Sem expansão de itens.')
o=operation('/v1/vendas/{venda_id}','get','Consultar detalhe da venda','Vendas',['vendas:ler'],'RespostaVenda',[path_id('venda_id'),persons()])
o['responses']['200']['headers']['ETag']={'description':'ETag desta revisão, necessário para ler itens/pagamentos com consistência.','schema':{'type':'string'}}
for part,schema in [('itens','ItemVenda'),('pagamentos','Pagamento')]:
 operation('/v1/vendas/{venda_id}/'+part,'get','Consultar '+part+' da venda','Vendas',['vendas:ler'],'Lista'+schema,[path_id('venda_id'),header_match(),persons(),*page()],description='Header da venda e filhos devem pertencer à mesma revisão. If-Match validado ao iniciar snapshot; cursor mantém essa revisão por 30 minutos.')
operation('/v1/filiais','get','Listar filiais concedidas','Filiais',['filiais:ler'],'ListaFilial',page())
operation('/v1/filiais/{filial_id}','get','Consultar filial','Filiais',['filiais:ler'],'RespostaFilial',[path_id('filial_id')])
product_filters=[branch(),param('busca','Código ou descrição; de 2 a 100 caracteres.',{'type':'string','minLength':2,'maxLength':100}),param('tipo_prod','Filtra produtos com variação presente do tipo efetivo na filial.',{'type':'string','enum':['todos','AC','SE','MP','MC','desconhecido'],'default':'todos'}),*page()]
operation('/v1/produtos','get','Listar produtos da filial','Produtos',['produtos:ler'],'ListaProduto',product_filters)
operation('/v1/produtos/{produto_id}','get','Consultar produto cadastral','Produtos',['produtos:ler'],'RespostaProduto',[path_id('produto_id'),branch()])
operation('/v1/produtos/{produto_id}/variacoes','get','Listar SKUs do produto na filial','Produtos',['produtos:ler'],'ListaVariacao',[path_id('produto_id'),branch(),*page()])
operation('/v1/estoques','get','Consultar posição atual por SKU','Estoques',['estoques:ler'],'ListaEstoque',[branch(),param('produto_id','ID interno opcional.'),param('sku','SKU exato opcional.',{'type':'string','maxLength':200}),param('saldo','Filtro sobre o saldo conhecido; ausente permanece diferente de zero.',{'type':'string','enum':['todos','positivo','zero','negativo','desconhecido'],'default':'todos'}),param('incluir_ausentes','Inclui tombstones preservados de SKUs ausentes na carga completa.',{'type':'boolean','default':False}),*page()])
operation('/v1/filiais/{filial_id}/estoques/{sku}','get','Consultar um SKU na filial','Estoques',['estoques:ler'],'RespostaEstoque',[path_id('filial_id'),param('sku','SKU exato, percent-encoded uma vez.','' or {'type':'string','maxLength':200},True,'path')],description='SKU ausente na carga completa pode retornar tombstone presente_ultima_carga=false, saldo_disponivel=null. Nunca inventar zero.')
operation('/v1/alteracoes','get','Consumir log incremental','Alteracoes',[],'ListaAlteracoes',[branch(),param('recurso','Exige o escopo correspondente, dinamicamente validado.',{'type':'string','enum':['vendas','filiais','produtos','estoques']},True),param('posicao','Somente atual para obter um checkpoint inicial sem eventos. Mutuamente exclusivo com cursor.',{'type':'string','enum':['atual']}),*page()],description='Requer vendas:ler, filiais:ler, produtos:ler ou estoques:ler conforme recurso. Após bootstrap, cursor é obrigatório. Cursor com retenção de 30 dias; 410 exige nova carga. Não usa updated_at como posição confiável.')
spec['paths']['/v1/alteracoes']['get']['security']=[{'IntegracaoOAuth':[s]} for s in ['vendas:ler','filiais:ler','produtos:ler','estoques:ler']]
operation('/v1/webhooks','get','Listar inscrições do cliente','Webhooks',['webhooks:ler','vendas:ler'],'ListaWebhook',page())
operation('/v1/webhooks','post','Criar inscrição desativada','Webhooks',['webhooks:gerenciar','vendas:ler'],'WebhookComSegredo',[idem()],body='WebhookCriacaoRequest',status='201',description='Máximo de 3 inscrições por cliente; ativo deve ser false. Segredo não é retornado em GET. Uma repetição idempotente pode reproduzir a resposta por até 24h.')
operation('/v1/webhooks/{webhook_id}','get','Consultar inscrição própria','Webhooks',['webhooks:ler','vendas:ler'],'RespostaWebhook',[path_id('webhook_id')])
o=spec['paths']['/v1/webhooks/{webhook_id}']['get'];o['responses']['200']['headers']['ETag']={'schema':{'type':'string'}}
operation('/v1/webhooks/{webhook_id}','put','Substituir configuração da inscrição','Webhooks',['webhooks:gerenciar','vendas:ler'],'RespostaWebhook',[path_id('webhook_id'),header_match(),idem()],body='WebhookRequest',description='Alterar destino exige novo teste, aprovação do hostname e estado pendente_verificacao. Não segue redirects.')
operation('/v1/webhooks/{webhook_id}/testes','post','Enfileirar teste assinado','Webhooks',['webhooks:gerenciar','vendas:ler'],'AceiteFila',[path_id('webhook_id'),idem()],status='202')
operation('/v1/webhooks/{webhook_id}/rotacionar-segredo','post','Rotacionar segredo de assinatura','Webhooks',['webhooks:gerenciar','vendas:ler'],'WebhookComSegredo',[path_id('webhook_id'),header_match(),idem()],description='Sobreposição de 24h; o emissor assina com ambas as chaves durante a transição.')
operation('/v1/webhooks/{webhook_id}/entregas','get','Consultar entregas da inscrição','Webhooks',['webhooks:ler','vendas:ler'],'ListaEntrega',[path_id('webhook_id'),*page()])
operation('/v1/webhooks/{webhook_id}/entregas/{entrega_id}/reenviar','post','Enfileirar reenvio autorizado','Webhooks',['webhooks:gerenciar','vendas:ler'],'AceiteFila',[path_id('webhook_id'),path_id('entrega_id'),idem()],status='202',description='Mantém evento/payload; nova assinatura e timestamp. Revalida permissões e destino. Até 30 dias de retenção; 410 depois disso.')
spec['webhooks']={'eventoVenda':{'post':{'summary':'Receber evento de venda ou teste','operationId':'receberEventoVenda','tags':['Webhooks'],'description':'Endpoint implementado pelo integrador para receber notificações HTTPS. Verifique a assinatura HMAC sobre os bytes originais e persista o evento antes de responder com sucesso.',
 'security':[{'WebhookSignature':[]}], 'parameters':[param('webhook-id','UUID do corpo; estável em retries e replay.',{'type':'string','format':'uuid'},True,'header'),param('webhook-timestamp','Unix timestamp em segundos. Tolerância de 300 segundos.',{'type':'string','pattern':r'^\d+$'},True,'header')],
 'requestBody':{'required':True,'content':{'application/json':{'schema':{'oneOf':[ref('EventoVenda'),ref('EventoTeste')]}}}},
 'responses':{'204':{'description':'Recebido e persistido duravelmente pelo consumidor; não significa processamento comercial concluído.'},'400':{'description':'Payload inválido; falha permanente.'},'401':{'description':'Assinatura ou timestamp inválido; inscrição deve ser pausada para revisão.'},'429':{'description':'Consumidor saturado; Retry-After em segundos.'},'503':{'description':'Falha transitória; reenfileirar.'}}}}}

meta={'request_id':'11111111-1111-4111-8111-111111111111','gerado_em':'2026-11-11T12:00:00Z','snapshot_id':None,'snapshot_expira_em':None,'recurso_versao':None}
note={'numero_nota':'000123','modelo':'65','idnfe':'ID-FISCAL-DEMONSTRATIVO','status':None}
sale={'id':'vnd_1001_S_900001','filial_id':'1001','cod_operacao':'900001','tipo_operacao':'S','data_operacao':'2026-11-10','hora_venda':None,'quantidade':2,'valor_final_centavos':'18000','cancelada':False,'vendedor':{'codigo':'42'},'evento_codigo':'10','conferencia':{'situacao':'conciliada','tolerancia_centavos':'2','erro_erp_confirmado':False,'homologacao_comercial':'nao_declarada'},'versao':'12','atualizado_em':'2026-11-11T12:00:00Z'}
detail={**copy.deepcopy(sale),'ajuste_centavos':'-2000','subtotal_itens_centavos':'20000','frete_centavos':None,'cortesia_informada':0,'nota_fiscal':note,'condicao_pagamento':{'id':'5','codigo':'CREDITO2','descricao':'Crédito em duas parcelas'},'cobertura':{'itens':'disponivel','pagamentos':'disponivel','nota_fiscal':'disponivel','pessoas':'restrito','complementos_importados_em':'2026-11-11T12:00:00Z'},'cancelada_em':None,'itens_url':'/v1/vendas/vnd_1001_S_900001/itens','pagamentos_url':'/v1/vendas/vnd_1001_S_900001/pagamentos'}
pagination={'limite':100,'quantidade':1,'tem_mais':False,'cursor_proximo':None}
listmeta={**meta,'snapshot_id':'snp_demo_001','snapshot_expira_em':'2026-11-11T12:30:00Z'}
stock={'filial_id':'1001','produto_id':'700001','sku':'CAMISETA-AZUL-M','cor':'AZUL','tamanho':'M','codigo_barras':'0001234567890','tipo_prod':'AC','tipo_prod_origem':'cadastro','presente_ultima_carga':True,'saldo_disponivel':'12.000000','reservas_ja_descontadas':True,'sincronizacao':{'ultimo_sucesso_em':'2026-11-11T11:58:00Z','consultado_em':'2026-11-11T11:58:00Z','data_atualizacao_erp':None,'ultima_carga_completa_em':'2026-11-11T04:00:00Z','desatualizado':False,'estado':'ok'},'versao':'80','atualizado_em':'2026-11-11T11:58:00Z'}
event={'id':'22222222-2222-4222-8222-222222222222','tipo':'venda.atualizada','schema_version':'1.0','criado_em':'2026-11-11T12:00:00Z','recurso_versao':'12','origem_carga':'continua','campos_alterados':['nota_fiscal'],'data':{k:sale[k] for k in ['id','filial_id','cod_operacao','tipo_operacao','cancelada','quantidade','valor_final_centavos']}}
event['data']['consulta_url']=detail['itens_url'].removesuffix('/itens')
examples={'venda.json':('RespostaVenda',{'data':detail,'meta':meta}),
 'vendas.json':('ListaVendaResumo',{'data':[sale],'paginacao':pagination,'meta':listmeta}),
 'itens.json':('ListaItemVenda',{'data':[{'ordem':0,'sku':'CAMISETA-AZUL-M','cod_produto':'CAM-001','descricao':'Camiseta demonstrativa','quantidade':2,'preco_centavos':'10000','preco_tabela_centavos':'12500','preco_aplicado_centavos':'10000','desconto_percentual_informado':'20','subtotal_centavos':'20000','imagem_disponivel':False}],'paginacao':pagination,'meta':{**listmeta,'recurso_versao':'12'}}),
 'pagamentos.json':('ListaPagamento',{'data':[{'ordem':0,'origem':'DEMO','n_documento':'DEMO/1','data_emissao':'2026-11-10','data_vencimento':'2026-12-10','desc_tipopgto':'CARTAO','nsu':None,'valor_inicial_centavos':'9000'},{'ordem':1,'origem':'DEMO','n_documento':'DEMO/2','data_emissao':'2026-11-10','data_vencimento':'2027-01-10','desc_tipopgto':'CARTAO','nsu':None,'valor_inicial_centavos':'9000'}],'paginacao':{**pagination,'quantidade':2},'meta':{**listmeta,'recurso_versao':'12'}}),
 'filiais.json':('ListaFilial',{'data':[{'id':'1001','codigo':'LOJA-DEMO','fantasia':'Loja demonstrativa','trans_id_origem':'900','versao':'4','atualizado_em':'2026-11-11T11:00:00Z'}],'paginacao':pagination,'meta':listmeta}),
 'produtos.json':('ListaProduto',{'data':[{'id':'700001','codigo':'CAM-001','descricao':'Camiseta demonstrativa','tipo_prod':'AC','classificacao':{k:{'codigo':None,'descricao':None} for k in ['colecao','departamento','grupo','categoria','grade','marca']},'trans_id_origem':'901','cadastro_consultado_em':'2026-11-11T11:00:00Z','cadastro_disponivel':True,'versao':'10','atualizado_em':'2026-11-11T11:00:00Z'}],'paginacao':pagination,'meta':listmeta}),
 'estoque.json':('RespostaEstoque',{'data':stock,'meta':meta}),
 'webhook-venda.json':('EventoVenda',event),
 'webhook-teste.json':('EventoTeste',{'id':'33333333-3333-4333-8333-333333333333','tipo':'webhook.teste','schema_version':'1.0','criado_em':'2026-11-11T12:00:00Z','data':{'mensagem':'Teste de conectividade e assinatura'}}),
 'erro.json':('Problem',{'type':'urn:joinnetwork:problem:rate-limit-exceeded','title':'Limite de requisições atingido','status':429,'detail':'Aguarde o prazo de Retry-After e reduza a concorrência.','instance':'urn:uuid:11111111-1111-4111-8111-111111111111','code':'RATE_LIMIT_EXCEEDED','request_id':meta['request_id']}),
 'alteracoes.json':('ListaAlteracoes',{'data':[{'id':event['id'],'recurso':'vendas','recurso_id':sale['id'],'filial_id':'1001','acao':'upsert','versao':'12','registrado_em':event['criado_em'],'consulta_url':event['data']['consulta_url']}],'paginacao':{'limite':100,'quantidade':1,'tem_mais':False,'cursor_proximo':'cur_demo_continuacao'},'meta':{'request_id':meta['request_id'],'gerado_em':meta['gerado_em'],'retencao_dias':30}})}
for filename,(schema,value) in examples.items():
    p=ROOT/'docs/integracoes/exemplos'/filename;p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
    SCHEMAS[schema].setdefault('examples',[]).append(value)
def remover_metadados_internos(value):
    if isinstance(value, dict):
        for key in list(value):
            if key.startswith('x-'):
                del value[key]
            else:
                remover_metadados_internos(value[key])
    elif isinstance(value, list):
        for item in value:
            remover_metadados_internos(item)

remover_metadados_internos(spec)
(ROOT/'apis/integracoes.openapi.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')

def typename(v):
    if '$ref' in v:return v['$ref'].split('/')[-1]
    if 'anyOf' in v:return ' / '.join(typename(x) for x in v['anyOf'])
    t=v.get('type','objeto');t=' / '.join(t) if isinstance(t,list) else t
    if v.get('items'):t+=' de '+typename(v['items'])
    return t

lines=['# Dicionário de campos','', 'Contrato 0.1.0. Referência de campos das requisições, respostas e eventos da API.','',
 'Todos os exemplos são fictícios. Obrigatório significa presença da chave no contrato; uma chave obrigatória pode aceitar null. Campos pessoais opcionais são omitidos quando não autorizados. Clientes devem tolerar propriedades novas em respostas.','']
count=0
for name,schema in SCHEMAS.items():
    lines+=['## '+name,'',schema['description'],'','| Campo | Tipo | Presença | Descrição e restrições |','| --- | --- | --- | --- |']
    for key,value in schema['properties'].items():
        description=value.get('description','Objeto referenciado; consultar seção correspondente.')
        for attr in ['enum','const','pattern','minimum','maximum','minLength','maxLength','format']:
            if attr in value:description+=' '+attr+'='+json.dumps(value[attr],ensure_ascii=False)+'.'
        cells=['`'+key+'`',typename(value),'obrigatória' if key in schema['required'] else 'opcional / condicional',description]
        lines.append('| '+' | '.join(str(c).replace('|','\\|').replace('\n',' ') for c in cells)+' |');count+=1
    lines.append('')
(ROOT/'docs/integracoes/dicionario.md').write_text('\n'.join(lines))
(ROOT/'docs/integracoes/exemplos/manifesto.json').write_text(json.dumps({name:schema for name,(schema,_) in examples.items()},indent=2)+'\n')
print(json.dumps({'schemas':len(SCHEMAS),'camposDocumentados':count,'operacoes':sum(len(x) for x in spec['paths'].values()),'webhooks':len(spec['webhooks']),'exemplosJSON':len(examples)},ensure_ascii=False))
