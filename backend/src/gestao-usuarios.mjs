import {randomUUID} from 'node:crypto';
import {hashSenha} from './admin-auth.mjs';
import {ErroApi} from './painel.mjs';
export function criarGestaoUsuarios(pool,dados,tenant,filiais){
 const listar=async()=>({usuarios:(await pool.query(`SELECT u.id,u.email,u.role,u.active,COALESCE((SELECT jsonb_agg(jsonb_build_object('filial',b.filial::text,'vendedor_codigo',b.vendedor_codigo)) FROM user_branches b WHERE b.user_id=u.id AND b.tenant_key=u.tenant_key),'[]'::jsonb) AS vinculos FROM admin_users u WHERE tenant_key=$1 ORDER BY email`,[tenant])).rows});
 return {listar,
  vendedores:async()=>({vendedores:(await dados.query(`SELECT DISTINCT ON (filial,vendedor_codigo) filial::text,vendedor_codigo,vendedor_nome FROM operacoes WHERE filial=ANY($1::bigint[]) AND vendedor_codigo IS NOT NULL AND vendedor_codigo<>'' ORDER BY filial,vendedor_codigo,data_operacao DESC,cod_operacao DESC`,[filiais])).rows}),
  salvar:async(id,body,actor)=>{
   if(!body||Object.keys(body).some(k=>!['email','role','active','senha','vinculos'].includes(k))||typeof body.email!=='string'||!/^\S+@\S+\.\S+$/.test(body.email.trim())||body.email.length>254||typeof body.role!=='string'||typeof body.active!=='boolean'||!Array.isArray(body.vinculos)||body.vinculos.length>filiais.length)throw new ErroApi(400,'USUARIO_INVALIDO');
   const vinculos=body.vinculos;
   if(vinculos.some(v=>!v||Object.keys(v).some(k=>!['filial','vendedor_codigo'].includes(k))||!filiais.includes(v.filial)||(v.vendedor_codigo!==null&&(typeof v.vendedor_codigo!=='string'||!v.vendedor_codigo.trim()||v.vendedor_codigo.length>100)))||new Set(vinculos.map(v=>v.filial)).size!==vinculos.length)throw new ErroApi(400,'VINCULOS_INVALIDOS');
   let hash=null;if(!id||body.senha){try{hash=await hashSenha(body.senha);}catch{throw new ErroApi(400,'SENHA_INVALIDA');}}else if(body.senha!==undefined&&body.senha!=='')throw new ErroApi(400,'SENHA_INVALIDA');
   const c=await pool.connect();try{
    await c.query('BEGIN');await c.query('SELECT tenant_key FROM tenants WHERE tenant_key=$1 FOR UPDATE',[tenant]);
    const atual=(await c.query("SELECT role,active FROM admin_users WHERE id=$1 AND tenant_key=$2",[actor,tenant])).rows[0];if(!atual?.active||atual.role!=='Admin')throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
    if(id===actor)throw new ErroApi(403,'PROPRIO_ACESSO_PROTEGIDO');
    const perfil=(await c.query('SELECT * FROM access_roles WHERE tenant_key=$1 AND role=$2 FOR SHARE',[tenant,body.role])).rows[0];if(!perfil)throw new ErroApi(400,'PERFIL_INVALIDO');
    if(body.active&&!perfil.todas_filiais&&!vinculos.length)throw new ErroApi(400,'FILIAL_OBRIGATORIA');
    if(perfil.somente_proprias_vendas&&vinculos.some(v=>!v.vendedor_codigo))throw new ErroApi(400,'VENDEDOR_OBRIGATORIO');
    for(const v of vinculos){if(v.vendedor_codigo&&!(await dados.query('SELECT 1 FROM operacoes WHERE filial=$1 AND vendedor_codigo=$2 LIMIT 1',[v.filial,v.vendedor_codigo])).rowCount)throw new ErroApi(400,'VENDEDOR_NAO_ENCONTRADO');}
    const userId=id||randomUUID();
    if(id){const r=await c.query('UPDATE admin_users SET email=$3,role=$4,active=$5,password_hash=COALESCE($6,password_hash) WHERE id=$1 AND tenant_key=$2 RETURNING id',[id,tenant,body.email.trim().toLowerCase(),body.role,body.active,hash]);if(!r.rowCount)throw new ErroApi(404,'USUARIO_NAO_ENCONTRADO');}
    else await c.query('INSERT INTO admin_users(id,tenant_key,email,role,active,password_hash) VALUES($1,$2,$3,$4,$5,$6)',[userId,tenant,body.email.trim().toLowerCase(),body.role,body.active,hash]);
    await c.query('DELETE FROM user_branches WHERE user_id=$1 AND tenant_key=$2',[userId,tenant]);for(const v of vinculos)await c.query('INSERT INTO user_branches(user_id,tenant_key,filial,vendedor_codigo) VALUES($1,$2,$3,$4)',[userId,tenant,v.filial,v.vendedor_codigo]);
    await c.query('DELETE FROM admin_sessions WHERE user_id=$1',[userId]);await c.query('COMMIT');return {id:userId};
   }catch(e){await c.query('ROLLBACK');if(e.code==='23505')throw new ErroApi(409,'EMAIL_JA_CADASTRADO');throw e;}finally{c.release();}
  }
 };
}
