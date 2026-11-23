import * as webpush from 'web-push';
import {createECDH} from 'node:crypto';
import {request} from 'node:https';
import {lookup as dnsLookup} from 'node:dns/promises';
import {ipPublico} from './integracoes/destinos.mjs';
import {validarEndpoint,validarInscricao} from './notificacoes-regras.mjs';

// O destino vem do aparelho, mas só serviços de push conhecidos podem receber
// tráfego. Resolver uma vez e fixar o endereço no socket impede DNS rebinding.
export function criarTransportePush({publicKey,privateKey,subject,lookup=dnsLookup,requisitar=request}){
 const key=createECDH('prime256v1');key.setPrivateKey(Buffer.from(privateKey,'base64url'));
 if(key.getPublicKey().toString('base64url')!==publicKey)throw Error('PUSH_CONFIGURACAO_INVALIDA');
 webpush.getVapidHeaders('https://web.push.apple.com',subject,publicKey,privateKey,'aes128gcm');
 return async(inscricao,payload,{ttl=600,topic}={})=>{
  validarInscricao(inscricao);const url=validarEndpoint(inscricao.endpoint);
  let timer,addresses;
  try{addresses=await Promise.race([lookup(url.hostname,{all:true,verbatim:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('PUSH_DNS_TIMEOUT')),2500);})]);}finally{clearTimeout(timer);}
  if(!addresses?.length||addresses.length>32||!addresses.every(a=>ipPublico(a.address)))throw Error('PUSH_DNS_REJEITADO');
  const detalhes=webpush.generateRequestDetails(inscricao,JSON.stringify(payload),{TTL:Math.min(1800,Math.max(1,ttl)),topic,urgency:'normal',vapidDetails:{subject,publicKey,privateKey}}),a=addresses[0];
  return new Promise((resolve,reject)=>{
   const req=requisitar(url,{method:'POST',agent:false,rejectUnauthorized:true,servername:url.hostname,lookup:(_host,options,cb)=>cb(null,options.all?[a]:a.address,a.family),headers:detalhes.headers,signal:AbortSignal.timeout(7000)},res=>{
    const resultado={status:res.statusCode,retryAfter:res.headers['retry-after']??null};res.destroy();resolve(resultado);
   });
   // Nunca retornar URL, headers, chaves ou corpo do serviço de push em erros.
   req.on('error',()=>reject(Error('PUSH_TRANSPORTE_INCERTO')));req.end(detalhes.body);
  });
 };
}
