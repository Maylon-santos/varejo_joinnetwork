import {randomUUID,randomBytes} from 'node:crypto';
import {exigir,UUID,hash,validarEscopos,chavePublica,verificarTotp,etag} from './seguranca.mjs';
import {transacao,limite} from './banco.mjs';
import {parametros} from './consultas.mjs';
import {criarConsultas} from './consultas.mjs';
import {criarWebhooks} from './webhooks.mjs';
import {manualIntegracoes} from './manual.mjs';
import {prepararCadastro,confirmarCadastro} from './cadastro-operador.mjs';

const clienteDTO=c=>({id:c.id,client_id:c.client_id,nome:c.nome,tenant_id:c.tenant_key,ambiente:c.ambiente,finalidade:c.finalidade,estado:c.estado,escopos:c.escopos,filiais:c.filiais,hosts:c.hosts,versao:c.versao,criado_em:c.criado_em,atualizado_em:c.atualizado_em,ultimo_acesso_em:c.ultimo_acesso_em});
export function criarAdministracao(pool,tenant,cofre,auth,filiais){
 const webhooks=criarWebhooks(pool,cofre,criarConsultas(pool,tenant,cofre,filiais));
 async function auditar(db,user,acao,alvo,motivo,dados={}){await db.query('INSERT INTO integration_admin_audit(id,ator_id,tenant_key,acao,alvo_id,motivo,dados) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),user.id,tenant,acao,alvo,motivo,JSON.stringify(dados)]);}
 async function usuarioAdmin(token){
  const u=await auth.autenticar(token);exigir(u?.tenant_key===tenant&&u.role==='Admin',403,'ADMIN_FORBIDDEN');
  return u;
 }
 async function humano(token){
  const u=await usuarioAdmin(token);
  const a=(await pool.query('SELECT * FROM integration_admins WHERE usuario_id=$1 AND tenant_key=$2 AND ativo',[u.id,tenant])).rows[0];exigir(a,403,'ADMIN_NOT_ENROLLED');return {u,a};
 }
 return async(req,path,params,body)=>{
  const sub=path.replace('/admin/integracoes','');
  if(sub==='/login'&&req.method==='POST'){
   await transacao(pool,db=>limite(db,'admin-login:'+hash(req.socket.remoteAddress??''),5,5));
   const session=await auth.login(body.email,body.senha);exigir(session,401,'LOGIN_INVALID');
   try{
    const u=await usuarioAdmin(session.token);
    const ativo=(await pool.query('SELECT 1 FROM integration_admins WHERE usuario_id=$1 AND tenant_key=$2 AND ativo',[u.id,tenant])).rowCount;
    const cadastro=ativo?null:await transacao(pool,db=>prepararCadastro(db,u,tenant,cofre,session.token));
    return {status:200,body:{...session,...(cadastro?{cadastro}:{})}};
   }catch(e){await auth.logout(session.token);throw e;}
  }
  if(sub==='/cadastro-confirmar'&&req.method==='POST'){
   const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization??'')?.[1],u=await usuarioAdmin(token);
   await transacao(pool,db=>limite(db,'admin-mfa:'+u.id,5,5));
   return {status:200,body:await transacao(pool,db=>confirmarCadastro(db,u,tenant,cofre,token,req.headers['x-integration-enrollment'],body.codigo))};
  }
  if(sub==='/logout'&&req.method==='POST'){
   const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization??'')?.[1],u=await usuarioAdmin(token);
   await auth.logout(token);await pool.query('DELETE FROM integration_admin_sessions WHERE usuario_id=$1 AND sessao_hash=$2',[u.id,hash(token)]);return {status:200,body:{ok:true}};
  }
  const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization??'')?.[1],{u}=await humano(token);
  if(sub==='/step-up'&&req.method==='POST'){
   await transacao(pool,db=>limite(db,'admin-mfa:'+u.id,5,5));
   return transacao(pool,async db=>{
    const locked=(await db.query('SELECT * FROM integration_admins WHERE usuario_id=$1 AND ativo FOR UPDATE',[u.id])).rows[0];exigir(locked,403,'ADMIN_FORBIDDEN');
    const step=verificarTotp(cofre.abrir(locked.totp_secret,'admin:'+u.id),body.codigo,locked.ultimo_passo);exigir(step!==null,401,'MFA_INVALID');
    await db.query('UPDATE integration_admins SET ultimo_passo=$2 WHERE usuario_id=$1',[u.id,step]);
    const t=randomBytes(32).toString('hex');await db.query('INSERT INTO integration_admin_sessions(hash,usuario_id,sessao_hash) VALUES($1,$2,$3)',[hash(t),u.id,hash(token)]);await auditar(db,u,'step_up',u.id,'Autenticação forte');return {status:200,body:{token:t,expires_in:300,tenant_id:tenant}};
   });
  }
  exigir(/^[a-f0-9]{64}$/.test(req.headers['x-integration-admin']??''),401,'STEP_UP_REQUIRED');
  exigir((await pool.query('SELECT 1 FROM integration_admin_sessions WHERE hash=$1 AND usuario_id=$2 AND sessao_hash=$3 AND expira_em>now()',[hash(req.headers['x-integration-admin']),u.id,hash(token)])).rowCount,401,'STEP_UP_REQUIRED');
  await transacao(pool,db=>limite(db,'admin-access:'+u.id,30,30));
  const hookMatch=/^\/clientes\/([a-f0-9-]+)\/(webhooks(?:\/.*)?)$/.exec(sub);
  if(hookMatch){
   exigir(UUID.test(hookMatch[1])&&['GET','POST','PUT'].includes(req.method),404,'NOT_FOUND');
   if(req.method!=='GET')exigir(typeof body.motivo==='string'&&body.motivo.trim().length>=5&&body.motivo.length<=500,422,'REASON_REQUIRED');
   return transacao(pool,async db=>{
    const c=(await db.query('SELECT * FROM integration_clients WHERE id=$1 AND tenant_key=$2 FOR UPDATE',[hookMatch[1],tenant])).rows[0];exigir(c&&c.estado==='ativo',404,'NOT_FOUND');
    const {motivo,...payload}=body??{},result=await webhooks(c,req.method,'/v1/'+hookMatch[2],params,req.headers,req.method==='GET'?null:payload,randomUUID(),db);
    if(result.status===202)await db.query('UPDATE integration_deliveries SET ator_id=$2 WHERE id=$1',[result.body.id,u.id]);
    await auditar(db,u,'webhook_'+req.method.toLowerCase(),c.id,motivo??'Consulta de webhook',{rota:hookMatch[2].replace(/\/[a-f0-9-]{36}/g,'/{id}'),entrega_id:result.status===202?result.body.id:null});return result;
   });
  }
  if(req.method==='GET'){
   if(sub==='/manual'){
    exigir(!params.size,400,'INVALID_PARAMETER');
    return {status:200,body:manualIntegracoes};
   }
   if(sub==='/clientes'){
    exigir(!params.size,400,'INVALID_PARAMETER');const rows=(await pool.query('SELECT * FROM integration_clients WHERE tenant_key=$1 ORDER BY criado_em DESC LIMIT 200',[tenant])).rows;
    const keys=(await pool.query('SELECT k.cliente_id,k.kid,k.ativa,k.valida_ate FROM integration_keys k JOIN integration_clients c ON c.id=k.cliente_id WHERE c.tenant_key=$1',[tenant])).rows;
    return {status:200,body:{tenant_id:tenant,filiais,data:rows.map(c=>({...clienteDTO(c),chaves:keys.filter(k=>k.cliente_id===c.id)}))}};
   }
   exigir(['/acessos','/auditoria','/entregas','/metricas','/webhooks'].includes(sub),404,'NOT_FOUND');
   const p=parametros(params,['inicio','fim','cliente_id','limite','antes']),inicio=p.inicio??new Date(Date.now()-3600000).toISOString(),fim=p.fim??new Date().toISOString();
   exigir(Number.isFinite(Date.parse(inicio))&&Number.isFinite(Date.parse(fim))&&Date.parse(fim)>=Date.parse(inicio)&&Date.parse(fim)-Date.parse(inicio)<=31*86400000,400,'INVALID_WINDOW');
   exigir(!p.cliente_id||UUID.test(p.cliente_id),400,'INVALID_PARAMETER');const n=+(p.limite??100);
   const cursor=p.antes?cofre.verificar(p.antes):null;exigir(!cursor||cursor.tipo==='admin'&&cursor.usuario===u.id&&cursor.rota===sub&&cursor.inicio===inicio&&cursor.fim===fim&&cursor.cliente===(p.cliente_id??null)&&cursor.expira>Date.now(),400,'INVALID_CURSOR');
   const max=cursor?.data??fim,filter=p.cliente_id??null;
   return transacao(pool,async db=>{
    await auditar(db,u,'consulta'+sub,null,'Consulta administrativa',{inicio,fim,cliente_id:filter});let result;
    if(sub==='/acessos')result=await db.query(`SELECT id,iniciado_em,duracao_ms,cliente_id,canal,metodo,rota_template,filial_id,http_status,codigo_erro,bytes_resposta,decisao,kid FROM integration_access_logs WHERE tenant_key=$1 AND iniciado_em>=$2 AND iniciado_em<=$3 AND ($4::uuid IS NULL OR cliente_id=$4) AND (iniciado_em,id)<($5::timestamptz,$6::uuid) ORDER BY iniciado_em DESC,id DESC LIMIT $7`,[tenant,inicio,fim,filter,max,cursor?.id??'ffffffff-ffff-ffff-ffff-ffffffffffff',n+1]);
    if(sub==='/auditoria')result=await db.query('SELECT * FROM integration_admin_audit WHERE tenant_key=$1 AND criado_em>=$2 AND criado_em<=$3 AND (criado_em,id)<($4::timestamptz,$5::uuid) ORDER BY criado_em DESC,id DESC LIMIT $6',[tenant,inicio,fim,max,cursor?.id??'ffffffff-ffff-ffff-ffff-ffffffffffff',n+1]);
    if(sub==='/webhooks')result=await db.query('SELECT w.id,w.cliente_id,w.nome,w.hostname,w.ativo,w.estado,w.verificado_em,w.falhas,w.circuito_ate,w.criado_em FROM integration_webhooks w JOIN integration_clients c ON c.id=w.cliente_id WHERE c.tenant_key=$1 AND ($2::uuid IS NULL OR c.id=$2) ORDER BY w.criado_em DESC,w.id DESC LIMIT $3',[tenant,filter,n+1]);
    if(sub==='/entregas')result=await db.query(`SELECT a.*,d.evento_id,d.webhook_id,d.estado,d.origem,d.filial,c.id AS cliente_id FROM integration_attempts a JOIN integration_deliveries d ON d.id=a.entrega_id JOIN integration_webhooks w ON w.id=d.webhook_id JOIN integration_clients c ON c.id=w.cliente_id WHERE c.tenant_key=$1 AND a.iniciado_em>=$2 AND a.iniciado_em<=$3 AND ($4::uuid IS NULL OR c.id=$4) AND (a.iniciado_em,a.id)<($5::timestamptz,$6::uuid) ORDER BY a.iniciado_em DESC,a.id DESC LIMIT $7`,[tenant,inicio,fim,filter,max,cursor?.id??'ffffffff-ffff-ffff-ffff-ffffffffffff',n+1]);
    if(sub==='/metricas'){
     result=await db.query(`SELECT count(*)::int amostras,count(*) FILTER(WHERE http_status>=400)::int falhas,count(*) FILTER(WHERE http_status=429)::int limitadas,percentile_cont(.5) WITHIN GROUP(ORDER BY duracao_ms) p50_ms,percentile_cont(.95) WITHIN GROUP(ORDER BY duracao_ms) p95_ms,percentile_cont(.99) WITHIN GROUP(ORDER BY duracao_ms) p99_ms FROM integration_access_logs WHERE tenant_key=$1 AND iniciado_em>=$2 AND iniciado_em<=$3 AND ($4::uuid IS NULL OR cliente_id=$4)`,[tenant,inicio,fim,filter]);return {status:200,body:{inicio,fim,...result.rows[0]}};
    }
    const more=result.rows.length>n,rows=result.rows.slice(0,n),last=rows.at(-1),data=last?.iniciado_em??last?.criado_em;
    return {status:200,body:{inicio,fim,data:rows,cursor_proximo:more&&sub!=='/webhooks'?cofre.assinar({tipo:'admin',usuario:u.id,rota:sub,inicio,fim,cliente:filter,data:data.toISOString(),id:last.id,expira:Date.now()+1800000}):null}};
   });
  }
  exigir(['POST','PUT'].includes(req.method),405,'METHOD_NOT_ALLOWED');exigir(typeof body.motivo==='string'&&body.motivo.trim().length>=5&&body.motivo.length<=500,422,'REASON_REQUIRED');
  return transacao(pool,async db=>{
   const clientMatch=/^\/clientes(?:\/([a-f0-9-]+))?$/.exec(sub),keyMatch=/^\/clientes\/([a-f0-9-]+)\/chaves\/([A-Za-z0-9_-]{1,100})$/.exec(sub);
   if(keyMatch){
    exigir(req.method==='PUT'&&UUID.test(keyMatch[1]),400,'INVALID_PARAMETER');const c=(await db.query('SELECT * FROM integration_clients WHERE id=$1 AND tenant_key=$2 FOR UPDATE',[keyMatch[1],tenant])).rows[0];exigir(c,404,'NOT_FOUND');exigir(req.headers['if-match']===etag(c.id,c.versao),412,'RESOURCE_CHANGED');
    exigir(typeof body.ativa==='boolean'&&Number.isFinite(Date.parse(body.valida_ate))&&Date.parse(body.valida_ate)>Date.now()&&Date.parse(body.valida_ate)<=Date.now()+366*86400000,422,'INVALID_KEY');chavePublica(body.public_key);
    const old=(await db.query('SELECT public_key,ativa FROM integration_keys WHERE cliente_id=$1 AND kid=$2',[c.id,keyMatch[2]])).rows[0];exigir(!old||old.public_key===body.public_key,409,'KID_ALREADY_USED');exigir(!old||old.ativa||!body.ativa,409,'KEY_REVOKED');
    await db.query('INSERT INTO integration_keys VALUES($1,$2,$3,$4,$5) ON CONFLICT(cliente_id,kid) DO UPDATE SET ativa=$4,valida_ate=$5',[c.id,keyMatch[2],body.public_key,body.ativa,body.valida_ate]);
    const row=(await db.query('UPDATE integration_clients SET versao=versao+1,atualizado_em=now() WHERE id=$1 RETURNING *',[c.id])).rows[0];await auditar(db,u,'chave_alterada',c.id,body.motivo,{kid:keyMatch[2],ativa:body.ativa,valida_ate:body.valida_ate});return {status:200,etag:etag(row.id,row.versao),body:clienteDTO(row)};
   }
   exigir(clientMatch,404,'NOT_FOUND');const id=clientMatch[1];exigir(!id&&req.method==='POST'||id&&UUID.test(id)&&req.method==='PUT',405,'METHOD_NOT_ALLOWED');
   exigir(typeof body.nome==='string'&&body.nome.trim().length>0&&body.nome.length<=120&&typeof body.finalidade==='string'&&body.finalidade.trim().length>0&&body.finalidade.length<=500&&['homologacao','producao'].includes(body.ambiente)&&['ativo','suspenso','revogado'].includes(body.estado),422,'INVALID_CLIENT');
   const scopes=validarEscopos(body.escopos);exigir(Array.isArray(body.filiais)&&body.filiais.length>0&&body.filiais.length<=100&&new Set(body.filiais).size===body.filiais.length&&body.filiais.every(f=>filiais.includes(f)),422,'INVALID_BRANCH');
   exigir(Array.isArray(body.hosts)&&body.hosts.length<=3&&body.hosts.every(h=>typeof h==='string'&&h.length<=253&&/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)),422,'INVALID_HOST');
   let c;if(id){
    const old=(await db.query('SELECT * FROM integration_clients WHERE id=$1 AND tenant_key=$2 FOR UPDATE',[id,tenant])).rows[0];exigir(old,404,'NOT_FOUND');exigir(old.estado!=='revogado',409,'CLIENT_REVOKED');exigir(req.headers['if-match']===etag(old.id,old.versao),412,'RESOURCE_CHANGED');exigir(body.ambiente===old.ambiente,422,'ENVIRONMENT_IMMUTABLE');
    c=(await db.query('UPDATE integration_clients SET nome=$2,finalidade=$3,estado=$4,escopos=$5,filiais=$6,hosts=$7,versao=versao+1,atualizado_em=now() WHERE id=$1 RETURNING *',[id,body.nome.trim(),body.finalidade,body.estado,JSON.stringify(scopes),JSON.stringify(body.filiais),JSON.stringify(body.hosts)])).rows[0];
   }else{
    c=(await db.query('INSERT INTO integration_clients(id,tenant_key,client_id,nome,ambiente,finalidade,estado,escopos,filiais,hosts) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[randomUUID(),tenant,'int_'+randomBytes(16).toString('hex'),body.nome.trim(),body.ambiente,body.finalidade,body.estado,JSON.stringify(scopes),JSON.stringify(body.filiais),JSON.stringify(body.hosts)])).rows[0];
   }
   await auditar(db,u,id?'cliente_alterado':'cliente_criado',c.id,body.motivo,{estado:c.estado,escopos:c.escopos,filiais:c.filiais,hosts:c.hosts});return {status:id?200:201,etag:etag(c.id,c.versao),body:clienteDTO(c)};
  });
 };
}
