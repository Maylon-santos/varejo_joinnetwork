import { writeFile } from 'node:fs/promises';
const base = process.env.MILLENNIUM_BASE_URL;
const token = process.env.MILLENNIUM_BASIC_TOKEN;
const url = new URL(base);
url.pathname = url.pathname.replace(/\/$/, '') + '/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDAS';
url.search = new URLSearchParams({filial:'30098297',data_inicial:'2026-09-01',data_final:'2026-09-08'}).toString();
try {
 const res=await fetch(url,{headers:{Authorization:`Basic ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!res.ok) throw new Error(`HTTP_${res.status}`);
 const body=await res.json();
 if(!Array.isArray(body.value)) throw new Error('INVALID_VALUE');
 const rows=body.value.map(x=>({id:Number(x.cod_operacao),branch:String(x.filial),date:new Date(Number(/^\/Date\((-?\d+)/.exec(x.data)?.[1])).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),type:x.tipo_operacao}));
 if(rows.some(x=>!Number.isSafeInteger(x.id)||x.date==='Invalid Date')) throw new Error('INVALID_ID_OR_DATE');
 const ids=rows.map(x=>x.id), sorted=[...new Set(ids)].sort((a,b)=>a-b);
 const gaps=[];
 for(let i=1;i<sorted.length;i++)if(sorted[i]-sorted[i-1]>1)gaps.push({previous:sorted[i-1],next:sorted[i],missingBetween:sorted[i]-sorted[i-1]-1});
 const byDay={};
 for(const row of rows){const d=byDay[row.date]??={count:0,min:row.id,max:row.id};d.count++;d.min=Math.min(d.min,row.id);d.max=Math.max(d.max,row.id);}
 const days=Object.keys(byDay).sort(), inversions=[];
 for(let i=1;i<days.length;i++){
 const earlier=rows.filter(x=>x.date<days[i]).reduce((a,b)=>a.id>b.id?a:b);
 const later=rows.filter(x=>x.date===days[i]).reduce((a,b)=>a.id<b.id?a:b);
 if(later.id<earlier.id)inversions.push({earlierDate:earlier.date,earlierId:earlier.id,laterDate:later.date,laterId:later.id});
 }
 const report={checkedAt:new Date().toISOString(),branch:'30098297',from:'2026-09-01',through:'2026-09-08',count:rows.length,declaredCount:body['odata.count'],unexpectedBranches:rows.filter(x=>x.branch!=='30098297').length,duplicateIds:ids.length-sorted.length,duplicateCompositeKeys:rows.length-new Set(rows.map(x=>`${x.id}:${x.type}:${x.branch}`)).size,min:sorted[0],max:sorted.at(-1),responseAscending:ids.every((x,i)=>i===0||x>=ids[i-1]),responseDescending:ids.every((x,i)=>i===0||x<=ids[i-1]),gapCount:gaps.length,gapExamples:gaps.slice(0,10),days:byDay,dateInversions:inversions,limitations:['A consulta de uma filial não comprova sequência global nem paginação completa.','Saltos podem ser operações de outras filiais/tipos.','Ordem por data de venda não comprova ordem de criação do ID.','ID não detecta alteração ou cancelamento posterior.']};
 report.byType = {};
 for (const type of new Set(rows.map(x=>x.type))) {
 const subset=rows.filter(x=>x.type===type);
 const violations=[];
 for(const later of subset){const earlier=subset.filter(x=>x.date<later.date && x.id>later.id).sort((a,b)=>b.id-a.id)[0];if(earlier)violations.push({earlierDate:earlier.date,earlierId:earlier.id,laterDate:later.date,laterId:later.id});}
 report.byType[type]={count:subset.length,dateInversionCount:violations.length,examples:violations.slice(0,5)};
 }
 await writeFile('docs/sequencia-cod-operacao.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(e){console.error('Falha:',String(e.cause?.code||e.message).replace(/[^A-Za-z0-9_]/g,''));process.exitCode=1;}
