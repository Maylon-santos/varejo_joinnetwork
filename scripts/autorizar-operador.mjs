// Convite individual por SSH; a ativação depende da senha e do autenticador do titular.
import {randomBytes,randomUUID} from 'node:crypto';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {cofre,exigir,UUID} from '../backend/src/integracoes/seguranca.mjs';
import {transacao,identidade} from '../backend/src/integracoes/banco.mjs';
let pool,control;
try{
 const id=process.argv[2],tenant=process.env.TENANT_KEY;exigir(UUID.test(id??''),400,'USER_UUID_REQUIRED');
 pool=criarPool(process.env.TENANT_DATABASE_URL);control=criarPool(process.env.CONTROL_DATABASE_URL);await identidade(pool,tenant);
 exigir((await control.query("SELECT 1 FROM admin_users WHERE id=$1 AND tenant_key=$2 AND role='Admin' AND active",[id,tenant])).rowCount,403,'ADMIN_FORBIDDEN');
 const crypt=cofre(process.env.INTEGRATIONS_ENCRYPTION_KEY);
 await transacao(pool,async db=>{
  // Não substituir autenticador existente ou reativar uma autorização revogada.
  exigir(!(await db.query('SELECT 1 FROM integration_admins WHERE usuario_id=$1 FOR UPDATE',[id])).rowCount,409,'OPERATOR_ALREADY_EXISTS');
  await db.query('INSERT INTO integration_admins(usuario_id,tenant_key,totp_secret,ativo,ultimo_passo) VALUES($1,$2,$3,false,-1)',[id,tenant,crypt.cifrar(randomBytes(20).toString('hex'),'admin:'+id)]);
  await db.query("INSERT INTO integration_admin_audit(id,ator_id,tenant_key,acao,alvo_id,motivo,dados) VALUES($1,$2,$3,'operador_provisionado',$2,'Cadastro individual autorizado por acesso operacional',$4)",[randomUUID(),id,tenant,JSON.stringify({cadastro_pendente:true,expira_em:new Date(Date.now()+86400000).toISOString(),canal:'operacional_ssh'})]);
 });console.log(JSON.stringify({evento:'integration_enrollment_authorized',exigeConfirmacaoTitular:true}));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{await Promise.all([pool?.end(),control?.end()]);}
