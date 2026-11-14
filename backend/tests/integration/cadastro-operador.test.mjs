import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ambienteFila} from '../fixtures/fila.mjs';
import {cofre,hash,totp} from '../../src/integracoes/seguranca.mjs';
import {criarAdministracao} from '../../src/integracoes/administracao.mjs';

test('cadastro exige convite individual, senha, desafio vinculado à sessão e TOTP antes de liberar o manual',async()=>{
 const a=await ambienteFila(),crypt=cofre('a1'.repeat(32)),secret='b2'.repeat(20),params=new URLSearchParams(),base={socket:{remoteAddress:'cadastro-teste'},headers:{},method:'POST'};
 try{
  const admin=criarAdministracao(a.pool,'teste',crypt,a.auth,a.filiais),u=await a.auth.autenticar(a.tokens.admin);
  await assert.rejects(()=>admin(base,'/admin/integracoes/login',params,{email:u.email,senha:'senha incorreta'}),e=>e.code==='LOGIN_INVALID');
  await assert.rejects(()=>admin(base,'/admin/integracoes/login',params,{email:'vendas@fila.local',senha:a.senha}),e=>e.code==='ADMIN_FORBIDDEN');
  await assert.rejects(()=>admin(base,'/admin/integracoes/login',params,{email:u.email,senha:a.senha}),e=>e.code==='ADMIN_NOT_ENROLLED');
  await a.pool.query('INSERT INTO integration_admins(usuario_id,tenant_key,totp_secret,ativo) VALUES($1,$2,$3,false)',[u.id,'teste',crypt.cifrar(secret,'admin:'+u.id)]);
  await a.pool.query("INSERT INTO integration_admin_audit(id,ator_id,tenant_key,acao,alvo_id,motivo,dados) VALUES($1,$2,'teste','operador_provisionado',$2,'Convite sintético',$3)",[randomUUID(),u.id,JSON.stringify({cadastro_pendente:true,expira_em:new Date(Date.now()+3600000).toISOString()})]);
  await a.pool.query("DELETE FROM integration_admission WHERE chave LIKE 'admin-login:%'");
  const x=(await admin(base,'/admin/integracoes/login',params,{email:u.email,senha:a.senha})).body;
  assert.equal(new URL(x.cadastro.otpauth_uri).searchParams.get('secret'),x.cadastro.chave);
  const req={...base,headers:{authorization:'Bearer '+x.token,'x-integration-enrollment':x.cadastro.desafio}};
  await assert.rejects(()=>admin({...req,method:'GET'},'/admin/integracoes/manual',params,null),e=>e.code==='ADMIN_NOT_ENROLLED');
  await assert.rejects(()=>admin({...req,headers:{...req.headers,authorization:'Bearer '+a.tokens.admin}},'/admin/integracoes/cadastro-confirmar',params,{codigo:totp(secret,Math.floor(Date.now()/30000))}),e=>e.code==='ENROLLMENT_INVALID');
  await a.pool.query("UPDATE integration_admin_sessions SET expira_em=now()-interval '1 second' WHERE hash=$1",[hash('cadastro:'+x.cadastro.desafio)]);
  await assert.rejects(()=>admin(req,'/admin/integracoes/cadastro-confirmar',params,{codigo:totp(secret,Math.floor(Date.now()/30000))}),e=>e.code==='ENROLLMENT_INVALID');
  await a.pool.query("UPDATE integration_admin_sessions SET expira_em=now()+interval '1 minute' WHERE hash=$1",[hash('cadastro:'+x.cadastro.desafio)]);
  await assert.rejects(()=>admin(req,'/admin/integracoes/cadastro-confirmar',params,{codigo:'abcdef'}),e=>e.code==='MFA_INVALID');
  assert.equal((await a.pool.query('SELECT ativo FROM integration_admins WHERE usuario_id=$1',[u.id])).rows[0].ativo,false);
  const ok=(await admin(req,'/admin/integracoes/cadastro-confirmar',params,{codigo:totp(secret,Math.floor(Date.now()/30000))})).body;
  assert.equal((await a.pool.query('SELECT ativo FROM integration_admins WHERE usuario_id=$1',[u.id])).rows[0].ativo,true);
  assert.equal((await admin({...req,method:'GET',headers:{...req.headers,'x-integration-admin':ok.token}},'/admin/integracoes/manual',params,null)).body.secoes.length,10);
  await assert.rejects(()=>admin({...req,method:'GET',headers:{...req.headers,'x-integration-admin':x.cadastro.desafio}},'/admin/integracoes/manual',params,null),e=>e.code==='STEP_UP_REQUIRED');
  await assert.rejects(()=>admin(req,'/admin/integracoes/step-up',params,{codigo:totp(secret,Math.floor(Date.now()/30000))}),e=>e.code==='MFA_INVALID');
  const audit=JSON.stringify((await a.pool.query('SELECT motivo,dados FROM integration_admin_audit')).rows);assert.ok(!audit.includes(secret)&&!audit.includes(x.cadastro.chave)&&!audit.includes(x.token));
  await a.pool.query('UPDATE integration_admins SET ativo=false WHERE usuario_id=$1',[u.id]);
  await assert.rejects(()=>admin({...req,method:'GET',headers:{...req.headers,'x-integration-admin':ok.token}},'/admin/integracoes/manual',params,null),e=>e.code==='ADMIN_NOT_ENROLLED');
 }finally{await a.close();}
});
