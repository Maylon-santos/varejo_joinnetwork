import {createHash,createHmac,createCipheriv,createDecipheriv,randomBytes,createPublicKey,verify,timingSafeEqual,constants} from 'node:crypto';

export const ESCOPOS=['vendas:ler','vendas:pessoas:ler','filiais:ler','produtos:ler','estoques:ler','webhooks:ler','webhooks:gerenciar'];
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export class Falha extends Error {
 constructor(status,code){super(code);this.status=status;this.code=code;}
}
export function exigir(condicao,status=400,code='INVALID_REQUEST'){if(!condicao)throw new Falha(status,code);}
export function canonico(v){
 if(Array.isArray(v))return '['+v.map(canonico).join(',')+']';
 if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonico(v[k])).join(',')+'}';
 return JSON.stringify(v);
}
export const hash=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:canonico(v)).digest('hex');
export function cofre(chave){
 exigir(typeof chave==='string'&&/^[a-f0-9]{64}$/i.test(chave),503,'ENCRYPTION_KEY_REQUIRED');
 const key=Buffer.from(chave,'hex');
 return {
  cifrar(v,contexto){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(contexto));return Buffer.concat([iv,c.update(JSON.stringify(v)),c.final(),c.getAuthTag()]);},
  abrir(bytes,contexto){const b=Buffer.from(bytes),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAAD(Buffer.from(contexto));d.setAuthTag(b.subarray(-16));return JSON.parse(Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8'));},
  assinar(v){const b=Buffer.from(JSON.stringify(v)).toString('base64url');return b+'.'+createHmac('sha256',key).update('cursor:'+b).digest('base64url');},
  verificar(s){
   exigir(typeof s==='string'&&s.length<=4096,400,'INVALID_CURSOR');const [b,sig,...rest]=s.split('.');
   const real=createHmac('sha256',key).update('cursor:'+b).digest('base64url');
   exigir(!rest.length&&typeof sig==='string'&&sig.length===real.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(real)),400,'INVALID_CURSOR');
   try{return JSON.parse(Buffer.from(b,'base64url'));}catch{throw new Falha(400,'INVALID_CURSOR');}
  },
 };
}
export function chavePublica(pem){
 exigir(typeof pem==='string'&&pem.length<=12000&&pem.startsWith('-----BEGIN PUBLIC KEY-----'),422,'INVALID_PUBLIC_KEY');
 let key;try{key=createPublicKey(pem);}catch{throw new Falha(422,'INVALID_PUBLIC_KEY');}
 exigir(key.asymmetricKeyType==='rsa'&&key.asymmetricKeyDetails.modulusLength>=2048&&key.asymmetricKeyDetails.modulusLength<=8192,422,'INVALID_PUBLIC_KEY');return key;
}
export function validarAssertion(jwt,{clientId,kid,publicKey,audience,agora=Date.now()}){
 try{
  exigir(typeof jwt==='string'&&jwt.length<=16384,401,'invalid_client');
  const parts=jwt.split('.');exigir(parts.length===3&&parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)),401,'invalid_client');
  const h=JSON.parse(Buffer.from(parts[0],'base64url')),p=JSON.parse(Buffer.from(parts[1],'base64url'));
  exigir(h.alg==='RS256'&&h.kid===kid&&!h.jku&&!h.x5u&&!h.jwk&&!h.crit&&(!h.typ||h.typ==='JWT'),401,'invalid_client');
  const now=Math.floor(agora/1000);
  exigir(p.iss===clientId&&p.sub===clientId&&p.aud===audience&&Number.isSafeInteger(p.iat)&&Number.isSafeInteger(p.exp)&&p.exp>p.iat&&p.exp-p.iat<=60&&p.iat<=now+30&&p.iat>=now-90&&p.exp>now-30&&(!p.nbf||Number.isSafeInteger(p.nbf)&&p.nbf<=now+30)&&UUID.test(p.jti),401,'invalid_client');
  exigir(verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),{key:chavePublica(publicKey),padding:constants.RSA_PKCS1_PADDING},Buffer.from(parts[2],'base64url')),401,'invalid_client');return p;
 }catch{throw new Falha(401,'invalid_client');}
}
export function assinaturaWebhook(secret,id,timestamp,body){return 'v1,'+createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(id+'.'+timestamp+'.').update(body).digest('base64');}
export const novoSegredo=()=>'whsec_'+randomBytes(32).toString('base64');
export const etag=(id,versao)=>'"'+id+':'+versao+'"';
export function validarEscopos(escopos){
 exigir(Array.isArray(escopos)&&escopos.length>0&&new Set(escopos).size===escopos.length&&escopos.every(s=>ESCOPOS.includes(s)),422,'INVALID_SCOPE');
 exigir(!escopos.some(s=>s==='vendas:pessoas:ler'||s.startsWith('webhooks:'))||escopos.includes('vendas:ler'),422,'INVALID_SCOPE');return [...escopos].sort();
}
export function totp(secret,passo){
 const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(passo));const h=createHmac('sha1',Buffer.from(secret,'hex')).update(b).digest(),o=h[19]&15;
 return String((h.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,'0');
}
export function verificarTotp(secret,codigo,ultimo=-1,agora=Date.now()){
 if(!/^\d{6}$/.test(codigo??''))return null;
 const n=Math.floor(agora/30000);
 for(const p of [n,n-1,n+1])if(p>Number(ultimo)&&timingSafeEqual(Buffer.from(codigo),Buffer.from(totp(secret,p))))return p;
 return null;
}
