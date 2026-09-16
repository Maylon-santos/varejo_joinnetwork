import {chromium} from 'playwright';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';
const origin='https://aeropostale.joinnetwork.com.br';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--host-resolver-rules=MAP aeropostale.joinnetwork.com.br 191.252.1.241']});
try{
 await mkdir('artifacts/deploy',{recursive:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',()=>errors.push('ERRO_JS'));
 await page.goto(origin);const login=page.waitForResponse(r=>r.url().endsWith('/api/v1/auth/login'));await page.fill('#email',process.env.ADMIN_EMAIL);await page.fill('#password',process.env.ADMIN_PASSWORD);await page.click('#login-submit');const session=await (await login).json();assert.ok(session.token);await page.locator('#app-view').waitFor({state:'visible'});
 const get=path=>page.evaluate(async({path,token})=>{const r=await fetch(path,{headers:{Authorization:'Bearer '+token}});return {status:r.status,data:await r.json()};},{path,token:session.token});
 const branches=await get('/api/v1/filiais');assert.equal(branches.status,200);assert.equal(branches.data.filiais.length,14);
 const dia=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),filiais=[];
 for(const b of branches.data.filiais){
  const p=await get('/api/v1/produtos?'+new URLSearchParams({filial:b.filial}));assert.equal(p.status,200);assert.equal(p.data.estoque_permitido,true);
  const d=await get('/api/v1/produtos/indicadores?'+new URLSearchParams({filial:b.filial,inicio:dia.slice(0,4)+'-01-01',fim:dia}));assert.equal(d.status,200);
  for(const item of d.data.produtos){assert.ok(BigInt(item.pecas)>=BigInt(item.pecas_com_desconto));assert.equal(item.pecas_com_desconto==='0',item.desconto_medio_percentual===null);}
  filiais.push({filial:b.filial,catalogoDisponivel:true,skus:p.data.total,estoqueSincronizado:!!p.data.sincronizacao?.ultimo_sucesso,erroEstoque:p.data.sincronizacao?.ultimo_erro_codigo??null,indicadoresDisponiveis:true,coberturaVendas:d.data.checkpoints_cobrem_fim});
 }
 assert.equal((await get('/api/v1/produtos?filial=99999999')).status,403);
 await page.click('[data-page="products"]');await page.locator('#products-list article').first().waitFor();await page.screenshot({path:'artifacts/deploy/produtos-producao-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/deploy/produtos-producao-mobile.png',fullPage:true});
 const r=page.waitForResponse(r=>r.url().includes('/produtos/indicadores?'));await page.selectOption('#products-mode','vendas');assert.equal((await r).status(),200);await page.locator('#products-list article').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.click('#logout');
 await writeFile('docs/validacao-produtos-producao.json',JSON.stringify({verificadoEm:new Date().toISOString(),dominio:'aeropostale.joinnetwork.com.br',filiais,filialNaoAutorizada:403,desktopMobileSemOverflow:true,nenhumaMutacaoComercial:true,errors},null,2)+'\n');console.log('Produtos e indicadores: 14 filiais verificadas no domínio, somente leitura.');
}finally{await browser.close();}
