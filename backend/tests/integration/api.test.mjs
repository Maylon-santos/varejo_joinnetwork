import {criarGestaoUsuarios} from '../../src/gestao-usuarios.mjs';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {criarPool} from '../../src/postgres.mjs';
import {migrar} from '../../src/migracoes.mjs';
import {criarAuth,criarAdmin,hashToken} from '../../src/admin-auth.mjs';
import {criarPainel} from '../../src/painel.mjs';
import {criarServidor} from '../../src/http-api.mjs';
import {criarGestaoPermissoes} from '../../src/gestao-permissoes.mjs';
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
 server=criarServidor({auth,gestaoUsuarios:criarGestaoUsuarios(control,pool,'teste',['1']),gestaoPermissoes:criarGestaoPermissoes(control,'teste'),imagemProduto:async()=>({type:'image/jpeg',body:Buffer.from([1,2,3])}),painel:criarPainel(pool,'teste',['1']),filiais:['1'],limitar:()=>true,limitarLogin:()=>true});
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

test('Admin com duas filiais autorizadas mantém indicadores e detalhes separados por filial',async()=>{
 const painel=criarPainel(pool,'teste',['1','999']);
 assert.equal((await painel.filiais()).filiais.length,2);
 const f={inicio:'2026-09-01',fim:'2026-09-02',pagina:1,limite:50};
 assert.equal((await painel.indicadores({...f,filial:'1'})).valor_vendas_centavos,'37000');
 assert.equal((await painel.indicadores({...f,filial:'999'})).valor_vendas_centavos,'999999');
 const lista=await painel.vendas({...f,filial:'999'});assert.equal(lista.total,1);assert.equal(lista.operacoes[0].filial,'999');
 await assert.rejects(painel.detalhe('1','S','7'),{status:404});
 await assert.rejects(painel.indicadores({...f,filial:'999'}).then(()=>criarPainel(pool,'outro',['1','999']).filiais()));
});

test('Lista de filiais exibe COD_FILIAL e preserva ID usado nos filtros sem expor filiais não autorizadas',async()=>{
 await pool.query("INSERT INTO cadastro_filiais(filial,cod_filial,trans_id) VALUES(1,'AERO-009',10),(999,'OUTRA',11)");
 const painel=criarPainel(pool,'teste',['1']);
 assert.deepEqual((await painel.filiais()).filiais,[{filial:'1',cod_filial:'AERO-009',fantasia:null,trans_id:'10'}]);
 await pool.query("UPDATE cadastro_filiais SET cod_filial='AERO-NOVO',trans_id=12 WHERE filial=1");
 assert.equal((await painel.filiais()).filiais[0].cod_filial,'AERO-NOVO');
});

test('Vendedor consulta somente suas vendas em indicadores, lista, ranking, detalhes, clientes e imagens',async()=>{
 await criarAdmin(control,{tenant:'teste',email:'vendas@teste.local',senha});
 const id=(await control.query("SELECT id FROM admin_users WHERE email='vendas@teste.local'")).rows[0].id;
 await control.query("UPDATE admin_users SET role='Vendas' WHERE id=$1",[id]);
 await control.query("INSERT INTO user_branches(user_id,tenant_key,filial,vendedor_codigo) VALUES($1,'teste',1,'10')",[id]);
 const session=await auth.login('vendas@teste.local',senha);const t=session.token;
 const filiais=await (await get('/api/v1/filiais',t)).json();assert.deepEqual(filiais.filiais.map(f=>f.filial),['1']);
 const d=await (await get('/api/v1/indicadores?'+filtro,t)).json();assert.equal(d.vendas,2);assert.equal(d.valor_vendas_centavos,'30000');assert.equal(d.pecas_cabecalho,'5');assert.equal(d.serie_diaria.reduce((n,r)=>n+r.vendas,0),2);
 const list=await (await get('/api/v1/vendas?'+filtro+'&limite=1&pagina=2',t)).json();assert.equal(list.total,2);assert.ok(list.operacoes.every(o=>o.vendedor_codigo==='10'));
 const ranking=await (await get('/api/v1/ranking?'+filtro,t)).json();assert.equal(ranking.total,1);assert.equal(ranking.ranking[0].vendedor_codigo,'10');
 for(const suffix of ['','/cliente','/itens/0/imagem'])assert.equal((await get('/api/v1/operacoes/1/S/6'+suffix,t)).status,404);
 assert.equal((await get('/api/v1/operacoes/1/S/1',t)).status,200);
 assert.equal((await get('/api/v1/indicadores?filial=999&inicio=2026-09-01&fim=2026-09-02',t)).status,403);
 assert.equal((await get('/api/v1/vendas?'+filtro+'&conciliacao=divergente',t)).status,403);
 // Alteração de vínculo vale já na próxima requisição, sem depender de novo login.
 await control.query("UPDATE user_branches SET vendedor_codigo='20' WHERE user_id=$1",[id]);
 assert.equal((await (await get('/api/v1/indicadores?'+filtro,t)).json()).valor_vendas_centavos,'7000');
 assert.equal((await get('/api/v1/operacoes/1/S/1',t)).status,404);
 await control.query('DELETE FROM user_branches WHERE user_id=$1',[id]);assert.equal((await get('/api/v1/indicadores?'+filtro,t)).status,403);
 assert.equal((await fetch(base+'/api/v1/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${t}`}})).status,200);
});
test('Permissão de recurso não pode ser contornada por detalhe ou URL de cliente e imagem',async()=>{
 await criarAdmin(control,{tenant:'teste',email:'restrito@teste.local',senha});
 await control.query(`INSERT INTO access_roles(tenant_key,role,nome,permissoes) VALUES('teste','Restrito','Consulta','["vendas:ler"]')`);
 const id=(await control.query("SELECT id FROM admin_users WHERE email='restrito@teste.local'")).rows[0].id;
 await control.query("UPDATE admin_users SET role='Restrito' WHERE id=$1",[id]);
 await control.query("INSERT INTO user_branches(user_id,tenant_key,filial) VALUES($1,'teste',1)",[id]);
 const {token:t}=await auth.login('restrito@teste.local',senha);
 const detail=await (await get('/api/v1/operacoes/1/S/1',t)).json();assert.equal('clientes' in detail.operacao,false);assert.ok(detail.itens.every(i=>!('imagem_url' in i)));
 for(const url of ['/api/v1/indicadores?'+filtro,'/api/v1/ranking?'+filtro,'/api/v1/operacoes/1/S/1/cliente','/api/v1/operacoes/1/S/1/itens/0/imagem'])assert.equal((await get(url,t)).status,403);
 await assert.rejects(control.query("INSERT INTO user_branches(user_id,tenant_key,filial) VALUES($1,'outro',999)",[id]));
 await control.query("UPDATE access_roles SET permissoes='[]' WHERE tenant_key='teste' AND role='Restrito'");
 assert.equal((await get('/api/v1/vendas?'+filtro,t)).status,403);
});

test('Gerenciador permite editar cargos só ao Admin, sem alterar outra empresa ou remover a proteção de Vendas',async()=>{
 const url='/api/v1/acessos/perfis';
 assert.equal((await get(url,'')).status,401);
 const data=await (await get(url)).json();assert.ok(data.perfis.some(p=>p.role==='Admin'));assert.equal(data.recursos.length,12);
 const payload={nome:'Direção',permissoes:['indicadores:ler','vendas:ler'],todas_filiais:true,somente_proprias_vendas:false};
 const put=(role,body,t=token)=>fetch(base+url+'/'+role,{method:'PUT',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await put('Diretoria',payload)).status,200);
 assert.equal((await control.query("SELECT nome FROM access_roles WHERE tenant_key='outro' AND role='Diretoria'")).rows[0].nome,'Diretoria');
 assert.equal((await put('Admin',payload)).status,403);assert.equal((await put('Vendas',payload)).status,400);
 assert.equal((await put('Gerentes',{...payload,tenant:'outro'})).status,400);
 assert.equal((await put('Gerentes',{...payload,permissoes:['clientes:ler']})).status,400);
 const vendedor=await auth.login('vendas@teste.local',senha);assert.equal((await get(url,vendedor.token)).status,403);assert.equal((await put('Gerentes',payload,vendedor.token)).status,403);
});

test('Gestão de usuários cria vendedor, altera vínculos, revoga sessões e protege Admin/tenant',async()=>{
 const basePath='/api/v1/acessos/usuarios';const send=(path,method,body,session=token)=>fetch(base+path,{method,headers:{Authorization:`Bearer ${session}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const body={email:'novo@teste.local',senha,role:'Vendas',active:true,vinculos:[{filial:'1',vendedor_codigo:'10'}]};
 assert.equal((await get(basePath,'')).status,401);
 for(const change of [{vinculos:[]},{vinculos:[{filial:'999',vendedor_codigo:'10'}]},{vinculos:[{filial:'1',vendedor_codigo:null}]},{vinculos:[{filial:'1',vendedor_codigo:'desconhecido'}]},{senha:'curta'},{tenant:'outro'}])assert.equal((await send(basePath,'POST',{...body,...change})).status,400);
 const created=await send(basePath,'POST',body);assert.equal(created.status,201);const {id}=await created.json();assert.ok(id);
 assert.equal((await send(basePath,'POST',body)).status,409);
 const session=await auth.login(body.email,senha);assert.ok(session);assert.equal((await get(basePath,session.token)).status,403);assert.equal((await send(basePath,'POST',{...body,email:'indevido@teste.local'},session.token)).status,403);
 const list=await (await get(basePath)).json();const saved=list.usuarios.find(u=>u.id===id);assert.equal(saved.role,'Vendas');assert.equal(saved.password_hash,undefined);assert.equal(saved.senha,undefined);assert.deepEqual(saved.vinculos,body.vinculos);assert.ok(!list.usuarios.some(u=>u.email==='outro@teste.local'));
 const vendedor=await (await get('/api/v1/acessos/vendedores')).json();assert.ok(vendedor.vendedores.every(v=>v.filial==='1'));
 const before=await (await get('/api/v1/indicadores?'+filtro,session.token)).json();assert.equal(before.valor_vendas_centavos,'30000');
 assert.equal((await send(basePath+'/'+id,'PUT',{...body,senha:'',vinculos:[{filial:'1',vendedor_codigo:'20'}]})).status,200);assert.equal((await get('/api/v1/auth/me',session.token)).status,401);
 const changed=await auth.login(body.email,senha);assert.equal((await (await get('/api/v1/indicadores?'+filtro,changed.token)).json()).valor_vendas_centavos,'7000');
 assert.equal((await send(basePath+'/'+id,'PUT',{...body,active:false,senha:''})).status,200);assert.equal(await auth.login(body.email,senha),null);assert.equal((await get('/api/v1/auth/me',changed.token)).status,401);
 const me=await (await get('/api/v1/auth/me')).json();assert.equal((await send(basePath+'/'+me.usuario.id,'PUT',{...body,email:me.usuario.email,role:'Admin',active:false,vinculos:[]})).status,403);
 const other=(await control.query("SELECT id FROM admin_users WHERE tenant_key='outro'")).rows[0].id;assert.equal((await send(basePath+'/'+other,'PUT',body)).status,404);
 assert.equal((await send(basePath+'/'+id,'PUT',{...body,senha:'Nova senha longa de integração!'})).status,200);assert.equal(await auth.login(body.email,senha),null);assert.ok(await auth.login(body.email,'Nova senha longa de integração!'));
});

test('Complementos são persistidos sem alterar valores e ficam restritos à operação autorizada',async()=>{
 const {RepositorioPostgres}=await import('../../src/repositorio-postgres.mjs');const {normalizarVenda}=await import('../../src/vendas.mjs');const repo=new RepositorioPostgres(pool,'teste');
 const op=normalizarVenda({cod_operacao:1,tipo_operacao:'S',filial:1,data:'/Date(1788231600000-180)/',qtde:2,valor_final:100,cancelada:false,v_acerto:0,produtos:[{quantidade:2,preco:50,preco_tabela:80,desconto:0,preco_aplicado:50}],desc_condicoes_pgto:'CRÉDITO 2X',lancamentos:[{valor_inicial:50,desc_gerador:'Nome restrito',historico:'Texto restrito'},{valor_inicial:50}]},'1','2026-09-01','2026-09-01');
 const before=(await pool.query('SELECT valor_final_centavos,quantidade,cancelada FROM operacoes WHERE cod_operacao=1')).rows[0];const checkpoint=(await pool.query('SELECT * FROM sync_checkpoints')).rows;
 assert.equal(await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.preencherComplementos([op])),1);
 assert.equal(await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.preencherComplementos([op])),0);
 assert.deepEqual((await pool.query('SELECT valor_final_centavos,quantidade,cancelada FROM operacoes WHERE cod_operacao=1')).rows[0],before);assert.deepEqual((await pool.query('SELECT * FROM sync_checkpoints')).rows,checkpoint);
 const full=await (await get('/api/v1/operacoes/1/S/1')).json();assert.equal(full.operacao.complementos.desc_condicoes_pgto,'CRÉDITO 2X');assert.equal(full.itens[0].preco_tabela_centavos,'8000');
 const email='semcliente@teste.local';await criarAdmin(control,{tenant:'teste',email,senha});await control.query("UPDATE admin_users SET role='Restrito' WHERE email=$1",[email]);await control.query("UPDATE access_roles SET permissoes='[\"vendas:ler\"]'::jsonb WHERE role='Restrito' AND tenant_key='teste'");await control.query("INSERT INTO user_branches(user_id,tenant_key,filial) SELECT id,tenant_key,1 FROM admin_users WHERE email=$1",[email]);const limited=await auth.login(email,senha);const detail=await (await get('/api/v1/operacoes/1/S/1',limited.token)).json();assert.equal(detail.operacao.complementos.lancamentos[0].historico,undefined);assert.equal(detail.operacao.complementos.lancamentos[0].desc_gerador,undefined);assert.equal(detail.operacao.complementos.lancamentos[0].valor_inicial_centavos,'5000');
 await pool.query('UPDATE operacoes SET complementos=NULL WHERE cod_operacao=1');await assert.rejects(repo.transacao({tenant:'teste',filial:'1'},tx=>tx.preencherComplementos([{...op,produtos:[{...op.produtos[0],sku:'OUTRA-VARIANTE'}]}])),/COMPLEMENTOS_ITENS_DIVERGENTES/);await assert.rejects(repo.transacao({tenant:'teste',filial:'1'},tx=>tx.preencherComplementos([{...op,produtos:[{...op.produtos[0],quantidade:9}]}])),/COMPLEMENTOS_ITENS_DIVERGENTES/);assert.equal((await pool.query('SELECT complementos FROM operacoes WHERE cod_operacao=1')).rows[0].complementos,null);
});

test('Preenchimento em lotes respeita limite, espera e registra falha sem avançar checkpoints',async()=>{
 const {preencherComplementos}=await import('../../src/preencher-complementos.mjs');const {RepositorioPostgres}=await import('../../src/repositorio-postgres.mjs');const repo=new RepositorioPostgres(pool,'teste');const calls=[];const before=(await pool.query('SELECT * FROM sync_checkpoints')).rows;
 await assert.rejects(preencherComplementos({pool,repositorio:repo,tenant:'teste',filial:'1',limite:1,consultar:async p=>{calls.push(p);throw new Error('ERP_HTTP_503');}}));assert.equal(calls.length,1);
 const cooldown=await preencherComplementos({pool,repositorio:repo,tenant:'teste',filial:'1',consultar:async()=>{throw new Error('NÃO DEVE CONSULTAR');}});assert.equal(cooldown.aguardando,true);assert.deepEqual((await pool.query('SELECT * FROM sync_checkpoints')).rows,before);
 assert.equal((await pool.query("SELECT ultimo_erro_codigo FROM sync_status WHERE filial=1 AND recurso='complementos'")).rows[0].ultimo_erro_codigo,'ERP_HTTP_503');
});

test('Cadastro unifica por código, filtra aniversário e não mistura contatos de outro vendedor/filial',async()=>{
 const one=[{cliente_codigo:'123',nome:'Mesmo nome',contatos:[{tipo:'Telefone',telefone:'1111'}],aniversario_mm_dd:'02-29'}];
 await pool.query("UPDATE operacoes SET clientes=$1,clientes_identidade_importada=true WHERE cod_operacao IN(1,2)",[JSON.stringify(one)]);
 await pool.query("UPDATE operacoes SET clientes=$1,clientes_identidade_importada=true WHERE cod_operacao=5",[JSON.stringify([{cliente_codigo:'124',nome:'Mesmo nome',contatos:[]}])]);
 await pool.query("UPDATE operacoes SET clientes=$1,clientes_identidade_importada=true WHERE cod_operacao IN(6,7)",[JSON.stringify([{...one[0],nome:'Contato restrito',contatos:[{telefone:'9999'}]}])]);
 const restricted=criarPainel(pool,'teste',['1'],{'1':'10'});const f={filial:'1',inicio:'2026-09-01',fim:'2026-09-02',pagina:1,limite:10};
 const d=await restricted.clientes(f);assert.equal(d.total,2);const c=d.clientes.find(c=>c.codigo==='123');assert.equal(c.movimentacoes,2);assert.equal(c.nome,'Mesmo nome');assert.equal(c.contatos[0].telefone,'1111');assert.equal(c.aniversario_mm_dd,'02-29');
 assert.equal((await restricted.clientes(f,'','02')).total,1);assert.equal((await restricted.clientes(f,'','03')).total,0);
 assert.equal((await restricted.clientes(f,'124')).total,1);assert.equal((await restricted.clientes(f,"' OR 1=1 --")).total,0);
 assert.equal((await restricted.clientes({...f,pagina:2,limite:1})).clientes.length,1);
 await assert.rejects(restricted.clientes({...f,filial:'999'}));await assert.rejects(criarPainel(pool,'outro',['1']).clientes(f));
 assert.equal((await get('/api/v1/clientes?'+filtro)).status,200);assert.equal((await get('/api/v1/clientes?'+filtro+'&mes=13')).status,400);
 assert.equal((await get('/api/v1/clientes?'+filtro,'')).status,401);
 const limited=await auth.login('semcliente@teste.local',senha);assert.equal((await get('/api/v1/clientes?'+filtro,limited.token)).status,403);
 // Confirmar também a rota autenticada de Vendas, com vínculo real.
 await control.query("INSERT INTO user_branches(user_id,tenant_key,filial,vendedor_codigo) SELECT id,tenant_key,1,'10' FROM admin_users WHERE email='vendas@teste.local'");
 const seller=await auth.login('vendas@teste.local',senha);const own=await (await get('/api/v1/clientes?'+filtro,seller.token)).json();assert.equal(own.clientes.find(c=>c.codigo==='123').contatos[0].telefone,'1111');
});

test('Preenchimento de identidade preserva dados comerciais e checkpoints, é idempotente e respeita backoff',async()=>{
 const {RepositorioPostgres}=await import('../../src/repositorio-postgres.mjs');const {preencherIdentidadeClientes}=await import('../../src/preencher-identidade-clientes.mjs');const repo=new RepositorioPostgres(pool,'teste');
 await pool.query('UPDATE operacoes SET clientes_identidade_importada=false WHERE cod_operacao=1');
 const before=(await pool.query("SELECT to_jsonb(o)-'clientes'-'clientes_importados_em'-'clientes_identidade_importada' AS dados FROM operacoes o WHERE cod_operacao=1")).rows;
 const checks=(await pool.query('SELECT * FROM sync_checkpoints')).rows;
 const op={cod_operacao:'1',tipo_operacao:'S',filial:'1',data_operacao:'2026-09-01',clientes:[{cliente_codigo:'999',nome:'Exemplo',contatos:[]}]};
 assert.equal(await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.preencherIdentidadeClientes([op])),1);
 assert.equal(await repo.transacao({tenant:'teste',filial:'1'},tx=>tx.preencherIdentidadeClientes([op])),0);
 assert.deepEqual((await pool.query("SELECT to_jsonb(o)-'clientes'-'clientes_importados_em'-'clientes_identidade_importada' AS dados FROM operacoes o WHERE cod_operacao=1")).rows,before);
 let calls=0;await assert.rejects(preencherIdentidadeClientes({pool,repositorio:repo,tenant:'teste',filial:'1',limite:1,consultar:async()=>{calls++;throw Error('ERP_HTTP_503');}}));
 assert.equal(calls,1);assert.equal((await preencherIdentidadeClientes({pool,repositorio:repo,tenant:'teste',filial:'1',consultar:async()=>assert.fail('cooldown')})).aguardando,true);
 assert.deepEqual((await pool.query('SELECT * FROM sync_checkpoints')).rows,checks);
});
