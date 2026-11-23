import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ambienteFila} from '../backend/tests/fixtures/fila.mjs';
import {fotoTeste} from '../backend/tests/fixtures/visao-geral.mjs';
import {limitador} from '../backend/src/http-api.mjs';

const remoto=process.env.NAV_UI_BASE,out='artifacts/troca-filiais-20261123'+(remoto?'/producao':'');
await mkdir(out,{recursive:true});let e,browser;
try{
 e=await ambienteFila({imagemProduto:async()=>fotoTeste,limitesHttp:{limitar:limitador()}});
 await e.pool.query('UPDATE operacoes SET valor_final_centavos=filial::bigint*100');
 for(let f=1;f<=10;f++)for(let i=1;i<=20;i++)await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,descricao,quantidade,preco_centavos,imagem_url) VALUES(10,'S',$1,$2,$3,$4,$5,1,100,$6)",[String(f),i,'SKU-'+i,'P'+i,'Produto sintético '+i,'https://aeropostale1.hospedagemdesites.ws/fotosaero/teste.png']);
 browser=await chromium.launch({channel:'chrome',headless:true});
 const p=await browser.newPage({viewport:{width:390,height:844}}),requests=[],statuses=[],errors=[];
 if(remoto)await p.route('**/api/v1/**',async route=>{
  const u=new URL(route.request().url()),r=await route.fetch({url:e.base+u.pathname+u.search});await route.fulfill({response:r});
 });
 p.on('request',r=>{if(r.url().includes('/api/v1/'))requests.push(new URL(r.url()));});
 p.on('response',r=>{if(r.url().includes('/api/v1/'))statuses.push(r.status());});p.on('pageerror',err=>errors.push(err.message));
 await p.goto(remoto||e.base);await p.fill('#email','admin@fila.local');await p.fill('#password',e.senha);await p.click('#login-submit');
 await p.locator('#overview-panel').waitFor({state:'visible'});assert.equal(await p.locator('#top-products-list .top-product-row').count(),20);
 const fotos=()=>requests.filter(u=>u.pathname.endsWith('/imagem')).length;
 assert.equal(fotos(),0);
 requests.length=0;
 await p.evaluate(async()=>{for(let f=1;f<=10;f++){document.querySelector('#branch').value=String(f);document.querySelector('#filters').requestSubmit();await new Promise(r=>setTimeout(r,25));}});
 await p.locator('#overview-panel').waitFor({state:'visible'});
 assert.match(await p.locator('#scope-label').textContent(),/Loja teste 10/);
 assert.match(await p.locator('#metric-value').textContent(),/30,00/);
 assert.equal(requests.filter(u=>u.pathname.endsWith('/indicadores')).length,1);
 assert.equal(fotos(),0);

 let liberar;const retida=new Promise(r=>liberar=r);
 await p.route('**/api/v1/indicadores?*',async route=>{const u=new URL(route.request().url());if(u.searchParams.get('filial')!=='3')return route.fallback();const resposta=await route.fetch({url:e.base+u.pathname+u.search});await retida;await route.fulfill({response:resposta}).catch(()=>{});});
 await p.selectOption('#branch','3');await p.locator('#filters button[type=submit]').click();
 await p.waitForRequest(r=>r.url().includes('/indicadores?')&&new URL(r.url()).searchParams.get('filial')==='3');
 await p.selectOption('#branch','4');await p.locator('#filters button[type=submit]').click();
 await p.locator('#overview-panel').waitFor({state:'visible'});liberar();
 assert.match(await p.locator('#scope-label').textContent(),/Loja teste 4/);assert.match(await p.locator('#metric-value').textContent(),/12,00/);
 await p.unroute('**/api/v1/indicadores?*');
 await p.selectOption('#branch','5');
 assert.match(await p.locator('#scope-label').textContent(),/Loja teste 4/);

 for(let i=0;i<12;i++){
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.selectOption('#branch',String(i%10+1));await p.locator('#filters button[type=submit]').click();
  await p.locator('#overview-panel').waitFor({state:'visible'});
  assert.equal(await p.locator('#page-error').isVisible(),false);
 }
 assert.equal(statuses.includes(429),false);
 await p.locator('#top-products-list').scrollIntoViewIfNeeded();
 await p.locator('#top-products-list .product-photo img').first().waitFor();
 assert.ok(fotos()>0&&fotos()<20);
 await p.evaluate(()=>window.scrollTo(0,0));
 await p.route('**/api/v1/indicadores?*',route=>route.fulfill({status:429,headers:{'Retry-After':'2'},json:{erro:'LIMITE_DE_REQUISICOES'}}));
 await p.locator('#filters button[type=submit]').click();await p.locator('#page-error').waitFor({state:'visible'});
 assert.equal(await p.locator('#retry').isDisabled(),true);assert.match(await p.locator('#retry').textContent(),/2s/);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.ok((await p.locator('#start-date').boundingBox()).width>300);
 await p.screenshot({path:out+'/aguardo-mobile.png'});
 await p.waitForFunction(()=>!document.querySelector('#retry').disabled,{timeout:5000});
 await p.unroute('**/api/v1/indicadores?*');await p.click('#retry');await p.locator('#overview-panel').waitFor({state:'visible'});
 assert.equal(await p.locator('#page-error').isVisible(),false);
 await p.screenshot({path:out+'/visao-geral-mobile.png'});
 const before=requests.filter(u=>u.pathname.endsWith('/indicadores')).length;
 await p.locator('#filters button[type=submit]').click();await p.click('#logout');await p.locator('#login-view').waitFor({state:'visible'});
 await p.waitForTimeout(350);assert.equal(requests.filter(u=>u.pathname.endsWith('/indicadores')).length,before);
 assert.deepEqual(errors,[]);
 const report={verificadoEm:new Date().toISOString(),ambiente:'PostgreSQL isolado e dados sintéticos; Chromium',assets:remoto?'HTTPS de produção, API substituída pela fixture local':'Servidor local',dezSelecoesRapidasUmaConsulta:true,dozeTrocasSequenciaisSem429:true,respostaAntigaDescartada:true,rotuloDaFilialAplicada:true,fotosSomenteAoAproximarDaTela:true,tempoDeEsperaDoServidor:true,botaoLiberadoAposIntervalo:true,semRequisicaoPendenteNoLogout:true,celularSemOverflow:true,errors};
 await writeFile(remoto?out+'/validacao-ui.json':'docs/validacao-troca-filiais-ui.json',JSON.stringify(report,null,2)+'\n');
 console.log('Troca de filiais: cancelamento, debounce, fotos sob demanda, limite e recuperação aprovados.');
}finally{await browser?.close();await e?.close();}
