import sharp from 'sharp';
import {ErroApi} from './painel.mjs';
import {escopoUsuario} from './permissoes.mjs';
export async function prepararFoto(bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>2*1024*1024)throw new ErroApi(400,'FOTO_INVALIDA');
 try{
  const img=sharp(bytes,{limitInputPixels:20000000,failOn:'warning'}),meta=await img.metadata();
  if(!['jpeg','png','webp'].includes(meta.format)||(meta.pages??1)!==1)throw Error();
  const out=await img.rotate().resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
  if(out.length>524288)throw Error();return out;
 }catch{throw new ErroApi(400,'FOTO_INVALIDA');}
}
export function criarFuncionarios(pool,tenant,filiais){
 async function autorizar(user,filial,escrita=false){
  if(user.tenant_key!==tenant||(await pool.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw new ErroApi(403,'TENANT_INCORRETO');
  const acesso=escopoUsuario(user,filiais);
  if(!acesso.filiais.includes(filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
  if(escrita?user.role!=='Admin':user.role!=='Admin'&&!acesso.permissoes.some(p=>['ranking:ler','fila:ler'].includes(p)))throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
  return acesso;
 }
 async function vendedor(filial,codigo){
  if(typeof codigo!=='string'||!codigo||codigo.length>100)throw new ErroApi(400,'VENDEDOR_INVALIDO');
  if(!(await pool.query('SELECT 1 FROM operacoes WHERE filial=$1 AND vendedor_codigo=$2 LIMIT 1',[filial,codigo])).rowCount)throw new ErroApi(404,'VENDEDOR_NAO_ENCONTRADO');
 }
 return {
  listar:async(user,filial)=>{
   await autorizar(user,filial,true);
   return {vendedores:(await pool.query(`SELECT DISTINCT ON(o.vendedor_codigo) o.vendedor_codigo,o.vendedor_nome,f.atualizado_em AS foto_atualizada_em FROM operacoes o LEFT JOIN vendedor_fotos f USING(filial,vendedor_codigo) WHERE o.filial=$1 AND NULLIF(o.vendedor_codigo,'') IS NOT NULL ORDER BY o.vendedor_codigo,o.data_operacao DESC,o.cod_operacao DESC`,[filial])).rows};
  },
  foto:async(user,filial,codigo)=>{
   const a=await autorizar(user,filial);if(a.vendedores!==null&&a.vendedores[filial]!==codigo)throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
   await vendedor(filial,codigo);const r=(await pool.query('SELECT imagem FROM vendedor_fotos WHERE filial=$1 AND vendedor_codigo=$2',[filial,codigo])).rows[0];
   if(!r)throw new ErroApi(404,'FOTO_NAO_ENCONTRADA');return r.imagem;
  },
  salvar:async(user,filial,codigo,body,reautenticar)=>{
   await autorizar(user,filial,true);await vendedor(filial,codigo);
   if(!body||Object.keys(body).length!==1||typeof body.imagem!=='string'||body.imagem.length>2796204||Buffer.from(body.imagem,'base64').toString('base64')!==body.imagem)throw new ErroApi(400,'FOTO_INVALIDA');
   const bytes=await prepararFoto(Buffer.from(body.imagem,'base64'));
   const atual=await reautenticar();if(!atual||atual.id!==user.id)throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');await autorizar(atual,filial,true);
   await pool.query('INSERT INTO vendedor_fotos(filial,vendedor_codigo,imagem,atualizado_por) VALUES($1,$2,$3,$4) ON CONFLICT(filial,vendedor_codigo) DO UPDATE SET imagem=EXCLUDED.imagem,atualizado_em=now(),atualizado_por=EXCLUDED.atualizado_por',[filial,codigo,bytes,user.id]);return {ok:true};
  },
  remover:async(user,filial,codigo)=>{await autorizar(user,filial,true);await vendedor(filial,codigo);await pool.query('DELETE FROM vendedor_fotos WHERE filial=$1 AND vendedor_codigo=$2',[filial,codigo]);return {ok:true};}
 };
}
