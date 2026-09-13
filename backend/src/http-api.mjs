import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {ErroApi,filtros} from './painel.mjs';
export function limitador({limite=120,janelaMs=60000,agora=Date.now}={}){
 const buckets=new Map();
 return chave=>{
  const now=agora();
  for(const [k,b] of buckets)if(b.ate<=now)buckets.delete(k);
  if(!buckets.has(chave)){
   if(buckets.size>=10000)return false;
   buckets.set(chave,{total:0,ate:now+janelaMs});
  }
  const b=buckets.get(chave);b.total++;return b.total<=limite;
 };
}
async function lerJson(req){
 if((req.headers['content-type']??'').split(';')[0]!=='application/json')throw new ErroApi(415,'JSON_OBRIGATORIO');
 const chunks=[];let bytes=0;
 for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)throw new ErroApi(413,'CORPO_MUITO_GRANDE');chunks.push(chunk);}
 try{const v=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!v||typeof v!=='object'||Array.isArray(v))throw new Error();return v;}
 catch{throw new ErroApi(400,'JSON_INVALIDO');}
}
export function criarServidor({auth,painel,filiais,frontend,health=async()=>{},log=()=>{},limitar=limitador(),limitarLogin=limitador({limite:10,janelaMs:15*60000})}){
 const server=createServer(async(req,res)=>{
  const requestId=randomUUID();
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Request-Id',requestId);
  const enviar=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};
  try{
   const url=new URL(req.url,'http://local');const path=url.pathname;
   if(path==='/health'&&req.method==='GET'){await health();return enviar(200,{status:'ok'});}
   if(frontend&&await frontend(req,res,path))return;
   if(!limitar(req.socket.remoteAddress))throw new ErroApi(429,'LIMITE_DE_REQUISICOES');
   if(path==='/api/v1/auth/login'&&req.method==='POST'){
    if(!limitarLogin(req.socket.remoteAddress))throw new ErroApi(429,'LIMITE_DE_LOGIN');
    const body=await lerJson(req);
    if(typeof body.email!=='string'||body.email.length>254||typeof body.senha!=='string'||Buffer.byteLength(body.senha)>256)throw new ErroApi(400,'CREDENCIAIS_INVALIDAS');
    const session=await auth.login(body.email,body.senha);
    if(!session)throw new ErroApi(401,'LOGIN_INVALIDO');
    return enviar(200,session);
   }
   const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization??'')?.[1];
   const user=await auth.autenticar(token);
   if(!user||user.role!=='Admin')throw new ErroApi(401,'NAO_AUTENTICADO');
   if(path==='/api/v1/auth/me'&&req.method==='GET')return enviar(200,{usuario:user});
   if(path==='/api/v1/auth/logout'&&req.method==='POST'){await auth.logout(token);return enviar(200,{ok:true});}
   if(req.method!=='GET')throw new ErroApi(405,'METODO_NAO_PERMITIDO');
   if(path==='/api/v1/filiais')return enviar(200,await painel.filiais());
   const detalhe=/^\/api\/v1\/operacoes\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(path);
   if(detalhe)return enviar(200,await painel.detalhe(detalhe[1],detalhe[2],detalhe[3]));
   if(!['/api/v1/indicadores','/api/v1/vendas','/api/v1/ranking'].includes(path))throw new ErroApi(404,'ROTA_NAO_ENCONTRADA');
   const permitidos=new Set(['filial','inicio','fim','pagina','limite',...(path.endsWith('/vendas')?['tipo','estado','conciliacao']:[]),...(path.endsWith('/ranking')?['ordenar']:[])]);
   for(const k of url.searchParams.keys())if(!permitidos.has(k)||url.searchParams.getAll(k).length!==1)throw new ErroApi(400,'PARAMETRO_INVALIDO');
   const f=filtros(url.searchParams,filiais);
   if(path.endsWith('/indicadores'))return enviar(200,await painel.indicadores(f));
   if(path.endsWith('/vendas'))return enviar(200,await painel.vendas(f,{tipo:url.searchParams.get('tipo')??'S',estado:url.searchParams.get('estado')??'ativas',conciliacao:url.searchParams.get('conciliacao')}));
   return enviar(200,await painel.ranking(f,url.searchParams.get('ordenar')??'valor'));
  }catch(error){
   const status=error instanceof ErroApi?error.status:500;
   if(status===500)log({evento:'api_erro',requestId,codigo:'ERRO_INTERNO'});
   if(status===429)res.setHeader('Retry-After','60');
   if(!res.headersSent&&!res.destroyed)enviar(status,{erro:status===500?'ERRO_INTERNO':error.message,request_id:requestId});
  }
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return server;
}
