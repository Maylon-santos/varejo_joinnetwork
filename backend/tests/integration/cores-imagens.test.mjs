import test from 'node:test';import assert from 'node:assert/strict';
import {ambienteFila} from '../fixtures/fila.mjs';
import {registrarCoresImagens,corDaImagem} from '../../src/cores-imagens.mjs';
import {RepositorioPostgres} from '../../src/repositorio-postgres.mjs';
import {normalizarVenda} from '../../src/vendas.mjs';
const ref={sku:'PROD-COR-P',cod_produto:'CAM',cor_codigo:'000078',cor_descricao:'Creme'};
async function estoque(e){
 await e.pool.query("INSERT INTO cadastro_produtos(produto,cod_produto,descricao) VALUES(9,'CAM','Camiseta'),(8,'OUTRO','Outro')");
 await e.pool.query("INSERT INTO estoque_atual(filial,sku,produto,cor,saldo,trans_id) VALUES(1,'PROD-COR-P',9,'2000000',3,1),(1,'PROD-COR-M',9,'2000000',2,1),(1,'PROD-AZUL-P',9,'3000000',1,1),(2,'PROD-COR-P',8,'2000000',1,1)");
}
const get=(e,path)=>fetch(e.base+'/api/v1'+path,{headers:{Authorization:'Bearer '+e.tokens.admin}});
test('mapeamento confirmado por SKU vale para os tamanhos da mesma cor/produto, sem cruzar produto, filial ou cor',async()=>{
 const calls=[],e=await ambienteFila({imagensAlternativas:true,imagemProduto:async(url,item)=>{calls.push(item);return {type:'image/webp',body:Buffer.from('foto')};}});
 try{
  await estoque(e);
  assert.equal(await registrarCoresImagens(e.pool,'2',[ref]),0);
  assert.equal(await registrarCoresImagens(e.pool,'1',[{...ref,sku:'NAO-EXISTE'},{...ref,cod_produto:'OUTRO'}]),0);
  assert.equal(await registrarCoresImagens(e.pool,'1',[ref]),1);
  assert.equal((await get(e,'/produtos/1/9/imagem?sku=PROD-COR-M')).status,200);assert.equal(calls.at(-1).cor_codigo,'000078');
  assert.equal((await get(e,'/produtos/1/9/imagem?sku=PROD-AZUL-P')).status,200);assert.equal(calls.at(-1).cor_codigo,null);
  await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,quantidade,preco_centavos) VALUES(10,'S',1,1,'PROD-COR-P','CAM',1,100)");
  assert.equal((await get(e,'/operacoes/1/S/10/itens/1/imagem')).status,200);assert.equal(calls.at(-1).cor_codigo,'000078');
  const antes=(await e.pool.query('SELECT row_to_json(e) AS dados FROM estoque_atual e ORDER BY filial,sku')).rows;
  await registrarCoresImagens(e.pool,'1',[{...ref,cor_codigo:'OUTRA'}]);
  assert.equal((await e.pool.query('SELECT conflitante FROM produto_cores_imagem')).rows[0].conflitante,true);
  await registrarCoresImagens(e.pool,'1',[ref]);
  await get(e,'/produtos/1/9/imagem?sku=PROD-COR-M');assert.equal(calls.at(-1).cor_codigo,null);
  assert.deepEqual((await e.pool.query('SELECT row_to_json(e) AS dados FROM estoque_atual e ORDER BY filial,sku')).rows,antes);
 }finally{await e.close();}
});
test('normalização e coletor preservam cor comercial sem alterar totais; colisão no mesmo lote bloqueia a associação',async()=>{
 const e=await ambienteFila();try{
  await estoque(e);
  const op=normalizarVenda({cod_operacao:90,tipo_operacao:'S',filial:1,data:'/Date(1788922800000-180)/',qtde:1,valor_final:10,cancelada:false,produtos:[{sku:ref.sku,cod_produto:'CAM',cod_cor:'000078',desc_cor:'Creme',quantidade:1,preco:10}]},'1','2026-09-09','2026-09-09');
  await new RepositorioPostgres(e.pool,'teste').transacao({tenant:'teste',filial:'1'},tx=>tx.salvarOperacoes([op]));
  assert.equal((await e.pool.query('SELECT cor_codigo FROM produto_cores_imagem')).rows[0].cor_codigo,'000078');
  assert.equal((await e.pool.query('SELECT valor_final_centavos::text FROM operacoes WHERE cod_operacao=90')).rows[0].valor_final_centavos,'1000');
  await e.pool.query('DELETE FROM produto_cores_imagem');
  await registrarCoresImagens(e.pool,'1',[ref,{...ref,sku:'PROD-COR-M',cor_codigo:'000079'}]);
  assert.equal((await e.pool.query('SELECT conflitante FROM produto_cores_imagem')).rows[0].conflitante,true);
  assert.deepEqual(corDaImagem({cod_cor:78,desc_cor:{}}),{cor_codigo:null,cor_descricao:null});
 }finally{await e.close();}
});
