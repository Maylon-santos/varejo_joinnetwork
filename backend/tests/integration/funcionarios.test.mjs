import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {ambienteFila} from '../fixtures/fila.mjs';
const request=async(e,path,{role='admin',method='GET',body}={})=>fetch(e.base+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+e.tokens[role],...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
test('fotos: upload Admin, leitura autorizada, isolamento de filial/vendedor, substituição, remoção e rejeição de arquivos',async()=>{
 const e=await ambienteFila();try{
  const image=await sharp({create:{width:600,height:800,channels:3,background:'#ccddff'}}).jpeg().toBuffer(),body={imagem:image.toString('base64')};
  const path='/funcionarios/1/10/foto';
  assert.equal((await request(e,'/funcionarios?filial=1')).status,200);
  assert.equal((await request(e,'/funcionarios?filial=1',{role:'leitor'})).status,403);
  assert.equal((await request(e,'/funcionarios?filial=999')).status,403);
  assert.equal((await request(e,path,{method:'PUT',body,role:'vendas'})).status,403);
  assert.equal((await request(e,'/funcionarios/1/inexistente/foto',{method:'PUT',body})).status,404);
  assert.equal((await request(e,path,{method:'PUT',body:{imagem:Buffer.from('<svg></svg>').toString('base64')}})).status,400);
  assert.equal((await request(e,path,{method:'PUT',body:{imagem:'!invalido'}})).status,400);
  assert.equal((await request(e,path,{method:'PUT',body:{imagem:'a'.repeat(2800001)}})).status,413);
  assert.equal((await request(e,path,{method:'PUT',body})).status,200);
  const read=await request(e,path,{role:'vendas'});assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'no-store');
  const meta=await sharp(Buffer.from(await read.arrayBuffer())).metadata();assert.equal(meta.format,'jpeg');assert.equal(meta.height,512);assert.ok(!meta.exif);
  assert.equal((await request(e,'/funcionarios/2/10/foto')).status,404);
  assert.equal((await request(e,'/funcionarios/999/10/foto')).status,403);
  assert.equal((await request(e,'/funcionarios/1/20/foto',{method:'PUT',body})).status,200);
  assert.equal((await request(e,'/funcionarios/1/20/foto',{role:'vendas'})).status,403);
  assert.equal((await request(e,path,{method:'PUT',body})).status,200);
  assert.equal((await e.pool.query('SELECT count(*)::int AS n FROM vendedor_fotos WHERE filial=1 AND vendedor_codigo=\'10\'')).rows[0].n,1);
  assert.equal((await request(e,path,{method:'DELETE',role:'leitor'})).status,403);
  assert.equal((await request(e,path,{method:'DELETE'})).status,200);assert.equal((await request(e,path)).status,404);
 }finally{await e.close();}
});
