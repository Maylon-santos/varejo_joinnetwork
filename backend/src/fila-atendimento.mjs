import {createHash,randomUUID} from 'node:crypto';
import {ErroApi} from './painel.mjs';
import {escopoUsuario,exigirPermissao} from './permissoes.mjs';
import {validarDia} from './sincronizar-cancelamentos.mjs';
import {aplicarAcaoFila} from './fila-regras.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const campos={abrir:['vendedores'],fechar:[],chegada:['vendedor'],pausar:['vendedor','motivo'],retornar:['vendedor'],ausente:['vendedor','motivo'],abordar:['vendedor','modalidade','motivo'],iniciar:['atendimento'],concluir:['atendimento','resultado','motivo']};
export function criarFila(pool,tenant,filiais){
 function autorizar(user,filial,dia){
  if(!user||user.tenant_key!==tenant)throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
  const acesso=escopoUsuario(user,filiais);exigirPermissao(acesso.permissoes,'fila:ler');
  if(!acesso.filiais.includes(filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
  try{validarDia(dia);}catch{throw new ErroApi(400,'PERIODO_INVALIDO');}
  const gerente=acesso.permissoes.includes('fila:gerenciar')&&!user.somente_proprias_vendas;
  const codigoProprio=user.vinculos?.find(v=>String(v.filial)===filial)?.vendedor_codigo??null;
  return {gerente,codigoProprio,operar:acesso.permissoes.includes('fila:operar')};
 }
 async function identidade(db){const r=await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton');if(r.rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');}
 async function carregar(db,filial,dia){
  const args=[filial,dia];return {jornada:(await db.query('SELECT estado,versao,aberta_em,fechada_em FROM fila_jornadas WHERE filial=$1 AND dia=$2',args)).rows[0]??null,
   participantes:(await db.query('SELECT vendedor_codigo,nome,posicao,estado FROM fila_participantes WHERE filial=$1 AND dia=$2 ORDER BY posicao,vendedor_codigo',args)).rows,
   atendimentos:(await db.query('SELECT id,vendedor_codigo,modalidade,abordado_em,iniciado_em,finalizado_em,resultado,motivo FROM fila_atendimentos WHERE filial=$1 AND dia=$2 AND finalizado_em IS NULL ORDER BY abordado_em',args)).rows};
 }
 async function candidatos(db,filial){return (await db.query("SELECT DISTINCT ON(vendedor_codigo) vendedor_codigo,COALESCE(vendedor_nome,'Vendedor sem nome') AS nome FROM operacoes WHERE filial=$1 AND vendedor_codigo IS NOT NULL AND vendedor_codigo<>'' ORDER BY vendedor_codigo,data_operacao DESC,cod_operacao DESC",[filial])).rows;}
 return {
  ler:async(user,filial,dia)=>{
   const acesso=autorizar(user,filial,dia),db=await pool.connect();
   try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL statement_timeout='5s'");await identidade(db);
    const s=await carregar(db,filial,dia);const pendente=(await db.query("SELECT dia::text FROM fila_jornadas WHERE filial=$1 AND estado='aberta' AND dia<>$2",[filial,dia])).rows[0]?.dia??null;
    const lista=acesso.gerente?await candidatos(db,filial):[];
    // A posição da equipe é pública dentro da filial; atendimentos individuais não são.
    s.atendimentos=s.atendimentos.filter(a=>acesso.gerente||(acesso.operar&&a.vendedor_codigo===acesso.codigoProprio));
    await db.query('COMMIT');return {filial,dia,...s,pendente_dia:pendente,candidatos:lista,gerenciar:acesso.gerente,operar:acesso.operar,codigo_proprio:acesso.codigoProprio};
   }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  },
  executar:async(user,body,reautorizar=async()=>user)=>{
   if(!body||!Object.hasOwn(campos,body.acao)||Object.keys(body).some(k=>!['acao','filial','dia','versao','requisicao',...campos[body.acao]].includes(k))||!Number.isSafeInteger(body.versao)||body.versao<0||typeof body.requisicao!=='string'||!uuid.test(body.requisicao))throw new ErroApi(400,'FILA_REQUISICAO_INVALIDA');
   if(body.atendimento!==undefined&&(typeof body.atendimento!=='string'||!uuid.test(body.atendimento)))throw new ErroApi(400,'FILA_REQUISICAO_INVALIDA');
   const {filial,dia}=body;autorizar(user,filial,dia);
   const fingerprint=createHash('sha256').update(JSON.stringify(body,Object.keys(body).sort())).digest('hex'),db=await pool.connect();
   try{
    await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");await db.query("SET LOCAL statement_timeout='10s'");await identidade(db);
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended(current_schema()||':fila:'||$1,0))",[filial]);
    user=await reautorizar();const acesso=autorizar(user,filial,dia);
    if(['abrir','fechar','chegada','pausar','retornar','ausente'].includes(body.acao)){if(!acesso.gerente)throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');}
    else if(!acesso.operar)throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
    const repetida=(await db.query('SELECT autor::text,fingerprint FROM fila_eventos WHERE requisicao=$1',[body.requisicao])).rows[0];
    if(repetida){if(repetida.autor!==user.id||repetida.fingerprint!==fingerprint)throw new ErroApi(409,'FILA_REQUISICAO_REUTILIZADA');await db.query('COMMIT');return {ok:true,repetida:true};}
    const s=await carregar(db,filial,dia);
    if((s.jornada?.versao??0)!==body.versao)throw new ErroApi(409,'FILA_DESATUALIZADA');
    if(body.acao==='abrir'&&(await db.query("SELECT 1 FROM fila_jornadas WHERE filial=$1 AND estado='aberta'",[filial])).rowCount)throw new ErroApi(409,'FILA_JORNADA_PENDENTE');
    const clock=(await db.query("SELECT clock_timestamp() AS agora,(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS hoje")).rows[0];
    const nomes=['abrir','chegada'].includes(body.acao)?Object.fromEntries((await candidatos(db,filial)).map(c=>[c.vendedor_codigo,c.nome])):{};
    const next=aplicarAcaoFila(s,body,{...acesso,agora:clock.agora.toISOString(),hoje:clock.hoje,id:randomUUID(),nomes});
    const j=next.jornada;await db.query(`INSERT INTO fila_jornadas(filial,dia,estado,versao,aberta_em,fechada_em) VALUES($1,$2,$3,1,$4,$5)
      ON CONFLICT(filial,dia) DO UPDATE SET estado=EXCLUDED.estado,versao=fila_jornadas.versao+1,fechada_em=EXCLUDED.fechada_em`,[filial,dia,j.estado,j.aberta_em,j.fechada_em]);
    for(const p of next.participantes)await db.query(`INSERT INTO fila_participantes(filial,dia,vendedor_codigo,nome,posicao,estado) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(filial,dia,vendedor_codigo) DO UPDATE SET posicao=EXCLUDED.posicao,estado=EXCLUDED.estado`,[filial,dia,p.vendedor_codigo,p.nome,p.posicao,p.estado]);
    for(const a of next.atendimentos)await db.query(`INSERT INTO fila_atendimentos(id,filial,dia,vendedor_codigo,modalidade,abordado_em,iniciado_em,finalizado_em,resultado,motivo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(id) DO UPDATE SET iniciado_em=EXCLUDED.iniciado_em,finalizado_em=EXCLUDED.finalizado_em,resultado=EXCLUDED.resultado,motivo=EXCLUDED.motivo`,[a.id,filial,dia,a.vendedor_codigo,a.modalidade,a.abordado_em,a.iniciado_em,a.finalizado_em,a.resultado,a.motivo]);
    await db.query('INSERT INTO fila_eventos(requisicao,filial,dia,autor,acao,criado_em,fingerprint,dados) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[body.requisicao,filial,dia,user.id,body.acao,clock.agora,fingerprint,JSON.stringify({pedido:body,finalizados:next.atendimentos.filter(a=>a.finalizado_em)})]);
    await db.query('COMMIT');return {ok:true};
   }catch(e){await db.query('ROLLBACK');if(e.code==='23505')throw new ErroApi(409,'FILA_CONFLITO');if(['55P03','57014'].includes(e.code))throw new ErroApi(409,'FILA_DESATUALIZADA');throw e;}finally{db.release();}
  }
 };
}
