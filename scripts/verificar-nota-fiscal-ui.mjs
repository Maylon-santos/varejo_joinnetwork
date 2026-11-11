import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ambienteFila} from '../backend/tests/fixtures/fila.mjs';
import {RepositorioPostgres} from '../backend/src/repositorio-postgres.mjs';
import {normalizarVenda} from '../backend/src/vendas.mjs';
let e,browser;
try{
 await mkdir('artifacts/deploy',{recursive:true});e=await ambienteFila();
 const repo=new RepositorioPostgres(e.pool,'teste'),idnfe='0'.repeat(43)+'1';
 const op=normalizarVenda({cod_operacao:10,filial:1,tipo_operacao:'S',data:`/Date(${Date.parse(e.dia+'T15:00:00Z')})/`,cancelada:false,qtde:1,valor_final:10,v_acerto:0,cortesia:0,numero_nota:'000123',modelo:65,idnfe,status:'<b>100</b>',produtos:[{quantidade:1,preco:10}]},'1',e.dia,e.dia);
 await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarOperacoes([op]));
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],requests=[];
 page.on('pageerror',()=>errors.push('ERRO_JS'));page.on('request',r=>requests.push(r.url()));
 await page.goto(e.base);await page.fill('#email','admin@fila.local');await page.fill('#password',e.senha);await page.click('#login-submit');await page.locator('#app-view').waitFor({state:'visible'});await page.click('[data-page="sales"]');
 const open=async()=>{await page.getByRole('button',{name:'Ver detalhes da operação 10',exact:true}).click();await page.locator('#detail-dialog .detail-invoice').waitFor();};
 await open();const section=page.locator('#detail-dialog .detail-invoice');
 for(const value of ['Número da nota','000123','Modelo','65','IDNFE',idnfe,'Status da nota (ERP)','<b>100</b>'])await section.getByText(value,{exact:true}).waitFor();
 assert.equal(await section.locator('b').count(),0);
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#detail-dialog').evaluate(n=>n.scrollWidth>n.clientWidth),false);
  await page.screenshot({path:`artifacts/deploy/nota-fiscal-${width}.png`});
 }
 await page.click('#detail-close');await e.pool.query("UPDATE operacoes SET complementos=complementos-'nota_fiscal' WHERE filial=1 AND cod_operacao=10");await open();assert.equal(await section.getByText('Aguardando importação',{exact:true}).count(),4);
 await page.click('#detail-close');await e.pool.query('UPDATE operacoes SET complementos=$1 WHERE filial=1 AND cod_operacao=10',[JSON.stringify({...op.complementos,nota_fiscal:{numero_nota:null,modelo:null,idnfe:null,status:null}})]);await open();assert.equal(await section.getByText('Não informado',{exact:true}).count(),4);
 assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith(e.base)));
 await writeFile('docs/validacao-nota-fiscal-ui.json',JSON.stringify({verificadoEm:new Date().toISOString(),ambiente:'schemas isolados, dados sintéticos',quatroCamposVisiveis:true,identificadoresPreservados:true,statusSemInterpretacao:true,textoSemHTML:true,legadoDistintoDeNulo:true,semConsultaERPNoDetalhe:true,desktopCelularSemOverflow:true,errors},null,2)+'\n');
 console.log('Nota fiscal: quatro campos, legado/nulos, identificadores e computador/celular aprovados.');
}finally{await browser?.close();await e?.close();}
