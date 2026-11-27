import {ErroApi, elegivel} from './painel.mjs';
import {validarDia} from './sincronizar-cancelamentos.mjs';
import {centavos} from './reconciliar-venda.mjs';
import {consultarCrescimento,hojeSaoPaulo} from './crescimento.mjs';
import {parametrosCrescimento,sugestaoCrescimento,hashMeta,uuidMeta,requisicaoMensal} from './metas-crescimento.mjs';
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
export function criarConsolidado(pool,tenant,autorizadas,{hoje=hojeSaoPaulo}={}){
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
 async function previaCrescimento(db,filial,p){
  const meses=[];
  for(const competencia of p.meses){
   const baseMes=String(Number(competencia.slice(0,4))-1)+competencia.slice(4),periodo=periodoMeta(baseMes),r=(await resumo(db,[filial],periodo.inicio,periodo.fim)).filiais[0];
   const atual=(await db.query(`SELECT ${metaCampos} FROM metas_filiais WHERE filial=$1 AND competencia=$2`,[filial,competencia+'-01'])).rows[0]??{valor_centavos:null,versao:0};
   const base={inicio:periodo.inicio,fim:periodo.fim,valor_centavos:r.valor_centavos,vendas:r.vendas,pecas:r.pecas,pendencias:r.pendencias,cobertura_completa:r.cobertura_completa};
   const sugestao=sugestaoCrescimento(base.valor_centavos,p.pontos);
   const impedimento=periodo.fim>=hoje()?'MES_BASE_NAO_ENCERRADO':!r.vendas||BigInt(base.valor_centavos)<=0n?'SEM_BASE_POSITIVA':sugestao===null?'SUGESTAO_ACIMA_DO_LIMITE':null;
   const item={competencia,base,meta_atual:{valor_centavos:atual.valor_centavos,versao:atual.versao},sugestao_centavos:impedimento?null:sugestao,impedimento};
   item.assinatura=hashMeta({filial,crescimento:p.crescimento_percentual,...item});meses.push(item);
  }
  return {filial,inicio:p.inicio,fim:p.fim,crescimento_percentual:p.crescimento_percentual,meses};
 }
 return {
  previaCrescimento:async(user,filial,inicio,fim,crescimento)=>{
   if(!escopo(user,'metas:gerenciar').includes(filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
   const p=parametrosCrescimento(inicio,fim,crescimento);return transacao(db=>previaCrescimento(db,filial,p));
  },
  salvarCrescimento:async(user,body,revalidar=async()=>user)=>{
   if(!body||Object.keys(body).sort().join(',')!=='crescimento,filial,fim,inicio,meses,requisicao'||typeof body.filial!=='string'||!uuidMeta(body.requisicao)||!Array.isArray(body.meses)||!body.meses.length||body.meses.length>12)throw new ErroApi(400,'META_LOTE_INVALIDO');
   const p=parametrosCrescimento(body.inicio,body.fim,body.crescimento),filial=body.filial;
   if(!escopo(user,'metas:gerenciar').includes(filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
   const meses=[...body.meses].sort((a,b)=>String(a?.competencia).localeCompare(String(b?.competencia)));
   if(new Set(meses.map(m=>m?.competencia)).size!==meses.length||meses.some(m=>!m||Object.keys(m).sort().join(',')!=='aceitar_base_parcial,assinatura,competencia,substituir'||!p.meses.includes(m.competencia)||typeof m.assinatura!=='string'||!/^[a-f0-9]{64}$/.test(m.assinatura)||typeof m.substituir!=='boolean'||typeof m.aceitar_base_parcial!=='boolean'))throw new ErroApi(400,'META_LOTE_INVALIDO');
   const assinatura=hashMeta({filial,inicio:p.inicio,fim:p.fim,crescimento:p.crescimento_percentual,meses});
   const ids=meses.map(m=>requisicaoMensal(body.requisicao,m.competencia,meses[0].competencia));
   return transacao(async db=>{
    await db.query("SET LOCAL lock_timeout='5s'");await db.query("SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || ':meta-lote:' || $1,0))",[body.requisicao]);
    for(const m of meses)await db.query("SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || ':meta:' || $1 || ':' || $2,0))",[filial,m.competencia]);
    const atualUser=await revalidar();if(!atualUser||atualUser.id!==user.id||!escopo(atualUser,'metas:gerenciar').includes(filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
    const anteriores=(await db.query('SELECT requisicao,ator_id,filial::text,depois FROM metas_filiais_historico WHERE requisicao=ANY($1::uuid[])',[ids])).rows;
    if(anteriores.length){if(anteriores.length!==ids.length||anteriores.some(h=>h.ator_id!==user.id||h.filial!==filial||h.depois.calculo?.lote_hash!==assinatura))throw new ErroApi(409,'REQUISICAO_REUTILIZADA');return {metas:meses.map((m,i)=>anteriores.find(h=>h.requisicao===ids[i]).depois),repetida:true};}
    const previa=await previaCrescimento(db,filial,p),selecionadas=meses.map(m=>({pedido:m,item:previa.meses.find(r=>r.competencia===m.competencia)}));
    for(const {pedido,item} of selecionadas){
     if(item.assinatura!==pedido.assinatura)throw new ErroApi(409,'META_PREVIA_DESATUALIZADA');
     if(item.impedimento)throw new ErroApi(400,'META_BASE_INDISPONIVEL');
     if(item.meta_atual.valor_centavos!==null&&!pedido.substituir)throw new ErroApi(409,'META_EXISTENTE_PROTEGIDA');
     if(!item.base.cobertura_completa&&!pedido.aceitar_base_parcial)throw new ErroApi(400,'META_BASE_PARCIAL');
    }
    const gravadas=[];
    for(let i=0;i<selecionadas.length;i++){
     const {item}=selecionadas[i],inicio=item.competencia+'-01';
     const antes=(await db.query(`SELECT ${metaCampos} FROM metas_filiais WHERE filial=$1 AND competencia=$2 FOR UPDATE`,[filial,inicio])).rows[0]??null;
     const depois=(await db.query(`INSERT INTO metas_filiais(filial,competencia,valor_centavos,versao,atualizado_por) VALUES($1,$2,$3,1,$4)
      ON CONFLICT(filial,competencia) DO UPDATE SET valor_centavos=EXCLUDED.valor_centavos,versao=metas_filiais.versao+1,atualizado_por=EXCLUDED.atualizado_por,atualizado_em=now() RETURNING ${metaCampos}`,[filial,inicio,item.sugestao_centavos,user.id])).rows[0];
     depois.calculo={origem:'crescimento_ano_anterior',crescimento_percentual:p.crescimento_percentual,base:item.base,lote:body.requisicao,lote_hash:assinatura};
     await db.query('INSERT INTO metas_filiais_historico(requisicao,filial,competencia,ator_id,valor_solicitado_centavos,versao_esperada,antes,depois) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)',[ids[i],filial,inicio,user.id,item.sugestao_centavos,item.meta_atual.versao,JSON.stringify(antes),JSON.stringify(depois)]);gravadas.push(depois);
    }
    return {metas:gravadas,repetida:false};
   },true).catch(e=>{if(e.code==='23505')throw new ErroApi(409,'REQUISICAO_REUTILIZADA');if(e.code==='55P03')throw new ErroApi(409,'META_EM_EDICAO');throw e;});
  },
  referenciasMetas:async(user,filial,inicio,fim)=>{
   let permitidas;try{permitidas=escopo(user);}catch(e){if(e.status===403)return null;throw e;}
   if(!permitidas.includes(filial))return null;periodoConsolidado(inicio,fim);
   return transacao(async db=>(await db.query(`SELECT competencia::text,valor_centavos::text FROM metas_filiais
    WHERE filial=$1 AND competencia BETWEEN date_trunc('month',$2::date)::date AND date_trunc('month',$3::date)::date
    AND valor_centavos IS NOT NULL ORDER BY competencia`,[filial,inicio,fim])).rows);
  },
  crescimento:async(user,ano,modo='acumulado',comparacao='anterior')=>{const filiais=escopo(user),dia=hoje();return transacao(db=>consultarCrescimento(db,filiais,ano??dia.slice(0,4),modo,dia,comparacao));},
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
