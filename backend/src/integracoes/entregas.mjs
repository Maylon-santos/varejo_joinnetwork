import {randomUUID} from 'node:crypto';
import {transacao,identidade} from './banco.mjs';
import {assinaturaWebhook} from './seguranca.mjs';
import {enviarSeguro,resultadoEntrega,proximaTentativa} from './destinos.mjs';

export function criarEntregador(pool,tenant,cofre,{enviar=enviarSeguro,filiais=[],ambiente='homologacao'}={}){
 async function distribuir(){return transacao(pool,async db=>{
  await identidade(db,tenant);
  const cp=(await db.query('SELECT posicao FROM integration_dispatch_checkpoint WHERE singleton FOR UPDATE')).rows[0];
  const rows=(await db.query('SELECT * FROM integration_changes WHERE posicao>$1 ORDER BY posicao LIMIT 100',[cp.posicao])).rows;
  for(const e of rows){
   if(e.tipo_evento&&e.payload){
    const hooks=(await db.query(`SELECT w.* FROM integration_webhooks w JOIN integration_clients c ON c.id=w.cliente_id
     WHERE c.tenant_key=$1 AND c.estado='ativo' AND c.escopos ? 'vendas:ler' AND (c.escopos ? 'webhooks:ler' OR c.escopos ? 'webhooks:gerenciar') AND w.ativo AND w.verificado_em IS NOT NULL
     AND w.eventos ? $2 AND w.filiais ? $3 AND c.filiais ? $3 AND w.criado_em<=$4`,[tenant,e.tipo_evento,e.filial,e.registrado_em])).rows;
    for(const w of hooks)await db.query(`INSERT INTO integration_deliveries(id,webhook_id,evento_id,filial,tipo_evento,payload,configuracao_versao,destino_url,origem,evento_criado_em)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,'automatica',$9) ON CONFLICT(webhook_id,evento_id,ciclo) DO NOTHING`,[randomUUID(),w.id,e.id,e.filial,e.tipo_evento,e.payload,w.versao,w.url,e.registrado_em]);
   }
  }
  if(rows.length)await db.query('UPDATE integration_dispatch_checkpoint SET posicao=$1 WHERE singleton',[rows.at(-1).posicao]);return rows.length;
 });}
 async function reservar(){return transacao(pool,async db=>{
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended('integration:delivery-admission',0))");
  const ativos=(await db.query("SELECT count(*)::int n FROM integration_deliveries WHERE estado='enviando' AND lease_ate>now()")).rows[0].n;if(ativos>=2)return null;
  const e=(await db.query(`SELECT d.* FROM integration_deliveries d JOIN integration_webhooks w ON w.id=d.webhook_id JOIN integration_clients c ON c.id=w.cliente_id
   WHERE c.ambiente=$1 AND d.estado IN ('na_fila','aguardando_retry','enviando') AND d.proxima_tentativa_em<=now() AND (d.lease_ate IS NULL OR d.lease_ate<now())
   AND (w.circuito_ate IS NULL OR w.circuito_ate<=now())
   AND NOT EXISTS(SELECT 1 FROM integration_deliveries other JOIN integration_webhooks ow ON ow.id=other.webhook_id WHERE ow.hostname=w.hostname AND other.estado='enviando' AND other.lease_ate>now())
   AND NOT EXISTS(SELECT 1 FROM integration_webhooks ow WHERE ow.hostname=w.hostname AND ow.ultimo_envio_em>now()-interval '1 second')
   ORDER BY d.proxima_tentativa_em,d.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED`,[ambiente])).rows[0];if(!e)return null;
  const w=(await db.query('SELECT * FROM integration_webhooks WHERE id=$1 FOR UPDATE',[e.webhook_id])).rows[0],c=(await db.query('SELECT * FROM integration_clients WHERE id=$1',[w.cliente_id])).rows[0];
  const teste=e.tipo_evento==='webhook.teste';
  const permitido=c?.estado==='ativo'&&c.tenant_key===tenant&&c.ambiente===ambiente&&c.escopos.includes('vendas:ler')&&c.escopos.some(s=>s==='webhooks:ler'||s==='webhooks:gerenciar')&&c.hosts.includes(w.hostname)&&e.destino_url===w.url&&(teste||w.ativo&&w.verificado_em&&w.eventos.includes(e.tipo_evento)&&w.filiais.includes(e.filial)&&c.filiais.includes(e.filial)&&filiais.includes(e.filial));
  // Mudar a URL impede entregar eventos previamente enfileirados ao novo destino.
  // Outras mudanças de versão (ativação/rotação) mantêm a URL aprovada pela trilha da configuração.
  if(!permitido||!e.payload||e.tentativas>=10||Date.now()-e.criado_em.getTime()>=72*3600000||Date.now()-e.evento_criado_em.getTime()>=30*86400000){await db.query("UPDATE integration_deliveries SET estado=$2,finalizado_em=now(),lease_ate=NULL WHERE id=$1",[e.id,!permitido?'falha_permanente':'expirada']);return {ignorada:true};}
  const lease=randomUUID(),tentativaId=randomUUID();await db.query("UPDATE integration_deliveries SET estado='enviando',lease_id=$2,lease_ate=now()+interval '20 seconds',tentativas=tentativas+1 WHERE id=$1",[e.id,lease]);await db.query('UPDATE integration_webhooks SET ultimo_envio_em=now() WHERE id=$1',[w.id]);
  await db.query("UPDATE integration_attempts SET codigo_falha='WORKER_INTERRUPTED' WHERE entrega_id=$1 AND finalizado_em IS NULL",[e.id]);
  await db.query("INSERT INTO integration_attempts(id,entrega_id,iniciado_em,atraso_fila_ms,codigo_falha,numero_tentativa,hostname,ator_id) VALUES($1,$2,now(),$3,'ATTEMPT_IN_PROGRESS',$4,$5,$6)",[tentativaId,e.id,Math.max(0,Date.now()-e.proxima_tentativa_em.getTime()),e.tentativas+1,w.hostname,e.ator_id]);
  return {e:{...e,tentativas:e.tentativas+1},w,c,lease,tentativaId};
 });}
 async function executar(){
  const reserva=await reservar();if(!reserva)return false;if(reserva.ignorada)return true;
  const {e,w,c,lease,tentativaId}=reserva,inicio=new Date(),start=performance.now();let http=null,erro=null,retry=null;
  try{
   const payload=cofre.abrir(e.payload,'event:'+e.evento_id),body=Buffer.from(JSON.stringify(payload)),timestamp=Math.floor(Date.now()/1000).toString();
   const segredos=[cofre.abrir(w.segredo,'webhook:'+w.id)];if(w.segredo_anterior&&w.anterior_ate.getTime()>Date.now())segredos.push(cofre.abrir(w.segredo_anterior,'webhook:'+w.id));
   const r=await enviar({url:w.url,hosts:c.hosts,headers:{'webhook-id':e.evento_id,'webhook-timestamp':timestamp,'webhook-signature':segredos.map(s=>assinaturaWebhook(s,e.evento_id,timestamp,body)).join(' ')},body});http=r.status;retry=[429,503].includes(http)?r.retryAfter:null;
  }catch(err){erro=['DELIVERY_TIMEOUT','UNSAFE_DESTINATION','DESTINATION_NOT_APPROVED'].includes(err.code??err.message)?(err.code??err.message):'DELIVERY_TRANSPORT';}
  const duracao=Math.round(performance.now()-start);
  await transacao(pool,async db=>{
   const locked=(await db.query('SELECT id FROM integration_deliveries WHERE id=$1 AND lease_id=$2 FOR UPDATE',[e.id,lease])).rowCount;if(!locked)return;
   const hook=(await db.query('SELECT * FROM integration_webhooks WHERE id=$1 FOR UPDATE',[w.id])).rows[0];
   let resultado=resultadoEntrega(http);if(['UNSAFE_DESTINATION','DESTINATION_NOT_APPROVED'].includes(erro))resultado='reverificar';
   const proxima=resultado==='retry'?proximaTentativa(e.tentativas,e.criado_em.getTime(),Date.now(),retry):null;
   const estado=resultado==='aceita'?'aceita':resultado==='retry'&&proxima?'aguardando_retry':resultado==='retry'?'expirada':'falha_permanente';
   await db.query('UPDATE integration_attempts SET iniciado_em=$2,finalizado_em=now(),duracao_ms=$3,http_status=$4,codigo_falha=$5 WHERE id=$1',[tentativaId,inicio,duracao,http,erro??(resultado==='aceita'?null:'HTTP_'+http)]);
   await db.query("UPDATE integration_deliveries SET estado=$2,ultimo_http_status=$3,proxima_tentativa_em=coalesce($4,proxima_tentativa_em),finalizado_em=CASE WHEN $2='aguardando_retry' THEN NULL ELSE now() END,lease_id=NULL,lease_ate=NULL WHERE id=$1",[e.id,estado,http,proxima]);
   if(resultado==='aceita'){
    if(e.tipo_evento==='webhook.teste'&&hook.url===w.url){await db.query("UPDATE integration_webhooks SET verificado_em=now(),estado=CASE WHEN ativo THEN 'ativo' ELSE 'pausado' END,versao=versao+1,atualizado_em=now(),falhas=0,circuito_ate=NULL WHERE id=$1",[w.id]);}
    else await db.query('UPDATE integration_webhooks SET falhas=0,circuito_ate=NULL WHERE id=$1',[w.id]);
   }else if(['pausar','desativar','reverificar'].includes(resultado)){
    await db.query("UPDATE integration_webhooks SET ativo=false,estado=$2,verificado_em=CASE WHEN $3 THEN NULL ELSE verificado_em END,versao=versao+1,atualizado_em=now() WHERE id=$1",[w.id,resultado==='desativar'?'desativado':resultado==='reverificar'?'pendente_verificacao':'pausado',resultado==='reverificar']);
   }else if(resultado==='retry'){
    const falhas=hook.falhas+1;await db.query("UPDATE integration_webhooks SET falhas=$2,circuito_ate=CASE WHEN $2>=10 THEN now()+make_interval(secs=>LEAST(300,60*($2-9))) ELSE NULL END WHERE id=$1",[w.id,falhas]);
   }
  });return true;
 }
 return {distribuir,executar};
}
