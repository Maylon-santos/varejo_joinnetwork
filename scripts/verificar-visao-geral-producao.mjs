import {chromium} from 'playwright';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--host-resolver-rules=MAP aeropostale.joinnetwork.com.br 191.252.1.241']});
try{
 await mkdir('artifacts/deploy',{recursive:true});const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',()=>errors.push('ERRO_JS'));
 await p.goto('https://aeropostale.joinnetwork.com.br');const login=p.waitForResponse(r=>r.url().endsWith('/auth/login'));await p.fill('#email',process.env.ADMIN_EMAIL);await p.fill('#password',process.env.ADMIN_PASSWORD);await p.click('#login-submit');const session=await (await login).json();assert.ok(session.token);await p.locator('#top-products-panel').waitFor({state:'visible'});
 const get=path=>p.evaluate(async({path,token})=>{const r=await fetch('/api/v1'+path,{headers:{Authorization:'Bearer '+token}});return {status:r.status,data:await r.json()};},{path,token:session.token});
 await p.fill('#start-date','2026-01-01');const fim=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});await p.fill('#end-date',fim);const topLoaded=p.waitForResponse(r=>r.url().includes('/produtos/top?')&&r.url().includes('inicio=2026-01-01'));await p.locator('#filters button[type=submit]').click();assert.equal((await topLoaded).status(),200);
 await p.waitForFunction(()=>document.getElementById('loading').hidden&&document.getElementById('scope-label').textContent.includes('01/01/2026'));
 await p.waitForFunction(()=>!document.getElementById('top-products-grid').textContent.includes('Carregando foto'),{},{timeout:90000});
 await p.waitForFunction(()=>[...document.querySelectorAll('.top-product-photo img')].every(i=>i.complete));
 const fotos=await p.locator('.top-product-photo img').evaluateAll(imgs=>({carregadas:imgs.filter(i=>i.complete&&i.naturalWidth>0).length}));assert.ok(fotos.carregadas>0);const cartoes=await p.locator('.top-product-card').count();assert.equal(cartoes,20);
 await p.locator('#top-products-panel').scrollIntoViewIfNeeded();await p.screenshot({path:'artifacts/deploy/visao-geral-producao-top-desktop.png'});await p.locator('.top-product-photo:not(:disabled)').first().click();await p.locator('#photo-dialog').waitFor({state:'visible'});await p.click('#photo-close');
 await p.locator('#overview-summaries').scrollIntoViewIfNeeded();await p.screenshot({path:'artifacts/deploy/visao-geral-producao-resumos-desktop.png'});await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.locator('#top-products-panel').scrollIntoViewIfNeeded();await p.screenshot({path:'artifacts/deploy/visao-geral-producao-top-mobile.png'});
 const branches=(await get('/filiais')).data.filiais,filiais=[];assert.equal(branches.length,14);
 for(const b of branches){
  const q=new URLSearchParams({filial:b.filial,inicio:'2026-01-01',fim});
  const ind=await get('/indicadores?'+q);assert.equal(ind.status,200);const d=ind.data;
  assert.equal(d.condicoes_pagamento.reduce((a,c)=>a+BigInt(c.valor_centavos),0n).toString(),d.valor_vendas_centavos);assert.equal(d.serie_diaria.reduce((a,c)=>a+BigInt(c.valor_vendas_centavos),0n).toString(),d.valor_vendas_centavos);
  const top=await get('/produtos/top?'+q);assert.equal(top.status,200);assert.ok(top.data.top.length<=20);assert.equal(new Set(top.data.top.map(x=>x.chave)).size,top.data.top.length);for(let i=1;i<top.data.top.length;i++)assert.ok(BigInt(top.data.top[i-1].pecas)>=BigInt(top.data.top[i].pecas));
  const stock=await get('/produtos/resumo-estoque?filial='+b.filial);assert.equal(stock.status,200);const g=stock.data.grupos;assert.equal(g.marca.reduce((a,x)=>a+x.skus,0),g.categoria.reduce((a,x)=>a+x.skus,0));
  filiais.push({filial:b.filial,condicoesConservamTotal:true,mensalConservaTotal:true,top20OrdenadoSemDuplicidade:true,estoqueAgrupado:true});
 }
 assert.equal((await get('/produtos/top?filial=99999999&inicio=2026-01-01&fim='+fim)).status,403);assert.deepEqual(errors,[]);await p.click('#logout');
 await writeFile('docs/validacao-visao-geral-producao.json',JSON.stringify({verificadoEm:new Date().toISOString(),dominio:'aeropostale.joinnetwork.com.br',filiais,top20:{cartoes,fotosCarregadas:fotos.carregadas,semFotoOuIndisponiveis:cartoes-fotos.carregadas,ampliacao:true},desktopMobileSemOverflow:true,nenhumaMutacaoComercial:true,errors},null,2)+'\n');console.log('Visão geral validada nas 14 filiais; fotos e ampliação conferidas no domínio.');
}finally{await browser.close();}
