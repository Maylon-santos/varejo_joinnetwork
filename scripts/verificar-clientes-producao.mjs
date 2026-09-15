import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--host-resolver-rules=MAP aeropostale.joinnetwork.com.br 191.252.1.241']});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',()=>errors.push('ERRO_JS'));
 await page.goto('https://aeropostale.joinnetwork.com.br');await page.fill('#email',process.env.ADMIN_EMAIL);await page.fill('#password',process.env.ADMIN_PASSWORD);await page.click('#login-submit');await page.locator('#app-view').waitFor({state:'visible'});await page.click('[data-page="customers"]');
 await page.selectOption('#branch','30098297');await page.selectOption('#period','custom');await page.fill('#start-date','2026-09-01');await page.fill('#end-date','2026-09-07');
 const response=page.waitForResponse(r=>r.url().includes('/api/v1/clientes?')&&r.url().includes('fim=2026-09-07'));await page.locator('#filters').evaluate(f=>f.requestSubmit());const r=await response;assert.equal(r.status(),200);const data=await r.json();await page.locator('#loading').waitFor({state:'hidden'});assert.ok(data.total>0);assert.equal(data.operacoes_pendentes,0);assert.equal(new Set(data.clientes.map(c=>c.codigo)).size,data.clientes.length);
 const requests=[];page.on('request',r=>requests.push(r.url()));let birthdayCount=0;
 for(const mes of ['01','02','03','04','05','06','07','08','09','10','11','12']){
  await page.selectOption('#customers-month',mes);const result=page.waitForResponse(r=>r.url().includes('/api/v1/clientes?')&&r.url().includes('mes='+mes));await page.locator('#customers-search button').click();const b=await (await result).json();assert.ok(b.clientes.every(c=>c.aniversario_mm_dd.startsWith(mes+'-')));birthdayCount+=b.total;
 }
 assert.ok(birthdayCount>0);await page.selectOption('#customers-month','');await page.locator('#customers-search button').click();await page.locator('.customer-card').first().waitFor();await page.locator('#loading').waitFor({state:'hidden'});
 await page.screenshot({path:'artifacts/deploy/clientes-producao-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/deploy/clientes-producao-mobile.png',fullPage:true});assert.ok(requests.every(u=>u.startsWith('https://aeropostale.joinnetwork.com.br/')));assert.deepEqual(errors,[]);await page.click('#logout');
 const report={verificadoEm:new Date().toISOString(),dominio:'aeropostale.joinnetwork.com.br',filial:'30098297',inicio:'2026-09-01',fim:'2026-09-07',clientesIdentificados:data.total,clientesComAniversario:birthdayCount,operacoesPendentes:data.operacoes_pendentes,filtros12Meses:true,desktopMobile:true,mobileSemOverflow:true,consultasSomenteLocais:true,errors};await writeFile('docs/validacao-clientes-producao.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
