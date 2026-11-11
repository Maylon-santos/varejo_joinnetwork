// Somente leitura: registra estrutura e cobertura, sem números de notas ou dados pessoais.
import {writeFile} from 'node:fs/promises';
const filial=process.env.NOTA_FISCAL_FILIAL||'30098297';
const dia=process.env.NOTA_FISCAL_DIA||'2026-11-10';
const campos=['numero_nota','modelo','idnfe','status'];
try{
 if(!/^\d+$/.test(filial)||!/^\d{4}-\d{2}-\d{2}$/.test(dia))throw Error('PARAMETROS_INVALIDOS');
 const url=new URL(process.env.MILLENNIUM_BASE_URL);
 url.pathname=url.pathname.replace(/\/$/,'')+'/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDAS';
 url.search=new URLSearchParams({filial,data_inicial:dia,data_final:dia});
 const r=await fetch(url,{headers:{Authorization:`Basic ${process.env.MILLENNIUM_BASIC_TOKEN}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('ERP_HTTP_'+r.status);
 const body=await r.json();
 if(!Array.isArray(body.value)||Number(body['odata.count'])!==body.value.length||Object.keys(body).some(k=>k.toLowerCase().includes('nextlink')))throw Error('RESPOSTA_INCOMPLETA');
 const report={verificadoEm:new Date().toISOString(),fonte:'LISTAVENDAS',filial,dia,operacoes:body.value.length,campos:{}};
 for(const campo of campos){
  const chaves=[...new Set(body.value.flatMap(v=>Object.keys(v).filter(k=>k.toLowerCase()===campo)))];
  const valores=body.value.flatMap(v=>chaves.filter(k=>Object.hasOwn(v,k)).map(k=>v[k]));
  report.campos[campo]={chaves,presentes:valores.length,nulos:valores.filter(v=>v===null).length,tipos:[...new Set(valores.filter(v=>v!==null).map(v=>typeof v))].sort()};
 }
 await writeFile('docs/validacao-fonte-nota-fiscal.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}catch(e){console.error(JSON.stringify({codigo:/^[A-Z_]+\d*$/.test(e.message)?e.message:'CONSULTA_NAO_CONCLUIDA',causa:e.cause?.code?.replace(/[^A-Z_]/g,'')??null}));process.exitCode=1;}
