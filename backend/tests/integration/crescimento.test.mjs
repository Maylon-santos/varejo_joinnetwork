import test from 'node:test';import assert from 'node:assert/strict';
import {ambienteFila} from '../fixtures/fila.mjs';import {dadosCrescimento} from '../fixtures/crescimento.mjs';import {criarConsolidado} from '../../src/consolidado.mjs';
const hoje=()=> '2026-11-16',path='/api/v1/crescimento?ano=2026&modo=acumulado';
async function req(e,url=path,role='admin',method='GET'){const r=await fetch(e.base+url,{method,headers:role?{Authorization:'Bearer '+e.tokens[role]}:{}});return {status:r.status,body:await r.json()};}
test('crescimento anual agrega cabeçalho, cancelamentos, peças, ticket, totais e mensal sem alterar dados',async()=>{
 const e=await ambienteFila({hoje});try{await dadosCrescimento(e);const before=(await e.pool.query('SELECT md5(string_agg(row_to_json(o)::text,\'\' ORDER BY filial,cod_operacao)) AS hash FROM operacoes o')).rows;
 const {status,body:d}=await req(e);assert.equal(status,200);assert.equal(d.filiais.length,10);assert.deepEqual(d.anos,[2026,2025,2024]);assert.equal(d.total.atual.valor_centavos,'48000');assert.equal(d.total.anterior.valor_centavos,'40000');assert.equal(d.total.variacao.valor_centavos.percentual,'20.00');assert.equal(d.total.atual.vendas,3);assert.equal(d.total.atual.ticket_medio_centavos,'16000');assert.equal(d.total.atual.pendencias,1);assert.equal(d.filiais[0].filial,'1');assert.equal(d.filiais[0].variacao.valor_centavos.percentual,'100.00');assert.equal(d.filiais.find(b=>b.filial==='2').variacao.valor_centavos.percentual,'-50.00');assert.equal(d.filiais.find(b=>b.filial==='3').variacao.valor_centavos.percentual,null);assert.equal(d.filiais.find(b=>b.filial==='4').variacao.valor_centavos.percentual,'-100.00');assert.equal(d.filiais.find(b=>b.filial==='5').sem_base_anterior,true);assert.equal(d.filiais[0].mensal.length,11);
 const sum=d.filiais[0].mensal.reduce((n,m)=>n+BigInt(m.atual.valor_centavos),0n);assert.equal(sum.toString(),d.filiais[0].atual.valor_centavos);
 assert.deepEqual((await e.pool.query('SELECT md5(string_agg(row_to_json(o)::text,\'\' ORDER BY filial,cod_operacao)) AS hash FROM operacoes o')).rows,before);
 await e.pool.query('UPDATE operacoes SET valor_final_centavos=9007199254740993 WHERE cod_operacao=3');assert.equal((await req(e)).body.filiais[0].variacao.valor_centavos.diferenca,'9007199254725993');
 }finally{await e.close();}
});
test('anos completos incluem dezembro e acumulado não mistura ano parcial com completo; entradas vazias mantidas',async()=>{
 const e=await ambienteFila({hoje});try{await dadosCrescimento(e);const d=(await req(e,'/api/v1/crescimento?ano=2025&modo=completo')).body;assert.equal(d.filiais.find(b=>b.filial==='1').atual.valor_centavos,'65000');assert.equal(d.periodos.anterior.fim,'2024-12-31');assert.equal(d.filiais[0].mensal.length,12);assert.equal((await req(e,'/api/v1/crescimento?ano=2026&modo=completo')).status,400);
 for(const q of ['ano=2027','ano=2025&modo=x','ano=2025&ano=2024','ano=2025&filial=1'])assert.equal((await req(e,'/api/v1/crescimento?'+q)).status,400);assert.equal((await req(e,path,'admin','POST')).status,405);
 await e.pool.query("UPDATE sync_checkpoints SET ate='2025-12-31' WHERE filial=1");assert.equal((await req(e)).body.filiais.find(b=>b.filial==='1').atualizacao_cobre_fim,false);
 }finally{await e.close();}
});
test('autorizações de consolidado limitam dados, anos e séries; tenant incorreto e vendedor recusados',async()=>{
 const e=await ambienteFila({hoje});try{await dadosCrescimento(e);assert.equal((await req(e,path,null)).status,401);for(const role of ['vendas','leitor'])assert.equal((await req(e,path,role)).status,403);
 for(const role of ['Diretoria','Supervisao']){await e.control.query("UPDATE admin_users SET role=$1 WHERE email='leitor@fila.local'",[role]);await e.control.query("DELETE FROM user_branches WHERE user_id=(SELECT id FROM admin_users WHERE email='leitor@fila.local') AND filial<>2");await e.control.query("UPDATE access_roles SET todas_filiais=true WHERE role=$1",[role]);const d=(await req(e,path,'leitor')).body;assert.deepEqual(d.filiais.map(b=>b.filial),['2']);assert.deepEqual(d.anos,[2026,2025]);assert.equal(d.total.atual.valor_centavos,'10000');}
 const user=await e.auth.autenticar(e.tokens.admin);await assert.rejects(criarConsolidado(e.pool,'teste',e.filiais,{hoje}).crescimento({...user,tenant_key:'outro'},'2026'),{status:403});
 await e.control.query("DELETE FROM user_branches WHERE user_id=(SELECT id FROM admin_users WHERE email='leitor@fila.local')");const vazio=(await req(e,path,'leitor')).body;assert.equal(vazio.filiais.length,0);assert.equal(vazio.total.atual.valor_centavos,'0');
 }finally{await e.close();}
});
