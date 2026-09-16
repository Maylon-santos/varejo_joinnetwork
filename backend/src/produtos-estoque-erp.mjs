export function inteiroErp(v){
 if(typeof v==='number'&&!Number.isSafeInteger(v))throw Error('INTEIRO_ERP_INVALIDO');
 if(!/^\d{1,18}$/.test(String(v)))throw Error('INTEIRO_ERP_INVALIDO');return BigInt(v).toString();
}
const texto=(v,max=500)=>v==null?null:String(v).trim().slice(0,max);
function data(v){
 if(v==null)return null;const m=/^\/Date\((-?\d+)(?:[+-]\d+)?\)\/$/.exec(v);
 if(!m||!Number.isSafeInteger(Number(m[1]))||!Number.isFinite(new Date(Number(m[1])).getTime()))throw Error('DATA_ERP_INVALIDA');
 return new Date(Number(m[1])).toISOString();
}
function envelope(body){
 if(!Array.isArray(body?.value)||body['odata.count']==null||Number(body['odata.count'])!==body.value.length||Object.keys(body).some(k=>k.toLowerCase().includes('nextlink')))throw Error('PAGINACAO_NAO_SUPORTADA');
 return body.value;
}
export function normalizarEstoque(body,filial,cursor='0'){
 filial=inteiroErp(filial);cursor=inteiroErp(cursor);const unicos=new Map();
 for(const r of envelope(body)){
  if(inteiroErp(r.filial)!==filial)throw Error('FILIAL_INESPERADA');
  const trans_id=inteiroErp(r.trans_id);if(BigInt(trans_id)<BigInt(cursor))throw Error('TRANS_ID_FORA_DA_JANELA');
  if(typeof r.sku!=='string'||!r.sku.trim()||r.sku.length>200||!texto(r.cod_produto)||!texto(r.desc_produto))throw Error('PRODUTO_ERP_INVALIDO');
  const saldo=r.saldo==null?null:String(r.saldo);
  if(saldo!==null&&!/^-?\d{1,14}(\.\d{1,6})?$/.test(saldo))throw Error('SALDO_ERP_INVALIDO');
  const item={filial,sku:r.sku,produto:inteiroErp(r.produto),cod_produto:texto(r.cod_produto),descricao:texto(r.desc_produto),cor:texto(r.cor),tamanho:texto(r.tamanho),barra:texto(r.barra),saldo,trans_id,data_atualizacao_erp:data(r.data_atualizacao)};
  const anterior=unicos.get(item.sku);if(anterior&&JSON.stringify(anterior)!==JSON.stringify(item))throw Error('ESTOQUE_SKU_DUPLICADO');
  unicos.set(item.sku,item);
 }
 return [...unicos.values()];
}
export function normalizarProduto(body,produto){
 const rows=envelope(body);if(rows.length!==1)throw Error('CADASTRO_PRODUTO_AUSENTE');
 const r=rows[0];if(inteiroErp(r.produto)!==inteiroErp(produto)||!texto(r.cod_produto)||!texto(r.descricao))throw Error('PRODUTO_ERP_INVALIDO');
 const classificacao={};for(const campo of ['colecao','departamento','grupo','categoria','grade','marca'])classificacao[campo]={codigo:texto(r['cod_'+campo]),descricao:texto(r['desc_'+campo])};
 return {produto:inteiroErp(r.produto),cod_produto:texto(r.cod_produto),descricao:texto(r.descricao),trans_id:inteiroErp(r.trans_id),classificacao};
}
async function consultar({baseUrl,token,fetchImpl=fetch},caminho,params){
 const url=new URL(baseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!token)throw Error('CONFIGURACAO_INVALIDA');
 url.pathname=url.pathname.replace(/\/$/,'')+'/'+caminho;url.search=new URLSearchParams(params);
 const r=await fetchImpl(url,{headers:{Authorization:`Basic ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error('ERP_HTTP_'+r.status);
 const reader=r.body.getReader(),chunks=[];let bytes=0;
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>32*1024*1024){await reader.cancel();throw Error('RESPOSTA_EXCEDE_LIMITE');}chunks.push(value);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function consultarEstoque(options){const filial=inteiroErp(options.filial),cursor=inteiroErp(options.cursor??'0');return normalizarEstoque(await consultar(options,'millenium_eco/produtos/saldodeestoque',{filial,trans_id:cursor}),filial,cursor);}
export async function consultarProduto(options){const produto=inteiroErp(options.produto);return normalizarProduto(await consultar(options,'MILLENIUM!JOINNETWORK.VAREJO.CONSULTAPRODUTOS',{produto}),produto);}
