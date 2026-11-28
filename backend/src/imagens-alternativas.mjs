import sharp from 'sharp';
import {carregarImagemProduto} from './detalhes-erp.mjs';

const ORIGEM='https://ragabesh.joinnetwork.com.br',MAX_BYTES=5*1024*1024;
const normalizar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
async function lerLimitado(response,max){
 if(Number(response.headers.get('content-length'))>max){await response.body?.cancel();throw Error('IMAGEM_LIMITE');}
 const chunks=[];let size=0;
 try{for await(const chunk of response.body){size+=chunk.length;if(size>max)throw Error('IMAGEM_LIMITE');chunks.push(Buffer.from(chunk));}}catch{throw Error('IMAGEM_INDISPONIVEL');}
 return Buffer.concat(chunks);
}
async function validarImagem(asset){
 if(!asset?.body?.length||asset.body.length>MAX_BYTES)throw Error('IMAGEM_INVALIDA');
 const body=await sharp(asset.body,{limitInputPixels:25000000,animated:false}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
 if(body.length>MAX_BYTES)throw Error('IMAGEM_LIMITE');return {type:'image/webp',body};
}
function destinoImagem(image){
 for(const [value,privada] of [[image.downloadUrl,true],[image.url,false]]){
  try{const u=new URL(value);if(u.origin!==ORIGEM||u.username||u.password||u.search||u.hash)continue;
   if(privada?!/^\/api\/integrations\/images\/[A-Za-z0-9_-]+\/file$/.test(u.pathname):!u.pathname.startsWith('/uploads/'))continue;
   return {url:u.href,privada};
  }catch{}
 }return null;
}
// Uma instância por processo/tenant. Nenhuma URL ou credencial da origem é enviada ao navegador.
export function criarImagensProduto({token='',fetchImpl=fetch,agora=Date.now,primaria=carregarImagemProduto}={}){
 const cache=new Map(),pendentes=new Map();let bytes=0,ativos=0,retomarEm=0;const fila=[];
 // A VPS tem memória limitada: downloads podem coexistir, decodificações grandes não.
 let decodificacao=Promise.resolve();
 function converter(asset){const result=decodificacao.then(()=>validarImagem(asset));decodificacao=result.catch(()=>{});return result;}
 async function limitarRede(task){
  if(ativos>=4)await new Promise(resolve=>fila.push(resolve));else ativos++;
  try{return await task();}finally{const proximo=fila.shift();if(proximo)proximo();else ativos--;}
 }
 async function rede(url,privada=false){
  if(agora()<retomarEm)throw Error('IMAGEM_ORIGEM_OCUPADA');
  const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(8000),headers:privada?{Authorization:'Bearer '+token,Accept:'application/json,image/*'}:{Accept:'image/*'}});
  if(response.status===429){
   const value=response.headers.get('retry-after'),segundos=/^\d+$/.test(value??'')?Number(value):(Date.parse(value)-agora())/1000;
   retomarEm=Math.max(retomarEm,agora()+Math.min(3600,Math.max(60,Number.isFinite(segundos)?segundos:60))*1000);
  }return response;
 }
 async function memorizar(key,loader){
  const previous=cache.get(key);if(previous&&previous.ate>agora()){cache.delete(key);cache.set(key,previous);if(previous.value===null)throw Error('IMAGEM_INDISPONIVEL');return previous.value;}
  if(previous){bytes-=previous.size;cache.delete(key);}if(pendentes.has(key))return pendentes.get(key);
  if(pendentes.size>=48)throw Error('IMAGEM_OCUPADA');
  const promise=(async()=>{let value=null;try{value=await loader();return value;}finally{const size=value?.body?.length??Buffer.byteLength(JSON.stringify(value));cache.set(key,{value,size,ate:agora()+(value===null?60000:6*3600000)});bytes+=size;while(cache.size>256||bytes>32*1024*1024){const [old,c]=cache.entries().next().value;bytes-=c.size;cache.delete(old);}pendentes.delete(key);}})();pendentes.set(key,promise);return promise;
 }
 async function alternativa(codigo,item){
  if(!token||typeof codigo!=='string'||! /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(codigo))throw Error('IMAGEM_INDISPONIVEL');
  // `cor` é um ID interno do ERP, nunca compará-lo com códigos comerciais.
  const cor=item.cor_codigo||item.cor_descricao;
  if(!cor&&(item.cor||item.sku))throw Error('IMAGEM_COR_NAO_CONFIRMADA');
  const produto=await memorizar('produto:'+codigo,()=>limitarRede(async()=>{
   const response=await rede(ORIGEM+'/api/integrations/products/'+encodeURIComponent(codigo)+'/images',true);
   if(!response.ok){await response.body?.cancel();throw Error('IMAGEM_INDISPONIVEL');}
   if(!(response.headers.get('content-type')??'').toLowerCase().startsWith('application/json')){await response.body?.cancel();throw Error('IMAGEM_INDISPONIVEL');}
   const data=JSON.parse((await lerLimitado(response,512*1024)).toString());
   if(String(data.code)!==codigo||!Array.isArray(data.colors)||data.colors.length>100)throw Error('IMAGEM_PRODUTO_DIVERGENTE');
   return {colors:data.colors.map(c=>({code:c.code,name:c.name,images:Array.isArray(c.images)?c.images.slice(0,20).map(i=>({url:i.url,downloadUrl:i.downloadUrl,position:i.position})):[]}))};
  }));
  const colors=cor?produto.colors.filter(c=>normalizar(item.cor_codigo?c.code:c.name)===normalizar(cor)):produto.colors;
  if(cor&&colors.length!==1)throw Error('IMAGEM_COR_AMBIGUA');
  const images=colors.flatMap(c=>c.images).sort((a,b)=>(Number.isFinite(a.position)?a.position:999)-(Number.isFinite(b.position)?b.position:999)).slice(0,3);
  for(const image of images){const dest=destinoImagem(image);if(!dest)continue;
   try{return await memorizar('arquivo:'+dest.url,()=>limitarRede(async()=>{const r=await rede(dest.url,dest.privada);if(!r.ok){await r.body?.cancel();throw Error('IMAGEM_INDISPONIVEL');}const type=(r.headers.get('content-type')??'').split(';')[0].toLowerCase();if(!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(type)){await r.body?.cancel();throw Error('IMAGEM_TIPO_INVALIDO');}return converter({body:await lerLimitado(r,MAX_BYTES)});}));}catch{}
  }throw Error('IMAGEM_INDISPONIVEL');
 }
 return async(url,item={})=>memorizar('imagem:'+JSON.stringify([url??null,item.cod_produto??null,item.cor??null,item.sku??null,item.cor_codigo??null,item.cor_descricao??null]),async()=>{
  if(url){try{return await limitarRede(async()=>converter(await primaria(url,{fetchImpl})));}catch{}}
  return alternativa(item.cod_produto,item);
 });
}
