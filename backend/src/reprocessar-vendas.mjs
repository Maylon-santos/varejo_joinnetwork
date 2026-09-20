import {ErroApi} from './painel.mjs';
import {escopoUsuario} from './permissoes.mjs';
import {erroSeguro} from './postgres.mjs';
const colunas='id,estado,criado_em,iniciado_em,finalizado_em,erro_codigo,resultado';
export function criarReprocessamentos(pool,tenant,filiais){
 async function autorizar(user,filial,tipo,codigo){
  if(user?.tenant_key!==tenant||user.role!=='Admin')throw new ErroApi(403,'RECURSO_NAO_AUTORIZADO');
  if(!escopoUsuario(user,filiais).filiais.includes(filial))throw new ErroApi(403,'FILIAL_NAO_AUTORIZADA');
  if(tipo!=='S'||!/^\d{1,18}$/.test(codigo))throw new ErroApi(400,'CHAVE_INVALIDA');
  if((await pool.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw new ErroApi(403,'TENANT_INCORRETO');
 }
 return {
  ler:async(user,filial,tipo,codigo)=>{await autorizar(user,filial,tipo,codigo);return {reprocessamento:(await pool.query(`SELECT ${colunas} FROM reprocessamentos_venda WHERE filial=$1 AND tipo_operacao=$2 AND cod_operacao=$3 ORDER BY criado_em DESC,id DESC LIMIT 1`,[filial,tipo,codigo])).rows[0]??null};},
  solicitar:async(user,filial,tipo,codigo,body)=>{
   await autorizar(user,filial,tipo,codigo);
   if(!body||Object.keys(body).length!==1||typeof body.requisicao!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.requisicao))throw new ErroApi(400,'REQUISICAO_INVALIDA');
   const db=await pool.connect();try{
    await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || ':' || $1,0))",[filial]);
    const repetida=(await db.query(`SELECT ${colunas},filial::text,tipo_operacao,cod_operacao::text,solicitado_por FROM reprocessamentos_venda WHERE id=$1`,[body.requisicao])).rows[0];
    if(repetida){if(repetida.filial!==filial||repetida.tipo_operacao!==tipo||repetida.cod_operacao!==codigo||repetida.solicitado_por!==user.id)throw new ErroApi(409,'REQUISICAO_REUTILIZADA');await db.query('COMMIT');return {reprocessamento:Object.fromEntries(colunas.split(',').map(k=>[k,repetida[k]]))};}
    const op=(await db.query('SELECT conciliacao FROM operacoes WHERE filial=$1 AND tipo_operacao=$2 AND cod_operacao=$3',[filial,tipo,codigo])).rows[0];
    if(!op)throw new ErroApi(404,'OPERACAO_NAO_ENCONTRADA');
    const ativa=(await db.query(`SELECT ${colunas} FROM reprocessamentos_venda WHERE filial=$1 AND tipo_operacao=$2 AND cod_operacao=$3 AND estado IN ('pendente','processando')`,[filial,tipo,codigo])).rows[0];
    if(ativa){await db.query('COMMIT');return {reprocessamento:ativa};}
    if(op.conciliacao==='conciliada')throw new ErroApi(409,'VENDA_SEM_PENDENCIA');
    if((await db.query("SELECT 1 FROM reprocessamentos_venda WHERE filial=$1 AND tipo_operacao=$2 AND cod_operacao=$3 AND criado_em>now()-interval '1 minute'",[filial,tipo,codigo])).rowCount)throw new ErroApi(429,'REPROCESSAMENTO_AGUARDE');
    const r=(await db.query(`INSERT INTO reprocessamentos_venda(id,filial,tipo_operacao,cod_operacao,solicitado_por) VALUES($1,$2,$3,$4,$5) RETURNING ${colunas}`,[body.requisicao,filial,tipo,codigo,user.id])).rows[0];
    await db.query('COMMIT');return {reprocessamento:r};
   }catch(e){await db.query('ROLLBACK');if(e.code==='23505')throw new ErroApi(409,'REQUISICAO_REUTILIZADA');if(e.code==='55P03')throw new ErroApi(409,'FILIAL_EM_ATUALIZACAO');throw e;}finally{db.release();}
  }
 };
}
export async function processarReprocessamento({pool,repositorio,tenant,filiais,consultar}){
 const db=await pool.connect();let locked=false,job;
 try{
  if((await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');
  locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended(current_schema() || ':reprocessamento:' || $1,0)) AS ok",[tenant])).rows[0].ok;
  if(!locked)return {ocupado:true};
  job=(await db.query(`UPDATE reprocessamentos_venda SET estado='processando',iniciado_em=now(),tentativas=tentativas+1,erro_codigo=NULL WHERE id=(SELECT id FROM reprocessamentos_venda WHERE filial=ANY($1::bigint[]) AND estado IN ('pendente','processando') ORDER BY criado_em,id LIMIT 1) RETURNING id,filial::text,tipo_operacao,cod_operacao::text`,[filiais])).rows[0];
  if(!job)return {vazio:true};
  const op=(await db.query('SELECT data_operacao::text AS dia FROM operacoes WHERE filial=$1 AND tipo_operacao=$2 AND cod_operacao=$3',[job.filial,job.tipo_operacao,job.cod_operacao])).rows[0];
  if(!op)throw Error('OPERACAO_NAO_ENCONTRADA');
  const recebidas=await consultar({filial:job.filial,inicio:op.dia,fim:op.dia});
  const candidatas=recebidas.filter(r=>r.filial===job.filial&&r.tipo_operacao===job.tipo_operacao&&r.cod_operacao===job.cod_operacao&&r.data_operacao===op.dia);
  if(candidatas.length!==1)throw Error('VENDA_AUSENTE_OU_DUPLICADA_ERP');
  await repositorio.transacao({tenant,filial:job.filial},tx=>tx.reprocessarVenda(job.id,candidatas[0]));
  return {id:job.id,estado:'concluido'};
 }catch(e){
  if(!job)throw e;
  const codigo=String(erroSeguro(e));await db.query("UPDATE reprocessamentos_venda SET estado='falhou',finalizado_em=now(),erro_codigo=$2 WHERE id=$1 AND estado='processando'",[job.id,codigo]);
  return {id:job.id,estado:'falhou',codigo};
 }finally{if(locked)await db.query("SELECT pg_advisory_unlock(hashtextextended(current_schema() || ':reprocessamento:' || $1,0))",[tenant]);db.release();}
}
