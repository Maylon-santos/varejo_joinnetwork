import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
let browser;
try{
 await mkdir('artifacts/documentacao-integracoes',{recursive:true});
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage(),errors=[],requests=[];
 page.on('pageerror',()=>errors.push('ERRO_JS'));page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text;}}}));
 const url=new URL('../docs/integracoes/index.html',import.meta.url).href;
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto(url);
  await page.getByRole('heading',{name:/Seus dados, conectados/}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('.doc-article').count(),9);
  await page.screenshot({path:`artifacts/documentacao-integracoes/portal-${width}.png`});
  await page.locator('.copy-code').first().click();assert.ok((await page.evaluate(()=>window.__copied)).includes('api-varejo.aeropostale.joinnetwork.com.br'));
  await page.locator('#search').fill('idnfe');await page.waitForTimeout(100);
  assert.ok(await page.locator('.doc-article:not([hidden])').count()>0);
  await page.locator('#search').fill('termo-impossivel-123987');await page.locator('#no-results').waitFor({state:'visible'});
  await page.locator('#search').fill('');
  await page.locator('#field-search').fill('NotaFiscal');await page.waitForTimeout(100);
  await page.locator('#dicionario .doc-section:not([hidden])').first().evaluate(n=>n.scrollIntoView({block:'start',behavior:'instant'}));
  await page.evaluate(()=>window.scrollBy({top:-90,behavior:'instant'}));
  const visible=await page.locator('#dicionario .doc-section:not([hidden])').count();assert.ok(visible>=1&&visible<51);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`artifacts/documentacao-integracoes/dicionario-${width}.png`});
  await page.locator('#field-search').fill('');
 }
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.startsWith('file:')));
 await writeFile('docs/validacao-portal-integracoes.json',JSON.stringify({verificadoEm:new Date().toISOString(),portalOffline:true,capitulos:9,larguras:[1440,390],semOverflow:true,buscaGeral:true,filtroDicionario:true,copiarExemplosSemClipboardReal:true,semChamadasDeRede:true,errors},null,2)+'\n');
 console.log('Portal: computador/celular, busca, dicionário, cópia e funcionamento offline aprovados.');
}finally{await browser?.close();}
