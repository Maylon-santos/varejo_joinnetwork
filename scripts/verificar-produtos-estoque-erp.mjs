// Diagnóstico somente de leitura. Não imprime token, produtos ou saldos individuais.
import {mkdir,writeFile} from 'node:fs/promises';
const filial='30098297',base=process.env.MILLENNIUM_BASE_URL,token=process.env.MILLENNIUM_BASIC_TOKEN;
const report={verificadoEm:new Date().toISOString(),filial,consultas:[]};
let etapa='configuracao';
async function consultar(recurso,path,params){
 etapa=recurso;
 const url=new URL(base);url.pathname=url.pathname.replace(/\/$/,'')+'/'+path;url.search=new URLSearchParams(params);
 const r=await fetch(url,{headers:{Authorization:`Basic ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error('ERP_HTTP_'+r.status);
 const reader=r.body.getReader();let bytes=0,chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>24*1024*1024){await reader.cancel();throw Error('RESPOSTA_EXCEDE_LIMITE');}chunks.push(value);}
 const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!Array.isArray(body.value))throw Error('ENVELOPE_INVALIDO');
 report.consultas.push({recurso,registros:body.value.length,contagem:body['odata.count']??null,bytes,completa:Number(body['odata.count'])===body.value.length&&!Object.keys(body).some(k=>k.toLowerCase().includes('nextlink')),campos:body.value[0]?Object.keys(body.value[0]).sort():[]});
 return body;
}
try{
 if(!base||!token)throw Error('CONFIGURACAO_INVALIDA');
 const produto=await consultar('produto','MILLENIUM!JOINNETWORK.VAREJO.CONSULTAPRODUTOS',{produto:'30338805'});
 report.produtoSolicitadoConfere=produto.value.every(r=>String(r.produto)==='30338805');
 const estoque=await consultar('estoque_filial','millenium_eco/produtos/saldodeestoque',{filial,trans_id:'0'});
 const rows=estoque.value;report.filialConfere=rows.every(r=>String(r.filial)===filial);
 report.skusDuplicados=rows.length-new Set(rows.map(r=>r.sku)).size;
 report.tipos={saldo:[...new Set(rows.map(r=>r.saldo===null?'null':typeof r.saldo))],trans_id:[...new Set(rows.map(r=>typeof r.trans_id))]};
 report.saldosNegativos=rows.filter(r=>Number(r.saldo)<0).length;report.saldosNulos=rows.filter(r=>r.saldo==null).length;
 const cursor=rows.reduce((m,r)=>{if(!Number.isSafeInteger(r.trans_id))throw Error('CURSOR_INVALIDO');return BigInt(r.trans_id)>m?BigInt(r.trans_id):m;},0n);
 if(cursor>0n){
  const incremental=await consultar('estoque_incremental','millenium_eco/produtos/saldodeestoque',{filial,trans_id:(cursor-1n).toString()});
  report.incrementalNaJanela=incremental.value.every(r=>Number.isSafeInteger(r.trans_id)&&BigInt(r.trans_id)>=cursor-1n&&String(r.filial)===filial);
  report.bordaReaparece=incremental.value.some(r=>BigInt(r.trans_id)===cursor);
 }
 const referencia=rows.find(r=>String(r.produto)==='30338805');
 if(referencia){const pontual=await consultar('estoque_sku','MILLENIUM!JOINNETWORK.VAREJO.CONSULTAESTOQUES',{filial,sku:referencia.sku});report.skuSolicitadoConfere=pontual.value.every(r=>r.sku===referencia.sku);report.saldoPontualCoincide=pontual.value.some(r=>r.sku===referencia.sku&&r.saldo===referencia.saldo);}
 if(!process.argv.includes('--stdout')){await mkdir('docs',{recursive:true});await writeFile('docs/validacao-contrato-produtos-estoque.json',JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report,null,2));
}catch(e){console.error(JSON.stringify({etapa,codigo:/^[A-Z_]+(?:\d+)?$/.test(e.message)?e.message:'CONSULTA_NAO_CONCLUIDA',tipo:e.name,causa:/^[A-Z_]+$/.test(e.cause?.code??'')?e.cause.code:null,consultasConcluidas:report.consultas}));process.exitCode=1;}
