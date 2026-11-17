import test from 'node:test';import assert from 'node:assert/strict';
import {ambienteFila} from '../fixtures/fila.mjs';
import {sincronizarEstoque} from '../../src/sincronizar-estoque.mjs';
const row=sku=>({filial:'1',sku,produto:'9',cod_produto:'CAM',descricao:'Camiseta sintética',cor:'AZ',tamanho:'P',barra:'123',saldo:'3',trans_id:'20'});
const get=(e,path,role='admin')=>fetch(e.base+'/api/v1'+path,{headers:role?{Authorization:'Bearer '+e.tokens[role]}:{}});
const permissao="UPDATE access_roles SET permissoes=permissoes||'[\"produtos:ler\",\"vendas:ler\",\"imagens:ler\"]'::jsonb WHERE role='Vendas' AND tenant_key='teste'";
const inserir="INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,descricao,quantidade,preco_centavos,imagem_url) VALUES($1,'S',1,1,$2,'CAM','Camiseta sintética',1,1000,$3)";

test('imagem alternativa do catálogo resolve código e cor sem venda; exige permissões, SKU, filial e produto autorizados',async()=>{
 const calls=[];const e=await ambienteFila({imagensAlternativas:true,imagemProduto:async(url,item)=>{calls.push({url,item});return {type:'image/webp',body:Buffer.from('foto-sintetica')};}});
 try{
  await sincronizarEstoque({pool:e.pool,tenant:'teste',filial:'1',consultar:async()=>[row('CAM-P')]});
  const catalogo=await(await get(e,'/produtos?filial=1')).json();assert.deepEqual(catalogo.produtos[0].imagem,{catalogo:true,filial:'1',produto:'9',sku:'CAM-P'});
  const path='/produtos/1/9/imagem?sku=CAM-P';assert.equal((await get(e,path,null)).status,401);
  for(const [path,status] of [['/produtos/999/9/imagem?sku=CAM-P',403],['/produtos/2/9/imagem?sku=CAM-P',404],['/produtos/1/10/imagem?sku=CAM-P',404],['/produtos/1/9/imagem?sku=OUTRO',404],['/produtos/1/9/imagem',404],['/produtos/1/9/imagem?sku=CAM-P&url=x',400],['/produtos/1/9/imagem?sku=CAM-P&sku=OUTRO',400]])assert.equal((await get(e,path)).status,status,path);
  assert.equal(calls.length,0);const r=await get(e,path);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');assert.deepEqual(calls,[{url:null,item:{cod_produto:'CAM',cor:'AZ',imagem_url:null}}]);
  await e.control.query(permissao);assert.equal((await(await get(e,'/produtos?filial=1','vendas')).json()).produtos[0].imagem,null);assert.equal((await get(e,path,'vendas')).status,404);
  await e.pool.query(inserir,[10,'CAM-P',null]);assert.equal((await get(e,path,'vendas')).status,200);
  await e.control.query("UPDATE access_roles SET permissoes=permissoes-'imagens:ler' WHERE role='Vendas' AND tenant_key='teste'");assert.equal((await get(e,path,'vendas')).status,403);assert.equal((await(await get(e,'/produtos?filial=1','vendas')).json()).produtos[0].imagem,null);
 }finally{await e.close();}
});

test('operações e rankings sem URL obtêm referência alternativa, mantendo vendedor e cor do SKU',async()=>{
 const calls=[];const e=await ambienteFila({imagensAlternativas:true,imagemProduto:async(url,item)=>{calls.push(item);return {type:'image/webp',body:Buffer.from('foto')};}});
 try{
  await sincronizarEstoque({pool:e.pool,tenant:'teste',filial:'1',consultar:async()=>[row('CAM-P')]});await e.pool.query('UPDATE operacoes SET data_operacao=$1',[e.dia]);
  await e.pool.query(inserir,[20,'CAM-P',null]);await e.control.query(permissao);
  const path='/operacoes/1/S/20/itens/1/imagem';assert.equal((await get(e,path,'vendas')).status,404);assert.equal(calls.length,0);
  assert.equal((await get(e,path)).status,200);assert.equal(calls[0].cod_produto,'CAM');assert.equal(calls[0].cor,'AZ');
  for(const endpoint of ['top','indicadores']){const data=await(await get(e,`/produtos/${endpoint}?filial=1&inicio=${e.dia}&fim=${e.dia}`)).json();assert.equal((data.top??data.produtos)[0].imagem.cod_operacao,'20');}
  await e.pool.query("INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou) VALUES(20,'S',1,now())");
  assert.equal((await get(e,path)).status,200); // O detalhe autorizado de uma venda cancelada continua consultável.
  assert.deepEqual((await(await get(e,`/produtos/top?filial=1&inicio=${e.dia}&fim=${e.dia}`)).json()).top,[]);
 }finally{await e.close();}
});

test('referências preferem foto principal mesmo quando existe uma venda mais recente sem URL',async()=>{
 const e=await ambienteFila({imagensAlternativas:true,imagemProduto:async()=>{throw Error('Indisponivel');}});
 try{
  await sincronizarEstoque({pool:e.pool,tenant:'teste',filial:'1',consultar:async()=>[row('CAM-P')]});await e.pool.query('UPDATE operacoes SET data_operacao=$1',[e.dia]);
  await e.pool.query(inserir,[10,'CAM-P','https://aeropostale1.hospedagemdesites.ws/fotosaero/exemplo.png']);await e.pool.query(inserir,[20,'CAM-P',null]);
  assert.equal((await(await get(e,'/produtos?filial=1')).json()).produtos[0].imagem.cod_operacao,'10');
  for(const endpoint of ['top','indicadores']){const data=await(await get(e,`/produtos/${endpoint}?filial=1&inicio=${e.dia}&fim=${e.dia}`)).json();assert.equal((data.top??data.produtos)[0].imagem.cod_operacao,'10');}
  assert.equal((await get(e,'/produtos/1/9/imagem?sku=CAM-P')).status,404);
 }finally{await e.close();}
});
