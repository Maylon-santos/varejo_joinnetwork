import test from 'node:test';
import assert from 'node:assert/strict';
import {generateVAPIDKeys} from 'web-push';
import {randomBytes,createECDH} from 'node:crypto';
import {EventEmitter} from 'node:events';
import ece from 'http_ece';
import {validarEndpoint,validarInscricao,validarPreferencias,instanteLocal,payloadResumo,escopoResumo} from '../src/notificacoes-regras.mjs';
import {criarTransportePush} from '../src/notificacoes-transporte.mjs';
const keys=generateVAPIDKeys(),sub={endpoint:'https://web.push.apple.com/teste-sintetico',keys:{p256dh:keys.publicKey,auth:randomBytes(16).toString('base64url')}};
test('inscrição aceita só serviços de push e chaves P-256 válidas',()=>{
 assert.equal(validarInscricao({...sub,expirationTime:null}).endpoint,sub.endpoint);
 for(const endpoint of ['http://web.push.apple.com/x','https://web.push.apple.com.evil.example/x','https://127.0.0.1/x','https://example.com/x','https://x@web.push.apple.com/x','https://web.push.apple.com:444/x','https://web.push.apple.com/x#hash'])assert.throws(()=>validarEndpoint(endpoint));
 for(const endpoint of ['https://fcm.googleapis.com/fcm/send/x','https://updates.push.services.mozilla.com/wpush/v2/x'])assert.ok(validarEndpoint(endpoint));
 assert.throws(()=>validarInscricao({...sub,keys:{...sub.keys,p256dh:Buffer.alloc(65,4).toString('base64url')}}));assert.throws(()=>validarInscricao({...sub,keys:{...sub.keys,auth:'AAAA'}}));
});
test('preferências exigem opt-in, filiais autorizadas e não liberam metas ou pessoas',()=>{
 assert.deepEqual(validarPreferencias({resumo_diario:false,filiais:[]},['1']),{resumo_diario:false,filiais:[]});
 for(const body of [{resumo_diario:true,filiais:[]},{resumo_diario:true,filiais:['2']},{resumo_diario:true,filiais:['1','1']},{resumo_diario:true,filiais:['1'],metas:true}])assert.throws(()=>validarPreferencias(body,['1']));
 const user={id:'a',tenant_key:'teste',role:'Gerentes',permissoes:['indicadores:ler'],vinculos:[{filial:'1'}]};assert.deepEqual(escopoResumo(user,'teste',['1','2'],['a']),['1']);assert.equal(escopoResumo({...user,somente_proprias_vendas:true},'teste',['1'],['a']),null);assert.equal(escopoResumo(user,'outro',['1'],['a']),null);assert.equal(escopoResumo(user,'teste',['1'],['b']),null);
});
test('resumo usa centavos e PA por venda, zero e valores negativos sem perder precisão',()=>{
 const r={nome:'Itupeva sintética',filial:'1',dia:'2026-11-23',vendas:28,pecas:'95',valor_centavos:'1421658',atualizado:true};
 const p=payloadResumo(r);assert.match(p.body,/95 peças/);assert.match(p.body,/14\.216,58/);assert.match(p.body,/PA: 3,39/);assert.match(p.body,/507,74/);assert.match(p.url,/filial=1&dia=2026-11-23/);
 assert.match(payloadResumo({...r,vendas:0,pecas:'0',valor_centavos:'0'}).body,/PA: — · Ticket médio: —/);
 assert.match(payloadResumo({...r,vendas:2,valor_centavos:'-301'}).body,/Ticket médio: − R\$ 1,51/);
 const parcial=payloadResumo({...r,atualizado:false,ultimo_sucesso:'2026-11-23T23:00:00Z'});assert.match(parcial.title,/parcial/);assert.match(parcial.body,/Coleta em atualização/);
});
test('horário da agenda segue São Paulo e preserva a data comercial ao cruzar UTC',()=>{
 assert.deepEqual(instanteLocal(new Date('2026-11-24T01:05:00Z')),{dia:'2026-11-23',hora:'22:05'});assert.deepEqual(instanteLocal(new Date('2026-11-24T02:59:00Z')),{dia:'2026-11-23',hora:'23:59'});
});
test('transporte bloqueia DNS privado mesmo em domínio aprovado, sem chamada HTTP',async()=>{
 const enviar=criarTransportePush({...keys,subject:'https://aeropostale.joinnetwork.com.br',lookup:async()=>[{address:'127.0.0.1',family:4}]});
 await assert.rejects(()=>enviar(sub,{title:'Teste'}),/PUSH_DNS_REJEITADO/);
 assert.throws(()=>criarTransportePush({...keys,privateKey:generateVAPIDKeys().privateKey,subject:'https://aeropostale.joinnetwork.com.br'}),/PUSH_CONFIGURACAO_INVALIDA/);
});
test('transporte cifra o payload real, assina VAPID e fixa DNS/TLS sem redirecionar',async()=>{
 const receiver=generateVAPIDKeys(),auth=randomBytes(16).toString('base64url'),s={endpoint:sub.endpoint,keys:{p256dh:receiver.publicKey,auth}};let options,body;
 const enviar=criarTransportePush({...keys,subject:'https://aeropostale.joinnetwork.com.br',lookup:async()=>[{address:'17.249.40.1',family:4}],requisitar:(_url,o,cb)=>{
  options=o;const req=new EventEmitter();req.end=b=>{body=b;cb({statusCode:201,headers:{},destroy(){}});};return req;
 }});
 const payload={title:'Teste sintético',body:'Somente o aparelho decifra este texto'};assert.equal((await enviar(s,payload,{ttl:120,topic:'a'.repeat(32)})).status,201);
 assert.equal(options.rejectUnauthorized,true);assert.equal(options.servername,'web.push.apple.com');assert.equal(options.headers.TTL,120);assert.match(options.headers.Authorization,/vapid/);assert.ok(!body.toString().includes(payload.body));
 const privateKey=createECDH('prime256v1');privateKey.setPrivateKey(Buffer.from(receiver.privateKey,'base64url'));
 assert.deepEqual(JSON.parse(ece.decrypt(body,{version:'aes128gcm',privateKey,authSecret:Buffer.from(auth,'base64url')}).toString()),payload);
 options.lookup('web.push.apple.com',{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,'17.249.40.1');assert.equal(family,4);});
});
