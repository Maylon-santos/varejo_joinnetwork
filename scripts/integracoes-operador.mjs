// Provisionamento explícito via acesso operacional. Entrada privada JSON com TOTP já configurado no autenticador.
import {readFile,stat,writeFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {cofre,exigir,UUID,verificarTotp} from '../backend/src/integracoes/seguranca.mjs';
import {transacao,identidade} from '../backend/src/integracoes/banco.mjs';
let pool,control;
try{
 if(process.argv[2]==='--preparar'){
  const id=process.argv[3],path=process.argv[4];exigir(UUID.test(id??'')&&path,400,'USAGE_PREPARE_USER_UUID_PRIVATE_FILE');
  const secret=randomBytes(20),alfabeto='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const b of secret)bits+=b.toString(2).padStart(8,'0');let b32='';for(let i=0;i<bits.length;i+=5)b32+=alfabeto[parseInt(bits.slice(i,i+5).padEnd(5,'0'),2)];
  await writeFile(path,JSON.stringify({usuario_id:id,ativo:true,motivo:'Habilitação operacional de integrações',totp_secret:secret.toString('hex'),otpauth_uri:`otpauth://totp/JoinNetwork:${id}?secret=${b32}&issuer=JoinNetwork&algorithm=SHA1&digits=6&period=30`,codigo:'PREENCHER_COM_CODIGO_ATUAL'},null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({evento:'integration_enrollment_file_created'}));process.exit(0);
 }
 const path=process.argv[2];exigir(path,400,'PRIVATE_INPUT_FILE_REQUIRED');const info=await stat(path);exigir((info.mode&0o077)===0&&info.isFile()&&info.size<10000,400,'PRIVATE_FILE_MODE_REQUIRED');
 const v=JSON.parse(await readFile(path,'utf8')),tenant=process.env.TENANT_KEY;exigir(UUID.test(v.usuario_id)&&typeof v.ativo==='boolean'&&typeof v.motivo==='string'&&v.motivo.length>=5&&v.motivo.length<=500,400,'INVALID_ENROLLMENT');
 let passo=null;if(v.ativo){exigir(/^[a-f0-9]{40}$/i.test(v.totp_secret),400,'INVALID_ENROLLMENT');passo=verificarTotp(v.totp_secret,v.codigo);exigir(passo!==null,400,'MFA_INVALID');}const crypt=cofre(process.env.INTEGRATIONS_ENCRYPTION_KEY);
 pool=criarPool(process.env.TENANT_DATABASE_URL);control=criarPool(process.env.CONTROL_DATABASE_URL);await identidade(pool,tenant);
 exigir((await control.query("SELECT 1 FROM admin_users WHERE id=$1 AND tenant_key=$2 AND (NOT $3::boolean OR role='Admin' AND active)",[v.usuario_id,tenant,v.ativo])).rowCount,403,'ADMIN_FORBIDDEN');
 await transacao(pool,async db=>{
  if(v.ativo)await db.query('INSERT INTO integration_admins(usuario_id,tenant_key,totp_secret,ativo,ultimo_passo) VALUES($1,$2,$3,true,$4) ON CONFLICT(usuario_id) DO UPDATE SET totp_secret=$3,ativo=true,ultimo_passo=$4',[v.usuario_id,tenant,crypt.cifrar(v.totp_secret,'admin:'+v.usuario_id),passo]);
  else await db.query('UPDATE integration_admins SET ativo=false WHERE usuario_id=$1',[v.usuario_id]);
  await db.query('DELETE FROM integration_admin_sessions WHERE usuario_id=$1',[v.usuario_id]);
  await db.query("INSERT INTO integration_admin_audit(id,ator_id,tenant_key,acao,alvo_id,motivo,dados) VALUES($1,$2,$3,'operador_provisionado',$2,$4,$5)",[randomUUID(),v.usuario_id,tenant,v.motivo,JSON.stringify({ativo:v.ativo,canal:'operacional_ssh'})]);
 });console.log(JSON.stringify({evento:'integration_operator_updated',ativo:v.ativo}));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{await Promise.all([pool?.end(),control?.end()]);}
