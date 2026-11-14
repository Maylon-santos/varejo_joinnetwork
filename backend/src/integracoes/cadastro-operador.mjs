import {randomBytes,randomUUID} from 'node:crypto';
import {exigir,hash,verificarTotp} from './seguranca.mjs';

export function base32(secret){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const b of Buffer.from(secret,'hex'))bits+=b.toString(2).padStart(8,'0');
 let value='';for(let i=0;i<bits.length;i+=5)value+=alphabet[parseInt(bits.slice(i,i+5).padEnd(5,'0'),2)];return value;
}
async function pendente(db,u,tenant){
 const a=(await db.query('SELECT * FROM integration_admins WHERE usuario_id=$1 AND tenant_key=$2 FOR UPDATE',[u.id,tenant])).rows[0];
 exigir(a&&!a.ativo&&String(a.ultimo_passo)==='-1',403,'ADMIN_NOT_ENROLLED');
 const audit=(await db.query("SELECT dados FROM integration_admin_audit WHERE alvo_id=$1 AND tenant_key=$2 AND acao='operador_provisionado' ORDER BY criado_em DESC,id DESC LIMIT 1",[u.id,tenant])).rows[0]?.dados;
 exigir(audit?.cadastro_pendente===true&&Date.parse(audit.expira_em)>Date.now(),403,'ENROLLMENT_NOT_AUTHORIZED');return a;
}
export async function prepararCadastro(db,u,tenant,cofre,token){
 const a=await pendente(db,u,tenant),secret=cofre.abrir(a.totp_secret,'admin:'+u.id),desafio=randomBytes(32).toString('hex');
 // Domínio próprio: um desafio de cadastro nunca é uma autorização de MFA.
 await db.query('INSERT INTO integration_admin_sessions(hash,usuario_id,sessao_hash) VALUES($1,$2,$3)',[hash('cadastro:'+desafio),u.id,hash(token)]);
 const chave=base32(secret),uri='otpauth://totp/'+encodeURIComponent('JoinNetwork:'+u.email)+'?'+new URLSearchParams({secret:chave,issuer:'JoinNetwork',algorithm:'SHA1',digits:'6',period:'30'});
 return {desafio,chave,otpauth_uri:uri,expires_in:300};
}
export async function confirmarCadastro(db,u,tenant,cofre,token,desafio,codigo){
 const a=await pendente(db,u,tenant);exigir(/^[a-f0-9]{64}$/.test(desafio??''),401,'ENROLLMENT_INVALID');
 exigir((await db.query('SELECT 1 FROM integration_admin_sessions WHERE hash=$1 AND usuario_id=$2 AND sessao_hash=$3 AND expira_em>now()',[hash('cadastro:'+desafio),u.id,hash(token)])).rowCount,401,'ENROLLMENT_INVALID');
 const passo=verificarTotp(cofre.abrir(a.totp_secret,'admin:'+u.id),codigo);exigir(passo!==null,401,'MFA_INVALID');
 await db.query('UPDATE integration_admins SET ativo=true,ultimo_passo=$2 WHERE usuario_id=$1',[u.id,passo]);
 await db.query('DELETE FROM integration_admin_sessions WHERE usuario_id=$1',[u.id]);
 const step=randomBytes(32).toString('hex');await db.query('INSERT INTO integration_admin_sessions(hash,usuario_id,sessao_hash) VALUES($1,$2,$3)',[hash(step),u.id,hash(token)]);
 await db.query("INSERT INTO integration_admin_audit(id,ator_id,tenant_key,acao,alvo_id,motivo,dados) VALUES($1,$2,$3,'operador_cadastrado',$2,'Autenticador confirmado pelo titular','{}')",[randomUUID(),u.id,tenant]);
 return {token:step,expires_in:300,tenant_id:tenant};
}
