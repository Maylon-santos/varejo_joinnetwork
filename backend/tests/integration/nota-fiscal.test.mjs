import test from 'node:test';
import assert from 'node:assert/strict';
import {ambienteFila} from '../fixtures/fila.mjs';
import {RepositorioPostgres} from '../../src/repositorio-postgres.mjs';
import {normalizarVenda} from '../../src/vendas.mjs';
import {preencherComplementos} from '../../src/preencher-complementos.mjs';
const venda=(e,fields={})=>normalizarVenda({cod_operacao:10,filial:1,tipo_operacao:'S',data:`/Date(${Date.parse(e.dia+'T15:00:00Z')})/`,cancelada:false,qtde:1,valor_final:10,v_acerto:0,cortesia:0,produtos:[{quantidade:1,preco:10}],numero_nota:123,modelo:65,idnfe:'0'.repeat(43)+'1',status:null,...fields},'1',e.dia,e.dia);
const snapshot=async e=>(await e.pool.query(`SELECT
 (SELECT jsonb_agg(to_jsonb(o)-'complementos'-'complementos_importados_em' ORDER BY filial,tipo_operacao,cod_operacao) FROM operacoes o) AS operacoes,
 (SELECT jsonb_agg(to_jsonb(i) ORDER BY filial,tipo_operacao,cod_operacao,ordem) FROM operacao_itens i) AS itens,
 (SELECT jsonb_agg(to_jsonb(c) ORDER BY filial,tipo_operacao,cod_operacao) FROM cancelamentos c) AS cancelamentos,
 (SELECT jsonb_agg(to_jsonb(c) ORDER BY filial,recurso) FROM sync_checkpoints c) AS checkpoints`)).rows[0];
test('nota fiscal é importada, exposta só no escopo autorizado e atualizada na releitura',async()=>{
 const e=await ambienteFila();try{
  const repo=new RepositorioPostgres(e.pool,'teste'),op=venda(e);
  await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarOperacoes([op]));
  const get=(codigo='10',filial='1',token=e.tokens.admin)=>fetch(e.base+`/api/v1/operacoes/${filial}/S/${codigo}`,{headers:{Authorization:'Bearer '+token}});
  const response=await get();assert.equal(response.status,200);assert.deepEqual((await response.json()).operacao.complementos.nota_fiscal,op.complementos.nota_fiscal);
  assert.equal((await get('10','999')).status,403);
  assert.equal((await get('20','1',e.tokens.vendas)).status,404);
  await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarOperacoes([venda(e,{status:'100'})]));
  assert.equal((await (await get()).json()).operacao.complementos.nota_fiscal.status,'100');
 }finally{await e.close();}
});
test('lote fiscal preenche legado sem substituir pagamentos, frete/cortesia, conferência ou checkpoints',async()=>{
 const e=await ambienteFila();try{
  const repo=new RepositorioPostgres(e.pool,'teste'),op=venda(e);
  await repo.transacao({tenant:'teste',filial:'1'},async tx=>{await tx.salvarOperacoes([op]);await tx.salvarCheckpoint(e.dia,'vendas');});
  await e.pool.query('UPDATE operacoes SET complementos=$1 WHERE complementos IS NULL',[JSON.stringify(op.complementos)]);
  await e.pool.query(`UPDATE operacoes SET conciliacao='regra_pendente',complementos=(complementos-'nota_fiscal')||'{"frete_centavos":"123","cortesia_informada":"2","desc_condicoes_pgto":"Pagamento preservado"}'::jsonb WHERE filial=1 AND cod_operacao=10`);
  const before=await snapshot(e),payment=(await e.pool.query('SELECT complementos FROM operacoes WHERE filial=1 AND cod_operacao=10')).rows[0].complementos;
  const calls=[],consultar=async p=>{calls.push(p);return [op];};
  const result=await preencherComplementos({pool:e.pool,repositorio:repo,tenant:'teste',filial:'1',consultar,limite:1});
  assert.equal(result.atualizadas,1);assert.deepEqual(calls,[{filial:'1',inicio:e.dia,fim:e.dia}]);
  const c=(await e.pool.query('SELECT complementos FROM operacoes WHERE filial=1 AND cod_operacao=10')).rows[0].complementos;
  assert.deepEqual(c,{...payment,nota_fiscal:op.complementos.nota_fiscal});assert.deepEqual(await snapshot(e),before);
  assert.equal(await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.preencherComplementos([op])),0);
  await e.pool.query("UPDATE sync_status SET proxima_tentativa=now()-interval '1 second' WHERE recurso='complementos'");
  assert.equal((await preencherComplementos({pool:e.pool,repositorio:repo,tenant:'teste',filial:'1',consultar,limite:1})).dias,0);assert.equal(calls.length,1);
  await e.pool.query("UPDATE operacoes SET complementos=complementos-'nota_fiscal' WHERE filial=1 AND cod_operacao=10");
  await assert.rejects(repo.transacao({tenant:'teste',filial:'1'},tx=>tx.preencherComplementos([{...op,valor_final_centavos:'999'}])),/CONFERENCIA_CABECALHO_DIVERGENTE/);
  assert.equal((await e.pool.query("SELECT complementos ? 'nota_fiscal' AS presente FROM operacoes WHERE filial=1 AND cod_operacao=10")).rows[0].presente,false);
  assert.deepEqual(await snapshot(e),before);
 }finally{await e.close();}
});
