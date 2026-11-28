import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {criarImagensProduto} from '../src/imagens-alternativas.mjs';

const origem='https://ragabesh.joinnetwork.com.br',principal='https://aeropostale1.hospedagemdesites.ws/fotosaero/exemplo.png';
const png=await sharp({create:{width:8,height:6,channels:3,background:'#123456'}}).png().toBuffer();
const foto=()=>new Response(png,{headers:{'Content-Type':'image/png'}});
const dados=(code='CAM',images=[{downloadUrl:origem+'/api/integrations/images/exemplo/file',position:0}])=>({code,colors:[{code:'AZ',name:'Azul',images}]});
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const indisponivel=async()=>{throw Error('ORIGEM_INDISPONIVEL');};

test('imagem principal válida tem prioridade, é decodificada e não recebe a chave alternativa',async()=>{
 const calls=[];const carregar=criarImagensProduto({token:'segredo-sintetico',fetchImpl:async(url,options)=>{calls.push({url:String(url),options});return foto();}});
 const asset=await carregar(principal,{cod_produto:'CAM'});assert.equal(asset.type,'image/webp');assert.equal((await sharp(asset.body).metadata()).width,8);
 assert.equal(calls.length,1);assert.equal(calls[0].url,principal);assert.equal(calls[0].options.headers?.Authorization,undefined);assert.equal(calls[0].options.redirect,'error');
 await carregar(principal,{cod_produto:'CAM'});assert.equal(calls.length,1);
});

test('ausência, erro HTTP e conteúdo corrompido na origem principal acionam a segunda base',async()=>{
 for(const modo of ['ausente','http','corrompido']){
  const calls=[];const carregar=criarImagensProduto({token:'segredo-sintetico',fetchImpl:async(url,options)=>{
   const path=new URL(url).pathname;calls.push({path,options});
   if(path.startsWith('/fotosaero/'))return modo==='http'?new Response(null,{status:404}):new Response('invalido',{headers:{'Content-Type':'image/jpeg'}});
   return path.includes('/products/')?json(dados()):foto();
  }});
  const asset=await carregar(modo==='ausente'?null:principal,{cod_produto:'CAM',cor_descricao:'azul'});assert.equal(asset.type,'image/webp');
  assert.equal(calls.filter(c=>c.path.includes('/products/')).length,1);assert.equal(calls.filter(c=>c.path.includes('/images/exemplo/')).length,1);
  for(const call of calls.filter(c=>c.path.startsWith('/api/')))assert.equal(call.options.headers.Authorization,'Bearer segredo-sintetico');
 }
});

test('metadados e arquivos compartilhados são consultados uma vez entre solicitações simultâneas',async()=>{
 let consultas=0;const carregar=criarImagensProduto({token:'teste',fetchImpl:async url=>{consultas++;await new Promise(r=>setTimeout(r,2));return String(url).includes('/products/')?json(dados()):foto();}});
 const results=await Promise.all(Array.from({length:12},()=>carregar(null,{cod_produto:'CAM'})));assert.equal(consultas,2);assert.ok(results.every(r=>r.body.equals(results[0].body)));
 await carregar(null,{cod_produto:'CAM',cor_codigo:'AZ'});assert.equal(consultas,2);
});

test('falhas têm cache curto, expiram e permitem uma nova tentativa',async()=>{
 let tempo=0,consultas=0;const carregar=criarImagensProduto({token:'teste',agora:()=>tempo,fetchImpl:async()=>{consultas++;return new Response(null,{status:401});}});
 await assert.rejects(carregar(null,{cod_produto:'CAM'}));await assert.rejects(carregar(null,{cod_produto:'CAM'}));assert.equal(consultas,1);
 tempo=61000;await assert.rejects(carregar(null,{cod_produto:'CAM'}));assert.equal(consultas,2);
});

test('seleção por cor exige correspondência e não usa imagem de outro produto',async()=>{
 let arquivos=0;const data=dados();data.colors.push({code:'VM',name:'Vermelho',images:[{url:origem+'/uploads/vermelho.png',position:0}]});
 const carregar=criarImagensProduto({token:'teste',fetchImpl:async url=>{if(String(url).includes('/products/'))return json(data);arquivos++;assert.ok(String(url).endsWith('/vermelho.png'));return foto();}});
 await carregar(null,{cod_produto:'CAM',cor_descricao:'Vermelho'});assert.equal(arquivos,1);
 await assert.rejects(carregar(null,{cod_produto:'CAM',cor_descricao:'Verde'}));assert.equal(arquivos,1);
 const outro=criarImagensProduto({token:'teste',fetchImpl:async()=>json(dados('OUTRO'))});await assert.rejects(outro(null,{cod_produto:'CAM'}));
});

test('URLs externas, credenciais embutidas e redirecionamentos não recebem a chave',async()=>{
 for(const url of ['http://127.0.0.1/segredo','https://outro.example/uploads/a.png',origem+'/api/admin',origem+'/uploads/a.png?token=x','https://usuario:senha@ragabesh.joinnetwork.com.br/uploads/a.png']){
  let calls=0;const carregar=criarImagensProduto({token:'teste',fetchImpl:async()=>{calls++;return json(dados('CAM',[{url,downloadUrl:url}]));}});
  await assert.rejects(carregar(null,{cod_produto:'CAM'}));assert.equal(calls,1);
 }
 let calls=0;const carregar=criarImagensProduto({token:'teste',fetchImpl:async(url,options)=>{calls++;assert.equal(options.redirect,'error');if(String(url).includes('/products/'))return json(dados('CAM',[{url:origem+'/uploads/foto.png'}]));assert.equal(options.headers.Authorization,undefined);return foto();}});
 await carregar(null,{cod_produto:'CAM'});assert.equal(calls,2);
});

test('código inseguro ou token ausente não fazem requisições à segunda base',async()=>{
 for(const token of ['', 'teste'])for(const code of ['../admin','A/B','',null]){
  const carregar=criarImagensProduto({token,fetchImpl:async()=>assert.fail('Não deve consultar')});await assert.rejects(carregar(null,{cod_produto:code}));
 }
 const carregar=criarImagensProduto({fetchImpl:async()=>assert.fail('Sem token')});await assert.rejects(carregar(null,{cod_produto:'CAM'}));
});

test('arquivo inválido tenta a próxima foto; limites de tipo e tamanho são respeitados',async()=>{
 for(const erro of ['tipo','tamanho','corrompido']){
  let arquivos=0;const carregar=criarImagensProduto({token:'teste',fetchImpl:async url=>{
   if(String(url).includes('/products/'))return json(dados('CAM',[{url:origem+'/uploads/primeira.png',position:0},{url:origem+'/uploads/segunda.png',position:1}]));
   arquivos++;if(arquivos===2)return foto();
   return erro==='tipo'?new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}}):erro==='tamanho'?new Response(png,{headers:{'Content-Type':'image/png','Content-Length':String(6*1024*1024)}}):new Response('invalida',{headers:{'Content-Type':'image/png'}});
  }});assert.equal((await carregar(null,{cod_produto:'CAM'})).type,'image/webp');assert.equal(arquivos,2);
 }
});

test('consultas de diferentes produtos limitam a concorrência de rede a quatro',async()=>{
 let ativos=0,maximo=0;const carregar=criarImagensProduto({token:'teste',primaria:indisponivel,fetchImpl:async url=>{
  ativos++;maximo=Math.max(maximo,ativos);await new Promise(r=>setTimeout(r,3));ativos--;
  const code=new URL(url).pathname.split('/')[4];return String(url).includes('/products/')?json(dados(code,[{url:origem+'/uploads/'+code+'.png'}])):foto();
 }});
 await Promise.all(Array.from({length:12},(_,i)=>carregar(null,{cod_produto:'P'+i})));assert.equal(maximo,4);
});

test('ID interno não é código comercial; cor confirmada mantém zeros e cache por variante',async()=>{
 let downloads=0;const data=dados();data.colors=[
  {code:'000078',name:'Creme',images:[{url:origem+'/uploads/creme.png'}]},
  {code:'78',name:'Outra cor',images:[{url:origem+'/uploads/outra.png'}]}
 ];
 const carregar=criarImagensProduto({token:'teste',fetchImpl:async url=>{
  if(String(url).includes('/products/'))return json(data);downloads++;assert.ok(String(url).endsWith('/creme.png'));return foto();
 }});
 await assert.rejects(carregar(null,{cod_produto:'CAM',sku:'SKU',cor:'2000000'}),/COR_NAO_CONFIRMADA/);
 await carregar(null,{cod_produto:'CAM',sku:'SKU',cor:'2000000',cor_codigo:'000078'});assert.equal(downloads,1);
 await assert.rejects(carregar(null,{cod_produto:'CAM',sku:'SKU',cor:'2000000',cor_codigo:'999',cor_descricao:'Creme'}));assert.equal(downloads,1);
 await assert.rejects(carregar(null,{cod_produto:'CAM',sku:'SKU'}));
 const duplicado=criarImagensProduto({token:'teste',fetchImpl:async()=>json({...data,colors:[data.colors[0],data.colors[0]]})});
 await assert.rejects(duplicado(null,{cod_produto:'CAM',cor_codigo:'000078'}),/COR_AMBIGUA/);
});
test('429 da alternativa respeita Retry-After entre produtos e não impede a fonte principal',async()=>{
 let tempo=0,calls=0;
 const carregar=criarImagensProduto({token:'teste',agora:()=>tempo,primaria:async()=>({body:png}),fetchImpl:async()=>{calls++;return new Response(null,{status:429,headers:{'Retry-After':'120'}});}});
 await assert.rejects(carregar(null,{cod_produto:'A'}));
 await assert.rejects(carregar(null,{cod_produto:'B'}));assert.equal(calls,1);
 assert.equal((await carregar(principal,{cod_produto:'C'})).type,'image/webp');
 tempo=121000;await assert.rejects(carregar(null,{cod_produto:'D'}));assert.equal(calls,2);
});
