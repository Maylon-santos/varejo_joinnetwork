import {readFile} from 'node:fs/promises';
import {setTimeout as esperar} from 'node:timers/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {cofre,exigir} from '../backend/src/integracoes/seguranca.mjs';
import {criarPublicador} from '../backend/src/integracoes/projecoes.mjs';
import {criarEntregador} from '../backend/src/integracoes/entregas.mjs';
import {transacao} from '../backend/src/integracoes/banco.mjs';

let pool,parar=false;process.once('SIGTERM',()=>{parar=true;});process.once('SIGINT',()=>{parar=true;});
try{
 exigir(process.env.INTEGRATIONS_ENABLED==='true'&&process.env.INTEGRATIONS_WORKER_ENABLED==='true',503,'INTEGRATIONS_WORKER_DISABLED');
 const tenant=process.env.TENANT_KEY,crypt=cofre(process.env.INTEGRATIONS_ENCRYPTION_KEY);exigir(tenant,503,'TENANT_REQUIRED');
 pool=criarPool(process.env.INTEGRATIONS_WORKER_DATABASE_URL??process.env.TENANT_DATABASE_URL,{max:4,application_name:'varejo-integracoes-worker'});
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url))),filiais=config.tenantGroupingConfirmed?config.branchIds:['30098297'];
 const ambiente=process.env.INTEGRATIONS_ENVIRONMENT??'homologacao';exigir(['homologacao','producao'].includes(ambiente),503,'INVALID_ENVIRONMENT');
 const publicar=criarPublicador(pool,tenant,crypt,filiais),entregador=criarEntregador(pool,tenant,crypt,{filiais,ambiente});
 let ultimaLimpeza=0;
 do{
  try{
   const n=await publicar(100);await entregador.distribuir();
   // Só este worker faz saída de rede. A API e o coletor não aguardam HTTP externo.
   if(process.env.INTEGRATIONS_DELIVERIES_ENABLED==='true')await Promise.all([entregador.executar(),entregador.executar()]);
   if(Date.now()-ultimaLimpeza>3600000){
    await transacao(pool,async db=>{
     for(const table of ['integration_tokens','integration_jti','integration_snapshots','integration_idempotency','integration_admin_sessions'])await db.query(`DELETE FROM ${table} WHERE expira_em<now()`);
     await db.query("DELETE FROM integration_admission WHERE atualizado_em<now()-interval '1 day'");
     const acessos=await db.query("DELETE FROM integration_access_logs WHERE iniciado_em<now()-interval '90 days'");
     const auditoria=await db.query("DELETE FROM integration_admin_audit WHERE criado_em<now()-interval '90 days'");
     if(acessos.rowCount||auditoria.rowCount)await db.query("INSERT INTO integration_admin_audit(id,ator_id,tenant_key,acao,motivo,dados) VALUES(gen_random_uuid(),'00000000-0000-4000-8000-000000000000',$1,'retencao_automatica','Política de retenção de 90 dias',$2)",[tenant,JSON.stringify({acessos:acessos.rowCount,auditoria:auditoria.rowCount,ator_tipo:'worker'})]);
     await db.query("DELETE FROM integration_changes WHERE registrado_em<now()-interval '30 days' AND posicao<=(SELECT posicao FROM integration_dispatch_checkpoint)");
     await db.query("UPDATE integration_deliveries SET payload=NULL WHERE evento_criado_em<now()-interval '30 days' AND payload IS NOT NULL");
     await db.query("DELETE FROM integration_attempts WHERE entrega_id IN(SELECT id FROM integration_deliveries WHERE criado_em<now()-interval '90 days')");
     await db.query("DELETE FROM integration_deliveries WHERE criado_em<now()-interval '90 days'");
     await db.query("UPDATE integration_webhooks SET segredo_anterior=NULL,anterior_ate=NULL WHERE anterior_ate<now()");
    });ultimaLimpeza=Date.now();
   }
   if(!n&&!process.argv.includes('--once')&&!parar)await esperar(1000);
  }catch(e){console.error(JSON.stringify({evento:'integrations_cycle_failed',codigo:erroSeguro(e)}));if(process.argv.includes('--once'))throw e;if(!parar)await esperar(5000);}
 }while(!parar&&!process.argv.includes('--once'));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{await pool?.end();}
