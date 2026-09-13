export async function carregarImagemProduto(url,{fetchImpl=fetch}={}){
 const u=new URL(url);
 // Origem fixa observada no ERP; não aceitar proxy para URLs arbitrárias ou redes locais.
 if(u.hostname!=='aeropostale1.hospedagemdesites.ws'||u.port||u.username||u.password||!['http:','https:'].includes(u.protocol)||!u.pathname.startsWith('/fotosaero/'))throw Error('IMAGEM_ORIGEM_INVALIDA');
 const r=await fetchImpl(u,{redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('IMAGEM_INDISPONIVEL');
 const type=(r.headers.get('content-type')||'').split(';')[0].toLowerCase();
 if(!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(type)){await r.body?.cancel();throw Error('IMAGEM_TIPO_INVALIDO');}
 const max=5*1024*1024;if(Number(r.headers.get('content-length'))>max){await r.body?.cancel();throw Error('IMAGEM_MUITO_GRANDE');}
 const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>max)throw Error('IMAGEM_MUITO_GRANDE');chunks.push(Buffer.from(chunk));}
 return {type,body:Buffer.concat(chunks)};
}
