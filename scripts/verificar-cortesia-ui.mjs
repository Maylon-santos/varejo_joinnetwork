import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ambienteFila} from '../backend/tests/fixtures/fila.mjs';
import {RepositorioPostgres} from '../backend/src/repositorio-postgres.mjs';
import {normalizarVenda} from '../backend/src/vendas.mjs';
import {processarReprocessamento} from '../backend/src/reprocessar-vendas.mjs';
let e,browser;
try{
 await mkdir('artifacts/deploy',{recursive:true});e=await ambienteFila();const repo=new RepositorioPostgres(e.pool,'teste');
 await e.pool.query('UPDATE operacoes SET data_operacao=$1,conciliacao=$2',[e.dia,'conciliada']);
 const venda=normalizarVenda({cod_operacao:10,filial:1,tipo_operacao:'S',data:`/Date(${Date.parse(e.dia+'T15:00:00Z')})/`,cancelada:false,qtde:2,valor_final:30,v_acerto:0,v_frete:null,cortesia:0,produtos:[{quantidade:1,preco:10,descricao:'Produto A'},{quantidade:1,preco:20,descricao:'Produto B'}]},'1',e.dia,e.dia);
 await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarOperacoes([venda]));
 await e.pool.query("UPDATE operacoes SET conciliacao='regra_pendente',complementos=complementos-'frete_centavos'-'cortesia_informada' WHERE filial=1 AND cod_operacao=10");
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',()=>errors.push('ERRO_JS'));
 await page.goto(e.base);await page.fill('#email','admin@fila.local');await page.fill('#password',e.senha);await page.click('#login-submit');await page.locator('#app-view').waitFor({state:'visible'});await page.click('[data-page="quality"]');
 await page.getByRole('button',{name:'Ver detalhes da operação 10',exact:true}).click();
 await page.locator('#detail-dialog .detail-summary').getByText('Aguardando importação',{exact:true}).first().waitFor();
 assert.equal(await page.locator('#detail-dialog .detail-summary').getByText('Aguardando importação',{exact:true}).count(),2);
 page.once('dialog',d=>d.accept());await page.locator('#detail-dialog .reprocess-sale').click();await page.locator('#detail-dialog').getByText('Reprocessamento aguardando na fila.',{exact:true}).waitFor();
 await processarReprocessamento({pool:e.pool,repositorio:repo,tenant:'teste',filiais:e.filiais,consultar:async()=>[venda]});
 await page.getByText(/Reprocessada e conciliada/).waitFor({timeout:20000});
 const summary=page.locator('#detail-dialog .detail-summary');await summary.getByText('Sem cortesia (0)',{exact:true}).waitFor();await summary.getByText('Não informado',{exact:true}).waitFor();
 await page.getByText('Valores e quantidades conferidos',{exact:true}).waitFor();
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`artifacts/deploy/cortesia-zero-${width}.png`});
 }
 await page.click('#detail-close');await page.getByText('Nenhuma operação nesta situação',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 await writeFile('docs/validacao-cortesia-ui.json',JSON.stringify({verificadoEm:new Date().toISOString(),ambiente:'schemas isolados, dados sintéticos',freteECortesiaVisiveis:true,legadoSemInventarZero:true,zeroSemCortesia:true,freteNuloDistintoDeZero:true,reprocessamentoRemovePendencia:true,desktopCelularSemOverflow:true,errors},null,2)+'\n');
 console.log('Campos, legado, cortesia zero, reprocessamento e computador/celular aprovados.');
}finally{await browser?.close();await e?.close();}
