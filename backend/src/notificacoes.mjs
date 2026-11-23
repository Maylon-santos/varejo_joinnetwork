import {randomUUID} from 'node:crypto';
import {ErroApi} from './painel.mjs';
import {hashToken} from './admin-auth.mjs';
import {cofre} from './integracoes/seguranca.mjs';
import {uuid,hashPush,escopoResumo,validarPreferencias,validarInscricao,instanteLocal,horarioResumo,fusoResumo,lerResumo,payloadResumo} from './notificacoes-regras.mjs';

export function configNotificacoes(env=process.env){
 return {enabled:env.WEB_PUSH_ENABLED==='true',publicKey:env.WEB_PUSH_PUBLIC_KEY,privateKey:env.WEB_PUSH_PRIVATE_KEY,encryptionKey:env.WEB_PUSH_ENCRYPTION_KEY,subject:env.WEB_PUSH_SUBJECT,pilotUsers:(env.WEB_PUSH_PILOT_USERS||'').split(',').filter(Boolean)};
}
export async function usuarioNotificacoes(db,tenant,id,{travar=false}={}){
 const user=(await db.query(`SELECT u.id,u.tenant_key,u.role,r.permissoes,r.todas_filiais,r.somente_proprias_vendas FROM admin_users u JOIN access_roles r USING(tenant_key,role) WHERE u.tenant_key=$1 AND u.id=$2 AND u.active ${travar?'FOR SHARE OF u,r':''}`,[tenant,id])).rows[0];
 if(!user)return null;
 user.vinculos=(await db.query(`SELECT filial::text,vendedor_codigo FROM user_branches WHERE user_id=$1 AND tenant_key=$2 ${travar?'FOR SHARE':''}`,[id,tenant])).rows;
 return user;
}
export function criarNotificacoes({control,pool,tenant,filiais,config=configNotificacoes(),agora=()=>new Date(),enviar}){
 const {enabled,publicKey,pilotUsers}=config;
 let seguro;
 if(enabled){
  if(!publicKey||!pilotUsers.length||pilotUsers.some(id=>!uuid.test(id)))throw Error('PUSH_CONFIGURACAO_INVALIDA');
  try{seguro=cofre(config.encryptionKey);validarInscricao({endpoint:'https://web.push.apple.com/config',keys:{p256dh:publicKey,auth:Buffer.alloc(16).toString('base64url')}});}catch{throw Error('PUSH_CONFIGURACAO_INVALIDA');}
 }
 const disponivel=user=>enabled&&!!escopoResumo(user,tenant,filiais,pilotUsers);
 const permitidas=user=>{const f=enabled&&escopoResumo(user,tenant,filiais,pilotUsers);if(!f)throw new ErroApi(403,'NOTIFICACOES_NAO_LIBERADAS');return f;};
 const contexto=(tipo,id,user)=>`push:${tenant}:${user}:${tipo}:${id}`;
 const parametros=user=>[user.id,tenant];
 async function transacao(user,fn){
  permitidas(user);const db=await control.connect();
  try{await db.query('BEGIN');await db.query('SELECT id FROM admin_users WHERE id=$1 AND tenant_key=$2 FOR UPDATE',parametros(user));const atual=await usuarioNotificacoes(db,tenant,user.id,{travar:true});permitidas(atual);const result=await fn(db,atual);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 async function preferencias(db,user){return (await db.query('SELECT resumo_diario,filiais,atualizado_em FROM notificacao_preferencias WHERE usuario_id=$1 AND tenant_key=$2',parametros(user))).rows[0]||{resumo_diario:false,filiais:[]};}
 async function adicionar(db,user,device,{tipo,chave,filial=null,dia=null,payload,expira}){
  const id=randomUUID();return (await db.query(`INSERT INTO notificacao_entregas(id,usuario_id,tenant_key,dispositivo_id,chave,tipo,filial,dia,payload_cifrado,expira_em) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(tenant_key,chave) DO NOTHING RETURNING id`,[id,user.id,tenant,device.id,chave,tipo,filial,dia,seguro.cifrar({...payload,tag:hashPush(chave).slice(0,32)},contexto('entrega',id,user.id)),expira])).rows[0]?.id;
 }
 async function cancelar(db,where,args){await db.query(`UPDATE notificacao_entregas SET estado='cancelada',erro_codigo='ADESAO_OU_ACESSO_REMOVIDO',finalizado_em=now() WHERE estado='pendente' AND ${where}`,args);}
 const api={
  disponivel,
  status:async(user,sessao)=>{
   if(!disponivel(user))return {disponivel:false};
   const f=permitidas(user),p=await preferencias(control,user),devices=(await control.query('SELECT id,nome,ativo,criado_em,ultimo_envio_em,sessao_hash=$3 AS nesta_sessao FROM notificacao_dispositivos WHERE usuario_id=$1 AND tenant_key=$2 AND ativo ORDER BY criado_em DESC', [...parametros(user),hashToken(sessao)])).rows;
   return {disponivel:true,chave_publica:publicKey,horario:horarioResumo,fuso:fusoResumo,preferencias:{...p,filiais:p.filiais.filter(id=>f.includes(id))},dispositivos:devices};
  },
  salvarPreferencias:(user,body)=>transacao(user,async(db,atual)=>{
   const p=validarPreferencias(body,permitidas(atual));await db.query(`INSERT INTO notificacao_preferencias(usuario_id,tenant_key,resumo_diario,filiais) VALUES($1,$2,$3,$4) ON CONFLICT(usuario_id,tenant_key) DO UPDATE SET resumo_diario=EXCLUDED.resumo_diario,filiais=EXCLUDED.filiais,atualizado_em=now()`,[...parametros(user),p.resumo_diario,JSON.stringify(p.filiais)]);
   await cancelar(db,"usuario_id=$1 AND tenant_key=$2 AND tipo='resumo_diario' AND (NOT $3::boolean OR NOT (filial::text=ANY($4::text[])))",[...parametros(user),p.resumo_diario,p.filiais]);return {ok:true,preferencias:p};
  }),
  inscrever:(user,sessao,body)=>transacao(user,async db=>{
   if(!body||Object.keys(body).some(k=>!['inscricao','nome'].includes(k))||typeof body.nome!=='string'||!body.nome.trim()||body.nome.length>80||/[\x00-\x1f]/.test(body.nome))throw new ErroApi(400,'PUSH_INSCRICAO_INVALIDA');
   const inscricao=validarInscricao(body.inscricao),hash=hashPush(inscricao.endpoint),existente=(await db.query('SELECT id,usuario_id,tenant_key FROM notificacao_dispositivos WHERE endpoint_hash=$1 FOR UPDATE',[hash])).rows[0];
   if(existente&&(existente.usuario_id!==user.id||existente.tenant_key!==tenant))throw new ErroApi(409,'PUSH_APARELHO_OUTRA_CONTA');
   const count=(await db.query('SELECT count(*)::int AS total FROM notificacao_dispositivos WHERE usuario_id=$1 AND tenant_key=$2 AND ativo AND endpoint_hash<>$3',[...parametros(user),hash])).rows[0].total;
   if(count>=3)throw new ErroApi(409,'PUSH_LIMITE_APARELHOS');
   const id=existente?.id||randomUUID();const salvo=await db.query(`INSERT INTO notificacao_dispositivos(id,usuario_id,tenant_key,sessao_hash,endpoint_hash,inscricao_cifrada,vapid_hash,nome) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(endpoint_hash) DO UPDATE SET sessao_hash=EXCLUDED.sessao_hash,inscricao_cifrada=EXCLUDED.inscricao_cifrada,vapid_hash=EXCLUDED.vapid_hash,nome=EXCLUDED.nome,ativo=true,atualizado_em=now(),ultimo_status=NULL WHERE notificacao_dispositivos.usuario_id=EXCLUDED.usuario_id AND notificacao_dispositivos.tenant_key=EXCLUDED.tenant_key RETURNING id`,[id,...parametros(user),hashToken(sessao),hash,seguro.cifrar(inscricao,contexto('dispositivo',id,user.id)),hashPush(publicKey),body.nome.trim()]);if(!salvo.rowCount)throw new ErroApi(409,'PUSH_APARELHO_OUTRA_CONTA');return {ok:true,id:salvo.rows[0].id};
  }),
  desativar:(user,id)=>transacao(user,async db=>{
   if(!uuid.test(id))throw new ErroApi(400,'PUSH_APARELHO_INVALIDO');
   const r=await db.query('UPDATE notificacao_dispositivos SET ativo=false,atualizado_em=now() WHERE id=$3 AND usuario_id=$1 AND tenant_key=$2 RETURNING id',[...parametros(user),id]);if(!r.rowCount)throw new ErroApi(404,'PUSH_APARELHO_INVALIDO');await cancelar(db,'dispositivo_id=$1',[id]);return {ok:true};
  }),
  sair:async(user,sessao)=>{
   if(!enabled)return;
   const db=await control.connect();try{await db.query('BEGIN');const ids=(await db.query('UPDATE notificacao_dispositivos SET ativo=false,atualizado_em=now() WHERE usuario_id=$1 AND tenant_key=$2 AND sessao_hash=$3 RETURNING id',[...parametros(user),hashToken(sessao)])).rows.map(d=>d.id);if(ids.length)await cancelar(db,'dispositivo_id=ANY($1::uuid[])',[ids]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  },
  testar:(user,sessao,body)=>transacao(user,async db=>{
   if(!body||Object.keys(body).some(k=>!['dispositivo','requisicao'].includes(k))||!uuid.test(body.dispositivo||'')||!uuid.test(body.requisicao||''))throw new ErroApi(400,'PUSH_APARELHO_INVALIDO');
   const d=(await db.query('SELECT id FROM notificacao_dispositivos WHERE id=$3 AND usuario_id=$1 AND tenant_key=$2 AND sessao_hash=$4 AND ativo',[...parametros(user),body.dispositivo,hashToken(sessao)])).rows[0];if(!d)throw new ErroApi(404,'PUSH_APARELHO_INVALIDO');
   const chave=`teste:${user.id}:${body.requisicao}`;
   const anterior=(await db.query('SELECT id FROM notificacao_entregas WHERE tenant_key=$1 AND chave=$2',[tenant,chave])).rows[0];if(anterior)return {ok:true,id:anterior.id};
   if((await db.query("SELECT 1 FROM notificacao_entregas WHERE usuario_id=$1 AND tenant_key=$2 AND tipo='teste' AND criado_em>now()-interval '1 minute' LIMIT 1",parametros(user))).rowCount)throw new ErroApi(429,'PUSH_TESTE_AGUARDE');
   const id=await adicionar(db,user,d,{tipo:'teste',chave,payload:{title:'Notificações ativadas',body:'Este é um aviso de teste da Aéropostale. Para receber o resumo diário após as 22h, escolha as filiais e ative a opção nas preferências.',url:'/?origem=notificacoes'},expira:new Date(agora().getTime()+10*60000)});return {ok:true,id};
  }),
  historico:async user=>{
   const f=permitidas(user);const rows=(await control.query('SELECT id,tipo,filial::text,dia::text,estado,criado_em,finalizado_em,payload_cifrado FROM notificacao_entregas WHERE usuario_id=$1 AND tenant_key=$2 AND (filial IS NULL OR filial::text=ANY($3::text[])) ORDER BY criado_em DESC,id DESC LIMIT 20',[...parametros(user),f])).rows;
   return {entregas:rows.map(row=>{const {payload_cifrado,...r}=row;const p=seguro.abrir(payload_cifrado,contexto('entrega',r.id,user.id));return {...r,titulo:p.title,texto:p.body,parcial:!!p.parcial};})};
  },
  executar:async()=>{
   if(!enabled||!enviar)return {geradas:0,aceitas:0};const db=await control.connect();let locked=false;
   try{
    locked=(await db.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked",['notificacoes:'+tenant])).rows[0].locked;if(!locked)return {ocupado:true};
    const now=agora(),local=instanteLocal(now),resultado={geradas:0,aceitas:0};
    // Uma interrupção após a tentativa deixa resultado incerto. Não reenviar
    // automaticamente: o serviço pode ter aceitado a mensagem antes da queda.
    await db.query("UPDATE notificacao_entregas SET estado='incerta',erro_codigo='PROCESSO_INTERROMPIDO',finalizado_em=now() WHERE tenant_key=$1 AND estado='enviando'",[tenant]);
    await db.query("UPDATE notificacao_entregas SET estado='expirada',finalizado_em=now() WHERE tenant_key=$1 AND estado='pendente' AND expira_em<=$2",[tenant,now]);
    if(local.hora>=horarioResumo&&local.hora<='23:55'){
     const aderentes=(await db.query('SELECT usuario_id,filiais FROM notificacao_preferencias WHERE tenant_key=$1 AND resumo_diario AND usuario_id=ANY($2::uuid[])',[tenant,pilotUsers])).rows;
     for(const p of aderentes){
      const user=await usuarioNotificacoes(db,tenant,p.usuario_id),f=enabled&&escopoResumo(user,tenant,filiais,pilotUsers);if(!f)continue;
      const devices=(await db.query('SELECT id FROM notificacao_dispositivos WHERE usuario_id=$1 AND tenant_key=$2 AND ativo AND vapid_hash=$3',[user.id,tenant,hashPush(publicKey)])).rows;if(!devices.length)continue;
      for(const filial of p.filiais.filter(id=>f.includes(id))){
       const faltam=[];for(const d of devices){const chave=`resumo:${user.id}:${filial}:${local.dia}:${d.id}`;if(!(await db.query('SELECT 1 FROM notificacao_entregas WHERE tenant_key=$1 AND chave=$2',[tenant,chave])).rowCount)faltam.push({d,chave});}if(!faltam.length)continue;
       const resumo=await lerResumo(pool,tenant,filial,local.dia,now);if(!resumo.atualizado&&local.hora<'22:30')continue;
       const payload=payloadResumo(resumo);for(const {d,chave} of faltam)if(await adicionar(db,user,d,{tipo:'resumo_diario',chave,filial,dia:local.dia,payload,expira:new Date(local.dia+'T23:59:59-03:00')}))resultado.geradas++;
      }
     }
    }
    const jobs=(await db.query("SELECT id FROM notificacao_entregas WHERE tenant_key=$1 AND estado='pendente' AND proxima_tentativa<=$2 AND expira_em>$2 ORDER BY criado_em,id LIMIT 30",[tenant,now])).rows;
    for(const {id} of jobs){
     await db.query('BEGIN');
     try{
      const j=(await db.query("SELECT * FROM notificacao_entregas WHERE id=$1 AND estado='pendente' FOR UPDATE",[id])).rows[0];if(!j){await db.query('ROLLBACK');continue;}
      if(new Date(j.expira_em)<=agora()){await db.query("UPDATE notificacao_entregas SET estado='expirada',finalizado_em=now() WHERE id=$1",[id]);await db.query('COMMIT');continue;}
      const user=await usuarioNotificacoes(db,tenant,j.usuario_id),f=user&&escopoResumo(user,tenant,filiais,pilotUsers),d=(await db.query('SELECT * FROM notificacao_dispositivos WHERE id=$1 FOR SHARE',[j.dispositivo_id])).rows[0];
      const p=user?await preferencias(db,user):null;
      if(!f||!d?.ativo||d.vapid_hash!==hashPush(publicKey)||j.tipo==='resumo_diario'&&(!p?.resumo_diario||!p.filiais.includes(String(j.filial))||!f.includes(String(j.filial)))){
       await db.query("UPDATE notificacao_entregas SET estado='cancelada',erro_codigo='ADESAO_OU_ACESSO_REMOVIDO',finalizado_em=now() WHERE id=$1",[id]);await db.query('COMMIT');continue;
      }
      const inscricao=seguro.abrir(d.inscricao_cifrada,contexto('dispositivo',d.id,user.id)),payload=seguro.abrir(j.payload_cifrado,contexto('entrega',id,user.id));
      // Persistir a intenção ANTES da rede. O lock global impede outro worker.
      await db.query("UPDATE notificacao_entregas SET estado='enviando',tentativas=tentativas+1 WHERE id=$1",[id]);await db.query('COMMIT');
      // Revalidar depois do claim: preferências/logout podem ter sido alterados.
      await db.query('BEGIN');const atual=await usuarioNotificacoes(db,tenant,user.id),atualF=atual&&escopoResumo(atual,tenant,filiais,pilotUsers),atualD=(await db.query('SELECT ativo FROM notificacao_dispositivos WHERE id=$1 FOR SHARE',[d.id])).rows[0],atualP=atual?await preferencias(db,atual):null;
      if(!atualF||!atualD?.ativo||j.tipo==='resumo_diario'&&(!atualP?.resumo_diario||!atualP.filiais.includes(String(j.filial))||!atualF.includes(String(j.filial)))){await db.query("UPDATE notificacao_entregas SET estado='cancelada',finalizado_em=now() WHERE id=$1",[id]);await db.query('COMMIT');continue;}
      const envioEm=agora();if(new Date(j.expira_em)<=envioEm){await db.query("UPDATE notificacao_entregas SET estado='expirada',finalizado_em=now() WHERE id=$1",[id]);await db.query('COMMIT');continue;}
      let res,erro=null;try{res=await enviar(inscricao,payload,{ttl:Math.min(1800,Math.max(1,Math.floor((new Date(j.expira_em)-envioEm)/1000))),topic:payload.tag});}catch(e){erro=e.message;}
      const status=res?.status,aceita=status>=200&&status<300,expirou=status===404||status===410,retry=[429,500,502,503,504].includes(status)&&j.tentativas+1<3;
      let espera=60;if(res?.retryAfter){const valor=String(res.retryAfter),s=/^\d+$/.test(valor)?Number(valor):(Date.parse(valor)-envioEm)/1000;if(Number.isFinite(s))espera=Math.min(3600,Math.max(60,s));}
      const estado=aceita?'aceita':erro==='PUSH_TRANSPORTE_INCERTO'?'incerta':retry?'pendente':'falha';
      await db.query("UPDATE notificacao_entregas SET estado=$2,status_http=$3,erro_codigo=$4,proxima_tentativa=$5,finalizado_em=CASE WHEN $2='pendente' THEN NULL ELSE now() END WHERE id=$1",[id,estado,status||null,aceita?null:erro==='PUSH_TRANSPORTE_INCERTO'?'TRANSPORTE_INCERTO':expirou?'INSCRICAO_EXPIRADA':erro?'DESTINO_OU_DNS_REJEITADO':'SERVICO_PUSH_RECUSOU',new Date(envioEm.getTime()+espera*1000)]);
      // Atualizar depois de liberar o FOR SHARE, dentro da mesma transação.
      await db.query('UPDATE notificacao_dispositivos SET ativo=CASE WHEN $2 THEN false ELSE ativo END,ultimo_status=$3,ultimo_envio_em=CASE WHEN $4 THEN now() ELSE ultimo_envio_em END WHERE id=$1',[d.id,expirou,status||null,aceita]);await db.query('COMMIT');if(aceita)resultado.aceitas++;
     }catch(e){await db.query('ROLLBACK');throw e;}
    }
    // Retenção curta: nem histórico nem endpoints inativos ficam indefinidamente.
    await db.query("DELETE FROM notificacao_entregas WHERE tenant_key=$1 AND criado_em<now()-interval '30 days'",[tenant]);await db.query("DELETE FROM notificacao_dispositivos WHERE tenant_key=$1 AND NOT ativo AND atualizado_em<now()-interval '30 days'",[tenant]);return resultado;
   }finally{if(locked)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',['notificacoes:'+tenant]);db.release();}
  }
 };
 return api;
}
