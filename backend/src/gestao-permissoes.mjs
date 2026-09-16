import {ErroApi} from './painel.mjs';
export const recursos=[
 {codigo:'produtos:ler',nome:'Consultar produtos e seus indicadores de venda'},
 {codigo:'estoque:ler',nome:'Consultar saldo de estoque'},
 {codigo:'fila:ler',nome:'Consultar Lista da Vez'},
 {codigo:'fila:operar',nome:'Operar atendimentos próprios'},
 {codigo:'fila:gerenciar',nome:'Gerenciar jornada e equipe da fila'},
 {codigo:'fila:relatorios',nome:'Consultar relatórios da fila'},
 {codigo:'indicadores:ler',nome:'Indicadores'},
 {codigo:'vendas:ler',nome:'Movimentações e detalhes'},
 {codigo:'ranking:ler',nome:'Ranking'},
 {codigo:'conferencia:ler',nome:'Conferência'},
 {codigo:'clientes:ler',nome:'Dados dos clientes'},
 {codigo:'imagens:ler',nome:'Fotos dos produtos'},
];
export function validarPerfil(role,body){
 if(role==='Admin')throw new ErroApi(403,'PERFIL_ADMIN_PROTEGIDO');
 const campos=['nome','permissoes','todas_filiais','somente_proprias_vendas'];
 if(Object.keys(body).some(k=>!campos.includes(k))||typeof body.nome!=='string'||!body.nome.trim()||body.nome.trim().length>80||typeof body.todas_filiais!=='boolean'||typeof body.somente_proprias_vendas!=='boolean'||!Array.isArray(body.permissoes)||body.permissoes.some(p=>!recursos.some(r=>r.codigo===p)))throw new ErroApi(400,'PERFIL_INVALIDO');
 const permissoes=[...new Set(body.permissoes)];
 if(permissoes.includes('estoque:ler')&&!permissoes.includes('produtos:ler'))throw new ErroApi(400,'ESTOQUE_REQUER_PRODUTOS');
 if(permissoes.some(p=>['fila:operar','fila:gerenciar','fila:relatorios'].includes(p))&&!permissoes.includes('fila:ler'))throw new ErroApi(400,'FILA_PERMISSAO_DEPENDENTE');
 if(permissoes.includes('fila:gerenciar')&&(!permissoes.includes('fila:operar')||body.somente_proprias_vendas))throw new ErroApi(400,'FILA_GESTAO_INCOMPATIVEL');
 if(['conferencia:ler','clientes:ler','imagens:ler'].some(p=>permissoes.includes(p))&&!permissoes.includes('vendas:ler'))throw new ErroApi(400,'PERMISSAO_DEPENDENTE_DE_VENDAS');
 if(role==='Vendas'&&(!body.somente_proprias_vendas||body.todas_filiais))throw new ErroApi(400,'VENDAS_REQUER_ESCOPO_PROPRIO');
 if(body.somente_proprias_vendas&&body.todas_filiais)throw new ErroApi(400,'ESCOPO_INCOMPATIVEL');
 return {nome:body.nome.trim(),permissoes,todas_filiais:body.todas_filiais,somente_proprias_vendas:body.somente_proprias_vendas};
}
export function criarGestaoPermissoes(pool,tenant){
 return {
  listar:async()=>({recursos,perfis:(await pool.query(`SELECT role,nome,permissoes,todas_filiais,somente_proprias_vendas FROM access_roles WHERE tenant_key=$1 ORDER BY CASE role WHEN 'Admin' THEN 0 WHEN 'Diretoria' THEN 1 WHEN 'Supervisao' THEN 2 WHEN 'Gerentes' THEN 3 WHEN 'Vendas' THEN 4 ELSE 5 END,role`,[tenant])).rows}),
  salvar:async(role,body)=>{
   const p=validarPerfil(role,body);
   const r=await pool.query(`UPDATE access_roles SET nome=$3,permissoes=$4::jsonb,todas_filiais=$5,somente_proprias_vendas=$6 WHERE tenant_key=$1 AND role=$2 AND role<>'Admin' RETURNING role,nome,permissoes,todas_filiais,somente_proprias_vendas`,[tenant,role,p.nome,JSON.stringify(p.permissoes),p.todas_filiais,p.somente_proprias_vendas]);
   if(!r.rowCount)throw new ErroApi(404,'PERFIL_NAO_ENCONTRADO');return r.rows[0];
  },
 };
}
