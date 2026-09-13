import { writeFile } from 'node:fs/promises';
import { reconciliarVenda } from '../backend/src/reconciliar-venda.mjs';
// Consulta limitada, somente leitura. Persiste apenas resumo sem cadastros pessoais.
const url = new URL(process.env.MILLENNIUM_BASE_URL);
url.pathname = url.pathname.replace(/\/$/, '') + '/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDAS';
url.search = new URLSearchParams({filial:'30098297',data_inicial:'2026-09-06',data_final:'2026-09-07',tipo_operacao:'S',cancelada:'F'}).toString();
try {
  const r = await fetch(url, {headers:{Authorization:`Basic ${process.env.MILLENNIUM_BASIC_TOKEN}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
  if (!r.ok) throw new Error(`HTTP_${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data.value)) throw new Error('INVALID_VALUE');
  const summary = {checkedAt:new Date().toISOString(),branch:'30098297',from:'2026-09-06',through:'2026-09-07',httpStatus:r.status,count:data.value.length,declaredCount:data['odata.count'],rootFields:Object.keys(data),fields:[...new Set(data.value.flatMap(Object.keys))].sort(),reconciliation:{},exceptions:[],knownOperations:[],adjustmentNull:0,adjustmentMissing:0,duplicateKeys:0,unexpectedBranches:0,transIdPresent:0};
  const keys = new Set();
  for(const sale of data.value){
    const key=`${sale.cod_operacao}:${sale.tipo_operacao}:${sale.filial}`;
    if(keys.has(key)) summary.duplicateKeys++;
    keys.add(key);
    if(String(sale.filial)!==summary.branch) summary.unexpectedBranches++;
    if(sale.trans_id!==undefined) summary.transIdPresent++;
    if(sale.v_acerto===null) summary.adjustmentNull++;
    if(sale.v_acerto===undefined) summary.adjustmentMissing++;
    let result;
    try{ result=reconciliarVenda(sale); }catch{result={status:'formato_invalido'};}
    summary.reconciliation[result.status]=(summary.reconciliation[result.status]||0)+1;
    const safe={operation:sale.cod_operacao,...result};
    if(result.status!=='conciliada') summary.exceptions.push(safe);
    if([30835456,30835576].includes(Number(sale.cod_operacao))) summary.knownOperations.push(safe);
  }
  await writeFile('docs/validacao-vendas.json',JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));
}catch(error){console.error('Consulta não concluída:',String(error.cause?.code || error.message).replace(/[^A-Za-z0-9_]/g,''));process.exitCode=1;}
