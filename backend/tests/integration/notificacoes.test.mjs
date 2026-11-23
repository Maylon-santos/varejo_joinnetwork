import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {generateVAPIDKeys} from 'web-push';
import {ambienteFila} from '../fixtures/fila.mjs';
import {criarNotificacoes} from '../../src/notificacoes.mjs';
import {lerResumo} from '../../src/notificacoes-regras.mjs';
import {readFile} from 'node:fs/promises';
import {criarPool} from '../../src/postgres.mjs';
const keys=generateVAPIDKeys(),config={enabled:true,...keys,encryptionKey:randomBytes(32).toString('hex')};
const sub=(n=1)=>({endpoint:'https://web.push.apple.com/sintetico-'+n,keys:{p256dh:generateVAPIDKeys().publicKey,auth:randomBytes(16).toString('base64url')}});
async function req(e,path,{method='GET',body,role='admin',token=e.tokens[role]}={}){const r=await fetch(e.base+'/api/v1'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
async function inscrever(e,n=1,role='admin'){return req(e,'/notificacoes/dispositivos',{role,method:'POST',body:{nome:'iPhone sintético '+n,inscricao:sub(n)}});}
const prefs=(e,filiais=['1'],resumo_diario=true)=>req(e,'/notificacoes/preferencias',{method:'PUT',body:{resumo_diario,filiais}});
async function cobertura(e,dia,sucesso){
 for(const recurso of ['vendas','cancelamentos']){await e.pool.query('INSERT INTO sync_checkpoints(filial,recurso,ate) VALUES(1,$1,$2) ON CONFLICT(filial,recurso) DO UPDATE SET ate=EXCLUDED.ate',[recurso,dia]);await e.pool.query('INSERT INTO sync_status(filial,recurso,ultimo_sucesso) VALUES(1,$1,$2) ON CONFLICT(filial,recurso) DO UPDATE SET ultimo_sucesso=EXCLUDED.ultimo_sucesso',[recurso,sucesso]);}
}
test('opt-in é pessoal, cifrado, limitado ao piloto e logout desativa só a sessão correspondente',async()=>{
 const e=await ambienteFila({push:{config}});try{
  assert.equal((await req(e,'/notificacoes',{token:null})).status,401);assert.equal((await req(e,'/notificacoes')).body.preferencias.resumo_diario,false);
  assert.equal((await req(e,'/notificacoes',{role:'vendas'})).body.disponivel,false);assert.equal((await inscrever(e,1,'vendas')).status,403);
  const d=await inscrever(e);assert.equal(d.status,201);assert.equal((await prefs(e)).status,200);assert.equal((await prefs(e,['999'])).status,400);
  const db=(await e.control.query('SELECT * FROM notificacao_dispositivos')).rows[0];assert.ok(!db.inscricao_cifrada.toString().includes('web.push.apple.com'));const json=JSON.stringify((await req(e,'/notificacoes')).body);for(const text of ['endpoint','sessao_hash','inscricao_cifrada','auth','privateKey'])assert.ok(!json.includes(text));
  assert.equal((await req(e,'/notificacoes/dispositivos/'+d.body.id,{role:'vendas',method:'DELETE'})).status,403);
  assert.equal((await req(e,'/auth/logout',{method:'POST'})).status,200);assert.equal((await e.control.query('SELECT ativo FROM notificacao_dispositivos')).rows[0].ativo,false);
 }finally{await e.close();}
});
test('teste é idempotente e exclusivo do aparelho da sessão, sem ativar resumo diário',async()=>{
 const enviados=[],e=await ambienteFila({push:{config,enviar:async(_s,p)=>{enviados.push(p);return {status:201};}}});try{
  const d=(await inscrever(e)).body;const body={dispositivo:d.id,requisicao:randomUUID()};
  const primeiro=await req(e,'/notificacoes/teste',{method:'POST',body});assert.equal(primeiro.status,202);assert.equal((await req(e,'/notificacoes/teste',{method:'POST',body})).body.id,primeiro.body.id);
  assert.equal((await req(e,'/notificacoes/teste',{method:'POST',body:{...body,requisicao:randomUUID()}})).status,429);
  await e.notificacoes.executar();await e.notificacoes.executar();assert.equal(enviados.length,1);assert.match(enviados[0].title,/ativadas/);
  const h=(await req(e,'/notificacoes/historico')).body;assert.equal(h.entregas[0].estado,'aceita');assert.equal((await req(e,'/notificacoes')).body.preferencias.resumo_diario,false);
  const outra=(await e.auth.login('admin@fila.local',e.senha)).token;assert.equal((await req(e,'/notificacoes/teste',{method:'POST',token:outra,body:{...body,requisicao:randomUUID()}})).status,404);
 }finally{await e.close();}
});
test('agenda respeita 22h05, soma vendas elegíveis e não duplica por execução ou worker concorrente',async()=>{
 let now=new Date('2026-11-24T01:04:00Z');const enviados=[],e=await ambienteFila({push:{config,agora:()=>now,enviar:async(_s,p)=>{enviados.push(p);return {status:201};}}});try{
  await inscrever(e);await prefs(e);await e.pool.query("DELETE FROM operacoes WHERE filial=1");
  await e.pool.query("INSERT INTO operacoes(cod_operacao,tipo_operacao,filial,data_operacao,quantidade,valor_final_centavos,cancelada) VALUES(1,'S',1,'2026-11-23',95,1421658,false),(2,'S',1,'2026-11-23',20,9999,true),(3,'E',1,'2026-11-23',20,9999,false),(4,'S',1,'2026-11-23',20,9999,false)");await e.pool.query("INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou) VALUES(4,'S',1,now())");
  await cobertura(e,'2026-11-23','2026-11-24T01:03:00Z');await e.notificacoes.executar();assert.equal(enviados.length,0);
  now=new Date('2026-11-24T01:05:00Z');await Promise.all([e.notificacoes.executar(),e.notificacoes.executar()]);assert.equal(enviados.length,1);assert.match(enviados[0].body,/1 vendas · 95 peças/);assert.match(enviados[0].body,/14\.216,58/);assert.equal(enviados[0].parcial,false);
  await e.notificacoes.executar();assert.equal(enviados.length,1);assert.equal((await e.control.query('SELECT count(*)::int AS n FROM notificacao_entregas')).rows[0].n,1);
 }finally{await e.close();}
});
test('coleta atrasada aguarda até 22h30 e envia um único resumo explicitamente parcial',async()=>{
 let now=new Date('2026-11-24T01:05:00Z');const enviados=[],e=await ambienteFila({push:{config,agora:()=>now,enviar:async(_s,p)=>{enviados.push(p);return {status:201};}}});try{
  await inscrever(e);await prefs(e);await e.notificacoes.executar();assert.equal(enviados.length,0);
  now=new Date('2026-11-24T01:30:00Z');await e.notificacoes.executar();assert.equal(enviados.length,1);assert.equal(enviados[0].parcial,true);assert.match(enviados[0].title,/parcial/);
  await cobertura(e,'2026-11-23','2026-11-24T01:31:00Z');now=new Date('2026-11-24T01:32:00Z');await e.notificacoes.executar();assert.equal(enviados.length,1);
 }finally{await e.close();}
});
test('remoção de permissão/filial, conta inativa e opt-out impedem geração e envio pendente',async()=>{
 const enviados=[],e=await ambienteFila({push:{config,enviar:async()=>{enviados.push(1);return {status:201};}}});try{
  const d=(await inscrever(e)).body;await req(e,'/notificacoes/teste',{method:'POST',body:{dispositivo:d.id,requisicao:randomUUID()}});
  await e.control.query("UPDATE access_roles SET permissoes=permissoes-'indicadores:ler' WHERE tenant_key='teste' AND role='Admin'");await e.notificacoes.executar();assert.equal(enviados.length,0);assert.equal((await e.control.query('SELECT estado FROM notificacao_entregas')).rows[0].estado,'cancelada');
  await e.control.query("UPDATE access_roles SET permissoes=permissoes||'[\"indicadores:ler\"]'::jsonb WHERE tenant_key='teste' AND role='Admin'");await prefs(e);
  await prefs(e,[],false);assert.equal((await req(e,'/notificacoes')).body.preferencias.resumo_diario,false);
  await e.control.query('UPDATE admin_users SET active=false WHERE id=$1',[e.usuarios.admin]);assert.equal((await req(e,'/notificacoes')).status,401);
 }finally{await e.close();}
});
test('410 desativa a inscrição; timeout incerto não reenvia; 429 conhecido respeita intervalo',async()=>{
 const e=await ambienteFila({push:{config,enviar:async()=>({status:410})}});try{
  const d=(await inscrever(e)).body;await req(e,'/notificacoes/teste',{method:'POST',body:{dispositivo:d.id,requisicao:randomUUID()}});await e.notificacoes.executar();assert.equal((await e.control.query('SELECT ativo FROM notificacao_dispositivos')).rows[0].ativo,false);assert.equal((await e.control.query('SELECT erro_codigo FROM notificacao_entregas')).rows[0].erro_codigo,'INSCRICAO_EXPIRADA');
  await e.control.query('DELETE FROM notificacao_entregas');await inscrever(e);
  const ctx={control:e.control,pool:e.pool,tenant:'teste',filiais:e.filiais,config:{...config,pilotUsers:[e.usuarios.admin]}};
  const incerto=criarNotificacoes({...ctx,enviar:async()=>{throw Error('PUSH_TRANSPORTE_INCERTO');}});await req(e,'/notificacoes/teste',{method:'POST',body:{dispositivo:d.id,requisicao:randomUUID()}});await incerto.executar();await incerto.executar();assert.equal((await e.control.query('SELECT estado,tentativas FROM notificacao_entregas')).rows[0].estado,'incerta');
  await e.control.query('DELETE FROM notificacao_entregas');await req(e,'/notificacoes/teste',{method:'POST',body:{dispositivo:d.id,requisicao:randomUUID()}});
  const retry=criarNotificacoes({...ctx,enviar:async()=>({status:429,retryAfter:'120'})});await retry.executar();const r=(await e.control.query('SELECT estado,tentativas,extract(epoch FROM(proxima_tentativa-now()))::int AS espera FROM notificacao_entregas')).rows[0];assert.equal(r.estado,'pendente');assert.equal(r.tentativas,1);assert.ok(r.espera>=119);await retry.executar();assert.equal((await e.control.query('SELECT tentativas FROM notificacao_entregas')).rows[0].tentativas,1);
 }finally{await e.close();}
});
test('uma inscrição não pode ser transferida entre contas; histórico é filtrado pela concessão atual',async()=>{
 const e=await ambienteFila({push:{config,agora:()=>new Date('2026-11-24T01:30:00Z'),enviar:async()=>({status:201})}});try{
  const inscricao=sub(8);const d=await req(e,'/notificacoes/dispositivos',{method:'POST',body:{nome:'Teste',inscricao}});assert.equal(d.status,201);
  await prefs(e);await e.notificacoes.executar();assert.equal((await req(e,'/notificacoes/historico')).body.entregas.length,1);
  await e.control.query("UPDATE admin_users SET role='Gerentes' WHERE id=$1",[e.usuarios.admin]);await e.control.query("UPDATE access_roles SET permissoes='[\"indicadores:ler\"]' WHERE tenant_key='teste' AND role='Gerentes'");await e.control.query('INSERT INTO user_branches(user_id,tenant_key,filial) VALUES($1,\'teste\',2)',[e.usuarios.admin]);
  assert.equal((await req(e,'/notificacoes/historico')).body.entregas.length,0);assert.equal((await prefs(e,['1'])).status,400);
  const outro=criarNotificacoes({control:e.control,pool:e.pool,tenant:'teste',filiais:e.filiais,config:{...config,pilotUsers:[e.usuarios.admin,e.usuarios.leitor]}});
  const user=await e.auth.autenticar(e.tokens.leitor);await assert.rejects(()=>outro.inscrever(user,e.tokens.leitor,{nome:'Teste',inscricao}),e=>e.status===409);
  assert.equal((await e.control.query('SELECT usuario_id FROM notificacao_dispositivos')).rows[0].usuario_id,e.usuarios.admin);
  await assert.rejects(()=>lerResumo(e.pool,'outro','1','2026-11-23'),/TENANT_INCORRETO/);
 }finally{await e.close();}
});
test('worker usa LOGIN restrito: envia sem ler senhas nem escrever usuários ou dados comerciais',async()=>{
 const e=await ambienteFila({push:{config}});let control,pool;try{
  const schema=(await e.control.query('SHOW search_path')).rows[0].search_path;
  await e.control.query((await readFile(new URL('../../../deploy/notificacoes-permissoes.sql',import.meta.url),'utf8')).replace('ON SCHEMA public','ON SCHEMA '+schema));
  await e.pool.query((await readFile(new URL('../../../deploy/notificacoes-dados-permissoes.sql',import.meta.url),'utf8')).replace('ON SCHEMA public','ON SCHEMA '+schema));
  const options={options:`-c search_path=${schema} -c role=varejo_notificacoes_worker`};control=criarPool(process.env.CONTROL_DATABASE_URL,options);pool=criarPool(process.env.TENANT_DATABASE_URL,options);
  await assert.rejects(()=>control.query('SELECT password_hash FROM admin_users'),e=>e.code==='42501');await assert.rejects(()=>control.query("UPDATE admin_users SET active=false"),e=>e.code==='42501');await assert.rejects(()=>pool.query('DELETE FROM operacoes'),e=>e.code==='42501');
  const d=(await inscrever(e)).body;await req(e,'/notificacoes/teste',{method:'POST',body:{dispositivo:d.id,requisicao:randomUUID()}});let count=0;
  const worker=criarNotificacoes({control,pool,tenant:'teste',filiais:e.filiais,config:{...config,pilotUsers:[e.usuarios.admin]},enviar:async()=>{count++;return {status:201};}});await worker.executar();assert.equal(count,1);
 }finally{await Promise.all([control?.end(),pool?.end()]);await e.close();}
});
test('limite de três aparelhos e retomada após interrupção não criam disparos extras',async()=>{
 const e=await ambienteFila({push:{config,enviar:async()=>({status:201})}});try{
  const results=await Promise.all([inscrever(e,1),inscrever(e,2),inscrever(e,3),inscrever(e,4)]);assert.equal(results.filter(r=>r.status===201).length,3);assert.equal(results.filter(r=>r.status===409).length,1);
  const d=results.find(r=>r.status===201).body;await req(e,'/notificacoes/teste',{method:'POST',body:{dispositivo:d.id,requisicao:randomUUID()}});await e.control.query("UPDATE notificacao_entregas SET estado='enviando',tentativas=1");await e.notificacoes.executar();const j=(await e.control.query('SELECT estado,tentativas FROM notificacao_entregas')).rows[0];assert.equal(j.estado,'incerta');assert.equal(j.tentativas,1);
 }finally{await e.close();}
});
test('prazo é reavaliado antes da rede mesmo se expirar durante o processamento do lote',async()=>{
 let clock=Date.now(),avancar=false,count=0;
 const e=await ambienteFila({push:{config,agora:()=>{const d=new Date(clock);if(avancar)clock+=1000;return d;},enviar:async()=>{count++;return {status:201};}}});try{
  const d=(await inscrever(e)).body;await req(e,'/notificacoes/teste',{method:'POST',body:{dispositivo:d.id,requisicao:randomUUID()}});
  await e.control.query('UPDATE notificacao_entregas SET expira_em=$1,proxima_tentativa=$2',[new Date(clock+500),new Date(clock-1000)]);avancar=true;await e.notificacoes.executar();assert.equal(count,0);assert.equal((await e.control.query('SELECT estado FROM notificacao_entregas')).rows[0].estado,'expirada');
 }finally{await e.close();}
});
