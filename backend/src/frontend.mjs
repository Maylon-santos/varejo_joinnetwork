import {readFile} from 'node:fs/promises';
// Allowlist fixa: nenhum caminho vindo da requisição acessa o filesystem.
export async function criarFrontend(root=new URL('../../frontend/',import.meta.url)){
 const files=new Map();
 for(const [path,file,type]of [
  ['/','index.html','text/html; charset=utf-8'],
  ['/assets/styles.css','assets/styles.css','text/css; charset=utf-8'],
  ['/assets/app.js','assets/app.js','text/javascript; charset=utf-8'],
  ['/assets/crescimento.js','assets/crescimento.js','text/javascript; charset=utf-8'],
  ['/assets/metas-crescimento.js','assets/metas-crescimento.js','text/javascript; charset=utf-8'],
  ['/assets/evolucao.js','assets/evolucao.js','text/javascript; charset=utf-8'],
  ['/assets/navegacao.js','assets/navegacao.js','text/javascript; charset=utf-8'],
  ['/assets/favicon.svg','assets/favicon.svg','image/svg+xml'],
  ['/assets/notificacoes.js','assets/notificacoes.js','text/javascript; charset=utf-8'],
  ['/assets/notificacoes.css','assets/notificacoes.css','text/css; charset=utf-8'],
  ['/sw.js','sw.js','text/javascript; charset=utf-8'],
  ['/manifest.webmanifest','manifest.webmanifest','application/manifest+json; charset=utf-8'],
  ['/assets/app-icon-192.png','assets/app-icon-192.png','image/png'],
  ['/assets/app-icon-512.png','assets/app-icon-512.png','image/png'],
  ['/assets/apple-touch-icon.png','assets/apple-touch-icon.png','image/png'],
 ])files.set(path,{body:await readFile(new URL(file,root)),type});
 return async(req,res,path)=>{
  const asset=files.get(path);if(!asset||!['GET','HEAD'].includes(req.method))return false;
  if(path==='/sw.js')res.setHeader('Service-Worker-Allowed','/');
  res.setHeader('Content-Type',asset.type);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Length',asset.body.length);res.writeHead(200);res.end(req.method==='HEAD'?undefined:asset.body);return true;
 };
}
