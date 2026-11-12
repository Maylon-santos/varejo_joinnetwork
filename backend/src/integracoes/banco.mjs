import {randomUUID,randomBytes} from 'node:crypto';
import {Falha,exigir,hash,validarAssertion,ESCOPOS} from './seguranca.mjs';

export async function transacao(pool,executar){
 const db=await pool.connect();try{await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='3s'");const r=await executar(db);await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function identidade(db,tenant){exigir((await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key===tenant,503,'TENANT_UNAVAILABLE');}
export async function limite(db,chave,capacidade,porMinuto){
 const r=await db.query(`INSERT INTO integration_admission(chave,atualizado_em,tokens) VALUES($1,clock_timestamp(),$2-1)
 ON CONFLICT(chave) DO UPDATE SET tokens=LEAST($2,integration_admission.tokens+GREATEST(0,extract(epoch FROM clock_timestamp()-integration_admission.atualizado_em))*$3/60)-1,atualizado_em=clock_timestamp()
 WHERE LEAST($2,integration_admission.tokens+GREATEST(0,extract(epoch FROM clock_timestamp()-integration_admission.atualizado_em))*$3/60)>=1 RETURNING floor(tokens)::int AS restantes`,[chave,capacidade,porMinuto]);
 if(!r.rowCount)throw new Falha(429,'RATE_LIMITED');return r.rows[0].restantes;
}
export function criarIdentidade(pool,tenant,audience,ambiente='homologacao'){
 async function carregar(db,clientId){const r=await db.query('SELECT * FROM integration_clients WHERE client_id=$1 AND tenant_key=$2 AND ambiente=$3',[clientId,tenant,ambiente]);return r.rows[0];}
 return {
  emitir:async(body,ip)=>{
   exigir(body.grant_type==='client_credentials',400,'unsupported_grant_type');
   exigir(body.client_assertion_type==='urn:ietf:params:oauth:client-assertion-type:jwt-bearer'&&typeof body.client_id==='string'&&body.client_id.length<=100,401,'invalid_client');
   // Cota durável de tentativas é confirmada antes da validação criptográfica.
   await transacao(pool,async db=>{await limite(db,'token-ip:'+ip,30,30);await limite(db,'token-client:'+hash(body.client_id),6,6);});
   return transacao(pool,async db=>{
    await identidade(db,tenant);const c=await carregar(db,body.client_id);exigir(c?.estado==='ativo',401,'invalid_client');
    let h;try{h=JSON.parse(Buffer.from(body.client_assertion.split('.')[0],'base64url'));}catch{throw new Falha(401,'invalid_client');}
    exigir(h&&typeof h==='object'&&typeof h.kid==='string'&&h.kid.length<=100,401,'invalid_client');
    const key=(await db.query('SELECT * FROM integration_keys WHERE cliente_id=$1 AND kid=$2 AND ativa AND valida_ate>now()',[c.id,h.kid])).rows[0];exigir(key,401,'invalid_client');
    const p=validarAssertion(body.client_assertion,{clientId:c.client_id,kid:key.kid,publicKey:key.public_key,audience});
    const j=await db.query("INSERT INTO integration_jti VALUES($1,$2,now()+interval '120 seconds') ON CONFLICT DO NOTHING RETURNING jti",[c.id,p.jti]);exigir(j.rowCount,401,'invalid_client');
    const scope=body.scope===undefined?c.escopos:String(body.scope).split(' ');
    exigir(scope.length>0&&scope.every(s=>ESCOPOS.includes(s)&&c.escopos.includes(s)),400,'invalid_scope');
    const token=randomBytes(32).toString('hex');
    await db.query("INSERT INTO integration_tokens VALUES($1,$2,$3,$4,now()+interval '900 seconds')",[hash(token),c.id,key.kid,JSON.stringify(scope)]);
    return {access_token:token,token_type:'Bearer',expires_in:900,scope:scope.join(' ')};
   });
  },
  autenticar:async token=>{
   exigir(/^[a-f0-9]{64}$/.test(token??''),401,'UNAUTHENTICATED');
   const r=await pool.query(`SELECT c.*,t.kid,t.escopos AS token_escopos FROM integration_tokens t JOIN integration_clients c ON c.id=t.cliente_id
    JOIN integration_keys k ON k.cliente_id=c.id AND k.kid=t.kid WHERE t.hash=$1 AND t.expira_em>now() AND c.estado='ativo' AND k.ativa AND k.valida_ate>now() AND c.tenant_key=$2 AND c.ambiente=$3`,[hash(token),tenant,ambiente]);
   const c=r.rows[0];exigir(c,401,'UNAUTHENTICATED');c.escopos=c.escopos.filter(s=>c.token_escopos.includes(s));return c;
  },
  admitir:async(c,ip,mutacao=false)=>{
   const id=randomUUID();const restantes=await transacao(pool,async db=>{
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('integration:admission',0))");
    const r=await limite(db,'client:'+c.id,10,60);await limite(db,'tenant:'+tenant,120,120);await limite(db,'instance',240,240);await limite(db,'ip:'+ip,120,120);
    if(mutacao)await limite(db,'mutation:'+c.id,10,10);
    await db.query('DELETE FROM integration_leases WHERE expira_em<=now()');
    const counts=(await db.query('SELECT count(*)::int total,count(*) FILTER(WHERE cliente_id=$1)::int cliente,count(*) FILTER(WHERE tenant_key=$2)::int tenant FROM integration_leases',[c.id,tenant])).rows[0];
    exigir(counts.total<8&&counts.cliente<2&&counts.tenant<4,429,'CONCURRENCY_LIMIT');
    await db.query("INSERT INTO integration_leases VALUES($1,$2,$3,now()+interval '15 seconds')",[id,c.id,tenant]);return r;
   });
   return {restantes,liberar:()=>pool.query('DELETE FROM integration_leases WHERE id=$1',[id])};
  },
 };
}
export function escopo(c,scope,filial){
 exigir(c.escopos.includes(scope),403,'INSUFFICIENT_SCOPE');
 if(filial!==undefined)exigir(c.filiais.includes(filial),403,'BRANCH_FORBIDDEN');
}
