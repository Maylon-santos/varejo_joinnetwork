import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {criarPool} from '../../src/postgres.mjs';import {migrar} from '../../src/migracoes.mjs';import {sincronizarFiliais} from '../../src/filiais.mjs';
const schema='filiais_'+randomUUID().replaceAll('-','');let admin,pool;
before(async()=>{admin=criarPool(process.env.TENANT_DATABASE_URL);await admin.query(`CREATE SCHEMA ${schema}`);pool=criarPool(process.env.TENANT_DATABASE_URL,{options:`-c search_path=${schema}`});await migrar(pool,new URL('../../../database/migrations/tenant/',import.meta.url));await pool.query("INSERT INTO tenant_identity(tenant_key) VALUES('teste')");});
after(async()=>{await pool?.end();if(admin){await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();}});
const executar=consultar=>sincronizarFiliais({pool,tenant:'teste',filiais:['1','2'],forcar:true,consultar});
const row=(filial,trans_id,cod_filial='AERO-'+filial)=>({filial,trans_id,cod_filial});
test('Carga inicial, incremental e replay persistem cadastro/cursor e não importam filial não autorizada',async()=>{
 const r=await executar(async({cursor})=>{assert.equal(cursor,null);return [row('1','10'),row('2','11'),row('999','12')];});assert.equal(r.cursor,'12');assert.equal(r.gravadas,2);
 const novo=await executar(async({cursor})=>{assert.equal(cursor,'11');return [row('1','13','NOVO')];});assert.equal(novo.cursor,'13');
 const replay=await executar(async({cursor})=>{assert.equal(cursor,'12');return [row('1','13','NOVO')];});assert.equal(replay.gravadas,0);
 assert.equal((await pool.query('SELECT count(*) FROM cadastro_filiais')).rows[0].count,'2');
 assert.equal((await pool.query('SELECT cod_filial FROM cadastro_filiais WHERE filial=1')).rows[0].cod_filial,'NOVO');
});
test('Falha depois da primeira escrita reverte cadastro e cursor, aplica espera e preserva checkpoints de vendas',async()=>{
 const antes=(await pool.query('SELECT cursor FROM sync_cadastro_filiais')).rows[0].cursor;
 await assert.rejects(executar(async()=>[row('1','14','REVERTER'),row('2','15','')]));
 assert.equal((await pool.query('SELECT cursor FROM sync_cadastro_filiais')).rows[0].cursor,antes);
 assert.equal((await pool.query('SELECT cod_filial FROM cadastro_filiais WHERE filial=1')).rows[0].cod_filial,'NOVO');
 const r=await sincronizarFiliais({pool,tenant:'teste',filiais:['1','2'],consultar:()=>assert.fail('não consultar durante espera')});assert.equal(r.aguardando,true);
 assert.equal((await pool.query('SELECT count(*) FROM sync_checkpoints')).rows[0].count,'0');
});
test('Resposta vazia preserva cursor; escopo ampliado exige carga total e cadastro de todos os autorizados',async()=>{
 const r=await executar(async()=>[]);assert.equal(r.cursor,'13');
 await assert.rejects(sincronizarFiliais({pool,tenant:'teste',filiais:['1','2','3'],forcar:true,consultar:async({cursor})=>{assert.equal(cursor,null);return [row('1','14'),row('2','15')];}}),/CADASTRO_AUTORIZADO_AUSENTE/);
 assert.equal((await pool.query('SELECT cursor FROM sync_cadastro_filiais')).rows[0].cursor,'13');
 await assert.rejects(sincronizarFiliais({pool,tenant:'outro',filiais:['1'],forcar:true,consultar:()=>assert.fail('tenant inválido não consulta ERP')}),/TENANT_INCORRETO/);
});
