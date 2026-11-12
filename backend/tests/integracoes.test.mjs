import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {cofre,validarAssertion,totp,verificarTotp,chavePublica,hash,assinaturaWebhook} from '../src/integracoes/seguranca.mjs';
import {validarDestino,resolverDestino,ipPublico,resultadoEntrega,proximaTentativa} from '../src/integracoes/destinos.mjs';
import {permitirPessoas,itemDTO} from '../src/integracoes/projecoes.mjs';
import {rotaSegura} from '../src/integracoes/http.mjs';
const crypt=cofre('a1'.repeat(32));
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),pem=publicKey.export({type:'spki',format:'pem'}),now=Date.now();
function jwt(p={},h={}){const parts=[{alg:'RS256',kid:'teste',typ:'JWT',...h},{iss:'int_teste',sub:'int_teste',aud:'https://api.exemplo.com/oauth/token',iat:Math.floor(now/1000),exp:Math.floor(now/1000)+60,jti:randomUUID(),...p}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url'));return parts.join('.')+'.'+sign('RSA-SHA256',Buffer.from(parts.join('.')),privateKey).toString('base64url');}
const verify=s=>validarAssertion(s,{clientId:'int_teste',kid:'teste',publicKey:pem,audience:'https://api.exemplo.com/oauth/token',agora:now});
test('JWT aceita RS256 e rejeita algoritmo, audience, duração, relógio, jti e chaves remotas',()=>{
 assert.ok(verify(jwt()).jti);
 for(const [p,h] of [[{aud:'https://outro'},{}],[{}, {alg:'HS256'}],[{}, {jku:'https://attacker'}],[{}, {jwk:{}}],[{exp:Math.floor(now/1000)+61},{}],[{iat:Math.floor(now/1000)+31},{}],[{jti:'nao-uuid'},{}],[{sub:'outro'},{}],[{exp:1},{}]])assert.throws(()=>verify(jwt(p,h)),e=>e.status===401);
 const altered=jwt().split('.');altered[2]=altered[2].slice(0,10)+'AAAA'+altered[2].slice(14);assert.throws(()=>verify(altered.join('.')));
 assert.throws(()=>chavePublica(privateKey.export({type:'pkcs8',format:'pem'})));
});
test('AES-GCM vincula o contexto e detecta adulteração; cursor é autenticado',()=>{
 const cipher=crypt.cifrar({segredo:'ficticio'},'x');assert.deepEqual(crypt.abrir(cipher,'x'),{segredo:'ficticio'});assert.throws(()=>crypt.abrir(cipher,'y'));cipher[15]^=1;assert.throws(()=>crypt.abrir(cipher,'x'));
 const cursor=crypt.assinar({x:1});assert.deepEqual(crypt.verificar(cursor),{x:1});assert.throws(()=>crypt.verificar(cursor+'x'));assert.equal(hash({b:2,a:1}),hash({a:1,b:2}));
});
test('TOTP segue vetor RFC 6238 e não reutiliza passo já confirmado',()=>{
 const secret=Buffer.from('12345678901234567890').toString('hex');assert.equal(totp(secret,1),'287082');assert.equal(verificarTotp(secret,'287082',-1,59000),1);assert.equal(verificarTotp(secret,'287082',1,59000),null);
});
test('SSRF bloqueia IPs privados, reservados, mapeados e DNS com resposta mista',async()=>{
 for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','100.64.0.1','192.168.1.1','192.0.2.1','198.18.0.1','224.0.0.1','::1','fc00::1','fe80::1','::ffff:8.8.8.8','2002:0808:0808::1','2001:db8::1'])assert.equal(ipPublico(ip),false,ip);
 assert.equal(ipPublico('8.8.8.8'),true);assert.equal(ipPublico('2606:4700:4700::1111'),true);
 for(const s of ['http://recebe.exemplo.com','https://127.0.0.1','https://recebe.exemplo.com:444','https://user:pw@recebe.exemplo.com','https://recebe.exemplo.com/?token=x','https://recebe.exemplo.com/#x','https://recebe.exemplo.com.','https://outro.exemplo.com'])assert.throws(()=>validarDestino(s,['recebe.exemplo.com']),s);
 await assert.rejects(()=>resolverDestino(new URL('https://recebe.exemplo.com'),async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]),e=>e.code==='UNSAFE_DESTINATION');
});
test('retentativas respeitam HTTP, Retry-After, dez tentativas e 72 horas',()=>{
 assert.equal(resultadoEntrega(204),'aceita');assert.equal(resultadoEntrega(302),'reverificar');assert.equal(resultadoEntrega(401),'pausar');assert.equal(resultadoEntrega(410),'desativar');assert.equal(resultadoEntrega(429),'retry');assert.equal(resultadoEntrega(422),'permanente');assert.equal(resultadoEntrega(null),'retry');
 assert.equal(proximaTentativa(10,now),null);assert.equal(proximaTentativa(1,now-73*3600000),null);assert.ok(proximaTentativa(1,now,now,'3600',()=>.5).getTime()>=now+3600000);
});
test('DTOs preservam BigInt, desconto informativo e omitem pessoas sem opt-in',()=>{
 assert.equal(itemDTO({ordem:0,quantidade:3,preco_centavos:'9007199254740993',desconto_informado:'20'}).subtotal_centavos,'27021597764222979');
 const p=permitirPessoas({data:{vendedor:{codigo:'1',nome:'Pessoa fictícia'},clientes:[],cobertura:{pessoas:'disponivel'}},pagamentos:[{historico:'privado',desc_gerador:'privado',origem:'ERP'}]},false);assert.ok(!Object.hasOwn(p.data.vendedor,'nome'));assert.ok(!Object.hasOwn(p.data,'clientes'));assert.equal(p.data.cobertura.pessoas,'restrito');assert.deepEqual(p.pagamentos,[{origem:'ERP'}]);
 assert.ok(assinaturaWebhook('whsec_'+Buffer.alloc(32).toString('base64'),randomUUID(),'1',Buffer.from('{}')).startsWith('v1,'));
 assert.equal(rotaSegura('/v1/vendas/vnd_1_S_123/itens'),'/v1/vendas/{venda_id}/itens');assert.equal(rotaSegura('/segredo?x=1'),'desconhecida');
});
