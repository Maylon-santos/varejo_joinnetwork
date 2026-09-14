import {ErroApi} from './painel.mjs';
export function escopoUsuario(user,autorizadas){
 const permissoes=Array.isArray(user?.permissoes)?user.permissoes:[];
 const vinculos=Array.isArray(user?.vinculos)?user.vinculos:[];
 const filiais=(user?.role==='Admin'||(user?.todas_filiais&&!user?.somente_proprias_vendas))?[...autorizadas]:autorizadas.filter(f=>vinculos.some(v=>String(v.filial)===f));
 const vendedores=user?.somente_proprias_vendas?Object.fromEntries(vinculos.filter(v=>filiais.includes(String(v.filial))).map(v=>[String(v.filial),v.vendedor_codigo??''])):null;
 return {filiais,vendedores,permissoes};
}
export function exigirPermissao(permissoes,recurso){if(!permissoes.includes(recurso))throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');}
