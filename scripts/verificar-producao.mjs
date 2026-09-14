import https from 'node:https';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const hostname='aeropostale.joinnetwork.com.br';
let token;
function request(path,{method='GET',body,session=token}={}){
 return new Promise((resolve,reject)=>{
 const payload=body?JSON.stringify(body):undefined;
 const headers={};if(payload){headers['Content-Type']='application/json';headers['Content-Length']=Buffer.byteLength(payload);}if(session)headers.Authorization=`Bearer ${session}`;
 const req=https.request({hostname,path,method,headers,timeout:15000,...(process.env.DEPLOY_VERIFY_IP?{lookup:(_host,opts,cb)=>opts.all?cb(null,[{address:process.env.DEPLOY_VERIFY_IP,family:4}]):cb(null,process.env.DEPLOY_VERIFY_IP,4)}:{})},res=>{let data='';res.setEncoding('utf8');res.on('data',part=>data+=part);res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(data)});}catch{reject(Error('RESPOSTA_NAO_JSON'));}});});req.on('timeout',()=>req.destroy(Error('TIMEOUT')));req.on('error',reject);req.end(payload);
 });
}
try{
 assert.equal((await request('/health')).status,200);
 const login=await request('/api/v1/auth/login',{method:'POST',body:{email:process.env.ADMIN_EMAIL,senha:process.env.ADMIN_PASSWORD}});assert.equal(login.status,200);token=login.data.token;
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
 const esperadas=config.tenantGroupingConfirmed?config.branchIds:['30098297'];
 const filiais=await request('/api/v1/filiais');assert.equal(filiais.status,200);assert.deepEqual(filiais.data.filiais.map(f=>f.filial).sort(),[...esperadas].sort());
 assert.ok(filiais.data.filiais.every(f=>typeof f.cod_filial==='string'&&f.cod_filial.length>0&&/^\d+$/.test(f.trans_id)));
 const coberturaFiliais=[];
 for(const filial of esperadas){const r=await request('/api/v1/indicadores?'+new URLSearchParams({filial,inicio:'2026-01-01',fim:'2026-09-09'}));assert.equal(r.status,200);coberturaFiliais.push({filial,coberturaCompleta:r.data.checkpoints_cobrem_fim});}
 const q='filial=30098297&inicio=2026-01-01&fim=2026-09-09';
 const indicators=await request('/api/v1/indicadores?'+q);assert.equal(indicators.status,200);
 const sales=await request('/api/v1/vendas?'+q+'&limite=2');assert.equal(sales.status,200);assert.equal(sales.data.total,indicators.data.vendas);
 assert.equal((await request('/api/v1/ranking?'+q)).status,200);
 const first=sales.data.operacoes[0];assert.ok(first);
 const detail=await request(`/api/v1/operacoes/${first.filial}/${first.tipo_operacao}/${first.cod_operacao}`);assert.equal(detail.status,200);assert.ok(detail.data.itens.length);
 assert.equal((await request('/api/v1/indicadores?'+q,{session:null})).status,401);
 assert.equal((await request('/api/v1/indicadores?filial=999999999&inicio=2026-01-01&fim=2026-09-09')).status,403);
 assert.equal((await request('/api/v1/auth/logout',{method:'POST'})).status,200);
 assert.equal((await request('/api/v1/auth/me')).status,401);token=null;
 const report={verificadoEm:new Date().toISOString(),dominio:hostname,tlsValidado:true,login:200,indicadores:200,ranking:200,vendas:200,detalhe:200,anonimo:401,filialNaoAutorizada:403,logout:200,sessaoRevogada:401,contagemConsistente:true,filiaisAutorizadas:esperadas.length,cadastroFiliaisPersistido:true,coberturaFiliais};
 await writeFile('docs/validacao-producao.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){console.error('VERIFICACAO_PRODUCAO_FALHOU',e.code||e.name);process.exitCode=1;}
finally{if(token)await request('/api/v1/auth/logout',{method:'POST'}).catch(()=>{});}
