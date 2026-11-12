import {randomUUID} from 'node:crypto';
import {hash,canonico} from './seguranca.mjs';
import {transacao,identidade} from './banco.mjs';

const iso=v=>v==null?null:new Date(v).toISOString();
const money=v=>v==null?null:String(v);
const campos=(v,keys)=>Object.fromEntries(keys.map(k=>[k,v?.[k]??null]));
export function itemDTO(i){return {...campos(i,['ordem','sku','cod_produto','descricao','quantidade']),preco_centavos:money(i.preco_centavos),preco_tabela_centavos:money(i.preco_tabela_centavos),preco_aplicado_centavos:money(i.preco_aplicado_centavos),desconto_percentual_informado:money(i.desconto_informado),subtotal_centavos:(BigInt(i.preco_centavos)*BigInt(i.quantidade)).toString(),imagem_disponivel:!!i.imagem_url};}
export function vendaDTO(o,itens){
 const c=o.complementos,id=`vnd_${o.filial}_${o.tipo_operacao}_${o.cod_operacao}`;
 const pagamentos=c?.lancamentos==null?null:c.lancamentos.map((l,ordem)=>({ordem,...campos(l,['origem','n_documento','data_emissao','data_vencimento','desc_tipopgto','nsu','valor_inicial_centavos','desc_gerador','historico'])}));
 return {data:{id,filial_id:o.filial,cod_operacao:o.cod_operacao,tipo_operacao:o.tipo_operacao,data_operacao:o.dia,hora_venda:null,quantidade:o.quantidade,valor_final_centavos:o.valor_final_centavos,cancelada:o.cancelada_efetiva,vendedor:{codigo:o.vendedor_codigo,nome:o.vendedor_nome},evento_codigo:o.evento_codigo,
  conferencia:{situacao:o.erro_erp_confirmado_por?'erro_erp_confirmado':o.conciliacao,tolerancia_centavos:'2',erro_erp_confirmado:!!o.erro_erp_confirmado_por,homologacao_comercial:'nao_declarada'},
  ajuste_centavos:money(o.ajuste_centavos),subtotal_itens_centavos:money(o.subtotal_itens_centavos),frete_centavos:c?.frete_centavos??null,cortesia_informada:c?.cortesia_informada??null,nota_fiscal:c?.nota_fiscal?campos(c.nota_fiscal,['numero_nota','modelo','idnfe','status']):null,
  condicao_pagamento:c?{id:c.condicoes_pgto??null,codigo:c.codigo_condicaopgto??null,descricao:c.desc_condicoes_pgto??null}:null,
  cobertura:{itens:itens.length?'disponivel':'pendente',pagamentos:pagamentos===null?'pendente':'disponivel',nota_fiscal:c?.nota_fiscal?'disponivel':'pendente',pessoas:o.clientes===null?'pendente':'disponivel',complementos_importados_em:iso(o.complementos_importados_em)},cancelada_em:iso(o.data_cancelou),
  clientes:o.clientes===null?null:o.clientes.map(p=>({...campos(p,['cliente_codigo','nome','aniversario_mm_dd']),contatos:(p.contatos??[]).map(t=>campos(t,['tipo','ddd','telefone']))})),itens_url:`/v1/vendas/${id}/itens`,pagamentos_url:`/v1/vendas/${id}/pagamentos`},itens:itens.map(itemDTO),pagamentos};
}
export function variacaoDTO(e){return {filial_id:e.filial,produto_id:e.produto,sku:e.sku,cor:e.cor,tamanho:e.tamanho,codigo_barras:e.barra,tipo_prod:e.tipo_cadastro??e.tipo_prod,tipo_prod_origem:e.tipo_cadastro?'cadastro':e.tipo_prod?'estoque':null,presente_ultima_carga:e.presente_ultima_carga};}
export function sincronizacaoDTO(e,agora=Date.now()){
 const antigo=!e.ultimo_sucesso||agora-new Date(e.ultimo_sucesso).getTime()>1800000;
 return {ultimo_sucesso_em:iso(e.ultimo_sucesso),consultado_em:iso(e.consultado_em),data_atualizacao_erp:iso(e.data_atualizacao_erp),ultima_carga_completa_em:iso(e.ultima_carga_completa),desatualizado:antigo,estado:!e.ultimo_sucesso?'sem_carga':e.falhas_consecutivas>0?'erro':antigo?'atrasado':'ok'};
}
function relevante(v,recurso){
 const c=structuredClone(v);delete c.data.versao;delete c.data.atualizado_em;
 if(recurso==='vendas')delete c.data.cobertura.complementos_importados_em;
 if(recurso==='produtos')delete c.data.cadastro_consultado_em;
 if(recurso==='estoques')delete c.data.sincronizacao;
 return c;
}
export function contextoRecurso(r){return `resource:${r.recurso}:${r.filial}:${r.chave}`;}
export function urlRecurso(recurso,filial,chave){
 if(recurso==='estoques')return `/v1/filiais/${filial}/estoques/${encodeURIComponent(chave)}`;
 return `/v1/${recurso}/${chave}`+(recurso==='produtos'?`?filial_id=${filial}`:'');
}
async function carregar(db,r){
 if(r.recurso==='vendas'){
  const [,filial,tipo,codigo]=/^vnd_(\d+)_([A-Z]+)_(\d+)$/.exec(r.chave);
  const o=(await db.query(`SELECT o.*,to_char(o.data_operacao,'YYYY-MM-DD') AS dia,(o.cancelada OR c.cod_operacao IS NOT NULL) cancelada_efetiva,c.data_cancelou
   FROM operacoes o LEFT JOIN cancelamentos c USING(filial,tipo_operacao,cod_operacao) WHERE o.filial=$1 AND o.tipo_operacao=$2 AND o.cod_operacao=$3`,[filial,tipo,codigo])).rows[0];
  if(!o||!['S','E'].includes(tipo))return null;
  const itens=(await db.query('SELECT * FROM operacao_itens WHERE filial=$1 AND tipo_operacao=$2 AND cod_operacao=$3 ORDER BY ordem',[filial,tipo,codigo])).rows;
  return vendaDTO(o,itens);
 }
 if(r.recurso==='filiais'){
  const p=(await db.query('SELECT * FROM cadastro_filiais WHERE filial=$1',[r.filial])).rows[0];
  return p?{data:{id:p.filial,codigo:p.cod_filial,fantasia:p.fantasia,trans_id_origem:p.trans_id}}:null;
 }
 if(r.recurso==='produtos'){
  const p=(await db.query('SELECT p.* FROM cadastro_produtos p WHERE produto=$1 AND EXISTS(SELECT 1 FROM estoque_atual e WHERE e.produto=p.produto AND e.filial=$2)',[r.chave,r.filial])).rows[0];
  return p?{data:{id:p.produto,codigo:p.cod_produto,descricao:p.descricao,tipo_prod:p.tipo_prod,classificacao:Object.fromEntries(['colecao','departamento','grupo','categoria','grade','marca'].map(k=>[k,campos(p.classificacao[k],['codigo','descricao'])])),trans_id_origem:p.trans_id,cadastro_consultado_em:iso(p.enriquecido_em),cadastro_disponivel:!!p.enriquecido_em}}:null;
 }
 const e=(await db.query(`SELECT e.*,p.tipo_prod AS tipo_cadastro,s.ultimo_sucesso,s.ultima_carga_completa,s.falhas_consecutivas FROM estoque_atual e JOIN cadastro_produtos p USING(produto) LEFT JOIN sync_estoques s USING(filial) WHERE e.filial=$1 AND e.sku=$2`,[r.filial,r.chave])).rows[0];
 return e?{data:{...variacaoDTO(e),saldo_disponivel:e.presente_ultima_carga?e.saldo:null,reservas_ja_descontadas:true,sincronizacao:sincronizacaoDTO(e)}}:null;
}
export function criarPublicador(pool,tenant,cofre,filiais){
 return async function publicar(limite=100){
  return transacao(pool,async db=>{
   // Mesmo lock para todos os publicadores, mantido até COMMIT. A sequência publicada fica sem lacuna de commits.
   const lock=(await db.query("SELECT pg_try_advisory_xact_lock(hashtextextended('integration:publisher',0)) ok")).rows[0].ok;if(!lock)return 0;
   await identidade(db,tenant);
   const pendentes=(await db.query('SELECT * FROM integration_dirty ORDER BY recurso,filial,chave LIMIT $1 FOR UPDATE SKIP LOCKED',[limite])).rows;
   for(const r of pendentes){
    const payload=filiais.includes(r.filial)?await carregar(db,r):null;
    if(payload){
     const anterior=(await db.query('SELECT * FROM integration_resources WHERE recurso=$1 AND filial=$2 AND chave=$3',[r.recurso,r.filial,r.chave])).rows[0];
     const digest=hash(relevante(payload,r.recurso)),mudou=anterior?.hash!==digest;
     const versao=mudou?(BigInt(anterior?.versao??'0')+1n).toString():anterior.versao;
     const atualizado=mudou?new Date().toISOString():iso(anterior.atualizado_em);
     payload.data.versao=versao;payload.data.atualizado_em=atualizado;
     const d=payload.data,filtros={id:d.id??r.chave,data:d.data_operacao??null,tipo:d.tipo_operacao??null,cancelada:d.cancelada??false,produto_id:d.produto_id??null,presente:d.presente_ultima_carga??true,saldo:d.saldo_disponivel??null,tipo_prod:d.tipo_prod??null,busca:r.recurso==='produtos'?(d.codigo+' '+d.descricao).toLocaleLowerCase('pt-BR'):null};
     await db.query(`INSERT INTO integration_resources VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(recurso,filial,chave) DO UPDATE SET versao=$4,hash=$5,dados=$6,filtros=$7,atualizado_em=$8`,[r.recurso,r.filial,r.chave,versao,digest,cofre.cifrar(payload,contextoRecurso(r)),JSON.stringify(filtros),atualizado]);
     if(mudou){
      const id=randomUUID(),url=urlRecurso(r.recurso,r.filial,r.chave),acao=d.cancelada?'cancelada':d.presente_ultima_carga===false?'ausente':'upsert';
      let evento=null,tipoEvento=null;
      if(r.recurso==='vendas'&&d.tipo_operacao==='S'){
       const old=anterior?cofre.abrir(anterior.dados,contextoRecurso(r)):null;
       tipoEvento=!old?'venda.importada':d.cancelada&&!old.data.cancelada?'venda.cancelada':'venda.atualizada';
       const paths=Object.keys(relevante(payload,'vendas').data).filter(k=>canonico(relevante(payload,'vendas').data[k])!==canonico(old?relevante(old,'vendas').data[k]:null));
       if(old&&canonico(old.itens)!==canonico(payload.itens))paths.push('itens');if(old&&canonico(old.pagamentos)!==canonico(payload.pagamentos))paths.push('pagamentos');
       evento={id,tipo:tipoEvento,schema_version:'1.0',criado_em:atualizado,recurso_versao:versao,origem_carga:r.origem,campos_alterados:paths.filter(k=>k!=='clientes'&&k!=='vendedor'),data:{id:d.id,filial_id:d.filial_id,cod_operacao:d.cod_operacao,tipo_operacao:'S',cancelada:d.cancelada,quantidade:d.quantidade,valor_final_centavos:d.valor_final_centavos,consulta_url:url}};
      }
      await db.query('INSERT INTO integration_changes(id,recurso,filial,chave,versao,acao,consulta_url,tipo_evento,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,r.recurso,r.filial,r.chave,versao,acao,url,tipoEvento,evento?cofre.cifrar(evento,'event:'+id):null]);
     }
    }
    await db.query('DELETE FROM integration_dirty WHERE recurso=$1 AND filial=$2 AND chave=$3',[r.recurso,r.filial,r.chave]);
   }
   return pendentes.length;
  });
 };
}
export function permitirPessoas(payload,permitido,resumo=false){
 const p=structuredClone(payload),d=p.data;
 if(!permitido){delete d.vendedor?.nome;delete d.clientes;if(d.cobertura)d.cobertura.pessoas='restrito';p.pagamentos=p.pagamentos?.map(({desc_gerador,historico,...l})=>l)??null;}
 if(resumo){for(const k of ['ajuste_centavos','subtotal_itens_centavos','frete_centavos','cortesia_informada','nota_fiscal','condicao_pagamento','cobertura','cancelada_em','clientes','itens_url','pagamentos_url'])delete d[k];}
 return p;
}
