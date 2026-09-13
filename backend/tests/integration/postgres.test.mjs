import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {criarPool} from '../../src/postgres.mjs';
import {migrar} from '../../src/migracoes.mjs';
import {RepositorioPostgres} from '../../src/repositorio-postgres.mjs';
import {sincronizarCancelamentos} from '../../src/sincronizar-cancelamentos.mjs';
const schema='test_'+randomUUID().replaceAll('-','');
let admin,pool,repo;
const escopo={tenant:'teste',filial:'30098297'};
const evento=(id,tipo='S')=>({cod_operacao:id,tipo_operacao:tipo,filial:'30098297',data_cancelou:'/Date(1788922800000-180)/'});
const operacao=(id)=>({cod_operacao:id,tipo_operacao:'S',filial:'30098297',data_operacao:'2026-09-01',quantidade:2,valor_final_centavos:'31198',cancelada:false});
before(async()=>{
 admin=criarPool(process.env.TENANT_DATABASE_URL);
 await admin.query(`CREATE SCHEMA ${schema}`);
 pool=criarPool(process.env.TENANT_DATABASE_URL,{options:`-c search_path=${schema}`});
 await migrar(pool,new URL('../../../database/migrations/tenant/',import.meta.url));
 await pool.query("INSERT INTO tenant_identity(tenant_key) VALUES('teste')");
 repo=new RepositorioPostgres(pool,'teste');
});
after(async()=>{
 await pool?.end();
 if(admin){await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();}
});
test('Migrations reaplicadas não alteram tabelas existentes',async()=>{
 assert.deepEqual(await migrar(pool,new URL('../../../database/migrations/tenant/',import.meta.url)),[]);
});
test('Ciclo grava cancelamento e checkpoint atomicamente; reprocessar não duplica',async()=>{
 const executar=()=>sincronizarCancelamentos({repositorio:repo,...escopo,inicioHistorico:'2026-09-01',fim:'2026-09-09',consultar:async()=>[evento(101)]});
 await executar();await executar();
 assert.equal((await pool.query('SELECT count(*) FROM cancelamentos WHERE cod_operacao=101')).rows[0].count,'1');
 assert.equal((await pool.query('SELECT ate::text FROM sync_checkpoints')).rows[0].ate,'2026-09-09');
});
test('Erro depois das escritas reverte evento, operação e checkpoint de verdade',async()=>{
 await assert.rejects(repo.transacao(escopo,async tx=>{
   await tx.salvarOperacoes([operacao(102)]);
   await tx.salvarCancelamentos([evento(102)]);
   await tx.salvarCheckpoint('2026-09-10');
   throw new Error('Falha injetada antes de commit');
 }));
 assert.equal((await pool.query('SELECT count(*) FROM operacoes WHERE cod_operacao=102')).rows[0].count,'0');
 assert.equal((await pool.query('SELECT count(*) FROM cancelamentos WHERE cod_operacao=102')).rows[0].count,'0');
 assert.equal((await pool.query('SELECT ate::text FROM sync_checkpoints')).rows[0].ate,'2026-09-09');
});
test('Cancelamento retira venda dos indicadores, sem duplicar nem reativar por carga antiga',async()=>{
 await repo.transacao(escopo,tx=>tx.salvarOperacoes([operacao(103)]));
 assert.equal((await pool.query('SELECT valor_final_centavos FROM operacoes_ativas WHERE cod_operacao=103')).rows[0].valor_final_centavos,'31198');
 await repo.transacao(escopo,tx=>tx.salvarCancelamentos([evento(103)]));
 await repo.transacao(escopo,tx=>tx.salvarOperacoes([operacao(103)]));
 assert.equal((await pool.query('SELECT count(*) FROM operacoes_ativas WHERE cod_operacao=103')).rows[0].count,'0');
 assert.equal((await pool.query('SELECT count(*) FROM operacoes WHERE cod_operacao=103')).rows[0].count,'1');
});
test('Cancelamento antes da importação também mantém venda inativa',async()=>{
 await repo.transacao(escopo,tx=>tx.salvarCancelamentos([evento(104)]));
 await repo.transacao(escopo,tx=>tx.salvarOperacoes([operacao(104)]));
 assert.equal((await pool.query('SELECT cancelada FROM operacoes WHERE cod_operacao=104')).rows[0].cancelada,true);
});
test('Mesmo código com outro tipo ou filial não cancela a venda errada',async()=>{
 await repo.transacao(escopo,tx=>tx.salvarOperacoes([operacao(105)]));
 await repo.transacao(escopo,tx=>tx.salvarCancelamentos([evento(105,'E')]));
 await repo.transacao({...escopo,filial:'30098400'},tx=>tx.salvarCancelamentos([{...evento(105),filial:'30098400'}]));
 assert.equal((await pool.query('SELECT count(*) FROM operacoes_ativas WHERE cod_operacao=105')).rows[0].count,'1');
});
test('Recusa tenant errado e evento de filial diferente',async()=>{
 await assert.rejects(repo.transacao({...escopo,tenant:'outro'},async()=>{}));
 await assert.rejects(new RepositorioPostgres(pool,'outro').transacao({...escopo,tenant:'outro'},async()=>{}));
 await assert.rejects(repo.transacao(escopo,tx=>tx.salvarCancelamentos([{...evento(106),filial:'999'}])));
});
test('Ciclos concorrentes da filial preservam cancelamento e checkpoint crescente',async()=>{
 let entrou,liberar;
 const pronto=new Promise(r=>entrou=r), barreira=new Promise(r=>liberar=r);
 const primeiro=repo.transacao(escopo,async tx=>{entrou();await barreira;await tx.salvarCancelamentos([evento(107)]);await tx.salvarCheckpoint('2026-09-11');});
 await pronto;
 const segundo=repo.transacao(escopo,async tx=>{await tx.salvarOperacoes([operacao(107)]);await tx.salvarCheckpoint('2026-09-10');});
 liberar();await Promise.all([primeiro,segundo]);
 assert.equal((await pool.query('SELECT cancelada FROM operacoes WHERE cod_operacao=107')).rows[0].cancelada,true);
 assert.equal((await pool.query('SELECT ate::text FROM sync_checkpoints')).rows[0].ate,'2026-09-11');
});

test('Itens são substituídos na reimportação e falha reverte também a substituição',async()=>{
 const item={ordem:0,sku:'SKU',cod_produto:'A',descricao:'Teste',quantidade:2,preco_centavos:'1000'};
 const op={...operacao(108),ajuste_centavos:'0',subtotal_itens_centavos:'2000',conciliacao:'conciliada',produtos:[item]};
 await repo.transacao(escopo,tx=>tx.salvarOperacoes([op]));
 await repo.transacao(escopo,tx=>tx.salvarOperacoes([op]));
 assert.equal((await pool.query('SELECT count(*) FROM operacao_itens WHERE cod_operacao=108')).rows[0].count,'1');
 await assert.rejects(repo.transacao(escopo,tx=>tx.salvarOperacoes([{...op,produtos:[{...item,quantidade:0}]}])));
 assert.equal((await pool.query('SELECT quantidade FROM operacao_itens WHERE cod_operacao=108')).rows[0].quantidade,2);
});
test('Checkpoint de vendas não altera checkpoint de cancelamentos',async()=>{
 await repo.transacao(escopo,tx=>tx.salvarCheckpoint('2026-01-01','vendas'));
 assert.equal(await repo.transacao(escopo,tx=>tx.lerCheckpoint('vendas')),'2026-01-01');
 assert.equal(await repo.transacao(escopo,tx=>tx.lerCheckpoint('cancelamentos')),'2026-09-11');
});

test('Cliente acompanha venda, reimportação atualiza snapshot e rollback preserva dados anteriores',async()=>{
 const clientes=[{nome:'Cliente teste',contatos:[{tipo:'Celular',ddd:'11',telefone:'999990000'}]}];
 const op={...operacao(201),clientes};
 await repo.transacao(escopo,tx=>tx.salvarOperacoes([op]));
 const ler=async()=> (await pool.query('SELECT clientes,clientes_importados_em FROM operacoes WHERE cod_operacao=201')).rows[0];
 assert.deepEqual((await ler()).clientes,clientes);assert.ok((await ler()).clientes_importados_em);
 await assert.rejects(repo.transacao(escopo,async tx=>{await tx.salvarOperacoes([{...op,clientes:[]}]);throw Error('rollback');}));
 assert.deepEqual((await ler()).clientes,clientes);
 await repo.transacao(escopo,tx=>tx.salvarOperacoes([operacao(201)]));assert.deepEqual((await ler()).clientes,clientes);
 await repo.transacao(escopo,tx=>tx.salvarOperacoes([{...op,clientes:[]}]));assert.deepEqual((await ler()).clientes,[]);
});
test('Preenchimento histórico é retomável e preserva campos comerciais, itens, cancelamentos e checkpoints',async()=>{
 await repo.transacao(escopo,tx=>tx.salvarOperacoes([operacao(202),{...operacao(202),tipo_operacao:'E'}]));
 const snapshot=async()=>{
  const result={};
  for(const table of ['operacoes','operacao_itens','cancelamentos','sync_checkpoints'])result[table]=(await pool.query(`SELECT (to_jsonb(t)-'clientes'-'clientes_importados_em')::text AS valor FROM ${table} t ORDER BY 1`)).rows;
  return result;
 };
 const antes=await snapshot();const op={...operacao(202),clientes:[{nome:'Histórico',contatos:[]}]};
 assert.equal(await repo.transacao(escopo,tx=>tx.preencherClientes([{...op,data_operacao:'2026-09-02'}])),0);
 assert.equal(await repo.transacao(escopo,tx=>tx.preencherClientes([op])),1);
 assert.equal(await repo.transacao(escopo,tx=>tx.preencherClientes([{...op,clientes:[]}])),0);
 await assert.rejects(repo.transacao(escopo,tx=>tx.preencherClientes([{...op,filial:'999'}])));
 assert.deepEqual(await snapshot(),antes);
 assert.equal((await pool.query("SELECT clientes FROM operacoes WHERE cod_operacao=202 AND tipo_operacao='E'")).rows[0].clientes,null);
});
