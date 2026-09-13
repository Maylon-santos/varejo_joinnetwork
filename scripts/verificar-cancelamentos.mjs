import {writeFile} from 'node:fs/promises';
const url=new URL(process.env.MILLENNIUM_BASE_URL);
url.pathname=url.pathname.replace(/\/$/,'')+'/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDASCANCELADAS';
url.search=new URLSearchParams({filial:'30098297',data_caninicial:'2026-09-09',data_canfinal:'2026-09-09'}).toString();
try{
 const r=await fetch(url,{headers:{Authorization:`Basic ${process.env.MILLENNIUM_BASIC_TOKEN}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error(`HTTP_${r.status}`);
 const d=await r.json();if(!Array.isArray(d.value))throw new Error('INVALID_VALUE');
 const report={checkedAt:new Date().toISOString(),httpStatus:r.status,branch:'30098297',from:'2026-09-09',through:'2026-09-09',dateFilter:'data_caninicial/data_canfinal',count:d.value.length,declaredCount:d['odata.count'],fields:[...new Set(d.value.flatMap(Object.keys))],operations:d.value.map(x=>({cod_operacao:x.cod_operacao,tipo_operacao:x.tipo_operacao,data_cancelou:x.data_cancelou,filialRetornada:x.filial??null}))};
 await writeFile('docs/validacao-cancelamentos.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(e){console.error('Falha:',String(e.cause?.code||e.message).replace(/[^A-Za-z0-9_]/g,''));process.exitCode=1;}
