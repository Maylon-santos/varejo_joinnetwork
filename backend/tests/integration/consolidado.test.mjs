import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {ambienteFila} from '../fixtures/fila.mjs';import {criarConsolidado} from '../../src/consolidado.mjs';
const mes='2026-09',consulta='/api/v1/consolidado?inicio=2026-09-01&fim=2026-09-30';
async function req(e,path=consulta,{role='admin',method='GET',body}={}){const r=await fetch(e.base+path,{method,headers:{Authorization:'Bearer '+e.tokens[role],'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
const put=(e,filial,body,role='admin')=>req(e,`/api/v1/metas/${filial}/${mes}`,{role,method:'PUT',body});
const meta=(valor='200000.00',versao=0)=>({valor,versao,requisicao:randomUUID()});
async function gestor(e,role='Supervisao'){await e.control.query("UPDATE admin_users SET role=$1 WHERE email='leitor@fila.local'",[role]);await e.control.query("DELETE FROM user_branches WHERE user_id=(SELECT id FROM admin_users WHERE email='leitor@fila.local') AND filial<>1");}
async function dados(e){await e.pool.query('DELETE FROM operacoes');await e.pool.query(`INSERT INTO operacoes(cod_operacao,tipo_operacao,filial,data_operacao,quantidade,valor_final_centavos,cancelada,conciliacao) VALUES
 (1,'S',1,'2026-09-19',2,10000,false,'conciliada'),(2,'S',2,'2026-09-19',3,20000,false,'divergente'),
 (3,'S',1,'2026-09-19',5,99999,true,'conciliada'),(4,'S',1,'2026-09-19',5,99999,false,'conciliada'),
 (5,'E',1,'2026-09-19',5,99999,false,'nao_elegivel'),(6,'S',1,'2026-08-31',1,50000,false,'conciliada')`);await e.pool.query("INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou) VALUES(4,'S',1,now())");}
test('consolidado soma filiais elegíveis, ordena por valor e inclui filial sem vendas, preservando cancelamentos e período',async()=>{
 const e=await ambienteFila();try{await dados(e);const d=await req(e);assert.equal(d.status,200);assert.deepEqual(d.body.total,{vendas:2,pecas:'5',valor_centavos:'30000',pendencias:1});assert.equal(d.body.filiais.length,10);assert.equal(d.body.filiais[0].filial,'2');assert.equal(d.body.filiais[0].participacao_percentual,'66.66');assert.equal(d.body.filiais.find(r=>r.filial==='3').valor_centavos,'0');assert.equal(d.body.filiais_sem_cobertura,10);
 await e.pool.query("UPDATE operacoes SET valor_final_centavos=9007199254740993 WHERE cod_operacao=1");assert.equal((await req(e)).body.total.valor_centavos,'9007199254760993');
 assert.equal((await req(e,'/api/v1/consolidado?inicio=2026-09-31&fim=2026-10-01')).status,400);assert.equal((await req(e,consulta+'&filial=1')).status,400);assert.equal((await req(e,consulta+'&inicio=2026-09-01')).status,400);
 }finally{await e.close();}
});
test('somente cargos autorizados; Diretoria/Supervisão veem e editam só filiais atribuídas, mesmo com todas_filiais',async()=>{
 const e=await ambienteFila();try{await dados(e);for(const role of ['leitor','vendas'])assert.equal((await req(e,consulta,{role})).status,403);
 for(const role of ['Supervisao','Diretoria']){await gestor(e,role);await e.control.query('UPDATE access_roles SET todas_filiais=true WHERE role=$1 AND tenant_key=$2',[role,'teste']);const d=await req(e,consulta,{role:'leitor'});assert.equal(d.status,200);assert.deepEqual(d.body.filiais.map(r=>r.filial),['1']);assert.equal(d.body.total.valor_centavos,'10000');assert.equal((await req(e,'/api/v1/metas?competencia='+mes,{role:'leitor'})).body.filiais.length,1);assert.equal((await put(e,'2',meta(),'leitor')).status,403);}
 const allowed=await put(e,'1',meta(),'leitor');assert.equal(allowed.status,200);
 await e.control.query("DELETE FROM user_branches WHERE user_id=(SELECT id FROM admin_users WHERE email='leitor@fila.local')");assert.equal((await req(e,consulta,{role:'leitor'})).body.filiais.length,0);
 const user=await e.auth.autenticar(e.tokens.admin);await assert.rejects(criarConsolidado(e.pool,'teste',e.filiais).consultar({...user,tenant_key:'outro'},'2026-09-01','2026-09-30'),{status:403});
 }finally{await e.close();}
});
test('metas mensais têm autoria, versão, idempotência, remoção auditada e não alteram vendas',async()=>{
 const e=await ambienteFila();try{await dados(e);const before=(await e.pool.query('SELECT to_jsonb(o)::text AS o FROM operacoes o ORDER BY filial,cod_operacao')).rows;
 const body=meta('200.00'),first=await put(e,'1',body);assert.equal(first.status,200);assert.equal(first.body.meta.valor_centavos,'20000');assert.equal((await put(e,'1',body)).body.meta.versao,1);assert.equal((await put(e,'1',{...body,valor:'201.00'})).status,409);
 const concurrent=await Promise.all([put(e,'1',meta('300.00',1)),put(e,'1',meta('400.00',1))]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 const m=(await req(e,'/api/v1/metas?competencia='+mes)).body;assert.equal(m.filiais_com_meta,1);assert.equal(m.realizado_com_meta_centavos,'10000');assert.equal(m.filiais.find(r=>r.filial==='2').meta.valor_centavos,null);
 assert.equal((await put(e,'1',meta(null,2))).status,200);assert.equal((await req(e,'/api/v1/metas?competencia='+mes)).body.filiais_com_meta,0);assert.equal((await put(e,'1',meta('0.00',3))).status,200);const zero=(await req(e,'/api/v1/metas?competencia='+mes)).body;assert.equal(zero.filiais_com_meta,1);assert.equal(zero.atingimento_percentual,null);
 assert.equal((await e.pool.query('SELECT count(*)::int AS n FROM metas_filiais_historico')).rows[0].n,4);const h=(await e.pool.query('SELECT antes,depois,ator_id FROM metas_filiais_historico WHERE requisicao=$1',[body.requisicao])).rows[0];assert.equal(h.antes,null);assert.equal(h.depois.valor_centavos,'20000');assert.ok(h.ator_id);assert.deepEqual((await e.pool.query('SELECT to_jsonb(o)::text AS o FROM operacoes o ORDER BY filial,cod_operacao')).rows,before);
 assert.equal((await req(e,'/api/v1/metas?competencia=2026-10')).body.filiais_com_meta,0);
 }finally{await e.close();}
});
test('validação e revogação durante edição não gravam metas',async()=>{
 const e=await ambienteFila();try{for(const valor of [-1,'-1.00','1.001','1e3','9999999999999.00','1,00'])assert.equal((await put(e,'1',meta(valor))).status,400);assert.equal((await req(e,'/api/v1/metas?competencia=2026-13')).status,400);assert.equal((await put(e,'999',meta())).status,403);assert.equal((await put(e,'1',meta(),'vendas')).status,403);
 await gestor(e);const user=await e.auth.autenticar(e.tokens.leitor);await assert.rejects(criarConsolidado(e.pool,'teste',e.filiais).salvarMeta(user,'1',mes,meta(),async()=>({...user,vinculos:[]})),{status:403});
 await e.control.query("UPDATE access_roles SET permissoes='[\"consolidado:ler\"]'::jsonb WHERE role='Supervisao' AND tenant_key='teste'");assert.equal((await put(e,'1',meta(),'leitor')).status,403);assert.equal((await req(e,'/api/v1/metas?competencia='+mes,{role:'leitor'})).body.pode_editar,false);assert.equal((await e.pool.query('SELECT count(*)::int AS n FROM metas_filiais')).rows[0].n,0);
 }finally{await e.close();}
});
