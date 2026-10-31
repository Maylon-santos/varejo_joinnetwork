import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as pausa} from 'node:timers/promises';
import {erroSeguro} from '../backend/src/postgres.mjs';
let browser,etapa='configuracao';
try{
 const filial=process.env.CORTESIA_FILIAL,codigo=process.env.CORTESIA_OPERACAO;
 if(!/^\d{1,18}$/.test(filial??'')||!/^\d{1,18}$/.test(codigo??''))throw Error('OPERACAO_NAO_CONFIGURADA');
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--host-resolver-rules=MAP aeropostale.joinnetwork.com.br 191.252.1.241']});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',()=>errors.push('ERRO_JS'));
 etapa='login';await page.goto('https://aeropostale.joinnetwork.com.br');const logged=page.waitForResponse(r=>r.url().endsWith('/auth/login'));
 await page.fill('#email',process.env.ADMIN_EMAIL);await page.fill('#password',process.env.ADMIN_PASSWORD);await page.click('#login-submit');const session=await(await logged).json();assert.ok(session.token);await page.locator('#app-view').waitFor({state:'visible'});
 const api=async(path,body)=>page.evaluate(async({path,body,token})=>{
  const r=await fetch('/api/v1'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};
 },{path,body,token:session.token});
 const path=`/operacoes/${filial}/S/${codigo}`;etapa='detalhe';let atual=await api(path);assert.equal(atual.status,200);const antes=atual.data;
 const referencia=process.env.CORTESIA_SNAPSHOT?JSON.parse(await readFile(process.env.CORTESIA_SNAPSHOT,'utf8')):null;
 let solicitado=false;
 if(antes.operacao.conciliacao!=='conciliada'){
  etapa='reprocessamento';const job=await api(path+'/reprocessar',{requisicao:randomUUID()});assert.equal(job.status,202);solicitado=true;
  for(let tentativa=0;tentativa<60;tentativa++){
   await pausa(3000);const estado=await api(path+'/reprocessar');assert.equal(estado.status,200);
   if(estado.data.reprocessamento?.estado==='falhou')throw Error('REPROCESSAMENTO_FALHOU');
   if(estado.data.reprocessamento?.estado==='concluido')break;
  }
  atual=await api(path);assert.equal(atual.status,200);
 }
 const depois=atual.data;etapa='conferencia';assert.equal(depois.operacao.conciliacao,'conciliada');
 assert.equal(depois.operacao.complementos.cortesia_informada,0);assert.equal(depois.operacao.complementos.frete_centavos,null);
 const comercial=o=>['quantidade','valor_final_centavos','ajuste_centavos','subtotal_itens_centavos'].map(k=>String(o[k]));
 assert.deepEqual(comercial(depois.operacao),comercial(antes.operacao));if(referencia)assert.deepEqual(comercial(depois.operacao),comercial(referencia.operacoes[0]));
 const itens=i=>i.map(x=>[x.sku,String(x.quantidade),String(x.preco_centavos)]).sort((a,b)=>a[0].localeCompare(b[0]));
 assert.deepEqual(itens(depois.itens),itens(antes.itens));if(referencia)assert.deepEqual(itens(depois.itens),itens(referencia.itens));
 const dia=depois.operacao.data_operacao;
 const pendentes=await api('/vendas?'+new URLSearchParams({filial,inicio:dia,fim:dia,conciliacao:'pendentes',limite:'100'}));assert.equal(pendentes.status,200);assert.ok(!pendentes.data.operacoes.some(o=>o.cod_operacao===codigo));
 etapa='interface';await page.click('[data-page="sales"]');await page.selectOption('#branch',filial);await page.selectOption('#period','custom');await page.fill('#start-date',dia);await page.fill('#end-date',dia);await page.click('#filters button[type="submit"]');await page.locator('#loading').waitFor({state:'hidden'});
 const abrir=page.getByRole('button',{name:'Ver detalhes da operação '+codigo,exact:true});
 for(let i=0;i<30&&!await abrir.count();i++){assert.equal(await page.locator('#sales-next').isEnabled(),true);await page.click('#sales-next');await page.locator('#loading').waitFor({state:'hidden'});}
 await abrir.click();const summary=page.locator('#detail-dialog .detail-summary');await summary.getByText('Sem cortesia (0)',{exact:true}).waitFor();await summary.getByText('Não informado',{exact:true}).waitFor();await page.getByText('Valores e quantidades conferidos',{exact:true}).waitFor();
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`artifacts/deploy/cortesia-producao-${width}.png`});}
 assert.deepEqual(errors,[]);await page.click('#detail-close');await page.click('#logout');
 await writeFile('docs/validacao-cortesia-producao.json',JSON.stringify({verificadoEm:new Date().toISOString(),dominio:'aeropostale.joinnetwork.com.br',vendaIndicadaConciliada:true,reprocessamentoSolicitado:solicitado,freteNuloECortesiaZeroPersistidos:true,valoresPecasItensPreservados:true,comparacaoComSnapshotAnterior:!!referencia,vendaAusenteDoFiltroPendencias:true,camposVisiveisNoDetalhe:true,desktopCelularSemOverflow:true,errors},null,2)+'\n');
 console.log('Produção: venda conciliada, campos visíveis, totais/itens preservados e computador/celular aprovados.');
}catch(e){console.error(JSON.stringify({etapa,codigo:erroSeguro(e)}));process.exitCode=1;}finally{await browser?.close();}
