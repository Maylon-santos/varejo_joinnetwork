import test from 'node:test';
import assert from 'node:assert/strict';
import {ambienteFila} from '../fixtures/fila.mjs';
import {RepositorioPostgres} from '../../src/repositorio-postgres.mjs';

test('histórico preserva datas atuais e checkpoints, grava origem e reexecuta sem duplicar',async()=>{
 const a=await ambienteFila();try{
  const repo=new RepositorioPostgres(a.pool,'teste'),janela={inicio:'2023-01-01',fim:'2023-01-01'};
  await a.pool.query("INSERT INTO sync_checkpoints(filial,recurso,ate) VALUES(1,'vendas',current_date),(1,'cancelamentos',current_date)");
  const antes=(await a.pool.query('SELECT row_to_json(o)::text v FROM operacoes o WHERE filial=1 AND cod_operacao=10')).rows[0].v;
  const cps=(await a.pool.query('SELECT json_agg(c ORDER BY recurso)::text v FROM sync_checkpoints c')).rows[0].v;
  const op={cod_operacao:'900000',tipo_operacao:'S',filial:'1',data_operacao:'2023-01-01',quantidade:1,valor_final_centavos:'100',cancelada:false,clientes:null,clientes_pendencia:'CLIENTE_CODIGO_INVALIDO',complementos:{lancamentos:null,nota_fiscal:{numero_nota:'0001'}},pagamentos_pendencia:'LANCAMENTOS_ERP_INVALIDOS'};
  await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarHistorico([op],[],janela));
  await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarHistorico([op],[],janela));
  assert.equal((await a.pool.query('SELECT count(*)::int n FROM operacoes WHERE cod_operacao=900000')).rows[0].n,1);
  assert.equal((await a.pool.query('SELECT clientes FROM operacoes WHERE cod_operacao=900000')).rows[0].clientes,null);
  assert.equal((await a.pool.query('SELECT clientes_identidade_importada FROM operacoes WHERE cod_operacao=900000')).rows[0].clientes_identidade_importada,false);
  const clientes=[{cliente_codigo:'123',nome:'Cliente fictício',contatos:[]}];
  const pagamentos=[{valor_inicial_centavos:'100'}];
  await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarHistorico([{...op,clientes,pagamentos_pendencia:undefined,complementos:{...op.complementos,lancamentos:pagamentos}}],[],janela));
  await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarHistorico([op],[],janela));
  assert.deepEqual((await a.pool.query('SELECT clientes FROM operacoes WHERE cod_operacao=900000')).rows[0].clientes,clientes);
  assert.deepEqual((await a.pool.query('SELECT complementos FROM operacoes WHERE cod_operacao=900000')).rows[0].complementos,{lancamentos:pagamentos,nota_fiscal:{numero_nota:'0001'}});
  assert.equal((await a.pool.query("SELECT origem FROM integration_dirty WHERE chave='vnd_1_S_900000'")).rows[0].origem,'historica');
  await assert.rejects(()=>repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarHistorico([{...op,cod_operacao:'10'}],[],janela)),/IDENTIDADE_CONFLITANTE/);
  const evento={cod_operacao:'10',tipo_operacao:'S',filial:'1',data_cancelou:'/Date(1672542000000)/'};
  await assert.rejects(()=>repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarHistorico([], [evento],janela)),/CANCELAMENTO_CONFLITANTE/);
  await assert.rejects(()=>repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarHistorico([{...op,cod_operacao:'900001',data_operacao:'2023-01-07'}],[{...evento,cod_operacao:'900001'}],{inicio:'2023-01-01',fim:'2023-01-07'})),/CANCELAMENTO_CONFLITANTE/);
  assert.equal((await a.pool.query('SELECT count(*)::int n FROM operacoes WHERE cod_operacao=900001')).rows[0].n,0);
  const fiscal={...op,cod_operacao:'900002',clientes_pendencia:undefined,pagamentos_pendencia:undefined,complementos:{nota_fiscal:{numero_nota:'0001',status:'100'}}};
  await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarHistorico([fiscal],[],janela));
  const divergente={...fiscal,nota_fiscal_pendencia:'NOTA_FISCAL_DIVERGENTE',complementos:{nota_fiscal:null,notas_fiscais_divergentes:[{numero_nota:'0002'},{numero_nota:'0003'},{status:'100',numero_nota:'0001'}]}};
  for(let i=0;i<2;i++)await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.salvarHistorico([divergente],[],janela));
  const docs=(await a.pool.query('SELECT complementos FROM operacoes WHERE cod_operacao=900002')).rows[0].complementos;
  assert.equal(docs.nota_fiscal,null);assert.deepEqual(docs.notas_fiscais_divergentes.map(n=>n.numero_nota).sort(),['0001','0002','0003']);

  assert.equal((await a.pool.query('SELECT row_to_json(o)::text v FROM operacoes o WHERE filial=1 AND cod_operacao=10')).rows[0].v,antes);
  assert.equal((await a.pool.query('SELECT json_agg(c ORDER BY recurso)::text v FROM sync_checkpoints c')).rows[0].v,cps);
 }finally{await a.close();}
});
