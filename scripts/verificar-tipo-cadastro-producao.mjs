import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {setTimeout as pausa} from 'node:timers/promises';
import {erroSeguro} from '../backend/src/postgres.mjs';
let browser,etapa='login';
try{
 await mkdir('artifacts/deploy',{recursive:true});
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--host-resolver-rules=MAP aeropostale.joinnetwork.com.br 191.252.1.241']});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',()=>errors.push('ERRO_JS'));
 await page.goto('https://aeropostale.joinnetwork.com.br');const logged=page.waitForResponse(r=>r.url().endsWith('/auth/login'));
 await page.fill('#email',process.env.ADMIN_EMAIL);await page.fill('#password',process.env.ADMIN_PASSWORD);await page.click('#login-submit');const session=await(await logged).json();assert.ok(session.token);await page.locator('#app-view').waitFor({state:'visible'});
 const get=async path=>{
  await pausa(500);
  const r=await page.evaluate(async({path,token})=>{const r=await fetch('/api/v1'+path,{headers:{Authorization:'Bearer '+token}});return {status:r.status,data:await r.json()};},{path,token:session.token});assert.equal(r.status,200);return r.data;
 };
 const branches=(await get('/filiais')).filiais;assert.deepEqual(branches.map(b=>b.filial).sort(),[...config.branchIds].sort());
 etapa='filiais';const cobertura=[];let selecionada;
 for(const branch of branches){
  const all=await get('/produtos?'+new URLSearchParams({filial:branch.filial,tipo_prod:'todos'}));
  const ac=await get('/produtos?'+new URLSearchParams({filial:branch.filial,tipo_prod:'AC'}));
  const sem=await get('/produtos?'+new URLSearchParams({filial:branch.filial,tipo_prod:'desconhecido'}));
  assert.equal(all.resumo_estoque.skus,all.total);assert.equal(ac.resumo_estoque.skus,ac.total);assert.equal(all.skus_sem_tipo,sem.total);
  assert.ok(ac.produtos.every(p=>p.tipo_prod==='AC'));assert.ok(sem.produtos.every(p=>p.tipo_prod===null));
  assert.ok(ac.total+sem.total<=all.total);
  if(!selecionada&&ac.produtos.some(p=>p.tipo_prod_origem==='cadastro'))selecionada=branch.filial;
  cobertura.push({filial:branch.filial,skus:all.total,acabados:ac.total,sem_tipo:sem.total,erro_estoque:all.sincronizacao?.ultimo_erro_codigo??null});
 }
 assert.ok(selecionada);etapa='interface';await page.click('[data-page="products"]');await page.selectOption('#branch',selecionada);await page.selectOption('#products-type','AC');await page.click('#products-search button');await page.locator('#products-list article').first().waitFor();
 assert.equal(await page.locator('#products-type').inputValue(),'AC');assert.ok(!(await page.locator('#products-status').innerText()).startsWith('0 SKUs'));
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`artifacts/deploy/tipo-cadastro-producao-${width}.png`});
 }
 await page.locator('.stock-product-details').first().click();await page.locator('#product-dialog').getByText('AC — Acabado',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/deploy/tipo-cadastro-detalhe-producao.png'});
 await page.click('#product-detail-close');await page.click('#logout');assert.deepEqual(errors,[]);
 await writeFile('docs/validacao-tipo-cadastro-producao.json',JSON.stringify({verificadoEm:new Date().toISOString(),filiaisVerificadas:branches.length,cobertura,listaFiltroTotalContagemCoerentes:true,origemCadastralObservada:true,tipoVisivelNosDetalhes:true,desktopCelularSemOverflow:true,somenteLeitura:true,errors},null,2)+'\n');
 console.log('Classificação cadastral: API das filiais, filtros/totais e computador/celular aprovados.');
}catch(e){console.error(JSON.stringify({etapa,codigo:erroSeguro(e)}));process.exitCode=1;}finally{await browser?.close();}
