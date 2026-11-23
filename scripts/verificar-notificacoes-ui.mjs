import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {generateVAPIDKeys} from 'web-push';
import {ambienteFila} from '../backend/tests/fixtures/fila.mjs';
const remoto=process.env.PUSH_UI_BASE,out='artifacts/notificacoes-20261123'+(remoto?'/producao':'');
await mkdir(out,{recursive:true});let e,browser;
const config={enabled:true,...generateVAPIDKeys(),encryptionKey:randomBytes(32).toString('hex')},chave=generateVAPIDKeys().publicKey,inscricao={endpoint:'https://web.push.apple.com/ui-sintetica',keys:{p256dh:chave,auth:randomBytes(16).toString('base64url')}};
try{
 const enviados=[];e=await ambienteFila({push:{config,enviar:async(_s,p)=>{enviados.push(p);return {status:201};}}});
 browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];
 // Verificar o service worker real, manifesto e ícones antes de simular a API
 // nativa de inscrição. Nenhum serviço de push externo recebe tráfego de teste.
 const real=await browser.newContext({permissions:['notifications']}),realPage=await real.newPage();realPage.on('pageerror',er=>errors.push(er.message));
 await realPage.goto(remoto||e.base);
 const manifest=await realPage.evaluate(async()=>{await navigator.serviceWorker.ready;const r=await fetch('/manifest.webmanifest');return r.json();});assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');
 const worker=real.serviceWorkers()[0]||await real.waitForEvent('serviceworker');
 const cache=await worker.evaluate(()=>caches.keys());assert.deepEqual(cache,[]);
 const cdp=await real.newCDPSession(realPage);let registro;
 cdp.on('ServiceWorker.workerRegistrationUpdated',ev=>{for(const r of ev.registrations)if(!r.isDeleted)registro=r.registrationId;});await cdp.send('ServiceWorker.enable');
 for(let i=0;i<20&&!registro;i++)await realPage.waitForTimeout(100);
 assert.ok(registro);
 await cdp.send('ServiceWorker.deliverPushMessage',{origin:remoto||e.base,registrationId:registro,data:JSON.stringify({title:'Resumo sintético',body:'28 vendas · 95 peças',tag:'a'.repeat(32),url:'https://example.invalid/nao-permitido'})});
 await realPage.waitForTimeout(600);
 const shown=await realPage.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return (await r.getNotifications()).map(n=>({title:n.title,body:n.body,url:n.data.url,tag:n.tag}));});
 assert.equal(shown[0]?.title,'Resumo sintético');assert.equal(new URL(shown[0].url).origin,remoto||e.base);assert.equal(shown[0].tag,'aero-'+'a'.repeat(32));
 await real.close();

 const ctx=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 await ctx.addInitScript(({inscricao})=>{
  window.__standalone=false;window.__permission='default';window.__subscribeCount=0;window.__unsubscribeCount=0;let atual=null;
  const listeners=new Map(),reg={pushManager:{getSubscription:async()=>atual,subscribe:async()=>{window.__subscribeCount++;window.__permission='granted';atual={toJSON:()=>inscricao,unsubscribe:async()=>{atual=null;window.__unsubscribeCount++;return true;}};return atual;}},getNotifications:async()=>[]};
  Object.defineProperty(navigator,'standalone',{get:()=>window.__standalone});Object.defineProperty(window,'Notification',{value:{get permission(){return window.__permission;}}});Object.defineProperty(window,'PushManager',{value:function(){}});
  Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>reg,ready:Promise.resolve(reg),addEventListener:(n,fn)=>listeners.set(n,fn)}});
  window.__abrirResumo=url=>listeners.get('message')?.({data:{tipo:'abrir-notificacao',url}});
 },{inscricao});
 const p=await ctx.newPage();p.on('pageerror',er=>errors.push(er.message));
 if(remoto)await p.route('**/api/v1/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:e.base+u.pathname+u.search});await route.fulfill({response:r});});
 await p.goto(remoto||e.base);await p.fill('#email','admin@fila.local');await p.fill('#password',e.senha);await p.click('#login-submit');await p.locator('#overview-panel').waitFor({state:'visible'});
 await p.click('#mobile-menu-toggle');await p.click('[data-page=notifications]');await p.locator('#notifications-branches label').first().waitFor();
 assert.equal(await p.locator('#filters').isVisible(),false);assert.equal(await p.locator('#notifications-enable').isDisabled(),true);assert.equal(await p.locator('#notifications-daily').isChecked(),false);
 await p.click('#notifications-install');assert.equal(await p.locator('#notifications-install-steps').isVisible(),true);await p.screenshot({path:out+'/instalacao-iphone.png',fullPage:true});
 await p.evaluate(()=>{window.__standalone=true;window.dispatchEvent(new Event('appinstalled'));});assert.equal(await p.locator('#notifications-enable').isEnabled(),true);
 await p.click('#notifications-enable');await p.waitForFunction(()=>document.querySelector('#notifications-device-state').textContent==='Ativado neste aparelho');assert.equal(await p.evaluate(()=>window.__subscribeCount),1);
 await p.check('#notifications-daily');await p.click('#notifications-save');await p.waitForFunction(()=>document.querySelector('#notifications-status').textContent.includes('Preferências salvas'));
 assert.equal((await e.control.query('SELECT resumo_diario FROM notificacao_preferencias')).rows[0].resumo_diario,true);
 await p.click('#notifications-test');await p.waitForFunction(()=>document.querySelector('#notifications-status').textContent.includes('Teste solicitado'));await e.notificacoes.executar();assert.equal(enviados.length,1);
 await p.click('#notifications-refresh');await p.waitForFunction(()=>document.querySelector('#notifications-history').textContent.includes('Aceito pelo serviço'));assert.match(await p.locator('#notifications-history').textContent(),/aviso de teste/);
 await p.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await p.screenshot({path:out+'/preferencias-mobile.png',fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.setViewportSize({width:1440,height:1000});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:out+'/preferencias-desktop.png'});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.evaluate(dia=>window.__abrirResumo('/?origem=resumo&filial=2&dia='+dia),e.dia);await p.locator('#overview-panel').waitFor({state:'visible'});assert.equal(await p.locator('#branch').inputValue(),'2');assert.equal(await p.locator('#start-date').inputValue(),e.dia);assert.equal(await p.locator('#end-date').inputValue(),e.dia);
 await p.evaluate(()=>window.__abrirResumo('/?origem=resumo&filial=999&dia=2026-11-23'));assert.equal(await p.locator('#branch').inputValue(),'2');
 await p.click('[data-page=notifications]');await p.click('#notifications-stop');await p.waitForFunction(()=>document.querySelector('#notifications-device-state').textContent==='Não ativado neste aparelho');assert.equal((await e.control.query('SELECT ativo FROM notificacao_dispositivos')).rows[0].ativo,false);assert.equal(await p.evaluate(()=>window.__unsubscribeCount),1);
 await p.click('#notifications-enable');await p.waitForFunction(()=>document.querySelector('#notifications-device-state').textContent==='Ativado neste aparelho');await p.click('#logout');await p.locator('#login-view').waitFor({state:'visible'});assert.equal((await e.control.query('SELECT ativo FROM notificacao_dispositivos')).rows[0].ativo,false);
 await p.fill('#email','leitor@fila.local');await p.fill('#password',e.senha);await p.click('#login-submit');await p.locator('#queue-panel').waitFor({state:'visible'});assert.equal(await p.locator('[data-page=notifications]').isVisible(),false);
 assert.deepEqual(errors,[]);const report={verificadoEm:new Date().toISOString(),ambiente:'Chromium e PostgreSQL isolado, dados sintéticos',assets:remoto?'HTTPS de produção, API substituída por fixture':'Servidor local',manifestoEIcones:true,serviceWorkerRealRecebePush:true,semCacheOffline:true,urlExternaRejeitada:true,instalacaoIphoneOrientada:true,autorizacaoPorToqueSimulada:true,preferenciasEFiliais:true,testeNoAparelhoDaSessao:true,desativacaoELogout:true,acessoAoResumoValidado:true,contaForaDoPilotoSemAcesso:true,celularSemOverflow:true,errors};
 await writeFile(out+'/validacao-ui.json',JSON.stringify(report,null,2)+'\n');if(!remoto)await writeFile('docs/validacao-notificacoes-ui.json',JSON.stringify(report,null,2)+'\n');console.log('PWA, service worker, preferências, teste e permissões aprovados. Inscrição nativa simulada; recebimento real no iPhone pendente.');
}finally{await browser?.close();await e?.close();}
