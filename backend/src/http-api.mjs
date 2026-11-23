import {escopoUsuario,exigirPermissao} from './permissoes.mjs';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {ErroApi,filtros} from './painel.mjs';
export function limitador({limite=120,janelaMs=60000,agora=Date.now}={}){
 const buckets=new Map();
 const aceita=chave=>{
  const now=agora();
  for(const [k,b] of buckets)if(b.ate<=now)buckets.delete(k);
  if(!buckets.has(chave)){
   if(buckets.size>=10000)return false;
   buckets.set(chave,{total:0,ate:now+janelaMs});
  }
  const b=buckets.get(chave);b.total++;return b.total<=limite;
 };
 aceita.retryAfter=chave=>Math.max(1,Math.ceil(((buckets.get(chave)?.ate??agora())-agora())/1000));
 return aceita;
}
function limitarOuFalhar(aceita,chave,codigo='LIMITE_DE_REQUISICOES'){
 if(aceita(chave))return;
 const erro=new ErroApi(429,codigo);erro.retryAfter=aceita.retryAfter?.(chave)??60;throw erro;
}
async function lerJson(req,limite=4096){
 if((req.headers['content-type']??'').split(';')[0]!=='application/json')throw new ErroApi(415,'JSON_OBRIGATORIO');
 const chunks=[];let bytes=0;
 for await(const chunk of req){bytes+=chunk.length;if(bytes>limite)throw new ErroApi(413,'CORPO_MUITO_GRANDE');chunks.push(chunk);}
 try{const v=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!v||typeof v!=='object'||Array.isArray(v))throw new Error();return v;}
 catch{throw new ErroApi(400,'JSON_INVALIDO');}
}
export function criarServidor({auth,painel,filiais,notificacoes,gestaoPermissoes,gestaoUsuarios,funcionarios,reprocessamentos,consolidado,fila,produtos,frontend,imagemProduto,health=async()=>{},log=()=>{},limitar=limitador(),limitarImagens=limitador({limite:240}),limitarEntrada=limitador({limite:1800}),limitarAnonimo=limitador(),limitarLogin=limitador({limite:10,janelaMs:15*60000})}){
 const server=createServer(async(req,res)=>{
  const requestId=randomUUID();
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Request-Id',requestId);
  const enviar=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};
  try{
   const url=new URL(req.url,'http://local');const path=url.pathname;
   if(path==='/health'&&req.method==='GET'){await health();return enviar(200,{status:'ok'});}
   if(frontend&&await frontend(req,res,path))return;
   // Não confiar em IPs/identidades declarados por headers. O teto de entrada
   // protege a autenticação; as cotas funcionais usam a conta já autenticada.
   limitarOuFalhar(limitarEntrada,req.socket.remoteAddress);
   if(path==='/api/v1/auth/login'&&req.method==='POST'){
    limitarOuFalhar(limitarLogin,req.socket.remoteAddress,'LIMITE_DE_LOGIN');
    const body=await lerJson(req);
    if(typeof body.email!=='string'||body.email.length>254||typeof body.senha!=='string'||Buffer.byteLength(body.senha)>256)throw new ErroApi(400,'CREDENCIAIS_INVALIDAS');
    const session=await auth.login(body.email,body.senha);
    if(!session)throw new ErroApi(401,'LOGIN_INVALIDO');
    return enviar(200,session);
   }
   const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization??'')?.[1];
   const user=await auth.autenticar(token);
   if(!user){limitarOuFalhar(limitarAnonimo,req.socket.remoteAddress);throw new ErroApi(401,'NAO_AUTENTICADO');}
   const conta=JSON.stringify([user.tenant_key,user.id]);
   limitarOuFalhar(req.method==='GET'&&/\/(?:imagem|foto)$/.test(path)?limitarImagens:limitar,conta);
   const acesso=escopoUsuario(user,filiais);
   const painelUsuario=painel.restringir(acesso.filiais,acesso.vendedores);
   if(path==='/api/v1/auth/me'&&req.method==='GET')return enviar(200,{usuario:{id:user.id,email:user.email,role:user.role,role_nome:user.role_nome,tenant_key:user.tenant_key,permissoes:acesso.permissoes,filiais:acesso.filiais,somente_proprias_vendas:user.somente_proprias_vendas,notificacoes:!!notificacoes?.disponivel(user)}});
   if(path==='/api/v1/auth/logout'&&req.method==='POST'){await notificacoes?.sair(user,token);await auth.logout(token);return enviar(200,{ok:true});}
   if(path==='/api/v1/notificacoes'||path.startsWith('/api/v1/notificacoes/')){
    if(url.search)throw new ErroApi(400,'PARAMETRO_INVALIDO');
    if(!notificacoes)throw new ErroApi(503,'NOTIFICACOES_INDISPONIVEIS');
    if(path==='/api/v1/notificacoes'&&req.method==='GET')return enviar(200,await notificacoes.status(user,token));
    if(path==='/api/v1/notificacoes/preferencias'&&req.method==='PUT')return enviar(200,await notificacoes.salvarPreferencias(user,await lerJson(req)));
    if(path==='/api/v1/notificacoes/dispositivos'&&req.method==='POST')return enviar(201,await notificacoes.inscrever(user,token,await lerJson(req,7000)));
    const dispositivo=/^\/api\/v1\/notificacoes\/dispositivos\/([a-f0-9-]{36})$/.exec(path);
    if(dispositivo&&req.method==='DELETE')return enviar(200,await notificacoes.desativar(user,dispositivo[1]));
    if(path==='/api/v1/notificacoes/teste'&&req.method==='POST')return enviar(202,await notificacoes.testar(user,token,await lerJson(req)));
    if(path==='/api/v1/notificacoes/historico'&&req.method==='GET')return enviar(200,await notificacoes.historico(user));
    throw new ErroApi(405,'METODO_NAO_PERMITIDO');
   }
   if(path==='/api/v1/crescimento'||path==='/api/v1/consolidado'||path==='/api/v1/metas'||path.startsWith('/api/v1/metas/')){
    if(!['Admin','Diretoria','Supervisao'].includes(user.role))throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
    if(!consolidado)throw new ErroApi(503,'CONSOLIDADO_INDISPONIVEL');
    const meta=/^\/api\/v1\/metas\/(\d+)\/(20\d{2}-\d{2})$/.exec(path);
    if(meta){if(url.search)throw new ErroApi(400,'PARAMETRO_INVALIDO');if(req.method!=='PUT')throw new ErroApi(405,'METODO_NAO_PERMITIDO');return enviar(200,await consolidado.salvarMeta(user,meta[1],meta[2],await lerJson(req),()=>auth.autenticar(token)));}
    if(!['/api/v1/crescimento','/api/v1/consolidado','/api/v1/metas'].includes(path))throw new ErroApi(404,'ROTA_NAO_ENCONTRADA');
    if(req.method!=='GET')throw new ErroApi(405,'METODO_NAO_PERMITIDO');
    const campos=path.endsWith('/crescimento')?['ano','modo','comparacao']:path.endsWith('/metas')?['competencia']:['inicio','fim'];
    for(const k of url.searchParams.keys())if(!campos.includes(k)||url.searchParams.getAll(k).length!==1)throw new ErroApi(400,'PARAMETRO_INVALIDO');
    if(path.endsWith('/crescimento'))return enviar(200,await consolidado.crescimento(user,url.searchParams.get('ano'),url.searchParams.get('modo')??'acumulado',url.searchParams.get('comparacao')??'anterior'));
    return enviar(200,path.endsWith('/metas')?await consolidado.metas(user,url.searchParams.get('competencia')):await consolidado.consultar(user,url.searchParams.get('inicio'),url.searchParams.get('fim')));
   }
   const reprocessar=/^\/api\/v1\/operacoes\/(\d+)\/([A-Z]+)\/(\d+)\/reprocessar$/.exec(path);
   if(reprocessar){
    if(user.role!=='Admin')throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
    if(!reprocessamentos)throw new ErroApi(503,'REPROCESSAMENTO_INDISPONIVEL');
    if(url.search)throw new ErroApi(400,'PARAMETRO_INVALIDO');
    if(req.method==='GET')return enviar(200,await reprocessamentos.ler(user,...reprocessar.slice(1)));
    if(req.method==='POST')return enviar(202,await reprocessamentos.solicitar(user,...reprocessar.slice(1),await lerJson(req)));
    throw new ErroApi(405,'METODO_NAO_PERMITIDO');
   }
   if(path==='/api/v1/funcionarios'){
    if(!funcionarios)throw new ErroApi(503,'GESTAO_INDISPONIVEL');
    if(req.method!=='GET')throw new ErroApi(405,'METODO_NAO_PERMITIDO');
    if([...url.searchParams.keys()].some(k=>k!=='filial')||url.searchParams.getAll('filial').length!==1)throw new ErroApi(400,'PARAMETRO_INVALIDO');
    return enviar(200,await funcionarios.listar(user,url.searchParams.get('filial')));
   }
   const fotoVendedor=/^\/api\/v1\/funcionarios\/(\d+)\/([^/]+)\/foto$/.exec(path);
   if(fotoVendedor){
    if(!funcionarios)throw new ErroApi(503,'GESTAO_INDISPONIVEL');
    if(url.search)throw new ErroApi(400,'PARAMETRO_INVALIDO');
    const filial=fotoVendedor[1],codigo=decodeURIComponent(fotoVendedor[2]);
    if(req.method==='GET'){const bytes=await funcionarios.foto(user,filial,codigo);res.setHeader('Content-Type','image/jpeg');res.setHeader('Content-Length',bytes.length);res.writeHead(200);return res.end(bytes);}
    if(user.role!=='Admin')throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
    if(req.method==='PUT')return enviar(200,await funcionarios.salvar(user,filial,codigo,await lerJson(req,2800000),()=>auth.autenticar(token)));
    if(req.method==='DELETE')return enviar(200,await funcionarios.remover(user,filial,codigo));
    throw new ErroApi(405,'METODO_NAO_PERMITIDO');
   }
   const usuarios=/^\/api\/v1\/acessos\/usuarios(?:\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}))?$/.exec(path);
   if(usuarios||path==='/api/v1/acessos/vendedores'){
    if(user.role!=='Admin')throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
    if(!gestaoUsuarios)throw new ErroApi(503,'GESTAO_INDISPONIVEL');
    if(url.search)throw new ErroApi(400,'PARAMETRO_INVALIDO');
    if(path.endsWith('/vendedores')&&req.method==='GET')return enviar(200,await gestaoUsuarios.vendedores());
    if(usuarios){if(req.method==='GET'&&!usuarios[1])return enviar(200,await gestaoUsuarios.listar());
     if((req.method==='POST'&&!usuarios[1])||(req.method==='PUT'&&usuarios[1]))return enviar(req.method==='POST'?201:200,await gestaoUsuarios.salvar(usuarios[1]||null,await lerJson(req),user.id));}
    throw new ErroApi(405,'METODO_NAO_PERMITIDO');
   }
   const perfil=/^\/api\/v1\/acessos\/perfis(?:\/([A-Za-z0-9_-]+))?$/.exec(path);
   if(perfil){
    if(user.role!=='Admin')throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
    if(!gestaoPermissoes)throw new ErroApi(503,'GESTAO_INDISPONIVEL');
    if(url.search)throw new ErroApi(400,'PARAMETRO_INVALIDO');
    if(req.method==='GET'&&!perfil[1])return enviar(200,await gestaoPermissoes.listar());
    if(req.method==='PUT'&&perfil[1])return enviar(200,await gestaoPermissoes.salvar(perfil[1],await lerJson(req)));
    throw new ErroApi(405,'METODO_NAO_PERMITIDO');
   }
   if(path==='/api/v1/fila/relatorio'){
    if(!fila)throw new ErroApi(503,'FILA_INDISPONIVEL');
    if(req.method!=='GET')throw new ErroApi(405,'METODO_NAO_PERMITIDO');
    for(const k of url.searchParams.keys())if(!['filial','inicio','fim','vendedor','pagina'].includes(k)||url.searchParams.getAll(k).length!==1)throw new ErroApi(400,'PARAMETRO_INVALIDO');
    return enviar(200,await fila.relatorio(user,Object.fromEntries(url.searchParams)));
   }
   if(path==='/api/v1/fila'){
    if(!fila)throw new ErroApi(503,'FILA_INDISPONIVEL');
    if(req.method==='GET'){
     for(const k of url.searchParams.keys())if(!['filial','dia'].includes(k)||url.searchParams.getAll(k).length!==1)throw new ErroApi(400,'PARAMETRO_INVALIDO');
     return enviar(200,await fila.ler(user,url.searchParams.get('filial'),url.searchParams.get('dia')));
    }
    if(req.method==='POST'){if(url.search)throw new ErroApi(400,'PARAMETRO_INVALIDO');return enviar(200,await fila.executar(user,await lerJson(req),()=>auth.autenticar(token)));}
    throw new ErroApi(405,'METODO_NAO_PERMITIDO');
   }
   if(['/api/v1/produtos','/api/v1/produtos/indicadores','/api/v1/produtos/top','/api/v1/produtos/resumo-estoque','/api/v1/produtos/detalhe'].includes(path)){
    if(req.method!=='GET')throw new ErroApi(405,'METODO_NAO_PERMITIDO');
    if(!produtos)throw new ErroApi(503,'PRODUTOS_INDISPONIVEIS');
    const metodo=path.endsWith('/detalhe')?'detalhe':path.endsWith('/top')?'top':path.endsWith('/resumo-estoque')?'resumoEstoque':path.endsWith('/indicadores')?'indicadores':'listar';
    const campos={top:['filial','inicio','fim','ordenar'],detalhe:['filial','inicio','fim','chave','pagina'],resumoEstoque:['filial'],indicadores:['filial','inicio','fim','busca','pagina'],listar:['filial','busca','pagina','saldo','tipo_prod']}[metodo];
    for(const k of url.searchParams.keys())if(!campos.includes(k)||url.searchParams.getAll(k).length!==1)throw new ErroApi(400,'PARAMETRO_INVALIDO');
    return enviar(200,await produtos[metodo](user,url.searchParams));
   }
   if(req.method!=='GET')throw new ErroApi(405,'METODO_NAO_PERMITIDO');
   if(path==='/api/v1/filiais')return enviar(200,await painelUsuario.filiais());
   const cliente=/^\/api\/v1\/operacoes\/([^/]+)\/([^/]+)\/([^/]+)\/cliente$/.exec(path);
   if(cliente){
    exigirPermissao(acesso.permissoes,'vendas:ler');exigirPermissao(acesso.permissoes,'clientes:ler');
    const d=await painelUsuario.detalhe(cliente[1],cliente[2],cliente[3]);
    return enviar(200,{clientes:d.operacao.clientes,importados_em:d.operacao.clientes_importados_em});
   }
   const imagemCatalogo=/^\/api\/v1\/produtos\/(\d+)\/(\d+)\/imagem$/.exec(path);
   if(imagemCatalogo){
    if(!produtos?.imagem||!imagemProduto)throw new ErroApi(404,'IMAGEM_INDISPONIVEL');
    for(const k of url.searchParams.keys())if(k!=='sku'||url.searchParams.getAll(k).length!==1)throw new ErroApi(400,'PARAMETRO_INVALIDO');
    const item=await produtos.imagem(user,new URLSearchParams({filial:imagemCatalogo[1],produto:imagemCatalogo[2],sku:url.searchParams.get('sku')??''}));
    let asset;try{asset=await imagemProduto(item.imagem_url,item);}catch{throw new ErroApi(404,'IMAGEM_INDISPONIVEL');}
    res.setHeader('Content-Type',asset.type);res.setHeader('Content-Length',asset.body.length);res.writeHead(200);res.end(asset.body);return;
   }
   const imagem=/^\/api\/v1\/operacoes\/([^/]+)\/([^/]+)\/([^/]+)\/itens\/(\d+)\/imagem$/.exec(path);
   if(imagem){
    exigirPermissao(acesso.permissoes,'vendas:ler');exigirPermissao(acesso.permissoes,'imagens:ler');
    const d=await painelUsuario.detalhe(imagem[1],imagem[2],imagem[3]);
    const item=d.itens.find(i=>i.ordem===Number(imagem[4]));
    if(!item||(!item.imagem_url&&!item.cod_produto)||!imagemProduto)throw new ErroApi(404,'IMAGEM_INDISPONIVEL');
    let asset;try{asset=await imagemProduto(item.imagem_url,item);}catch{throw new ErroApi(502,'IMAGEM_INDISPONIVEL');}
    res.setHeader('Content-Type',asset.type);res.setHeader('Content-Length',asset.body.length);res.writeHead(200);res.end(asset.body);return;
   }
   const detalhe=/^\/api\/v1\/operacoes\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(path);
   if(detalhe){
    exigirPermissao(acesso.permissoes,'vendas:ler');
    const d=await painelUsuario.detalhe(detalhe[1],detalhe[2],detalhe[3]);
    if(!acesso.permissoes.includes('clientes:ler')){delete d.operacao.clientes;delete d.operacao.clientes_importados_em;if(d.operacao.complementos?.lancamentos)for(const l of d.operacao.complementos.lancamentos){delete l.desc_gerador;delete l.historico;}}
    if(!acesso.permissoes.includes('imagens:ler'))for(const item of d.itens)delete item.imagem_url;
    return enviar(200,d);
   }
   if(!['/api/v1/indicadores','/api/v1/vendas','/api/v1/ranking','/api/v1/clientes'].includes(path))throw new ErroApi(404,'ROTA_NAO_ENCONTRADA');
   exigirPermissao(acesso.permissoes,path.split('/').at(-1)+':ler');
   if(url.searchParams.has('conciliacao'))exigirPermissao(acesso.permissoes,'conferencia:ler');
   const permitidos=new Set(['filial','inicio','fim','pagina','limite',...(path.endsWith('/vendas')?['tipo','estado','conciliacao']:[]),...(path.endsWith('/ranking')?['ordenar']:[]),...(path.endsWith('/clientes')?['busca','mes']:[])]);
   for(const k of url.searchParams.keys())if(!permitidos.has(k)||url.searchParams.getAll(k).length!==1)throw new ErroApi(400,'PARAMETRO_INVALIDO');
   const f=filtros(url.searchParams,acesso.filiais);
   if(path.endsWith('/indicadores'))return enviar(200,await painelUsuario.indicadores(f));
   if(path.endsWith('/vendas'))return enviar(200,await painelUsuario.vendas(f,{tipo:url.searchParams.get('tipo')??'S',estado:url.searchParams.get('estado')??'ativas',conciliacao:url.searchParams.get('conciliacao')}));
   if(path.endsWith('/clientes')){exigirPermissao(acesso.permissoes,'clientes:ler');exigirPermissao(acesso.permissoes,'vendas:ler');return enviar(200,await painelUsuario.clientes(f,url.searchParams.get('busca')??'',url.searchParams.get('mes')??''));}
   return enviar(200,await painelUsuario.ranking(f,url.searchParams.get('ordenar')??'valor'));
  }catch(error){
   const status=error instanceof ErroApi?error.status:500;
   if(status===500)log({evento:'api_erro',requestId,codigo:'ERRO_INTERNO'});
   if(status===429)res.setHeader('Retry-After',String(error.retryAfter??60));
   if(!res.headersSent&&!res.destroyed)enviar(status,{erro:status===500?'ERRO_INTERNO':error.message,request_id:requestId});
  }
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return server;
}
