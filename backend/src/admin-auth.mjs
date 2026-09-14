import {randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const options={N:32768,r:8,p:1,maxmem:64*1024*1024};
export async function hashSenha(senha){
 if(typeof senha!=='string'||senha.length<16||Buffer.byteLength(senha)>256)throw new Error('SENHA_INVALIDA');
 const salt=randomBytes(16).toString('hex');
 const hash=await scrypt(senha,salt,64,options);
 return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verificarSenha(senha,encoded){
 if(typeof senha!=='string'||Buffer.byteLength(senha)>256)return false;
 const m=/^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(encoded??'');
 if(!m)return false;
 const candidate=await scrypt(senha,m[1],64,options);
 return timingSafeEqual(candidate,Buffer.from(m[2],'hex'));
}
export const hashToken=token=>createHash('sha256').update(token).digest('hex');
export async function criarAdmin(pool,{tenant,email,senha}){
 const normal=email?.trim().toLowerCase();
 if(!tenant||!normal||!/^\S+@\S+\.\S+$/.test(normal)||normal.length>254)throw new Error('ADMIN_INVALIDO');
 const passwordHash=await hashSenha(senha);
 const r=await pool.query(`INSERT INTO admin_users(id,tenant_key,email,password_hash) VALUES($1,$2,$3,$4)
 ON CONFLICT(tenant_key,email) DO NOTHING RETURNING id`,[randomUUID(),tenant,normal,passwordHash]);
 return {criado:r.rowCount===1};
}
export async function criarAuth(pool,tenant){
 const dummy=await hashSenha(randomBytes(32).toString('hex'));
 return {
  login:async(email,senha)=>{
   const normal=typeof email==='string'?email.trim().toLowerCase():'';
   const r=await pool.query('SELECT id,password_hash,active FROM admin_users WHERE tenant_key=$1 AND email=$2',[tenant,normal]);
   const user=r.rows[0];
   const valid=await verificarSenha(senha,user?.password_hash||dummy);
   if(!valid||!user?.active)return null;
   const token=randomBytes(32).toString('hex');
   await pool.query('DELETE FROM admin_sessions WHERE expires_at<=now()');
   const session=await pool.query("INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours') RETURNING expires_at",[hashToken(token),user.id]);
   return {token,expires_at:session.rows[0].expires_at};
  },
  autenticar:async(token)=>{
   if(!/^[a-f0-9]{64}$/.test(token??''))return null;
   const r=await pool.query(`SELECT u.id,u.email,u.role,u.tenant_key,r.nome AS role_nome,r.permissoes,r.todas_filiais,r.somente_proprias_vendas,
     COALESCE((SELECT jsonb_agg(jsonb_build_object('filial',b.filial::text,'vendedor_codigo',b.vendedor_codigo)) FROM user_branches b WHERE b.user_id=u.id AND b.tenant_key=u.tenant_key),'[]'::jsonb) AS vinculos FROM admin_sessions s
     JOIN admin_users u ON u.id=s.user_id JOIN access_roles r ON r.tenant_key=u.tenant_key AND r.role=u.role WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active AND u.tenant_key=$2`,[hashToken(token),tenant]);
   return r.rows[0]??null;
  },
  logout:async token=>{await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1',[hashToken(token)]);},
 };
}
