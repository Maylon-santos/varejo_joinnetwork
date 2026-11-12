import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {generateKeyPairSync} from 'node:crypto';
import {ambienteFila} from '../backend/tests/fixtures/fila.mjs';
import {cofre,totp} from '../backend/src/integracoes/seguranca.mjs';
import {criarApiIntegracoes} from '../backend/src/integracoes/http.mjs';
import {criarAdministracao} from '../backend/src/integracoes/administracao.mjs';
const a=await ambienteFila(),crypt=cofre('d4'.repeat(32)),secret='e5'.repeat(20);let server,browser;
try{
 const u=await a.auth.autenticar(a.tokens.admin);await a.pool.query('INSERT INTO integration_admins(usuario_id,tenant_key,totp_secret) VALUES($1,$2,$3)',[u.id,'teste',crypt.cifrar(secret,'admin:'+u.id)]);
 server=criarApiIntegracoes({pool:a.pool,tenant:'teste',cofre:crypt,filiais:a.filiais,audience:'https://api.exemplo.com/oauth/token',administracao:criarAdministracao(a.pool,'teste',crypt,a.auth,a.filiais)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),erros=[];page.on('pageerror',e=>erros.push(e.name));
 await page.goto(`http://127.0.0.1:${server.address().port}/admin/integracoes/console`);await page.locator('#login [name=email]').fill('admin@fila.local');await page.locator('#login [name=senha]').fill(a.senha);await page.locator('#login button').click();await page.locator('#mfa').waitFor({state:'visible'});
 await page.locator('#mfa [name=codigo]').fill(totp(secret,Math.floor(Date.now()/30000)));await page.locator('#mfa button').click();await page.locator('#console').waitFor({state:'visible'});await page.locator('#filiais input').first().waitFor();
 await page.locator('#cliente [name=nome]').fill('Integração <img src=x onerror=alert(1)>');await page.locator('#cliente [name=finalidade]').fill('Consumidor sintético de homologação');await page.locator('#escopos [value="vendas:ler"]').check();await page.locator('#filiais [value="1"]').check();await page.locator('#cliente [name=motivo]').fill('Teste de cadastro autorizado');await page.locator('#cliente button').first().click();await page.getByRole('button',{name:'Editar / chaves'}).click();
 const {publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});await page.locator('#chave [name=kid]').fill('k1');await page.locator('#chave [name=valida_ate]').fill(new Date(Date.now()+7*86400000).toISOString().slice(0,16));await page.locator('#chave [name=public_key]').fill(publicKey.export({type:'spki',format:'pem'}));await page.locator('#chave [name=motivo]').fill('Chave pública de teste');await page.locator('#chave button').click();await page.getByText('Chave pública salva e auditada.',{exact:true}).waitFor();
 for(const tab of ['acessos','entregas','webhooks','metricas','auditoria','clientes']){await page.locator(`[data-tab="${tab}"]`).click();await page.waitForTimeout(100);}
 await mkdir('artifacts/integracoes-validacao',{recursive:true});const checks=[];for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);await page.screenshot({path:`artifacts/integracoes-validacao/console-${width}.png`});checks.push({largura:width,sem_transbordamento:true});}
 assert.equal(await page.locator('#resultado img').count(),0);assert.deepEqual(erros,[]);const logs=(await a.pool.query('SELECT count(*)::int n FROM integration_admin_audit')).rows[0].n;assert.ok(logs>=4);
 await page.locator('#sair').click();await page.locator('#login').waitFor({state:'visible'});assert.equal((await a.pool.query('SELECT count(*)::int n FROM integration_admin_sessions')).rows[0].n,0);
 const report={data:'2026-11-11',ambiente:'PostgreSQL isolado com dados sintéticos',login_mfa:true,cadastro_concessao:true,cadastro_chave_publica:true,auditoria:true,texto_html_escapado:true,logout_revoga_sessao:true,viewports:checks,erros_js:erros,producao_alterada:false};await mkdir('artifacts/integracoes-validacao',{recursive:true});await writeFile('artifacts/integracoes-validacao/ui.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await a.close();}
