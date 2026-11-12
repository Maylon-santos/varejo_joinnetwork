import {randomUUID} from 'node:crypto';
import {exigir,Falha,UUID,hash,etag,novoSegredo} from './seguranca.mjs';
import {escopo,transacao} from './banco.mjs';
import {validarDestino} from './destinos.mjs';
import {parametros,meta} from './consultas.mjs';

const EVENTOS=['venda.importada','venda.atualizada','venda.cancelada'];
export function webhookDTO(w){return {id:w.id,nome:w.nome,url:w.url,eventos:w.eventos,filiais:w.filiais,ativo:w.ativo,estado:w.estado,verificado_em:w.verificado_em?.toISOString()??null,criado_em:w.criado_em.toISOString(),atualizado_em:w.atualizado_em.toISOString(),versao:w.versao};}
export function entregaDTO(e){return {id:e.id,webhook_id:e.webhook_id,evento_id:e.evento_id,estado:e.estado,tentativas:e.tentativas,ultimo_http_status:e.ultimo_http_status,proxima_tentativa_em:['na_fila','enviando','aguardando_retry'].includes(e.estado)?e.proxima_tentativa_em.toISOString():null,criado_em:e.criado_em.toISOString(),finalizado_em:e.finalizado_em?.toISOString()??null};}
export function criarWebhooks(pool,cofre,consultas){
 return async(c,method,path,params,headers,body,requestId,dbCompartilhado=null)=>{
  escopo(c,method==='GET'?'webhooks:ler':'webhooks:gerenciar');escopo(c,'vendas:ler');
  const parts=path.split('/').slice(3),id=parts[0];exigir(!id||UUID.test(id),404,'NOT_FOUND');
  const executar=async db=>{
   const p=parametros(params,method==='GET'?['limite','cursor']:[]);
   if(method==='GET'){
    if(!id)return {status:200,body:await consultas.paginar(db,c,path,p,async()=>(await db.query('SELECT * FROM integration_webhooks WHERE cliente_id=$1 ORDER BY criado_em,id',[c.id])).rows.map(webhookDTO),requestId)};
    const w=(await db.query('SELECT * FROM integration_webhooks WHERE id=$1 AND cliente_id=$2',[id,c.id])).rows[0];exigir(w,404,'NOT_FOUND');
    if(parts.length===1)return {status:200,body:{data:webhookDTO(w),meta:meta(requestId)},etag:etag(w.id,w.versao)};
    exigir(parts.length===2&&parts[1]==='entregas',404,'NOT_FOUND');return {status:200,body:await consultas.paginar(db,c,path,p,async()=>(await db.query("SELECT * FROM integration_deliveries WHERE webhook_id=$1 AND criado_em>now()-interval '30 days' ORDER BY criado_em DESC,id LIMIT 10001",[id])).rows.map(entregaDTO),requestId)};
   }
   exigir(['POST','PUT'].includes(method),405,'METHOD_NOT_ALLOWED');
   const key=headers['idempotency-key'];exigir(UUID.test(key??''),400,'IDEMPOTENCY_KEY_REQUIRED');
   const digest=hash([method,path,body]);
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['client-mutation:'+c.id]);
   const cached=(await db.query('SELECT * FROM integration_idempotency WHERE cliente_id=$1 AND chave=$2 AND expira_em>now()',[c.id,key])).rows[0];
   if(cached){exigir(cached.hash===digest,409,'IDEMPOTENCY_CONFLICT');return {status:cached.status,etag:cached.etag,body:cofre.abrir(cached.resposta,'idempotency:'+c.id+':'+key)};}
   let w=id?(await db.query('SELECT * FROM integration_webhooks WHERE id=$1 AND cliente_id=$2 FOR UPDATE',[id,c.id])).rows[0]:null;if(id)exigir(w,404,'NOT_FOUND');
   let result;
   if(!id&&method==='POST'||id&&parts.length===1&&method==='PUT'){
    exigir(body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).length===5&&['nome','url','eventos','filiais','ativo'].every(k=>Object.hasOwn(body,k)),422,'INVALID_WEBHOOK');
    exigir(typeof body.nome==='string'&&body.nome.trim().length>0&&body.nome.length<=120&&typeof body.ativo==='boolean'&&Array.isArray(body.eventos)&&body.eventos.length>0&&body.eventos.length<=3&&new Set(body.eventos).size===body.eventos.length&&body.eventos.every(e=>EVENTOS.includes(e))&&Array.isArray(body.filiais)&&body.filiais.length>0&&body.filiais.length<=100&&new Set(body.filiais).size===body.filiais.length&&body.filiais.every(f=>c.filiais.includes(f)),422,'INVALID_WEBHOOK');
    const u=validarDestino(body.url,c.hosts);
    if(!w){
     exigir(body.ativo===false,422,'VERIFICATION_REQUIRED');exigir((await db.query('SELECT count(*)::int n FROM integration_webhooks WHERE cliente_id=$1',[c.id])).rows[0].n<3,409,'WEBHOOK_LIMIT');
     const wid=randomUUID(),secret=novoSegredo();w=(await db.query('INSERT INTO integration_webhooks(id,cliente_id,nome,url,hostname,eventos,filiais,segredo) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[wid,c.id,body.nome.trim(),u.href,u.hostname,JSON.stringify(body.eventos),JSON.stringify(body.filiais),cofre.cifrar(secret,'webhook:'+wid)])).rows[0];
     result={status:201,etag:etag(w.id,w.versao),body:{webhook:webhookDTO(w),signing_secret:secret,chave_anterior_valida_ate:null}};
    }else{
     exigir(headers['if-match'],428,'IF_MATCH_REQUIRED');exigir(headers['if-match']===etag(w.id,w.versao),412,'RESOURCE_CHANGED');
     const mudou=u.href!==w.url;exigir(!body.ativo||!mudou&&w.verificado_em,409,'VERIFICATION_REQUIRED');
     w=(await db.query(`UPDATE integration_webhooks SET nome=$2,url=$3,hostname=$4,eventos=$5,filiais=$6,ativo=$7,estado=$8,verificado_em=CASE WHEN $9 THEN NULL ELSE verificado_em END,versao=versao+1,atualizado_em=now() WHERE id=$1 RETURNING *`,[w.id,body.nome.trim(),u.href,u.hostname,JSON.stringify(body.eventos),JSON.stringify(body.filiais),body.ativo,body.ativo?'ativo':mudou?'pendente_verificacao':'pausado',mudou])).rows[0];
     result={status:200,etag:etag(w.id,w.versao),body:{data:webhookDTO(w),meta:meta(requestId)}};
    }
   }else if(w&&method==='POST'&&parts.length===2&&parts[1]==='rotacionar-segredo'){
    exigir(Object.keys(body).length===0,422,'INVALID_REQUEST');exigir(headers['if-match'],428,'IF_MATCH_REQUIRED');exigir(headers['if-match']===etag(w.id,w.versao),412,'RESOURCE_CHANGED');
    exigir(!w.anterior_ate||w.anterior_ate.getTime()<=Date.now(),409,'ROTATION_IN_PROGRESS');
    const secret=novoSegredo();w=(await db.query("UPDATE integration_webhooks SET segredo_anterior=segredo,anterior_ate=now()+interval '24 hours',segredo=$2,versao=versao+1,atualizado_em=now() WHERE id=$1 RETURNING *",[id,cofre.cifrar(secret,'webhook:'+id)])).rows[0];result={status:200,etag:etag(w.id,w.versao),body:{webhook:webhookDTO(w),signing_secret:secret,chave_anterior_valida_ate:w.anterior_ate.toISOString()}};
   }else if(w&&method==='POST'&&parts.length===2&&parts[1]==='testes'){
    exigir(Object.keys(body).length===0,422,'INVALID_REQUEST');validarDestino(w.url,c.hosts);
    const eid=randomUUID(),did=randomUUID(),payload={id:eid,tipo:'webhook.teste',schema_version:'1.0',criado_em:new Date().toISOString(),data:{mensagem:'Teste de conectividade e assinatura'}};
    await db.query("INSERT INTO integration_deliveries(id,webhook_id,evento_id,tipo_evento,payload,configuracao_versao,destino_url,origem) VALUES($1,$2,$3,'webhook.teste',$4,$5,$6,'teste')",[did,id,eid,cofre.cifrar(payload,'event:'+eid),w.versao,w.url]);result={status:202,body:{id:did,estado:'na_fila'}};
   }else if(w&&method==='POST'&&parts.length===4&&parts[1]==='entregas'&&UUID.test(parts[2])&&parts[3]==='reenviar'){
    exigir(Object.keys(body).length===0,422,'INVALID_REQUEST');
    const e=(await db.query('SELECT * FROM integration_deliveries WHERE id=$1 AND webhook_id=$2',[parts[2],id])).rows[0];exigir(e,404,'NOT_FOUND');exigir(e.payload&&Date.now()-e.evento_criado_em.getTime()<30*86400000,410,'REPLAY_EXPIRED');exigir(e.filial&&w.ativo&&w.verificado_em&&c.filiais.includes(e.filial)&&w.filiais.includes(e.filial)&&w.eventos.includes(e.tipo_evento),403,'REPLAY_FORBIDDEN');
    const did=randomUUID(),ciclo=(await db.query('SELECT coalesce(max(ciclo),0)+1 n FROM integration_deliveries WHERE webhook_id=$1 AND evento_id=$2',[id,e.evento_id])).rows[0].n;
    await db.query("INSERT INTO integration_deliveries(id,webhook_id,evento_id,filial,tipo_evento,payload,configuracao_versao,destino_url,origem,ciclo,evento_criado_em) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'replay',$9,$10)",[did,id,e.evento_id,e.filial,e.tipo_evento,e.payload,w.versao,w.url,ciclo,e.evento_criado_em]);result={status:202,body:{id:did,estado:'na_fila'}};
   }else throw new Falha(404,'NOT_FOUND');
   await db.query('DELETE FROM integration_idempotency WHERE cliente_id=$1 AND chave=$2',[c.id,key]);
   await db.query('INSERT INTO integration_idempotency(cliente_id,chave,hash,resposta,status,etag) VALUES($1,$2,$3,$4,$5,$6)',[c.id,key,digest,cofre.cifrar(result.body,'idempotency:'+c.id+':'+key),result.status,result.etag??null]);return result;
  };
  return dbCompartilhado?executar(dbCompartilhado):transacao(pool,executar);
 };
}
