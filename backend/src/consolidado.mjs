import {ErroApi, elegivel} from './painel.mjs';
import {validarDia} from './sincronizar-cancelamentos.mjs';
import {centavos} from './reconciliar-venda.mjs';
export const cargosConsolidado=['Admin','Diretoria','Supervisao'];
const metaCampos='filial::text,competencia::text,valor_centavos::text,versao,atualizado_em';
export function periodoConsolidado(inicio,fim){
 try{validarDia(inicio);validarDia(fim);}catch{throw new ErroApi(400,'PERIODO_INVALIDO');}
 if(inicio>fim||(Date.parse(fim)-Date.parse(inicio))/86400000>365)throw new ErroApi(400,'PERIODO_INVALIDO');
 return {inicio,fim};
}
export function periodoMeta(mes){
 if(typeof mes!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(mes))throw new ErroApi(400,'COMPETENCIA_INVALIDA');
 const inicio=mes+'-01',d=new Date(inicio+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0);
 return {inicio,fim:d.toISOString().slice(0,10)};
}
const percentual=(valor,total)=>{if(BigInt(total)<=0n)return null;const n=BigInt(valor)*10000n/BigInt(total),a=n<0n?-n:n;return `${n<0n?'-':''}${a/100n}.${String(a%100n).padStart(2,'0')}`;};
export function criarConsolidado(pool,tenant,autorizadas){
 function escopo(user,recurso='consolidado:ler'){
  if(user?.tenant_key!==tenant||!cargosConsolidado.includes(user?.role)||user.somente_proprias_vendas||!user.permissoes?.includes(recurso))throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
  return user.role==='Admin'?[...autorizadas]:autorizadas.filter(f=>user.vinculos?.some(v=>String(v.filial)===f));
 }
 async function transacao(fn,escrita=false){
  const db=await pool.connect();try{
   await db.query(escrita?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL statement_timeout='8s'");
   if((await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw new ErroApi(403,'TENANT_INCORRETO');
   const result=await fn(db);await db.query('COMMIT');return result;
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 async function resumo(db,filiais,inicio,fim){
  const rows=(await db.query(`WITH ids AS (SELECT unnest($1::bigint[]) AS filial), vendas AS (
   SELECT o.filial,count(*)::int AS vendas,sum(o.quantidade)::text AS pecas,sum(o.valor_final_centavos)::text AS valor_centavos,
   count(*) FILTER(WHERE o.conciliacao<>'conciliada' AND NOT(o.erro_erp_confirmado_por IS NOT NULL AND o.conciliacao IN ('divergente','quantidade_divergente')))::int AS pendencias
   FROM operacoes o WHERE o.filial=ANY($1::bigint[]) AND o.data_operacao BETWEEN $2::date AND $3::date AND ${elegivel} GROUP BY o.filial)
   SELECT ids.filial::text,c.cod_filial,c.fantasia,COALESCE(v.vendas,0) AS vendas,COALESCE(v.pecas,'0') AS pecas,COALESCE(v.valor_centavos,'0') AS valor_centavos,COALESCE(v.pendencias,0) AS pendencias,
    (SELECT min(data_operacao)::text FROM operacoes WHERE filial=ids.filial) AS primeira_operacao,
    (SELECT min(ate)::text FROM sync_checkpoints WHERE filial=ids.filial AND recurso IN ('vendas','cancelamentos') HAVING count(*)=2) AS cobertura_ate,
    (SELECT min(ultimo_sucesso) FROM sync_status WHERE filial=ids.filial AND recurso IN ('vendas','cancelamentos') HAVING count(*)=2) AS atualizado_em
   FROM ids LEFT JOIN cadastro_filiais c USING(filial) LEFT JOIN vendas v USING(filial)`,[filiais,inicio,fim])).rows;
  rows.sort((a,b)=>BigInt(a.valor_centavos)>BigInt(b.valor_centavos)?-1:BigInt(a.valor_centavos)<BigInt(b.valor_centavos)?1:BigInt(a.filial)<BigInt(b.filial)?-1:1);
  const total={vendas:0,pecas:'0',valor_centavos:'0',pendencias:0};
  for(const r of rows){total.vendas+=r.vendas;total.pecas=(BigInt(total.pecas)+BigInt(r.pecas)).toString();total.valor_centavos=(BigInt(total.valor_centavos)+BigInt(r.valor_centavos)).toString();total.pendencias+=r.pendencias;}
  rows.forEach((r,i)=>{r.posicao=i+1;r.participacao_percentual=percentual(r.valor_centavos,total.valor_centavos);r.cobertura_completa=!!r.cobertura_ate&&r.cobertura_ate>=fim&&!!r.primeira_operacao&&r.primeira_operacao<=inicio;});
  return {inicio,fim,filiais:rows,total,filiais_sem_cobertura:rows.filter(r=>!r.cobertura_completa).length,
   regra:'Vendas S não canceladas, com valores e peças do cabeçalho ERP. Inclui pendências sinalizadas. Devoluções e faturamento bruto/líquido aguardam validação; entradas não são subtraídas.'};
 }
 return {
  consultar:async(user,inicio,fim)=>{const filiais=escopo(user);periodoConsolidado(inicio,fim);return transacao(db=>resumo(db,filiais,inicio,fim));},
  metas:async(user,mes)=>{
   const filiais=escopo(user),{inicio,fim}=periodoMeta(mes);
   return transacao(async db=>{
    const result=await resumo(db,filiais,inicio,fim),metas=(await db.query(`SELECT ${metaCampos} FROM metas_filiais WHERE filial=ANY($1::bigint[]) AND competencia=$2`,[filiais,inicio])).rows;
    let totalMeta=0n,comMeta=0,realizadoComMeta=0n;
    for(const r of result.filiais){r.meta=metas.find(m=>m.filial===r.filial)??{filial:r.filial,competencia:inicio,valor_centavos:null,versao:0,atualizado_em:null};r.atingimento_percentual=r.meta.valor_centavos===null?null:percentual(r.valor_centavos,r.meta.valor_centavos);r.falta_centavos=r.meta.valor_centavos===null?null:(BigInt(r.meta.valor_centavos)>BigInt(r.valor_centavos)?BigInt(r.meta.valor_centavos)-BigInt(r.valor_centavos):0n).toString();if(r.meta.valor_centavos!==null){comMeta++;totalMeta+=BigInt(r.meta.valor_centavos);realizadoComMeta+=BigInt(r.valor_centavos);}}
    return {...result,competencia:mes,pode_editar:user.permissoes.includes('metas:gerenciar'),meta_total_centavos:totalMeta.toString(),filiais_com_meta:comMeta,realizado_com_meta_centavos:realizadoComMeta.toString(),atingimento_percentual:percentual(realizadoComMeta,totalMeta)};
   });
  },
  salvarMeta:async(user,filial,mes,body,revalidar=async()=>user)=>{
   if(!escopo(user,'metas:gerenciar').includes(filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
   const {inicio}=periodoMeta(mes);
   if(!body||Object.keys(body).length!==3||!['valor','versao','requisicao'].every(k=>Object.hasOwn(body,k))||!Number.isSafeInteger(body.versao)||body.versao<0||body.versao>2147483646||typeof body.requisicao!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.requisicao)||(body.valor!==null&&(typeof body.valor!=='string'||!/^\d{1,12}\.\d{2}$/.test(body.valor))))throw new ErroApi(400,'META_INVALIDA');
   const valor=body.valor===null?null:centavos(body.valor).toString();
   return transacao(async db=>{
    await db.query("SET LOCAL lock_timeout='5s'");await db.query("SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || ':meta:' || $1 || ':' || $2,0))",[filial,mes]);
    const atualUser=await revalidar();if(!atualUser||atualUser.id!==user.id||!escopo(atualUser,'metas:gerenciar').includes(filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
    const anterior=(await db.query(`SELECT ${metaCampos} FROM metas_filiais WHERE filial=$1 AND competencia=$2 FOR UPDATE`,[filial,inicio])).rows[0]??null;
    const repetida=(await db.query('SELECT filial::text,competencia::text,ator_id,valor_solicitado_centavos::text,versao_esperada,depois FROM metas_filiais_historico WHERE requisicao=$1',[body.requisicao])).rows[0];
    if(repetida){if(repetida.filial!==filial||repetida.competencia!==inicio||repetida.ator_id!==user.id||repetida.valor_solicitado_centavos!==valor||repetida.versao_esperada!==body.versao)throw new ErroApi(409,'REQUISICAO_REUTILIZADA');return {meta:repetida.depois};}
    if((anterior?.versao??0)!==body.versao)throw new ErroApi(409,'META_DESATUALIZADA');
    const depois=(await db.query(`INSERT INTO metas_filiais(filial,competencia,valor_centavos,versao,atualizado_por) VALUES($1,$2,$3,1,$4)
     ON CONFLICT(filial,competencia) DO UPDATE SET valor_centavos=EXCLUDED.valor_centavos,versao=metas_filiais.versao+1,atualizado_por=EXCLUDED.atualizado_por,atualizado_em=now() RETURNING ${metaCampos}`,[filial,inicio,valor,user.id])).rows[0];
    await db.query('INSERT INTO metas_filiais_historico(requisicao,filial,competencia,ator_id,valor_solicitado_centavos,versao_esperada,antes,depois) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)',[body.requisicao,filial,inicio,user.id,valor,body.versao,JSON.stringify(anterior),JSON.stringify(depois)]);
    return {meta:depois};
   },true).catch(e=>{if(e.code==='23505')throw new ErroApi(409,'REQUISICAO_REUTILIZADA');if(e.code==='55P03')throw new ErroApi(409,'META_EM_EDICAO');throw e;});
  }
 };
}
