import test from 'node:test';
import assert from 'node:assert/strict';
import {criarFrontend} from '../src/frontend.mjs';
test('Frontend publica apenas assets conhecidos, com CSP e sem acesso a arquivos privados',async()=>{
 const servir=await criarFrontend();const headers={};let body,status;
 const res={setHeader:(k,v)=>headers[k]=v,writeHead:s=>status=s,end:b=>body=b};
 assert.equal(await servir({method:'GET'},res,'/'),true);assert.equal(status,200);assert.match(headers['Content-Type'],/text\/html/);assert.match(headers['Content-Security-Policy'],/script-src 'self'/);assert.match(body.toString(),/login-form/);
 for(const path of ['/.env','/assets/../../.env','/scripts/api.mjs','/docs/validacao-api.json'])assert.equal(await servir({method:'GET'},res,path),false);
 assert.equal(await servir({method:'POST'},res,'/'),false);
});
