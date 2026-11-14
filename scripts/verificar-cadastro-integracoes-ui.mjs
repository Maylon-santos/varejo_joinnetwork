import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {ambienteFila} from '../backend/tests/fixtures/fila.mjs';
import {cofre,totp} from '../backend/src/integracoes/seguranca.mjs';
import {criarApiIntegracoes} from '../backend/src/integracoes/http.mjs';
import {criarAdministracao} from '../backend/src/integracoes/administracao.mjs';
import jsQR from 'jsqr';
const a=await ambienteFila(),crypt=cofre('f6'.repeat(32)),secret='a7'.repeat(20);let server,browser;
try{
 const u=await a.auth.autenticar(a.tokens.admin);
 await a.pool.query('INSERT INTO integration_admins(usuario_id,tenant_key,totp_secret,ativo) VALUES($1,$2,$3,false)',[u.id,'teste',crypt.cifrar(secret,'admin:'+u.id)]);
 await a.pool.query("INSERT INTO integration_admin_audit(id,ator_id,tenant_key,acao,alvo_id,motivo,dados) VALUES($1,$2,'teste','operador_provisionado',$2,'Convite sintético',$3)",[randomUUID(),u.id,JSON.stringify({cadastro_pendente:true,expira_em:new Date(Date.now()+3600000).toISOString()})]);
 server=criarApiIntegracoes({pool:a.pool,tenant:'teste',cofre:crypt,filiais:a.filiais,audience:'https://api.exemplo.com/oauth/token',administracao:criarAdministracao(a.pool,'teste',crypt,a.auth,a.filiais)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:1000}}),errors=[],externalRequests=[];page.on('pageerror',e=>errors.push(e.name));page.on('request',r=>{if(!new URL(r.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))externalRequests.push(new URL(r.url()).origin);});await page.clock.install();
 await page.goto(a.base);await page.locator('#email').fill('admin@fila.local');await page.locator('#password').fill(a.senha);await page.locator('#login-submit').click();await page.locator('#app-view').waitFor({state:'visible'});
 assert.equal(await page.locator('#integrations-console').isVisible(),true);assert.equal(await page.locator('#integrations-console').getAttribute('href'),'/admin/integracoes/console#manual');
 await page.locator('#logout').click();await page.locator('#email').fill('vendas@fila.local');await page.locator('#password').fill(a.senha);await page.locator('#login-submit').click();await page.locator('#app-view').waitFor({state:'visible'});assert.equal(await page.locator('#integrations-console').isVisible(),false);
 await page.goto(`http://127.0.0.1:${server.address().port}/admin/integracoes/console#manual`);await page.locator('#login [name=email]').fill('admin@fila.local');await page.locator('#login [name=senha]').fill(a.senha);await page.locator('#login button').click();await page.locator('#cadastro').waitFor({state:'visible'});
 assert.equal(await page.locator('#cadastro-chave').getAttribute('type'),'password');assert.equal(await page.locator('#console').isVisible(),false);assert.ok((await page.locator('#cadastro-app').getAttribute('href')).startsWith('otpauth://totp/'));
 await mkdir('artifacts/console-integracoes',{recursive:true});
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const image=await page.locator('#cadastro-qr').evaluate(canvas=>({width:canvas.width,height:canvas.height,data:Array.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data)}));
  const decoded=jsQR(new Uint8ClampedArray(image.data),image.width,image.height);assert.ok(decoded);assert.equal(decoded.data,await page.locator('#cadastro-app').getAttribute('href'));
  await page.locator('#cadastro-qr').screenshot({path:`artifacts/console-integracoes/qr-sintetico-${width}.png`});await page.screenshot({path:`artifacts/console-integracoes/cadastro-qr-${width}.png`});
 }
 await page.clock.fastForward(301000);await page.locator('#login').waitFor({state:'visible'});
 assert.equal(await page.locator('#cadastro-chave').inputValue(),'');assert.equal(await page.locator('#cadastro-app').getAttribute('href'),null);assert.equal(await page.locator('#cadastro-qr').evaluate(c=>c.width*c.height),0);
 await page.locator('#login [name=senha]').fill(a.senha);await page.locator('#login button').click();await page.locator('#cadastro').waitFor({state:'visible'});assert.ok(await page.locator('#cadastro-qr').evaluate(c=>c.width>0));
 await page.locator('#cadastro-confirmar [name=codigo]').fill(totp(secret,Math.floor(Date.now()/30000)));await page.locator('#cadastro-confirmar button').click();await page.getByRole('heading',{name:'Manual de integrações por API e webhook',exact:true}).waitFor();
 assert.equal(await page.locator('#cadastro-chave').inputValue(),'');assert.equal(await page.locator('#cadastro-app').getAttribute('href'),null);assert.equal(await page.locator('#cadastro-qr').evaluate(c=>c.width*c.height),0);assert.equal(await page.locator('#manual .manual-etapa').count(),10);assert.equal(await page.evaluate(()=>Object.keys(localStorage).length+Object.keys(sessionStorage).length),0);assert.deepEqual(externalRequests,[]);
 await mkdir('artifacts/console-integracoes',{recursive:true});
 for(const width of [390,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`artifacts/console-integracoes/manual-${width}.png`});}
 await page.locator('#sair').click();await page.locator('#login').waitFor({state:'visible'});assert.equal((await a.pool.query('SELECT count(*)::int n FROM integration_admin_sessions')).rows[0].n,0);assert.deepEqual(errors,[]);
 const result={verificadoEm:new Date().toISOString(),ambiente:'dados sintéticos isolados',menuSomenteAdmin:true,cadastroComChaveMascarada:true,qrDecodificadoIgualAoOtpauth:true,qrRemovidoAposExpiracaoEConfirmacao:true,semRequisicoesExternas:true,confirmacaoTotp:true,manualAbertoPeloLink:true,chaveRemovidaAposConfirmacao:true,semTokensNoArmazenamentoDoNavegador:true,logoutRevogaSessao:true,computadorCelularSemOverflow:true,errosJS:errors};await writeFile('artifacts/console-integracoes/ui-cadastro.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await a.close();}
