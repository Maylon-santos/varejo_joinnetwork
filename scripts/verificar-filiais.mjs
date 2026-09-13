import {readFile,writeFile} from 'node:fs/promises';
import {setTimeout as esperar} from 'node:timers/promises';
import {erroSeguro} from '../backend/src/postgres.mjs';
const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
let anteriores=[];
if(process.argv.includes('--retomar')){try{anteriores=JSON.parse(await readFile('docs/validacao-filiais.json')).filiais;}catch{}}
const filiais=[];
for(const filial of config.branchIds){
 const anterior=anteriores.find(f=>f.filial===filial&&f.presente);if(anterior){filiais.push(anterior);continue;}
 try{
  const url=new URL(process.env.MILLENNIUM_BASE_URL);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!process.env.MILLENNIUM_BASIC_TOKEN)throw Error('CONFIGURACAO_INVALIDA');
  url.pathname=url.pathname.replace(/\/$/,'')+'/millenium!joinnetwork/varejo/listafiliais';url.search=new URLSearchParams({filial});
  const r=await fetch(url,{headers:{Authorization:`Basic ${process.env.MILLENNIUM_BASIC_TOKEN}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('ERP_HTTP_'+r.status);
  const body=await r.json();const presente=Array.isArray(body.value)&&body.value.some(v=>String(v.filial)===filial);
  filiais.push({filial,presente});if(!presente)process.exitCode=1;
 }catch(e){filiais.push({filial,presente:false,erro:erroSeguro(e)});process.exitCode=1;}
 console.log(JSON.stringify({filial,presente:filiais.at(-1).presente}));
 await esperar(500);
}
const report={verificadoEm:new Date().toISOString(),somenteLeitura:true,filiais};await writeFile('docs/validacao-filiais.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
