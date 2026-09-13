import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {criarPool} from '../../src/postgres.mjs';
import {migrar} from '../../src/migracoes.mjs';
import {criarAuth,criarAdmin,hashToken} from '../../src/admin-auth.mjs';
import {criarPainel} from '../../src/painel.mjs';
import {criarServidor} from '../../src/http-api.mjs';
const schema='api_'+randomUUID().replaceAll('-','');
let controlAdmin,tenantAdmin,control,pool,server,base,auth,token;
const senha='Senha longa somente para integração!';
before(async()=>{
 controlAdmin=criarPool(process.env.CONTROL_DATABASE_URL);tenantAdmin=criarPool(process.env.TENANT_DATABASE_URL);
 await controlAdmin.query(`CREATE SCHEMA ${schema}`);await tenantAdmin.query(`CREATE SCHEMA ${schema}`);
 control=criarPool(process.env.CONTROL_DATABASE_URL,{options:`-c search_path=${schema}`});pool=criarPool(process.env.TENANT_DATABASE_URL,{options:`-c search_path=${schema}`});
 await migrar(control,new URL('../../../database/migrations/control/',import.meta.url));await migrar(pool,new URL('../../../database/migrations/tenant/',import.meta.url));
 await control.query("INSERT INTO tenants(tenant_key,nome,database_name) VALUES('teste','Teste','teste'),('outro','Outro','outro')");
 await pool.query("INSERT INTO tenant_identity(tenant_key) VALUES('teste')");
 await criarAdmin(control,{tenant:'teste',email:'admin@teste.local',senha});await criarAdmin(control,{tenant:'outro',email:'outro@teste.local',senha});
 await pool.query(`INSERT INTO operacoes(cod_operacao,tipo_operacao,filial,data_operacao,quantidade,valor_final_centavos,cancelada,conciliacao,vendedor_codigo,vendedor_nome) VALUES
  (1,'S',1,'2026-09-01',2,10000,false,'conciliada','10','Nome antigo'),
  (2,'S',1,'2026-09-02',3,20000,false,'conciliada','10','Nome atual'),
  (3,'S',1,'2026-09-01',9,90000,true,'nao_elegivel','10','Nome atual'),
  (4,'S',1,'2026-09-01',9,90000,false,'conciliada','10','Nome atual'),
  (5,'E',1,'2026-09-01',1,5000,false,'nao_elegivel','10','Nome atual'),
  (6,'S',1,'2026-09-02',1,7000,false,'quantidade_divergente','20','Outro vendedor'),
  (7,'S',999,'2026-09-01',9,999999,false,'conciliada','10','Loja restrita')`);
 await pool.query("INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou) VALUES(4,'S',1,now())");
 await pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,quantidade,preco_centavos) VALUES(1,'S',1,0,2,5000)");
 await pool.query("INSERT INTO sync_checkpoints(filial,recurso,ate) VALUES(1,'vendas','2026-09-02'),(1,'cancelamentos','2026-09-02')");
 await pool.query(`UPDATE operacoes SET clientes=$1::jsonb,clientes_importados_em=now() WHERE cod_operacao=1 AND filial=1`,[JSON.stringify([{nome:'Cliente da operação 1',contatos:[{tipo:'Telefone',ddd:'11',telefone:'33330000'}]}])]);
 auth=await criarAuth(control,'teste');
 server=criarServidor({auth,imagemProduto:async()=>({type:'image/jpeg',body:Buffer.from([1,2,3])}),painel:criarPainel(pool,'teste',['1']),filiais:['1'],limitar:()=>true,limitarLogin:()=>true});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 const session=await auth.login('admin@teste.local',senha);token=session.token;
});
after(async()=>{
 if(server)await new Promise(resolve=>server.close(resolve));await Promise.all([pool?.end(),control?.end()]);
 if(controlAdmin){await controlAdmin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await controlAdmin.end();}
 if(tenantAdmin){await tenantAdmin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await tenantAdmin.end();}
});
const get=(path,session=token)=>fetch(base+path,{headers:{Authorization:`Bearer ${session}`}});
const filtro='filial=1&inicio=2026-09-01&fim=2026-09-02';
test('Login via HTTP cria sessão; senha incorreta e tenant diferente são rejeitados',async()=>{
 for(const [email,password,status] of [['admin@teste.local',senha,200],['admin@teste.local','incorreta',401],['outro@teste.local',senha,401]]){
 const r=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,senha:password})});assert.equal(r.status,status);
 const data=await r.json();if(status===200){assert.match(data.token,/^[a-f0-9]{64}$/);assert.equal(data.password_hash,undefined);}
 }
});
test('Sem autenticação não expõe indicadores; sessão armazenada somente como hash',async()=>{
 assert.equal((await get('/api/v1/indicadores?'+filtro,'')).status,401);
 const r=await control.query('SELECT token_hash FROM admin_sessions WHERE token_hash=$1',[hashToken(token)]);assert.equal(r.rowCount,1);assert.notEqual(r.rows[0].token_hash,token);
});
test('Indicadores excluem cancelamentos e entradas, sinalizam pendências e usam a mesma população',async()=>{
 const r=await get('/api/v1/indicadores?'+filtro);assert.equal(r.status,200);const d=await r.json();
 assert.equal(d.vendas,3);assert.equal(d.valor_vendas_centavos,'37000');assert.equal(d.pecas_cabecalho,'6');assert.equal(d.ticket_medio_centavos,'12333');assert.equal(d.pecas_por_venda,'2.0000');
 assert.equal(d.vendas_com_pendencia,1);assert.equal(d.excluidas.canceladas,2);assert.equal(d.excluidas.outras_operacoes_ativas,1);assert.equal(d.serie_diaria.length,2);
 assert.equal(d.checkpoints_cobrem_fim,true);
});
test('Período vazio retorna ticket e PA nulos; cobertura incompleta é explícita',async()=>{
 const d=await (await get('/api/v1/indicadores?filial=1&inicio=2026-09-03&fim=2026-09-04')).json();
 assert.equal(d.vendas,0);assert.equal(d.valor_vendas_centavos,'0');assert.equal(d.ticket_medio_centavos,null);assert.equal(d.pecas_por_venda,null);assert.equal(d.checkpoints_cobrem_fim,false);
});
test('Ranking agrupa por código do vendedor, usa nome recente e calcula ticket correto',async()=>{
 const r=await get('/api/v1/ranking?'+filtro);assert.equal(r.status,200);const d=await r.json();
 assert.equal(d.total,2);assert.equal(d.ranking[0].vendedor_codigo,'10');assert.equal(d.ranking[0].vendedor_nome,'Nome atual');assert.equal(d.ranking[0].ticket_medio_centavos,'15000');assert.equal(d.ranking[0].pecas_por_venda,'2.5000');
});
test('Paginação é estável, detalhe inclui itens e cancelamento efetivo',async()=>{
 const d=await (await get('/api/v1/vendas?'+filtro+'&limite=1&pagina=2')).json();assert.equal(d.total,3);assert.equal(d.operacoes.length,1);assert.equal(d.operacoes[0].cod_operacao,'2');
 const detalhe=await (await get('/api/v1/operacoes/1/S/1')).json();assert.equal(detalhe.itens.length,1);
 const cancelada=await (await get('/api/v1/operacoes/1/S/4')).json();assert.equal(cancelada.operacao.cancelada,true);assert.ok(cancelada.cancelamento);
});
test('Isolamento e validação rejeitam filial, tenant, SQL e datas inválidas',async()=>{
 for(const [url,status] of [['/api/v1/indicadores?filial=999&inicio=2026-09-01&fim=2026-09-02',403],['/api/v1/operacoes/999/S/7',403],['/api/v1/indicadores?'+filtro+'&tenant=outro',400],['/api/v1/ranking?'+filtro+'&ordenar=1;DROP',400],['/api/v1/indicadores?filial=1&inicio=2026-02-30&fim=2026-03-01',400]])assert.equal((await get(url)).status,status);
 await assert.rejects(criarPainel(pool,'outro',['1']).filiais());
});
test('Logout, expiração e usuário desativado invalidam sessão',async()=>{
 const one=await auth.login('admin@teste.local',senha);const r=await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${one.token}`}});assert.equal(r.status,200);assert.equal((await get('/api/v1/auth/me',one.token)).status,401);
 const two=await auth.login('admin@teste.local',senha);await control.query("UPDATE admin_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[hashToken(two.token)]);assert.equal((await get('/api/v1/auth/me',two.token)).status,401);
 await control.query("UPDATE admin_users SET active=false WHERE tenant_key='teste'");assert.equal((await get('/api/v1/auth/me')).status,401);await control.query("UPDATE admin_users SET active=true WHERE tenant_key='teste'");
});

test('Erro ERP confirmado sai das pendências, mantém cabeçalho e sobrevive à reimportação',async()=>{
 const {RepositorioPostgres}=await import('../../src/repositorio-postgres.mjs');
 const painel=criarPainel(pool,'teste',['1']);const f={filial:'1',inicio:'2026-09-01',fim:'2026-09-02',pagina:1,limite:50};
 const antes=await painel.indicadores(f);
 try{
  await pool.query("UPDATE operacoes SET erro_erp_confirmado_por='Maylon',erro_erp_confirmado_em=now() WHERE cod_operacao=6 AND filial=1");
  const row=(await pool.query("SELECT *,data_operacao::text FROM operacoes WHERE cod_operacao=6 AND filial=1")).rows[0];
  await new RepositorioPostgres(pool,'teste').transacao({tenant:'teste',filial:'1'},tx=>tx.salvarOperacoes([{...row,produtos:[]}]));
  const depois=await painel.indicadores(f);
  for(const k of ['vendas','valor_vendas_centavos','pecas_cabecalho','ticket_medio_centavos','pecas_por_venda'])assert.equal(depois[k],antes[k]);
  assert.equal(depois.vendas_com_pendencia,antes.vendas_com_pendencia-1);
  const lista=await painel.vendas(f,{conciliacao:'erro_erp_confirmado'});assert.equal(lista.total,1);assert.equal(lista.operacoes[0].cod_operacao,'6');
  const detalhe=await painel.detalhe('1','S','6');assert.equal(detalhe.operacao.conciliacao,'erro_erp_confirmado');assert.equal(detalhe.operacao.conciliacao_original,'quantidade_divergente');assert.equal(detalhe.operacao.erro_erp_confirmado_por,'Maylon');
  const rank=await painel.ranking(f);assert.equal(rank.ranking.find(r=>r.vendedor_codigo==='20').vendas_com_pendencia,0);
 }finally{await pool.query('UPDATE operacoes SET erro_erp_confirmado_por=NULL,erro_erp_confirmado_em=NULL WHERE cod_operacao=6 AND filial=1');}
});


test('Cliente persistido é servido sem conector ERP; cliente e fotos exigem autenticação e filial autorizada',async()=>{
 const detail=await (await get('/api/v1/operacoes/1/S/1')).json();assert.equal(detail.operacao.clientes[0].nome,'Cliente da operação 1');
 const pending=await (await get('/api/v1/operacoes/1/S/2/cliente')).json();assert.equal(pending.clientes,null);
 const customer='/api/v1/operacoes/1/S/1/cliente';
 assert.equal((await get(customer,'')).status,401);
 const r=await get(customer);assert.equal(r.status,200);assert.equal((await r.json()).clientes[0].nome,'Cliente da operação 1');
 assert.equal((await get('/api/v1/operacoes/999/S/7/cliente')).status,403);
 await pool.query("UPDATE operacao_itens SET imagem_url='http://aeropostale1.hospedagemdesites.ws/fotosaero/exemplo.jpg' WHERE cod_operacao=1");
 try{
  const path='/api/v1/operacoes/1/S/1/itens/0/imagem';assert.equal((await get(path,'')).status,401);
  const image=await get(path);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');assert.equal(image.headers.get('cache-control'),'no-store');assert.deepEqual([...new Uint8Array(await image.arrayBuffer())],[1,2,3]);
  assert.equal((await get('/api/v1/operacoes/999/S/7/itens/0/imagem')).status,403);
  assert.equal((await get('/api/v1/operacoes/1/S/1/itens/99/imagem')).status,404);
 }finally{await pool.query('UPDATE operacao_itens SET imagem_url=NULL WHERE cod_operacao=1');}
});
