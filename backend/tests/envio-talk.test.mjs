import test from 'node:test';import assert from 'node:assert/strict';
import {enviarArquivoTalk,validarDestinoTalk} from '../src/envio-talk.mjs';
const destino={url:'https://apitalk.joinnetwork.com.br/api/messages/send',token:'token-sintetico',numero:'5511999999999'};
test('Talk envia CSV multipart só ao número configurado e sem seguir redirecionamento',async()=>{
 const bytes=new TextEncoder().encode('data;valor\r\n2026-10-01;1.00\r\n');
 const r=await enviarArquivoTalk({...destino,nome:'faturamento_diario_2026.csv',bytes,legenda:'Teste sintético',fetchImpl:async(url,options)=>{
  assert.equal(url,destino.url);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+destino.token);
  assert.deepEqual([...options.body.keys()],['number','body','medias']);assert.equal(options.body.get('number'),destino.numero);
  assert.equal(options.body.get('medias').name,'faturamento_diario_2026.csv');assert.equal(await options.body.get('medias').text(),new TextDecoder().decode(bytes));
  return new Response('{"message":"ok"}',{status:200,headers:{'content-type':'application/json'}});
 }});assert.deepEqual(r,{aceito_api:true,http_status:200});
});
test('Talk bloqueia destino inválido, arquivo externo, falha HTTP e recusa lógica',async()=>{
 for(const config of [{...destino,url:'https://outro.example/send'},{...destino,numero:'5511999999999,5521999999999'}])assert.throws(()=>validarDestinoTalk(config));
 const dados={...destino,nome:'teste.csv',bytes:new Uint8Array([1]),legenda:'Teste'};
 await assert.rejects(enviarArquivoTalk({...dados,nome:'../teste.csv'}),/ARQUIVO_INVALIDO/);
 await assert.rejects(enviarArquivoTalk({...dados,fetchImpl:async()=>new Response('',{status:401})}),/TALK_HTTP_401/);
 await assert.rejects(enviarArquivoTalk({...dados,fetchImpl:async()=>new Response('{"success":false}',{status:200,headers:{'content-type':'application/json'}})}),/ENVIO_RECUSADO/);
});
