import test from 'node:test';
import assert from 'node:assert/strict';
import {ambienteFila} from '../fixtures/fila.mjs';
import {criarConsolidado} from '../../src/consolidado.mjs';
const req=async(e,filial='1',role='admin')=>{const r=await fetch(e.base+`/api/v1/indicadores?filial=${filial}&inicio=2026-11-10&fim=2026-12-05`,{headers:{Authorization:'Bearer '+e.tokens[role]}});return {status:r.status,body:await r.json()};};
async function semear(e){await e.pool.query(`INSERT INTO metas_filiais(filial,competencia,valor_centavos,versao,atualizado_por) VALUES(1,'2026-10-01',999,1,$1),(1,'2026-11-01',310000,1,$1),(1,'2026-12-01',0,1,$1),(2,'2026-11-01',999999,1,$1),(1,'2027-01-01',123,1,$1)`,[e.usuarios.admin]);}
test('indicadores incluem apenas metas mensais vigentes da filial e meses selecionados, sem alterar registros',async()=>{
 const e=await ambienteFila();try{await semear(e);const antes=(await e.pool.query('SELECT row_to_json(m)::text AS r FROM metas_filiais m ORDER BY filial,competencia')).rows;
 const r=await req(e);assert.equal(r.status,200);assert.deepEqual(r.body.metas_mensais,[{competencia:'2026-11-01',valor_centavos:'310000'},{competencia:'2026-12-01',valor_centavos:'0'}]);
 await e.pool.query("UPDATE metas_filiais SET valor_centavos=NULL WHERE filial=1 AND competencia='2026-11-01'");assert.deepEqual((await req(e)).body.metas_mensais,[{competencia:'2026-12-01',valor_centavos:'0'}]);
 assert.equal((await e.pool.query('SELECT count(*)::int AS n FROM metas_filiais_historico')).rows[0].n,0);assert.equal((await e.pool.query('SELECT count(*)::int AS n FROM operacoes')).rows[0].n,30);
 await e.pool.query("UPDATE metas_filiais SET valor_centavos=310000 WHERE filial=1 AND competencia='2026-11-01'");assert.deepEqual((await e.pool.query('SELECT row_to_json(m)::text AS r FROM metas_filiais m ORDER BY filial,competencia')).rows,antes);
 }finally{await e.close();}
});
test('metas nos indicadores preservam cargo, permissão, tenant e vínculo explícito de filial',async()=>{
 const e=await ambienteFila();try{await semear(e);
 await e.control.query("UPDATE access_roles SET permissoes='[\"indicadores:ler\"]'::jsonb,todas_filiais=true WHERE role='Gerentes' AND tenant_key='teste'");assert.equal((await req(e,'1','leitor')).status,200);assert.equal(Object.hasOwn((await req(e,'1','leitor')).body,'metas_mensais'),false);
 await e.control.query("UPDATE admin_users SET role='Supervisao' WHERE email='leitor@fila.local'");await e.control.query("UPDATE access_roles SET permissoes='[\"indicadores:ler\",\"consolidado:ler\"]'::jsonb,todas_filiais=true WHERE role='Supervisao' AND tenant_key='teste'");await e.control.query('DELETE FROM user_branches WHERE user_id=$1 AND filial<>1',[e.usuarios.leitor]);
 assert.equal((await req(e,'1','leitor')).body.metas_mensais.length,2);const outra=await req(e,'2','leitor');assert.equal(outra.status,200);assert.equal(Object.hasOwn(outra.body,'metas_mensais'),false);
 await e.control.query("UPDATE access_roles SET permissoes='[\"indicadores:ler\"]'::jsonb WHERE role='Supervisao' AND tenant_key='teste'");assert.equal(Object.hasOwn((await req(e,'1','leitor')).body,'metas_mensais'),false);
 const user=await e.auth.autenticar(e.tokens.admin),s=criarConsolidado(e.pool,'teste',e.filiais);assert.equal(await s.referenciasMetas({...user,tenant_key:'outro'},'1','2026-11-10','2026-12-05'),null);assert.equal(await s.referenciasMetas({...user,somente_proprias_vendas:true},'1','2026-11-10','2026-12-05'),null);
 }finally{await e.close();}
});
