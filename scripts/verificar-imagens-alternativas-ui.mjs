import {chromium} from 'playwright';import sharp from 'sharp';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';
import {ambienteFila} from '../backend/tests/fixtures/fila.mjs';import {sincronizarEstoque} from '../backend/src/sincronizar-estoque.mjs';import {criarImagensProduto} from '../backend/src/imagens-alternativas.mjs';
let e,browser;
try{
 const png=await sharp({create:{width:30,height:40,channels:3,background:'#325c9b'}}).png().toBuffer(),calls=[];
 const provider=criarImagensProduto({token:'credencial-sintetica-so-servidor',fetchImpl:async(url)=>{
  const path=new URL(url).pathname;calls.push(path);
  if(path.startsWith('/fotosaero/'))return new Response(null,{status:404});
  if(path.includes('/products/'))return new Response(JSON.stringify({code:path.split('/')[4],colors:[{code:'AZ',images:[{url:'https://ragabesh.joinnetwork.com.br/uploads/sintetica.png'}]}]}),{headers:{'Content-Type':'application/json'}});
  return new Response(png,{headers:{'Content-Type':'image/png'}});
 }});
 e=await ambienteFila({imagensAlternativas:true,imagemProduto:provider});await mkdir('artifacts/imagens-alternativas',{recursive:true});
 await sincronizarEstoque({pool:e.pool,tenant:'teste',filial:'1',consultar:async()=>['A','B','C'].map((v,i)=>({filial:'1',sku:'SKU-'+v,produto:String(i+1),cod_produto:'COD-'+v,descricao:'Produto sintético '+v,cor:'AZ',tamanho:'P',saldo:'3',trans_id:'20',tipo_prod:'AC'}))});
 await e.pool.query('UPDATE operacoes SET data_operacao=$1',[e.dia]);
 await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,descricao,quantidade,preco_centavos,imagem_url) VALUES(10,'S',1,1,'SKU-A','COD-A','Produto sintético A',1,1000,NULL),(10,'S',1,2,'SKU-B','COD-B','Produto sintético B',1,1000,'https://aeropostale1.hospedagemdesites.ws/fotosaero/quebrada.png')");
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 page.on('pageerror',()=>errors.push('ERRO_JS'));page.on('request',r=>requests.push({url:r.url(),auth:r.headers().authorization}));
 await page.goto(e.base);await page.fill('#email','admin@fila.local');await page.fill('#password',e.senha);await page.click('#login-submit');await page.locator('#app-view').waitFor({state:'visible'});await page.click('[data-page="products"]');
 await page.waitForFunction(()=>document.querySelectorAll('#products-list .product-photo:not(:disabled) img').length===3);
 await page.locator('#products-list .product-photo:not(:disabled)').first().click();await page.locator('#photo-dialog').waitFor({state:'visible'});assert.ok(await page.locator('#photo-dialog img').evaluate(i=>i.complete&&i.naturalWidth>0));await page.click('#photo-close');
 await page.screenshot({path:'artifacts/imagens-alternativas/catalogo-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#products-list').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/imagens-alternativas/catalogo-mobile.png'});
 await page.selectOption('#products-mode','vendas');await page.waitForFunction(()=>document.querySelectorAll('#products-list .product-photo:not(:disabled) img').length===2);
 assert.ok(calls.includes('/fotosaero/quebrada.png'));assert.ok(calls.includes('/api/integrations/products/COD-C/images'));
 assert.equal(requests.some(r=>r.url.includes('ragabesh.')||r.auth?.includes('credencial-sintetica')),false);assert.deepEqual(errors,[]);
 await writeFile('artifacts/imagens-alternativas/ui.json',JSON.stringify({ambiente:'PostgreSQL isolado, dados e credencial sintéticos',catalogoSemVenda:true,origemAusente:true,origemQuebrada:true,ranking:true,ampliacao:true,desktopMobileSemOverflow:true,chaveSomenteServidor:true,erros:errors},null,2)+'\n');
 console.log('Imagens alternativas: catálogo, vendas, ampliação e celular aprovados; credencial restrita ao servidor.');
}finally{await browser?.close();await e?.close();}
