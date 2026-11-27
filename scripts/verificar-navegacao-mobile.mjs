import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ambienteFila} from '../backend/tests/fixtures/fila.mjs';

const remoto=process.env.NAV_UI_BASE;
const out='artifacts/navegacao-mobile-20261123'+(remoto?'/producao':'');
await mkdir(out,{recursive:true});
let e,browser;
try{
 e=await ambienteFila();
 browser=await chromium.launch({channel:'chrome',headless:true});
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 if(remoto)await p.route('**/api/v1/**',async route=>{
  const resposta=await route.fetch({url:e.base+new URL(route.request().url()).pathname+new URL(route.request().url()).search});
  await route.fulfill({response:resposta});
 });
 p.on('pageerror',err=>errors.push(err.message));
 const login=async conta=>{
  await p.goto(remoto||e.base);
  await p.fill('#email',conta+'@fila.local');await p.fill('#password',e.senha);
  await p.click('#login-submit');await p.locator('#app-view').waitFor({state:'visible'});
 };
 const closed=async()=>{
  await p.waitForFunction(()=>!document.querySelector('#mobile-menu').open&&!document.body.classList.contains('mobile-menu-open'));
  assert.equal(await p.locator('#mobile-menu-toggle').getAttribute('aria-expanded'),'false');
  assert.equal(await p.locator('.sidebar #primary-navigation').count(),1);
 };
 const open=async()=>{
  await p.click('#mobile-menu-toggle');
  await p.waitForFunction(()=>document.querySelector('#mobile-menu').open);
  assert.equal(await p.locator('#mobile-menu-toggle').getAttribute('aria-expanded'),'true');
  assert.equal(await p.locator('#mobile-menu #primary-navigation').count(),1);
  assert.equal(await p.locator('#primary-navigation').count(),1);
 };
 const fits=async()=>assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await login('admin');
 assert.equal(await p.locator('.sidebar').isVisible(),true);
 assert.equal(await p.locator('#mobile-menu-toggle').isVisible(),false);
 assert.equal(await p.locator('#primary-navigation .nav-button:visible').count(),13);
 assert.equal(await p.locator('#primary-navigation [data-page="goals"]').isVisible(),true);
 await p.screenshot({path:out+'/desktop.png'});

 const viewports=[];
 for(const width of [320,390,430,760]){
  await p.setViewportSize({width,height:844});await fits();
  assert.equal(await p.locator('.sidebar').isVisible(),false);
  assert.equal(await p.locator('#mobile-menu-toggle').isVisible(),true);
  assert.ok((await p.locator('#main').boundingBox()).y<100);
  for(const id of ['mobile-menu-toggle','logout','refresh']){
   const r=await p.locator('#'+id).boundingBox();assert.ok(r.width>=44&&r.height>=44,id);
  }
  assert.equal(await p.locator('#period').evaluate(n=>getComputedStyle(n).fontSize),'16px');
  await open();
  assert.equal(await p.evaluate(()=>document.querySelector('#mobile-menu-close')===document.activeElement),true);
  assert.equal(await p.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
  for(let i=0;i<18;i++){
   await p.keyboard.press('Tab');
   assert.equal(await p.evaluate(()=>document.querySelector('#mobile-menu').contains(document.activeElement)),true);
  }
  await p.keyboard.press('Shift+Tab');
  assert.equal(await p.evaluate(()=>document.querySelector('#mobile-menu').contains(document.activeElement)),true);
  await p.locator('#integrations-console').scrollIntoViewIfNeeded();
  assert.equal(await p.locator('#integrations-console').getAttribute('href'),'/admin/integracoes/console#manual');
  await p.locator('#mobile-menu-content').evaluate(n=>n.scrollTop=0);
  if(width===390)await p.screenshot({path:out+'/menu-mobile.png'});
  await p.keyboard.press('Escape');await closed();
  assert.equal(await p.evaluate(()=>document.activeElement.id),'mobile-menu-toggle');
  viewports.push({largura:width,semOverflow:true,focoContido:true,opcoesAcessiveis:true});
 }
 await p.setViewportSize({width:390,height:844});await open();
 await p.click('[data-page="consolidated"]');await closed();
 await p.locator('#consolidated-body tr').first().waitFor();
 assert.equal(await p.locator('#page-title').textContent(),'Visão das filiais');
 assert.equal(await p.evaluate(()=>document.activeElement.id),'main');
 assert.equal(await p.locator('.filter-store').isVisible(),false);
 await fits();await p.screenshot({path:out+'/filiais-mobile.png'});
 await open();
 assert.equal(await p.locator('#mobile-menu-page').textContent(),'Visão das filiais');
 assert.equal(await p.locator('[data-page="consolidated"]').getAttribute('aria-current'),'page');
 await p.mouse.click(386,100);await closed();
 await open();await p.click('#mobile-menu-back');await closed();
 await open();await p.click('#mobile-menu-close');await closed();
 await p.evaluate(()=>window.scrollTo(0,500));await open();
 await p.click('[data-page="sales"]');await closed();
 assert.equal(await p.locator('#page-title').textContent(),'Movimentações');
 assert.equal(await p.evaluate(()=>scrollY),0);
 await open();await p.setViewportSize({width:900,height:844});await closed();
 assert.equal(await p.locator('.sidebar').isVisible(),true);
 assert.equal(await p.locator('#mobile-menu-toggle').isVisible(),false);await fits();
 await p.setViewportSize({width:1440,height:1000});
 await p.click('[data-page="consolidated"]');await p.locator('#consolidated-body tr').first().waitFor();
 await p.setViewportSize({width:390,height:640});await open();
 await p.route('**/api/v1/consolidado?*',route=>route.fulfill({status:401,json:{erro:'NAO_AUTENTICADO'}}));
 await p.evaluate(()=>document.querySelector('#refresh').click());
 await p.locator('#login-view').waitFor({state:'visible'});await closed();
 assert.equal(await p.evaluate(()=>document.activeElement.id),'email');
 await p.unroute('**/api/v1/consolidado?*');
 await login('leitor');await open();
 assert.equal(await p.locator('#primary-navigation .nav-button:visible').count(),1);
 assert.equal(await p.locator('[data-page="queue"]').isVisible(),true);
 for(const id of ['users','permissions','employees'])assert.equal(await p.locator(`[data-page="${id}"]`).isVisible(),false);
 assert.equal(await p.locator('#integrations-console').isVisible(),false);
 await p.locator('[data-page="queue"]').focus();await p.keyboard.press('Enter');await closed();
 assert.equal(await p.locator('#page-title').textContent(),'Lista da Vez');
 await p.click('#logout');await p.locator('#login-view').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);
 const report={verificadoEm:new Date().toISOString(),ambiente:'PostgreSQL isolado e dados sintéticos; Chromium',assets:remoto?'HTTPS da produção; apenas respostas da API substituídas pela fixture local':'Servidor local',viewports,desktopTabletPreservados:true,menuUnicoSemDuplicacao:true,permissoesPreservadas:true,escapeBackdropBotaoFechar:true,focoRestaurado:true,navegacaoFechaMenuEFocaConteudo:true,retornoAoTopo:true,rotacaoRestauraSidebar:true,sessaoExpiradaFechaMenu:true,alvosDeToque44px:true,camposDeFiltro16px:true,errors};
 await writeFile(remoto?out+'/validacao-ui.json':'docs/validacao-navegacao-mobile-ui.json',JSON.stringify(report,null,2)+'\n');
 console.log('Navegação móvel: foco, toque, permissões, resize, sessão e computador aprovados.');
}finally{await browser?.close();await e?.close();}
