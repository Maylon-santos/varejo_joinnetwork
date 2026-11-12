import {BlockList,isIP} from 'node:net';
import {lookup as dnsLookup} from 'node:dns/promises';
import {request} from 'node:https';
import {exigir,Falha} from './seguranca.mjs';

const bloqueados=new BlockList();
for(const [rede,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]])bloqueados.addSubnet(rede,bits,'ipv4');
for(const [rede,bits] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])bloqueados.addSubnet(rede,bits,'ipv6');
const v6global=new BlockList();v6global.addSubnet('2000::',3,'ipv6');
export function ipPublico(ip){const family=isIP(ip);return family===4?!bloqueados.check(ip,'ipv4'):family===6&&v6global.check(ip,'ipv6')&&!bloqueados.check(ip,'ipv6');}
export function validarDestino(value,hosts){
 exigir(typeof value==='string'&&value.length<=2048,422,'INVALID_DESTINATION');let u;try{u=new URL(value);}catch{throw new Falha(422,'INVALID_DESTINATION');}
 exigir(u.protocol==='https:'&&(!u.port||u.port==='443')&&!u.username&&!u.password&&!u.search&&!u.hash&&!isIP(u.hostname)&&!u.hostname.endsWith('.')&&/^[a-z0-9.-]+$/.test(u.hostname)&&hosts.includes(u.hostname),422,'DESTINATION_NOT_APPROVED');return u;
}
export async function resolverDestino(url,lookup=dnsLookup){
 const addresses=await lookup(url.hostname,{all:true,verbatim:true});
 exigir(addresses.length>0&&addresses.length<=32&&addresses.every(a=>ipPublico(a.address)&&isIP(a.address)===a.family),422,'UNSAFE_DESTINATION');return addresses;
}
export async function enviarSeguro({url,hosts,headers,body,lookup=dnsLookup}){
 const inicio=performance.now(),u=validarDestino(url,hosts);let dnsTimer,addresses;
 try{addresses=await Promise.race([resolverDestino(u,lookup),new Promise((_,reject)=>{dnsTimer=setTimeout(()=>reject(new Error('DELIVERY_TIMEOUT')),3000);})]);}finally{clearTimeout(dnsTimer);}
 const a=addresses[0],restante=Math.max(1,10000-Math.ceil(performance.now()-inicio));
 return new Promise((resolve,reject)=>{
  let done=false;
  const timer=setTimeout(()=>req.destroy(new Error('DELIVERY_TIMEOUT')),restante);
  const finish=(err,result)=>{if(done)return;done=true;clearTimeout(timer);if(err)reject(new Error(err.message==='DELIVERY_TIMEOUT'?'DELIVERY_TIMEOUT':'DELIVERY_TRANSPORT'));else resolve({...result,duracao_ms:Math.round(performance.now()-inicio)});};
  // Nunca resolver novamente no socket. Host/SNI e verificação de certificado continuam sendo o hostname original.
  const req=request(u,{method:'POST',agent:false,rejectUnauthorized:true,servername:u.hostname,lookup:(_host,options,cb)=>cb(null,options.all?[a]:a.address,a.family),headers:{...headers,'Content-Type':'application/json','Content-Length':body.length,'User-Agent':'Varejo-Webhooks/1.0'},signal:AbortSignal.timeout(restante)},res=>{
   const result={status:res.statusCode,retryAfter:res.headers['retry-after']??null};res.destroy();finish(null,result);
  });
  req.on('error',err=>finish(err));req.end(body);
 });
}
export function resultadoEntrega(status){
 if(status>=200&&status<300)return 'aceita';
 if(status===401||status===403)return 'pausar';if(status===410)return 'desativar';if(status>=300&&status<400)return 'reverificar';
 if(status===null||[408,425,429].includes(status)||status>=500)return 'retry';return 'permanente';
}
const agenda=[0,60,300,900,3600,10800,21600,43200,86400,172800];
export function proximaTentativa(tentativas,criado,agora=Date.now(),retryAfter=null,random=Math.random){
 if(tentativas>=10||agora-criado>=72*3600000)return null;
 const nominal=criado+agenda[tentativas]*1000,anterior=agenda[tentativas-1]*1000;
 let proxima=Math.max(agora+1000,nominal+(agenda[tentativas]*1000-anterior)*(random()*.4-.2));
 if(retryAfter){let ms=/^\d+$/.test(String(retryAfter))?Number(retryAfter)*1000:Date.parse(retryAfter)-agora;if(Number.isFinite(ms))proxima=Math.max(proxima,agora+Math.min(3600000,Math.max(0,ms)));}
 return new Date(Math.min(proxima,criado+72*3600000));
}
