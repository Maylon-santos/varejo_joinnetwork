import {erroSeguro} from './postgres.mjs';
function inteiro(v){
 if(typeof v==='number'&&!Number.isSafeInteger(v))throw Error('INTEIRO_ERP_INVALIDO');
 const texto=String(v);if(!/^\d{1,18}$/.test(texto))throw Error('INTEIRO_ERP_INVALIDO');return BigInt(texto).toString();
}
export function normalizarFiliais(body,cursor=null){
 if(!Array.isArray(body?.value)||body['odata.count']==null||Number(body['odata.count'])!==body.value.length||Object.keys(body).some(k=>k.toLowerCase().includes('nextlink')))throw Error('FILIAIS_RESPOSTA_INCOMPLETA');
 const unicas=new Map();
 for(const v of body.value){
  const filial=inteiro(v.filial),trans_id=inteiro(v.trans_id),cod_filial=v.cod_filial??v.COD_FILIAL;
  if(typeof cod_filial!=='string'||!cod_filial.trim()||cod_filial.trim().length>200)throw Error('COD_FILIAL_INVALIDO');
  if(cursor!==null&&BigInt(trans_id)<BigInt(cursor))throw Error('TRANS_ID_FORA_DA_JANELA');
  const atual={filial,cod_filial:cod_filial.trim(),trans_id};const anterior=unicas.get(filial);
  if(anterior&&anterior.trans_id===trans_id&&anterior.cod_filial!==atual.cod_filial)throw Error('FILIAL_DUPLICADA_CONFLITANTE');
  if(!anterior||BigInt(trans_id)>BigInt(anterior.trans_id))unicas.set(filial,atual);
 }
 return [...unicas.values()];
}
export async function consultarFiliais({baseUrl,token,cursor=null,fetchImpl=fetch}){
 if(!token)throw Error('CONFIGURACAO_INVALIDA');
 const url=new URL(baseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('URL_INVALIDA');
 url.pathname=url.pathname.replace(/\/$/,'')+'/millenium!joinnetwork/varejo/listafiliais';url.search='';
 if(cursor!==null)url.search=new URLSearchParams({trans_id:inteiro(cursor)});
 const r=await fetchImpl(url,{headers:{Authorization:`Basic ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('ERP_HTTP_'+r.status);
 return normalizarFiliais(await r.json(),cursor);
}
export async function sincronizarFiliais({pool,tenant,filiais,consultar,intervalo=360,forcar=false}){
 if(!tenant||!Number.isSafeInteger(intervalo)||intervalo<30)throw Error('CONFIGURACAO_INVALIDA');
 const escopo=[...new Set(filiais.map(inteiro))].sort();if(!escopo.length)throw Error('FILIAIS_AUSENTES');
 const db=await pool.connect();let identidadeVerificada=false;
 try{
  await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");await db.query("SET LOCAL statement_timeout='40s'");
  if((await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');
  identidadeVerificada=true;
  const state=(await db.query('SELECT *,proxima_tentativa>now() AS aguardar FROM sync_cadastro_filiais WHERE singleton FOR UPDATE')).rows[0];
  if(!state)throw Error('ESTADO_CADASTRAL_AUSENTE');
  const inicial=state.cursor===null||JSON.stringify(state.escopo)!==JSON.stringify(escopo);
  if(state.aguardar&&!forcar){await db.query('COMMIT');return {aguardando:true};}
  // Releitura da última transação é idempotente e protege a borda do cursor.
  const cursor=inicial?null:(BigInt(state.cursor)>0n?BigInt(state.cursor)-1n:0n).toString();
  const rows=await consultar({cursor});
  if(inicial&&escopo.some(id=>!rows.some(r=>r.filial===id)))throw Error('CADASTRO_AUTORIZADO_AUSENTE');
  let maior=BigInt(state.cursor??'0'),gravadas=0;
  for(const row of rows){
   if(BigInt(row.trans_id)>maior)maior=BigInt(row.trans_id);
   // Cadastro recebido não concede autorização a uma filial nova.
   if(!escopo.includes(row.filial))continue;
   const r=await db.query(`INSERT INTO cadastro_filiais(filial,cod_filial,trans_id) VALUES($1,$2,$3)
    ON CONFLICT(filial) DO UPDATE SET cod_filial=EXCLUDED.cod_filial,trans_id=EXCLUDED.trans_id,atualizado_em=now()
    WHERE EXCLUDED.trans_id>=cadastro_filiais.trans_id AND (EXCLUDED.trans_id,EXCLUDED.cod_filial) IS DISTINCT FROM (cadastro_filiais.trans_id,cadastro_filiais.cod_filial)`,[row.filial,row.cod_filial,row.trans_id]);
   gravadas+=r.rowCount;
  }
  await db.query(`UPDATE sync_cadastro_filiais SET cursor=$1,escopo=$2::jsonb,ultimo_sucesso=now(),ultimo_erro_codigo=NULL,falhas_consecutivas=0,proxima_tentativa=now()+$3*interval '1 second' WHERE singleton`,[maior.toString(),JSON.stringify(escopo),intervalo]);
  await db.query('COMMIT');return {inicial,recebidas:rows.length,gravadas,cursor:maior.toString()};
 }catch(e){
  await db.query('ROLLBACK');
  if(identidadeVerificada)await db.query(`UPDATE sync_cadastro_filiais SET falhas_consecutivas=falhas_consecutivas+1,ultimo_erro_codigo=$1,
   proxima_tentativa=now()+$2*interval '1 second'*(CASE WHEN falhas_consecutivas<2 THEN 1 ELSE power(2,least(falhas_consecutivas-1,4)) END) WHERE singleton`,[erroSeguro(e),intervalo]);
  throw e;
 }finally{db.release();}
}
