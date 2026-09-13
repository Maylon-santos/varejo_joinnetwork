import {readFile} from 'node:fs/promises';
// Allowlist fixa: nenhum caminho vindo da requisição acessa o filesystem.
export async function criarFrontend(root=new URL('../../frontend/',import.meta.url)){
 const files=new Map();
 for(const [path,file,type]of [
  ['/','index.html','text/html; charset=utf-8'],
  ['/assets/styles.css','assets/styles.css','text/css; charset=utf-8'],
  ['/assets/app.js','assets/app.js','text/javascript; charset=utf-8'],
  ['/assets/favicon.svg','assets/favicon.svg','image/svg+xml'],
 ])files.set(path,{body:await readFile(new URL(file,root)),type});
 return async(req,res,path)=>{
  const asset=files.get(path);if(!asset||!['GET','HEAD'].includes(req.method))return false;
  res.setHeader('Content-Type',asset.type);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' http: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Length',asset.body.length);res.writeHead(200);res.end(req.method==='HEAD'?undefined:asset.body);return true;
 };
}
