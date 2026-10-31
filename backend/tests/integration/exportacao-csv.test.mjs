import test from 'node:test';
import assert from 'node:assert/strict';
import {ambienteFila} from '../fixtures/fila.mjs';
import {lerBaseExportacao,montarRelatorios} from '../../src/exportacao-csv.mjs';
test('exporta snapshot sem cancelar/duplicar totais, isola filial/tenant e preserva dados',async()=>{
 const e=await ambienteFila();try{
  await e.pool.query('DELETE FROM operacoes');
  await e.pool.query(`INSERT INTO operacoes(cod_operacao,tipo_operacao,filial,data_operacao,quantidade,valor_final_centavos,cancelada) VALUES
   (1,'S',1,'2026-10-01',2,10001,false),(2,'S',1,'2026-10-20',1,20002,false),
   (3,'S',1,'2026-10-01',1,99999,true),(4,'S',1,'2026-10-01',1,99999,false),
   (5,'E',1,'2026-10-01',1,99999,false),(6,'S',2,'2026-10-01',1,99999,false),(7,'S',1,'2026-10-21',1,99999,false)`);
  await e.pool.query("INSERT INTO cancelamentos VALUES(4,'S',1,now(),now())");
  await e.pool.query("INSERT INTO cadastro_produtos(produto,cod_produto,descricao,classificacao) VALUES(1,'P','Produto','{\"marca\":{\"codigo\":\"M\",\"descricao\":\"Marca teste\"}}')");
  await e.pool.query("INSERT INTO estoque_atual(filial,sku,produto,trans_id) VALUES(1,'SKU',1,1)");
  await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,quantidade,preco_centavos) VALUES(1,'S',1,0,'SKU','P',2,5000)");
  const antes=(await e.pool.query('SELECT to_jsonb(o)::text AS dado FROM operacoes o ORDER BY filial,cod_operacao')).rows;
  const args={tenant:'teste',filiais:['1'],inicio:'2026-10-01',fim:'2026-10-20'};
  const b=await lerBaseExportacao(e.pool,args),{relatorios:r}=montarRelatorios(b);
  assert.deepEqual(b.operacoes.map(o=>o.cod_operacao),['1','2']);assert.equal(b.marcas.length,1);assert.equal(b.marcas[0].marca,'Marca teste');
  assert.equal(r.vendas_por_cupom.linhas[0].situacao_marca,'unica');assert.equal(r.cadastro_filiais.linhas.length,1);
  assert.equal(b.operacoes.reduce((s,o)=>s+BigInt(o.valor_final_centavos),0n),30003n);
  assert.deepEqual((await e.pool.query('SELECT to_jsonb(o)::text AS dado FROM operacoes o ORDER BY filial,cod_operacao')).rows,antes);
  await assert.rejects(lerBaseExportacao(e.pool,{...args,tenant:'outro'}),/TENANT_INCORRETO/);
 }finally{await e.close();}
});
