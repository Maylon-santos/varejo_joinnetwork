import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {ambienteFila as criarAmbienteFila} from '../fixtures/fila.mjs';import {RepositorioPostgres} from '../../src/repositorio-postgres.mjs';
import {normalizarVenda} from '../../src/vendas.mjs';import {processarReprocessamento,criarReprocessamentos} from '../../src/reprocessar-vendas.mjs';
async function ambienteFila(){const e=await criarAmbienteFila();await e.pool.query('UPDATE operacoes SET data_operacao=$1',[e.dia]);return e;}
const path=(codigo='10',filial='1')=>`/api/v1/operacoes/${filial}/S/${codigo}/reprocessar`;
async function request(e,{codigo='10',filial='1',role='admin',id=randomUUID(),method='POST'}={}){const r=await fetch(e.base+path(codigo,filial),{method,headers:{Authorization:'Bearer '+e.tokens[role],'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({requisicao:id})}:{})});return {status:r.status,body:await r.json()};}
function venda(e,changes={}){return normalizarVenda({filial:1,cod_operacao:10,tipo_operacao:'S',data:`/Date(${Date.parse(e.dia+'T15:00:00Z')})/`,cancelada:false,qtde:2,valor_final:20,v_acerto:0,produtos:[{quantidade:2,preco:10,sku:'P-1',cod_produto:'P',descricao:'Produto corrigido'}],vendedor:[{funcionario:10,nome:'Ana Exemplo'}],...changes},'1',e.dia,e.dia);}
const run=(e,consultar)=>processarReprocessamento({pool:e.pool,repositorio:new RepositorioPostgres(e.pool,'teste'),tenant:'teste',filiais:e.filiais,consultar});
const snapshot=async e=>(await e.pool.query("SELECT to_jsonb(o)::text AS op,(SELECT jsonb_agg(to_jsonb(i) ORDER BY ordem)::text FROM operacao_itens i WHERE filial=1 AND tipo_operacao='S' AND cod_operacao=10) AS itens FROM operacoes o WHERE filial=1 AND tipo_operacao='S' AND cod_operacao=10")).rows[0];
test('Admin agenda uma venda; reprocessamento atualiza só a escolhida, audita antes/depois e preserva checkpoints',async()=>{
 const e=await ambienteFila();try{
  await e.pool.query("UPDATE operacoes SET conciliacao='quantidade_divergente',erro_erp_confirmado_por='Teste',erro_erp_confirmado_em=now() WHERE filial=1 AND cod_operacao=10");
  await e.pool.query("INSERT INTO sync_checkpoints(filial,recurso,ate) VALUES(1,'vendas',current_date)");const checkpoints=(await e.pool.query('SELECT to_jsonb(c)::text AS c FROM sync_checkpoints c')).rows;
  const id=randomUUID(),first=await request(e,{id});assert.equal(first.status,202);assert.equal(first.body.reprocessamento.estado,'pendente');
  const duplicates=await Promise.all([request(e,{id}),request(e)]);assert.ok(duplicates.every(r=>r.body.reprocessamento.id===id));
  assert.equal((await request(e,{id,codigo:'20'})).status,409);
  let scope;const r=await run(e,async f=>{scope=f;return [venda(e),venda(e,{cod_operacao:20})];});assert.equal(r.estado,'concluido');assert.deepEqual(scope,{filial:'1',inicio:e.dia,fim:e.dia});
  const current=(await e.pool.query("SELECT quantidade,valor_final_centavos::text,conciliacao,erro_erp_confirmado_por FROM operacoes WHERE filial=1 AND cod_operacao=10")).rows[0];assert.deepEqual(current,{quantidade:2,valor_final_centavos:'2000',conciliacao:'conciliada',erro_erp_confirmado_por:null});
  assert.equal((await e.pool.query('SELECT valor_final_centavos::text AS v FROM operacoes WHERE filial=1 AND cod_operacao=20')).rows[0].v,'100');
  assert.deepEqual((await e.pool.query('SELECT to_jsonb(c)::text AS c FROM sync_checkpoints c')).rows,checkpoints);
  const audit=(await e.pool.query('SELECT antes,depois,solicitado_por FROM reprocessamentos_venda WHERE id=$1',[id])).rows[0];assert.equal(audit.antes.operacao.erro_erp_confirmado_por,'Teste');assert.equal(audit.antes.operacao.quantidade,1);assert.equal(audit.depois.operacao.quantidade,2);assert.ok(audit.solicitado_por);
  const status=await request(e,{method:'GET'});assert.equal(status.body.reprocessamento.estado,'concluido');assert.ok(!('antes' in status.body.reprocessamento));
  assert.equal((await request(e,{id})).body.reprocessamento.id,id);assert.equal((await request(e)).status,409);
 }finally{await e.close();}
});
test('reprocessamento exige Admin, tenant/filial corretos e não aceita operação inexistente',async()=>{
 const e=await ambienteFila();try{
  assert.equal((await request(e,{role:'vendas'})).status,403);assert.equal((await request(e,{role:'leitor'})).status,403);assert.equal((await request(e,{role:'leitor',method:'GET'})).status,403);
  assert.equal((await request(e,{filial:'999'})).status,403);assert.equal((await request(e,{codigo:'999'})).status,404);
  assert.equal((await request(e,{id:'invalido'})).status,400);
  const user=await e.auth.autenticar(e.tokens.admin);await assert.rejects(criarReprocessamentos(e.pool,'teste',e.filiais).solicitar({...user,tenant_key:'outro'},'1','S','10',{requisicao:randomUUID()}),/RECURSO_NAO_AUTORIZADO/);
  assert.equal((await e.pool.query('SELECT count(*)::int AS n FROM reprocessamentos_venda')).rows[0].n,0);
 }finally{await e.close();}
});
test('ERP indisponível, venda ausente e falha de gravação conservam os dados anteriores; retry controlado',async()=>{
 const e=await ambienteFila();try{
  await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,quantidade,preco_centavos) VALUES(10,'S',1,0,1,100)");const before=await snapshot(e);
  await request(e);assert.equal((await run(e,async()=>{throw Error('ERP_HTTP_503');})).estado,'falhou');assert.deepEqual(await snapshot(e),before);assert.equal((await request(e)).status,429);
  await e.pool.query("UPDATE reprocessamentos_venda SET criado_em=now()-interval '2 minutes'");await request(e);assert.equal((await run(e,async()=>[])).estado,'falhou');assert.deepEqual(await snapshot(e),before);
  await e.pool.query("UPDATE reprocessamentos_venda SET criado_em=now()-interval '2 minutes'");await request(e);const broken=venda(e);broken.produtos[0].quantidade=0;assert.equal((await run(e,async()=>[broken])).estado,'falhou');assert.deepEqual(await snapshot(e),before);
  assert.equal((await e.pool.query("SELECT count(*)::int AS n FROM reprocessamentos_venda WHERE estado='falhou'")).rows[0].n,3);
 }finally{await e.close();}
});
test('worker serializa consultas, retoma pedido interrompido e não reativa cancelamentos',async()=>{
 const e=await ambienteFila();try{
  const job=await request(e);await e.pool.query("UPDATE reprocessamentos_venda SET estado='processando',tentativas=1 WHERE id=$1",[job.body.reprocessamento.id]);
  await e.pool.query("INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou) VALUES(10,'S',1,now())");
  let release,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);const running=run(e,async()=>{started();await gate;return [venda(e)];});await ready;assert.equal((await run(e,async()=>{throw Error('NAO_DEVE_CONSULTAR');})).ocupado,true);release();assert.equal((await running).estado,'concluido');
  assert.equal((await e.pool.query('SELECT cancelada FROM operacoes WHERE filial=1 AND cod_operacao=10')).rows[0].cancelada,true);assert.equal((await e.pool.query('SELECT tentativas FROM reprocessamentos_venda WHERE id=$1',[job.body.reprocessamento.id])).rows[0].tentativas,2);
 }finally{await e.close();}
});
test('auditoria mantém centavos bigint exatos e divergência do ERP continua pendente',async()=>{
 const e=await ambienteFila();try{
  await request(e);const op=venda(e,{qtde:2,valor_final:'90071992547409.93',produtos:[{quantidade:1,preco:'90071992547409.93'}]});assert.equal(op.conciliacao,'quantidade_divergente');await run(e,async()=>[op]);
  const audit=(await e.pool.query("SELECT depois->'operacao'->>'valor_final_centavos' AS valor,resultado->>'valor_final_centavos' AS resumo,resultado->>'conciliacao' AS situacao FROM reprocessamentos_venda")).rows[0];assert.equal(audit.valor,'9007199254740993');assert.equal(audit.resumo,audit.valor);assert.equal(audit.situacao,'quantidade_divergente');
 }finally{await e.close();}
});

test('filtro de pendências inclui todas as divergências e exclui conciliadas e erros aceitos',async()=>{
 const e=await ambienteFila();try{
  const consultar=async()=>{const r=await fetch(e.base+`/api/v1/vendas?filial=1&inicio=${e.dia}&fim=${e.dia}&conciliacao=pendentes`,{headers:{Authorization:'Bearer '+e.tokens.admin}});assert.equal(r.status,200);return (await r.json()).operacoes;};
  await e.pool.query("UPDATE operacoes SET conciliacao='conciliada'");
  for(const status of ['quantidade_divergente','divergente','contrato_incompleto','regra_pendente','pendente']){await e.pool.query('UPDATE operacoes SET conciliacao=$1 WHERE filial=1 AND cod_operacao=10',[status]);assert.deepEqual((await consultar()).map(o=>o.cod_operacao),['10']);}
  await e.pool.query("UPDATE operacoes SET conciliacao='divergente',erro_erp_confirmado_por='Teste',erro_erp_confirmado_em=now() WHERE filial=1 AND cod_operacao=10");assert.equal((await consultar()).length,0);
 }finally{await e.close();}
});
