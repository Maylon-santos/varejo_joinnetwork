import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,generateKeyPairSync,sign} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {criarPool} from '../../src/postgres.mjs';
import {criarAuth} from '../../src/admin-auth.mjs';
import {request} from 'node:http';
import {ambienteFila} from '../fixtures/fila.mjs';
import {cofre,hash,etag,totp} from '../../src/integracoes/seguranca.mjs';
import {criarPublicador} from '../../src/integracoes/projecoes.mjs';
import {criarIdentidade,transacao,limite} from '../../src/integracoes/banco.mjs';
import {criarConsultas} from '../../src/integracoes/consultas.mjs';
import {criarWebhooks} from '../../src/integracoes/webhooks.mjs';
import {criarEntregador} from '../../src/integracoes/entregas.mjs';
import {criarApiIntegracoes} from '../../src/integracoes/http.mjs';
import {criarAdministracao} from '../../src/integracoes/administracao.mjs';

test('API externa: autenticação, isolamento, snapshots, log, outbox, webhook e auditoria',async t=>{
 const a=await ambienteFila(),crypt=cofre('b2'.repeat(32)),tenant='teste',filiais=['1','2'],clientId='int_sintetico',id=randomUUID(),kid='k1',audience='https://api.exemplo.com/oauth/token';let server;const contratos=[],guardar=(schema,body)=>contratos.push({schema,body});
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const assertion=(claims={},header={})=>{const now=Math.floor(Date.now()/1000),s=[{alg:'RS256',kid,...header},{iss:clientId,sub:clientId,aud:audience,iat:now,exp:now+60,jti:randomUUID(),...claims}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return s+'.'+sign('RSA-SHA256',Buffer.from(s),privateKey).toString('base64url');};
 const tokenBody=jwt=>({client_id:clientId,grant_type:'client_credentials',client_assertion_type:'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',client_assertion:jwt});
 const identity=criarIdentidade(a.pool,tenant,audience),publicar=criarPublicador(a.pool,tenant,crypt,filiais),consultas=criarConsultas(a.pool,tenant,crypt,filiais),hooks=criarWebhooks(a.pool,crypt,consultas),params=o=>new URLSearchParams(o),rid=()=>randomUUID();let c,token,hook,secret;
 try{
  await a.pool.query(`INSERT INTO integration_clients(id,tenant_key,client_id,nome,ambiente,finalidade,estado,escopos,filiais,hosts) VALUES($1,'teste',$2,'Cliente sintético','homologacao','Teste automatizado','ativo',$3,'["1"]','["recebe.exemplo.com"]')`,[id,clientId,JSON.stringify(['vendas:ler','vendas:pessoas:ler','filiais:ler','produtos:ler','estoques:ler','webhooks:ler','webhooks:gerenciar'])]);
  await a.pool.query("INSERT INTO integration_keys VALUES($1,$2,$3,true,now()+interval '1 day')",[id,kid,publicKey.export({type:'spki',format:'pem'})]);
  await a.pool.query("UPDATE operacoes SET data_operacao='2026-11-01',clientes='[]',complementos=$1,complementos_importados_em=now() WHERE filial=1",[JSON.stringify({nota_fiscal:{numero_nota:'000007',modelo:'65',idnfe:'9007199254740993',status:null},frete_centavos:'0',cortesia_informada:0,lancamentos:[{origem:'ERP',historico:'Pessoa fictícia',valor_inicial_centavos:'100'}]})]);
  await a.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,quantidade,preco_centavos) VALUES(10,'S',1,0,'SKU/01',1,100)");
  await a.pool.query("INSERT INTO cadastro_produtos(produto,cod_produto,descricao,tipo_prod) VALUES(9007199254740993,'00001','Produto fictício','AC')");
  await a.pool.query("INSERT INTO estoque_atual(filial,sku,produto,saldo,trans_id) VALUES(1,'SKU/01',9007199254740993,-2.123456,1)");
  await t.test('private_key_jwt emite token opaco, rejeita replay e assinatura incorreta',async()=>{
   const jwt=assertion(),session=await identity.emitir(tokenBody(jwt),'ip-ficticio');token=session.access_token;c=await identity.autenticar(token);assert.equal(c.id,id);assert.equal(session.expires_in,900);
   guardar('TokenResponse',{...session,access_token:'0'.repeat(64)});
   await assert.rejects(()=>identity.emitir(tokenBody(jwt),'ip-ficticio'),e=>e.status===401);await assert.rejects(()=>identity.emitir(tokenBody(assertion({aud:'https://outro'})),'ip-ficticio'),e=>e.status===401);
   assert.equal((await a.pool.query('SELECT hash FROM integration_tokens')).rows[0].hash,hash(token));
  });
  await t.test('trigger é transacional e publicador não cria revisões para reimportação idêntica',async()=>{
   await publicar(100);const before=(await a.pool.query('SELECT count(*)::int n FROM integration_changes')).rows[0].n;
   await a.pool.query("UPDATE operacoes SET atualizado_em=now(),complementos_importados_em=now() WHERE filial=1");await publicar(100);assert.equal((await a.pool.query('SELECT count(*)::int n FROM integration_changes')).rows[0].n,before);
   await assert.rejects(()=>transacao(a.pool,async db=>{await db.query("UPDATE operacoes SET valor_final_centavos=999 WHERE filial=1 AND cod_operacao=10");throw Error('rollback');}));assert.equal((await a.pool.query('SELECT count(*)::int n FROM integration_dirty')).rows[0].n,0);
  });
  await t.test('escrita concorrente à captura bloqueada deixa uma nova marca após o commit',async()=>{
   await a.pool.query("UPDATE operacoes SET evento_codigo='captura1' WHERE filial=1 AND cod_operacao=30");
   const db=await a.pool.connect();let escrita;
   try{
    await db.query('BEGIN');await db.query("SELECT * FROM integration_dirty WHERE recurso='vendas' AND filial=1 AND chave='vnd_1_S_30' FOR UPDATE");
    let terminou=false;escrita=a.pool.query("UPDATE operacoes SET evento_codigo='captura2' WHERE filial=1 AND cod_operacao=30").then(()=>{terminou=true;});await new Promise(r=>setTimeout(r,30));assert.equal(terminou,false);
    await db.query("DELETE FROM integration_dirty WHERE recurso='vendas' AND filial=1 AND chave='vnd_1_S_30'");await db.query('COMMIT');await escrita;
    assert.equal((await a.pool.query("SELECT count(*)::int n FROM integration_dirty WHERE chave='vnd_1_S_30'")).rows[0].n,1);await publicar(100);
   }finally{await db.query('ROLLBACK');db.release();await escrita;}
  });
  const filtro={filial_id:'1',inicio:'2026-11-01',fim:'2026-11-01',limite:'1'};
  await t.test('snapshot fica estável após atualização; cursor não atravessa cliente, filtros ou concessões',async()=>{
   const first=await consultas.consultar(c,'/v1/vendas',params(filtro),{},rid());assert.equal(first.body.data.length,1);assert.equal(first.body.data[0].valor_final_centavos,'100');assert.ok(!('nome' in first.body.data[0].vendedor));
   guardar('ListaVendaResumo',first.body);
   const cursor=first.body.paginacao.cursor_proximo;assert.ok(cursor);await a.pool.query("UPDATE operacoes SET valor_final_centavos=777 WHERE filial=1 AND cod_operacao=20");await publicar(100);
   const second=await consultas.consultar(c,'/v1/vendas',params({...filtro,cursor}),{},rid());assert.equal(second.body.data[0].valor_final_centavos,'100');
   await assert.rejects(()=>consultas.consultar({...c,id:randomUUID()},'/v1/vendas',params({...filtro,cursor}),{},rid()),e=>e.code==='INVALID_CURSOR');
   await assert.rejects(()=>consultas.consultar({...c,versao:'2'},'/v1/vendas',params({...filtro,cursor}),{},rid()),e=>e.code==='INVALID_CURSOR');
   await assert.rejects(()=>consultas.consultar(c,'/v1/vendas',params({...filtro,estado:'ativas',cursor}),{},rid()),e=>e.code==='INVALID_CURSOR');
   await assert.rejects(()=>consultas.consultar(c,'/v1/vendas',params({...filtro,filial_id:'2'}),{},rid()),e=>e.status===403);
  });
  await t.test('fiscal, pessoas, filhos com ETag, IDs grandes, SKU codificado e estoque negativo',async()=>{
   const d=await consultas.consultar(c,'/v1/vendas/vnd_1_S_10',params({}),{},rid());assert.equal(d.body.data.nota_fiscal.numero_nota,'000007');assert.equal(d.body.data.cortesia_informada,0);assert.ok(!('clientes' in d.body.data));
   guardar('RespostaVenda',d.body);
   await assert.rejects(()=>consultas.consultar(c,'/v1/vendas/vnd_2_S_10',params({}),{},rid()),e=>e.status===404);
   await assert.rejects(()=>consultas.consultar(c,'/v1/vendas/vnd_1_S_10/itens',params({}),{},rid()),e=>e.status===428);
   const items=await consultas.consultar(c,'/v1/vendas/vnd_1_S_10/itens',params({}),{'if-match':d.etag},rid());assert.equal(items.body.data[0].subtotal_centavos,'100');assert.equal(items.body.meta.recurso_versao,d.body.data.versao);
   guardar('ListaItemVenda',items.body);
   const payments=await consultas.consultar(c,'/v1/vendas/vnd_1_S_10/pagamentos',params({}),{'if-match':d.etag},rid());assert.ok(!('historico' in payments.body.data[0]));
   guardar('ListaPagamento',payments.body);
   const people=await consultas.consultar(c,'/v1/vendas/vnd_1_S_10/pagamentos',params({incluir_pessoas:'true'}),{'if-match':d.etag},rid());assert.equal(people.body.data[0].historico,'Pessoa fictícia');
   const stock=await consultas.consultar(c,'/v1/filiais/1/estoques/SKU%2F01',params({}),{},rid());assert.equal(stock.body.data.saldo_disponivel,'-2.123456');assert.equal(stock.body.data.produto_id,'9007199254740993');
   guardar('RespostaEstoque',stock.body);
   await a.pool.query("UPDATE estoque_atual SET saldo=3,consultado_em=now()+interval '1 minute' WHERE filial=1 AND sku='SKU/01'");
   const pending=await consultas.consultar(c,'/v1/filiais/1/estoques/SKU%2F01',params({}),{},rid());assert.equal(pending.body.data.saldo_disponivel,'-2.123456');assert.equal(pending.body.data.sincronizacao.consultado_em,stock.body.data.sincronizacao.consultado_em);await publicar(100);
   const product=await consultas.consultar(c,'/v1/produtos/9007199254740993',params({filial_id:'1'}),{},rid());assert.equal(product.body.data.codigo,'00001');
   guardar('RespostaProduto',product.body);
   for(const [path,p,schema] of [['/v1/filiais',{},'ListaFilial'],['/v1/filiais/1',{},'RespostaFilial'],['/v1/produtos',{filial_id:'1'},'ListaProduto'],['/v1/produtos/9007199254740993/variacoes',{filial_id:'1'},'ListaVariacao'],['/v1/estoques',{filial_id:'1'},'ListaEstoque']])guardar(schema,(await consultas.consultar(c,path,params(p),{},rid())).body);
  });
  await t.test('log registra complemento tardio, cancelamento e ausência sem pular publicação concorrente',async()=>{
   const f={recurso:'vendas',filial_id:'1'},base=await consultas.alteracoes(c,params({...f,posicao:'atual'}),rid()),cursor=base.paginacao.cursor_proximo;
   await a.pool.query("INSERT INTO cancelamentos VALUES(10,'S',1,now(),now())");await Promise.all([publicar(100),publicar(100)]);
   const changes=await consultas.alteracoes(c,params({...f,cursor}),rid());assert.equal(changes.data.length,1);assert.equal(changes.data[0].acao,'cancelada');
   guardar('ListaAlteracoes',changes);
   await a.pool.query("UPDATE estoque_atual SET presente_ultima_carga=false WHERE filial=1");await publicar(100);const stock=await consultas.consultar(c,'/v1/filiais/1/estoques/SKU%2F01',params({}),{},rid());assert.equal(stock.body.data.saldo_disponivel,null);
   const d=await consultas.consultar(c,'/v1/vendas/vnd_1_S_10',params({}),{},rid());await assert.rejects(()=>consultas.consultar(c,'/v1/vendas/vnd_1_S_10/itens',params({}),{'if-match':etag('vnd_1_S_10','1')},rid()),e=>e.status===412);assert.equal(d.body.data.cancelada,true);
  });
  await t.test('cursores expirados retornam 410 e filtros inválidos são rejeitados antes do SQL',async()=>{
   const f={filial_id:'1',inicio:'2026-11-01',fim:'2026-11-01',limite:'1'},first=await consultas.consultar(c,'/v1/vendas',params(f),{},rid());await a.pool.query("UPDATE integration_snapshots SET expira_em=now()-interval '1 second' WHERE id=$1",[first.body.meta.snapshot_id]);
   await assert.rejects(()=>consultas.consultar(c,'/v1/vendas',params({...f,cursor:first.body.paginacao.cursor_proximo}),{},rid()),e=>e.status===410);
   for(const overrides of [{inicio:'2026-02-30'},{fim:'2026-12-15'},{limite:'201'}])await assert.rejects(()=>consultas.consultar(c,'/v1/vendas',params({...f,...overrides}),{},rid()),e=>e.status===400);
   const base=await consultas.alteracoes(c,params({recurso:'vendas',filial_id:'1',posicao:'atual'}),rid()),cur=crypt.verificar(base.paginacao.cursor_proximo);cur.expira=Date.now()-1;
   await assert.rejects(()=>consultas.alteracoes(c,params({recurso:'vendas',filial_id:'1',cursor:crypt.assinar(cur)}),rid()),e=>e.status===410);
  });
  await t.test('inscrição exige destino aprovado, idempotência e teste antes de ativar',async()=>{
   const body={nome:'Consumidor fictício',url:'https://recebe.exemplo.com/vendas',eventos:['venda.importada','venda.atualizada','venda.cancelada'],filiais:['1'],ativo:false},key=rid();
   const r=await hooks(c,'POST','/v1/webhooks',params({}),{'idempotency-key':key},body,rid());hook=r.body.webhook;secret=r.body.signing_secret;
   guardar('WebhookComSegredo',{...r.body,signing_secret:'whsec_'+Buffer.alloc(32).toString('base64')});
   assert.deepEqual((await hooks(c,'POST','/v1/webhooks',params({}),{'idempotency-key':key},body,rid())).body,r.body);
   await assert.rejects(()=>hooks(c,'POST','/v1/webhooks',params({}),{'idempotency-key':key},{...body,nome:'diferente'},rid()),e=>e.status===409);
   await assert.rejects(()=>hooks(c,'PUT','/v1/webhooks/'+hook.id,params({}),{'idempotency-key':rid(),'if-match':r.etag},{...body,ativo:true},rid()),e=>e.code==='VERIFICATION_REQUIRED');
  });
  let envios=[],status=204;
  const entregador=criarEntregador(a.pool,tenant,crypt,{filiais,enviar:async request=>{envios.push(request);return {status};}});
  async function liberar(){await a.pool.query("UPDATE integration_webhooks SET ultimo_envio_em=now()-interval '2 seconds'");await a.pool.query('UPDATE integration_deliveries SET proxima_tentativa_em=now() WHERE estado=\'aguardando_retry\'');}
  await t.test('teste assinado confirma destino; outbox gera entrega com payload mínimo e retry durável',async()=>{
   await hooks(c,'POST',`/v1/webhooks/${hook.id}/testes`,params({}),{'idempotency-key':rid()},{},rid());assert.equal(await entregador.executar(),true);assert.equal(envios.length,1);assert.ok(envios[0].headers['webhook-signature'].startsWith('v1,'));
   guardar('EventoTeste',JSON.parse(envios[0].body));
   hook=(await hooks(c,'GET','/v1/webhooks/'+hook.id,params({}),{},null,rid())).body.data;assert.ok(hook.verificado_em);
   const body={nome:hook.nome,url:hook.url,eventos:hook.eventos,filiais:hook.filiais,ativo:true};hook=(await hooks(c,'PUT','/v1/webhooks/'+hook.id,params({}),{'idempotency-key':rid(),'if-match':etag(hook.id,hook.versao)},body,rid())).body.data;
   await entregador.distribuir();await a.pool.query("UPDATE operacoes SET valor_final_centavos=778 WHERE filial=1 AND cod_operacao=20");await publicar(100);await entregador.distribuir();await liberar();status=503;await entregador.executar();
   const delivery=(await a.pool.query("SELECT * FROM integration_deliveries WHERE tipo_evento='venda.atualizada'")).rows[0];assert.equal(delivery.estado,'aguardando_retry');assert.equal(delivery.tentativas,1);
   const sent=envios.at(-1),payload=JSON.parse(sent.body);assert.ok(!('clientes' in payload.data));assert.equal(payload.data.valor_final_centavos,'778');
   guardar('EventoVenda',payload);guardar('ListaEntrega',(await hooks(c,'GET',`/v1/webhooks/${hook.id}/entregas`,params({}),{},null,rid())).body);
   await liberar();status=204;await entregador.executar();assert.deepEqual(envios.at(-1).body,sent.body);assert.equal(envios.at(-1).headers['webhook-id'],sent.headers['webhook-id']);assert.equal((await a.pool.query('SELECT estado FROM integration_deliveries WHERE id=$1',[delivery.id])).rows[0].estado,'aceita');
  });
  await t.test('rotação conserva duas assinaturas e revogação impede novas entregas',async()=>{
   hook=(await hooks(c,'GET','/v1/webhooks/'+hook.id,params({}),{},null,rid())).body.data;
   const key=rid(),rot=await hooks(c,'POST',`/v1/webhooks/${hook.id}/rotacionar-segredo`,params({}),{'idempotency-key':key,'if-match':etag(hook.id,hook.versao)},{},rid());assert.notEqual(rot.body.signing_secret,secret);
   assert.deepEqual((await hooks(c,'POST',`/v1/webhooks/${hook.id}/rotacionar-segredo`,params({}),{'idempotency-key':key,'if-match':'"antigo"'},{},rid())).body,rot.body);
   await hooks(c,'POST',`/v1/webhooks/${hook.id}/testes`,params({}),{'idempotency-key':rid()},{},rid());await liberar();await entregador.executar();assert.equal(envios.at(-1).headers['webhook-signature'].split(' ').length,2);
   await hooks(c,'POST',`/v1/webhooks/${hook.id}/testes`,params({}),{'idempotency-key':rid()},{},rid());await a.pool.query("UPDATE integration_clients SET estado='revogado' WHERE id=$1",[id]);const count=envios.length;await liberar();await entregador.executar();assert.equal(envios.length,count);await assert.rejects(()=>identity.autenticar(token),e=>e.status===401);await a.pool.query("UPDATE integration_clients SET estado='ativo' WHERE id=$1",[id]);
  });
  await t.test('replay preserva evento e corpo; alteração de URL invalida entrega antiga',async()=>{
   hook=(await hooks(c,'GET','/v1/webhooks/'+hook.id,params({}),{},null,rid())).body.data;
   const antiga=(await a.pool.query("SELECT * FROM integration_deliveries WHERE tipo_evento='venda.atualizada' AND estado='aceita' LIMIT 1")).rows[0];
   const replay=await hooks(c,'POST',`/v1/webhooks/${hook.id}/entregas/${antiga.id}/reenviar`,params({}),{'idempotency-key':rid()},{},rid());const restored=(await a.pool.query('SELECT * FROM integration_deliveries WHERE id=$1',[replay.body.id])).rows[0];assert.equal(restored.evento_id,antiga.evento_id);assert.deepEqual(restored.payload,antiga.payload);
   assert.equal(restored.evento_criado_em.toISOString(),antiga.evento_criado_em.toISOString());
   await a.pool.query("UPDATE integration_deliveries SET evento_criado_em=now()-interval '31 days' WHERE id=$1",[antiga.id]);await assert.rejects(()=>hooks(c,'POST',`/v1/webhooks/${hook.id}/entregas/${antiga.id}/reenviar`,params({}),{'idempotency-key':rid()},{},rid()),e=>e.status===410);
   const updated=await hooks(c,'PUT','/v1/webhooks/'+hook.id,params({}),{'idempotency-key':rid(),'if-match':etag(hook.id,hook.versao)},{nome:hook.nome,url:'https://recebe.exemplo.com/novo',eventos:hook.eventos,filiais:hook.filiais,ativo:false},rid());assert.equal(updated.body.data.verificado_em,null);
   const count=envios.length;await liberar();await entregador.executar();assert.equal(envios.length,count);assert.equal((await a.pool.query('SELECT estado FROM integration_deliveries WHERE id=$1',[restored.id])).rows[0].estado,'falha_permanente');
  });
  await t.test('cotas são atômicas e concorrência é compartilhada entre instâncias',async()=>{
   const results=await Promise.allSettled(Array.from({length:12},()=>transacao(a.pool,db=>limite(db,'teste-concorrente',3,0))));assert.equal(results.filter(r=>r.status==='fulfilled').length,3);
   const one=await identity.admitir(c,'admission-test'),two=await identity.admitir(c,'admission-test');await assert.rejects(()=>identity.admitir(c,'admission-test'),e=>e.code==='CONCURRENCY_LIMIT');await one.liberar();await two.liberar();
  });
  await t.test('Admin exige concessão humana e MFA; auditoria é atômica e token externo não serve',async()=>{
   const admin=criarAdministracao(a.pool,tenant,crypt,a.auth,filiais),req={method:'GET',headers:{authorization:'Bearer '+a.tokens.admin},socket:{remoteAddress:'127.0.0.1'}};
   await assert.rejects(()=>admin(req,'/admin/integracoes/clientes',params({}),null),e=>e.code==='ADMIN_NOT_ENROLLED');
   const user=await a.auth.autenticar(a.tokens.admin),secret='c3'.repeat(20);await a.pool.query('INSERT INTO integration_admins(usuario_id,tenant_key,totp_secret) VALUES($1,$2,$3)',[user.id,tenant,crypt.cifrar(secret,'admin:'+user.id)]);
   const mfa=await admin({...req,method:'POST'},'/admin/integracoes/step-up',params({}),{codigo:totp(secret,Math.floor(Date.now()/30000))});req.headers['x-integration-admin']=mfa.body.token;
   await assert.rejects(()=>admin({...req,method:'POST'},'/admin/integracoes/step-up',params({}),{codigo:totp(secret,Math.floor(Date.now()/30000))}),e=>e.code==='MFA_INVALID');
   assert.equal((await admin(req,'/admin/integracoes/clientes',params({}),null)).body.data.length,1);
   await assert.rejects(()=>admin({...req,headers:{...req.headers,authorization:'Bearer '+token}},'/admin/integracoes/clientes',params({}),null),e=>e.status===403);
   const result=await admin({...req,method:'PUT',headers:{...req.headers,'if-match':etag(id,'1')}},'/admin/integracoes/clientes/'+id,params({}),{nome:'Cliente atualizado',ambiente:'homologacao',finalidade:'Teste',estado:'suspenso',escopos:['vendas:ler'],filiais:['1'],hosts:[],motivo:'Teste de suspensão'});assert.equal(result.body.estado,'suspenso');assert.ok((await a.pool.query("SELECT 1 FROM integration_admin_audit WHERE acao='cliente_alterado'")).rowCount);await assert.rejects(()=>identity.autenticar(token));
   await a.pool.query("UPDATE integration_clients SET estado='ativo' WHERE id=$1",[id]);
  });
  await t.test('HTTP produz Problem Details, auditoria medida e não guarda tokens/PII',async()=>{
   server=criarApiIntegracoes({pool:a.pool,tenant,cofre:crypt,filiais,audience});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
   await a.pool.query('DELETE FROM integration_admission');const headers={Authorization:'Bearer '+token};let r=await fetch(base+'/v1/vendas/vnd_1_S_10',{headers});assert.equal(r.status,200);const rid=r.headers.get('x-request-id');await r.json();
   r=await fetch(base+'/v1/vendas?tenant=outro',{headers});assert.equal(r.status,400);assert.match(r.headers.get('content-type'),/problem/);const problem=await r.json();assert.equal(problem.code,'INVALID_PARAMETER');guardar('Problem',problem);
   await new Promise(r=>setTimeout(r,50));const logs=(await a.pool.query('SELECT * FROM integration_access_logs WHERE id=$1',[rid])).rows;assert.equal(logs.length,1);assert.equal(logs[0].cliente_id,id);assert.ok(logs[0].duracao_ms>=0);assert.ok(!JSON.stringify(logs).includes(token));assert.equal(logs[0].rota_template,'/v1/vendas/{venda_id}');
   r=await fetch(base+'/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(tokenBody('null.invalido.invalido'))});assert.equal(r.status,401);guardar('OAuthError',await r.json());
   const large=await new Promise((resolve,reject)=>{const req=request(base+'/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Transfer-Encoding':'chunked'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end('x'.repeat(65537));});assert.equal(large,413);
   const otherEnvironment=criarIdentidade(a.pool,tenant,audience,'producao');await assert.rejects(()=>otherEnvironment.autenticar(token),e=>e.status===401);
  });
  await t.test('papéis PostgreSQL da API e do worker não conseguem alterar dados comerciais',async()=>{
   const schema=(await a.pool.query('SELECT current_schema() s')).rows[0].s;assert.match(schema,/^fila_[a-f0-9]+$/);
   const sql=await readFile(new URL('../../../deploy/integracoes-permissoes.sql',import.meta.url),'utf8');await a.pool.query(sql.replaceAll("schemaname='public'",`schemaname='${schema}'`).replaceAll('SCHEMA public',`SCHEMA ${schema}`).replaceAll('TABLE public.',`TABLE ${schema}.`));
   for(const role of ['varejo_integracoes_api','varejo_integracoes_worker']){
    const acesso=await a.pool.query("SELECT EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(d.datacl) acl WHERE d.datname=current_database() AND acl.grantee=(SELECT oid FROM pg_roles WHERE rolname=$1) AND acl.privilege_type='CONNECT') ok",[role]);assert.equal(acesso.rows[0].ok,true,'CONNECT deve ser explícito, sem depender de PUBLIC');
    const rp=criarPool(process.env.TENANT_DATABASE_URL,{options:a.pool.options.options+` -c role=${role}`});
    try{
     await assert.rejects(()=>rp.query('UPDATE operacoes SET quantidade=0'),e=>e.code==='42501');
     if(role==='varejo_integracoes_api'){const cc=await criarIdentidade(rp,tenant,audience).autenticar(token);assert.equal((await criarConsultas(rp,tenant,crypt,filiais).consultar(cc,'/v1/vendas/vnd_1_S_10',params({}),{},rid())).body.data.id,'vnd_1_S_10');await assert.rejects(()=>rp.query('DELETE FROM integration_admin_audit'),e=>e.code==='42501');}
     else assert.equal(await criarPublicador(rp,tenant,crypt,filiais)(100),0);
    }finally{await rp.end();}
   }
   const controlSql=await readFile(new URL('../../../deploy/integracoes-controle-permissoes.sql',import.meta.url),'utf8');await a.control.query(controlSql.replaceAll('SCHEMA public',`SCHEMA ${schema}`));
   assert.equal((await a.control.query("SELECT EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(d.datacl) acl WHERE d.datname=current_database() AND acl.grantee=(SELECT oid FROM pg_roles WHERE rolname='varejo_integracoes_auth') AND acl.privilege_type='CONNECT') ok")).rows[0].ok,true);
   const cp=criarPool(process.env.CONTROL_DATABASE_URL,{options:a.control.options.options+' -c role=varejo_integracoes_auth'});
   try{await assert.rejects(()=>cp.query('UPDATE admin_users SET active=false'),e=>e.code==='42501');const restrictedAuth=await criarAuth(cp,tenant),s=await restrictedAuth.login('admin@fila.local',a.senha);assert.ok(await restrictedAuth.autenticar(s.token));await restrictedAuth.logout(s.token);assert.equal(await restrictedAuth.autenticar(s.token),null);}finally{await cp.end();}
  });
  await mkdir('artifacts/integracoes-validacao',{recursive:true});await writeFile('artifacts/integracoes-validacao/respostas-sinteticas.json',JSON.stringify(contratos,null,2));
 }finally{if(server)await new Promise(r=>server.close(r));await a.close();}
});
