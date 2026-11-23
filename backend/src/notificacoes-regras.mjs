import {createHash,ECDH} from 'node:crypto';
import {ErroApi,elegivel} from './painel.mjs';
import {validarDia} from './sincronizar-cancelamentos.mjs';
import {escopoUsuario} from './permissoes.mjs';

export const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const hashPush=value=>createHash('sha256').update(value).digest('hex');
export const horarioResumo='22:05';
export const fusoResumo='America/Sao_Paulo';
export function instanteLocal(agora=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:fusoResumo,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(agora).map(p=>[p.type,p.value]));
 return {dia:`${parts.year}-${parts.month}-${parts.day}`,hora:`${parts.hour}:${parts.minute}`};
}
export function escopoResumo(user,tenant,filiais,piloto){
 if(!user||user.tenant_key!==tenant||!piloto.includes(user.id)||!user.permissoes?.includes('indicadores:ler')||user.somente_proprias_vendas)return null;
 return escopoUsuario(user,filiais).filiais;
}
export function validarPreferencias(body,permitidas){
 if(!body||Object.keys(body).some(k=>!['resumo_diario','filiais'].includes(k))||typeof body.resumo_diario!=='boolean'||!Array.isArray(body.filiais)||body.filiais.length>100||new Set(body.filiais).size!==body.filiais.length||body.filiais.some(f=>typeof f!=='string'||!permitidas.includes(f)))throw new ErroApi(400,'NOTIFICACOES_PREFERENCIAS_INVALIDAS');
 if(body.resumo_diario&&!body.filiais.length)throw new ErroApi(400,'FILIAL_OBRIGATORIA');
 return {resumo_diario:body.resumo_diario,filiais:body.filiais};
}
export function validarEndpoint(endpoint){
 let u;try{u=new URL(endpoint);}catch{throw new ErroApi(400,'PUSH_INSCRICAO_INVALIDA');}
 const host=u.hostname;
 if(typeof endpoint!=='string'||endpoint.length>4096||!/^[\x21-\x7e]+$/.test(endpoint)||u.protocol!=='https:'||u.port||u.username||u.password||u.hash||!((host==='push.apple.com'||host.endsWith('.push.apple.com'))||host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'))throw new ErroApi(400,'PUSH_DESTINO_NAO_PERMITIDO');
 return u;
}
function base64(value,bytes){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value))throw new ErroApi(400,'PUSH_INSCRICAO_INVALIDA');
 const b=Buffer.from(value,'base64url');if(b.length!==bytes||b.toString('base64url')!==value)throw new ErroApi(400,'PUSH_INSCRICAO_INVALIDA');return b;
}
export function validarInscricao(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['endpoint','expirationTime','keys'].includes(k))||!value.keys||Object.keys(value.keys).some(k=>!['p256dh','auth'].includes(k)))throw new ErroApi(400,'PUSH_INSCRICAO_INVALIDA');
 validarEndpoint(value.endpoint);const p=base64(value.keys.p256dh,65);base64(value.keys.auth,16);
 try{if(p[0]!==4)throw Error();ECDH.convertKey(p,'prime256v1');}catch{throw new ErroApi(400,'PUSH_INSCRICAO_INVALIDA');}
 return {endpoint:value.endpoint,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};
}
const ints=new Intl.NumberFormat('pt-BR');
export function reais(value){const n=BigInt(value),a=n<0n?-n:n;return `${n<0n?'− ':''}R$ ${ints.format(a/100n)},${String(a%100n).padStart(2,'0')}`;}
export function razao(n,d){if(BigInt(d)===0n)return '—';const a=BigInt(n),den=BigInt(d),neg=a<0n;const cent=((neg?-a:a)*100n+den/2n)/den;return `${neg?'− ':''}${ints.format(cent/100n)},${String(cent%100n).padStart(2,'0')}`;}
export async function lerResumo(pool,tenant,filial,dia,agora=new Date()){
 validarDia(dia);const db=await pool.connect();
 try{
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL statement_timeout='5s'");
  if((await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');
  const totais=(await db.query(`SELECT count(*)::integer AS vendas,COALESCE(sum(o.quantidade),0)::text AS pecas,COALESCE(sum(o.valor_final_centavos),0)::text AS valor_centavos FROM operacoes o WHERE o.filial=$1 AND o.data_operacao=$2 AND ${elegivel}`,[filial,dia])).rows[0];
  const sincronizacao=(await db.query("SELECT c.recurso,c.ate::text,s.ultimo_sucesso,s.ultimo_erro_codigo FROM sync_checkpoints c LEFT JOIN sync_status s USING(filial,recurso) WHERE c.filial=$1 AND c.recurso IN ('vendas','cancelamentos')",[filial])).rows;
  const cadastro=(await db.query('SELECT cod_filial,fantasia FROM cadastro_filiais WHERE filial=$1',[filial])).rows[0];
  const min=new Date(dia+'T22:00:00-03:00').getTime(),now=agora.getTime();
  const atualizado=['vendas','cancelamentos'].every(r=>sincronizacao.some(s=>s.recurso===r&&s.ate>=dia&&!s.ultimo_erro_codigo&&s.ultimo_sucesso&&new Date(s.ultimo_sucesso).getTime()>=min&&new Date(s.ultimo_sucesso).getTime()<=now&&now-new Date(s.ultimo_sucesso).getTime()<=20*60000));
  const ultimo=sincronizacao.length===2&&sincronizacao.every(s=>s.ultimo_sucesso)?new Date(Math.min(...sincronizacao.map(s=>new Date(s.ultimo_sucesso).getTime()))).toISOString():null;
  await db.query('COMMIT');return {...totais,filial,dia,nome:cadastro?.fantasia||cadastro?.cod_filial||'Filial '+filial,atualizado,ultimo_sucesso:ultimo};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export function payloadResumo(resumo){
 const r=resumo,dia=r.dia.split('-').reverse().join('/'),nome=r.nome.slice(0,90),atualizacao=r.ultimo_sucesso?new Intl.DateTimeFormat('pt-BR',{timeZone:fusoResumo,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(r.ultimo_sucesso)):'ainda não confirmada';
 const ticket=BigInt(r.vendas)?((BigInt(r.valor_centavos)<0n?-1n:1n)*((BigInt(r.valor_centavos)<0n?-BigInt(r.valor_centavos):BigInt(r.valor_centavos))+BigInt(r.vendas)/2n)/BigInt(r.vendas)).toString():null;
 return {title:`${r.atualizado?'Resumo do dia':'Resumo parcial'} · ${nome}`,body:`${dia} · ${ints.format(r.vendas)} vendas · ${ints.format(BigInt(r.pecas))} peças\nVendas: ${reais(r.valor_centavos)}\nPA: ${razao(r.pecas,r.vendas)} · Ticket médio: ${ticket===null?'—':reais(ticket)}${r.atualizado?'':'\nColeta em atualização · '+atualizacao}`,url:`/?origem=resumo&filial=${encodeURIComponent(r.filial)}&dia=${r.dia}`,parcial:!r.atualizado};
}
