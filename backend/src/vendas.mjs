import {precosComplementares,complementosDaVenda} from './complementos-venda.mjs';
import {clientesDaVenda} from './clientes.mjs';
import {chaveOperacao} from './cancelamentos.mjs';
import {validarDia} from './sincronizar-cancelamentos.mjs';
import {centavos,reconciliarVenda} from './reconciliar-venda.mjs';
export function diaMillennium(valor) {
 const m=/^\/Date\((-?\d+)(?:[+-]\d+)?\)\/$/.exec(valor??'');
 const ms=m?Number(m[1]):NaN;
 if(!Number.isSafeInteger(ms)||!Number.isFinite(new Date(ms).getTime()))throw new Error('DATA_ERP_INVALIDA');
 return new Date(ms).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
}
export function normalizarVenda(v,filial,inicio,fim){
 chaveOperacao(v.cod_operacao,v.tipo_operacao,v.filial);
 if(String(v.filial)!==String(filial))throw new Error('FILIAL_INESPERADA');
 const data=diaMillennium(v.data);
 if(data<inicio||data>fim)throw new Error('DATA_FORA_DO_PERIODO');
 if(typeof v.cancelada!=='boolean'||!Number.isSafeInteger(v.qtde)||v.qtde<0)throw new Error('CABECALHO_INVALIDO');
 if(!Array.isArray(v.produtos)||!v.produtos.length)throw new Error('ITENS_AUSENTES');
 const produtos=v.produtos.map((p,i)=>{
  if(!Number.isSafeInteger(p.quantidade)||p.quantidade<=0)throw new Error('QUANTIDADE_INVALIDA');
  return {...precosComplementares(p),imagem_url:imagemProduto(p),ordem:i,sku:p.sku??null,cod_produto:p.cod_produto==null?null:String(p.cod_produto),descricao:p.descricao??null,quantidade:p.quantidade,preco_centavos:centavos(p.preco).toString()};
 });
 const reconciliacao=reconciliarVenda(v);
 const vendedor=Array.isArray(v.vendedor)&&v.vendedor.length===1?v.vendedor[0]:null;
 return {
  cod_operacao:String(v.cod_operacao),tipo_operacao:v.tipo_operacao,filial:String(filial),data_operacao:data,
  quantidade:v.qtde,valor_final_centavos:centavos(v.valor_final).toString(),cancelada:v.cancelada,
  ajuste_centavos:v.v_acerto==null?null:centavos(v.v_acerto).toString(),
  subtotal_itens_centavos:produtos.reduce((s,p)=>s+BigInt(p.preco_centavos)*BigInt(p.quantidade),0n).toString(),
  conciliacao:reconciliacao.status,vendedor_codigo:vendedor?.funcionario==null?null:String(vendedor.funcionario),
  vendedor_nome:vendedor?.nome??null,evento_codigo:v.codigo??null,produtos,clientes:clientesDaVenda(v),complementos:complementosDaVenda(v,diaMillennium),
 };
}
export async function consultarVendas({baseUrl,token,filial,inicio,fim,fetchImpl=fetch,onDuplicado=()=>{}}){
 validarDia(inicio);validarDia(fim);
 if(inicio>fim||!/^\d+$/.test(String(filial))||!token)throw new Error('CONFIGURACAO_INVALIDA');
 const url=new URL(baseUrl);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('URL_INVALIDA');
 url.pathname=url.pathname.replace(/\/$/,'')+'/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDAS';
 // Não excluir canceladas nem entradas: preservar movimentações e seu estado.
 url.search=new URLSearchParams({filial:String(filial),data_inicial:inicio,data_final:fim}).toString();
 const r=await fetchImpl(url,{headers:{Authorization:`Basic ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error(`ERP_HTTP_${r.status}`);
 const body=await r.json();
 if(!Array.isArray(body.value)||body['odata.count']==null||Number(body['odata.count'])!==body.value.length||Object.keys(body).some(k=>k.toLowerCase().includes('nextlink')))throw new Error('PAGINACAO_NAO_SUPORTADA');
 const unicas=new Map();
 for(const v of body.value){
  const op=normalizarVenda(v,filial,inicio,fim);const key=chaveOperacao(op.cod_operacao,op.tipo_operacao,op.filial);
  if(unicas.has(key)){
   if(JSON.stringify(unicas.get(key))!==JSON.stringify(op))throw new Error('CHAVE_DUPLICADA_CONFLITANTE');
   onDuplicado({chave:key,dia:op.data_operacao});
  }else unicas.set(key,op);
 }
 return [...unicas.values()];
}

export function imagemProduto(p){for(const k of ['imagem_01','imagem_02','imagem_03']){try{const u=new URL(p[k]);if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password)return u.href;}catch{}}return null;}
