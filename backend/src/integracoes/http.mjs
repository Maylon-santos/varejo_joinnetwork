import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Falha,exigir,hash} from './seguranca.mjs';
import {criarIdentidade,transacao,limite} from './banco.mjs';
import {criarConsultas} from './consultas.mjs';
import {criarWebhooks} from './webhooks.mjs';

async function lerCorpo(req,form=false){
 const tipo=(req.headers['content-type']??'').split(';')[0];exigir(tipo===(form?'application/x-www-form-urlencoded':'application/json'),415,'UNSUPPORTED_MEDIA_TYPE');
 exigir(!req.headers['content-encoding']||req.headers['content-encoding']==='identity',415,'UNSUPPORTED_ENCODING');
 if(req.headers['content-length'])exigir(Number(req.headers['content-length'])<=65536,413,'REQUEST_TOO_LARGE');
 const chunks=[];let bytes=0;for await(const chunk of req.iterator({destroyOnReturn:false})){bytes+=chunk.length;exigir(bytes<=65536,413,'REQUEST_TOO_LARGE');chunks.push(chunk);}
 const raw=Buffer.concat(chunks).toString('utf8');
 if(form){const p=new URLSearchParams(raw);for(const k of p.keys())exigir(['grant_type','client_id','scope','client_assertion_type','client_assertion'].includes(k)&&p.getAll(k).length===1,400,'invalid_request');return Object.fromEntries(p);}
 try{const v=JSON.parse(raw);exigir(v&&typeof v==='object'&&!Array.isArray(v),400,'INVALID_JSON');return v;}catch{throw new Falha(400,'INVALID_JSON');}
}
export function rotaSegura(path){
 if(path==='/oauth/token'||path==='/health'||path==='/admin/integracoes/step-up')return path;
 if(path.startsWith('/admin/integracoes/clientes/'))return path.includes('/chaves/')?'/admin/integracoes/clientes/{id}/chaves/{kid}':'/admin/integracoes/clientes/{id}';
 if(['/admin/integracoes/clientes','/admin/integracoes/acessos','/admin/integracoes/auditoria','/admin/integracoes/entregas','/admin/integracoes/metricas','/admin/integracoes/webhooks'].includes(path))return path;
 if(/^\/v1\/vendas\/[^/]+(?:\/(?:itens|pagamentos))?$/.test(path))return '/v1/vendas/{venda_id}'+(path.endsWith('/itens')?'/itens':path.endsWith('/pagamentos')?'/pagamentos':'');
 if(/^\/v1\/produtos\/[^/]+(?:\/variacoes)?$/.test(path))return '/v1/produtos/{produto_id}'+(path.endsWith('/variacoes')?'/variacoes':'');
 if(/^\/v1\/filiais\/[^/]+\/estoques\/[^/]+$/.test(path))return '/v1/filiais/{filial_id}/estoques/{sku}';
 if(/^\/v1\/filiais\/[^/]+$/.test(path))return '/v1/filiais/{filial_id}';
 if(/^\/v1\/webhooks\/[^/]+(?:\/(?:testes|rotacionar-segredo|entregas)(?:\/[^/]+\/reenviar)?)?$/.test(path))return '/v1/webhooks/{webhook_id}'+(path.endsWith('/reenviar')?'/entregas/{entrega_id}/reenviar':path.endsWith('/testes')?'/testes':path.endsWith('/rotacionar-segredo')?'/rotacionar-segredo':path.endsWith('/entregas')?'/entregas':'');
 return ['/v1/vendas','/v1/filiais','/v1/produtos','/v1/estoques','/v1/alteracoes','/v1/webhooks'].includes(path)?path:'desconhecida';
}
export function criarApiIntegracoes({pool,tenant,cofre,filiais,audience,ambiente='homologacao',administracao,proxyConfiavel=[],log=()=>{}}){
 const identidade=criarIdentidade(pool,tenant,audience,ambiente),consultas=criarConsultas(pool,tenant,cofre,filiais),webhooks=criarWebhooks(pool,cofre,consultas);
 let auditoriasPendentes=0,ultimoAlerta=0,descartados=0;
 const server=createServer({maxHeaderSize:16384},async(req,res)=>{
  const requestId=randomUUID(),iniciado=new Date(),start=performance.now();let cliente=null,codigo=null,rota='desconhecida',canal='api_externa',bytes=0,admissao=null,filial=null,auditado=false;
  const peer=req.socket.remoteAddress??'desconhecido';
  const forwarded=req.headers['x-real-ip'];const ip=proxyConfiavel.includes(peer)&&typeof forwarded==='string'&&forwarded.length<=45?forwarded:peer;
  const ipHash=hash(ip);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Request-Id',requestId);res.setHeader('Pragma','no-cache');
  const finalizar=()=>{
   if(auditado)return;auditado=true;admissao?.liberar().catch(()=>log({evento:'integration_lease_release_failed',request_id:requestId}));
   if(rota==='/health')return;
   const duracao=Math.max(0,Math.round(performance.now()-start)),status=res.writableFinished?res.statusCode:499;
   if(auditoriasPendentes>=32){descartados++;if(Date.now()-ultimoAlerta>=60000){log({evento:'integration_audit_backpressure',request_id:requestId,descartados});ultimoAlerta=Date.now();descartados=0;}return;}
   auditoriasPendentes++;
   const agent=/Firefox|Chrome|Safari|curl|node|python/i.exec(String(req.headers['user-agent']??'').slice(0,200))?.[0].toLowerCase()??'outro';
   pool.query('INSERT INTO integration_access_logs VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[requestId,iniciado,duracao,cliente?.id??null,tenant,canal,req.method,rota,filial,status,codigo,bytes,status<400?'permitida':status===401?'nao_autenticada':'negada',ipHash,agent,cliente?.kid??null]).catch(()=>log({evento:'integration_audit_failed',request_id:requestId})).finally(()=>{auditoriasPendentes--;});
  };
  res.once('finish',finalizar);res.once('close',finalizar);
  const enviar=(status,body,tag)=>{
   const raw=JSON.stringify(body);exigir(Buffer.byteLength(raw)<=2*1024*1024,422,'RESPONSE_TOO_LARGE');bytes=Buffer.byteLength(raw);if(tag)res.setHeader('ETag',tag);res.writeHead(status);res.end(raw);
  };
  try{
   const url=new URL(req.url,'http://local'),path=url.pathname;rota=rotaSegura(path);canal=path==='/oauth/token'?'autenticacao':path.startsWith('/admin/integracoes')?'administracao':'api_externa';
   if(path==='/health'&&req.method==='GET'){await pool.query('SELECT 1');return enviar(200,{status:'ok'});}
   await transacao(pool,async db=>{await limite(db,'preauth-instance',60,240);await limite(db,'preauth-ip:'+ipHash,120,120);});
   if(path==='/oauth/token'){
    canal='autenticacao';exigir(req.method==='POST',405,'METHOD_NOT_ALLOWED');exigir(!url.search,400,'invalid_request');const body=await lerCorpo(req,true),result=await identidade.emitir(body,ipHash);cliente=await identidade.autenticar(result.access_token);return enviar(200,result);
   }
   if(path==='/admin/integracoes/console'&&req.method==='GET'&&administracao){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");const html=await readFile(new URL('../../../frontend/integracoes/index.html',import.meta.url));bytes=html.length;res.writeHead(200);return res.end(html);
   }
   if(['/admin/integracoes/console.js','/admin/integracoes/console.css'].includes(path)&&req.method==='GET'&&administracao){const ext=path.endsWith('.js')?'js':'css';res.setHeader('Content-Type',ext==='js'?'text/javascript; charset=utf-8':'text/css; charset=utf-8');const asset=await readFile(new URL('../../../frontend/integracoes/console.'+ext,import.meta.url));bytes=asset.length;res.writeHead(200);return res.end(asset);}
   if(path.startsWith('/admin/integracoes')){
    canal='administracao';exigir(administracao,404,'NOT_FOUND');const result=await administracao(req,path,url.searchParams,req.method==='GET'?null:await lerCorpo(req));return enviar(result.status,result.body,result.etag);
   }
   const bearer=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization??'')?.[1];cliente=await identidade.autenticar(bearer);
   admissao=await identidade.admitir(cliente,ipHash,req.method!=='GET');res.setHeader('X-RateLimit-Limit','60');res.setHeader('X-RateLimit-Remaining',String(admissao.restantes));res.setHeader('X-RateLimit-Reset',String(Math.floor(Date.now()/1000)+60));
   if(req.headers.accept)exigir(req.headers.accept.split(',').some(a=>['*/*','application/json','application/*'].includes(a.trim().split(';')[0])),406,'NOT_ACCEPTABLE');
   if(path==='/v1/webhooks'||path.startsWith('/v1/webhooks/')){const result=await webhooks(cliente,req.method,path,url.searchParams,req.headers,req.method==='GET'?null:await lerCorpo(req),requestId);return enviar(result.status,result.body,result.etag);}
   exigir(req.method==='GET',405,'METHOD_NOT_ALLOWED');exigir(rota!=='desconhecida'&&path.startsWith('/v1/'),404,'NOT_FOUND');
   const result=path==='/v1/alteracoes'?{body:await consultas.alteracoes(cliente,url.searchParams,requestId)}:await consultas.consultar(cliente,path,url.searchParams,req.headers,requestId);
   const branch=url.searchParams.get('filial_id');filial=cliente.filiais.includes(branch)?branch:result.body.data?.filial_id??null;
   await pool.query('UPDATE integration_clients SET ultimo_acesso_em=now() WHERE id=$1',[cliente.id]);return enviar(200,result.body,result.etag);
  }catch(err){
   const status=err instanceof Falha?err.status:503;codigo=err instanceof Falha?err.code:'SERVICE_UNAVAILABLE';if(status===429||status===503)res.setHeader('Retry-After','60');if(status===401&&canal!=='autenticacao')res.setHeader('WWW-Authenticate','Bearer');
   if(status===413)res.setHeader('Connection','close');
   if(canal==='autenticacao'){return enviar(status,{error:['invalid_client','invalid_scope','unsupported_grant_type'].includes(codigo)?codigo:status===429||status>=500?'temporarily_unavailable':'invalid_request',error_description:status>=500?'Serviço indisponível.':'Não foi possível emitir o token.'});}
   res.setHeader('Content-Type','application/problem+json; charset=utf-8');return enviar(status,{type:'urn:varejo:problema:'+codigo.toLowerCase(),title:status>=500?'Serviço temporariamente indisponível':'Solicitação não atendida',status,detail:status===410?'O cursor expirou. Reinicie a sincronização.':'Consulte o código de erro e o contrato da API.',instance:'urn:uuid:'+requestId,code:codigo,request_id:requestId});
  }
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.timeout=10000;server.maxRequestsPerSocket=100;server.maxConnections=64;return server;
}
