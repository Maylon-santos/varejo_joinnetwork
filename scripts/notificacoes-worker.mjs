import {readFile,writeFile} from 'node:fs/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {criarNotificacoes,configNotificacoes} from '../backend/src/notificacoes.mjs';
import {criarTransportePush} from '../backend/src/notificacoes-transporte.mjs';
let control,pool,parar=false,despertar;
process.once('SIGINT',()=>{parar=true;despertar?.();});process.once('SIGTERM',()=>{parar=true;despertar?.();});
try{
 const config=configNotificacoes();if(!config.enabled||process.env.WEB_PUSH_WORKER_ENABLED!=='true')throw Error('PUSH_WORKER_DESATIVADO');
 const tenant=process.env.TENANT_KEY;if(!tenant)throw Error('TENANT_AUSENTE');
 control=criarPool(process.env.PUSH_CONTROL_DATABASE_URL,{max:2,application_name:'notificacoes-worker'});pool=criarPool(process.env.PUSH_TENANT_DATABASE_URL,{max:2,application_name:'notificacoes-worker'});
 const c=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url))),filiais=c.tenantGroupingConfirmed?c.branchIds:['30098297'];
 if((await pool.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');
 const nome=(await pool.query('SELECT current_database() AS nome')).rows[0].nome;
 if((await control.query('SELECT database_name FROM tenants WHERE tenant_key=$1',[tenant])).rows[0]?.database_name!==nome)throw Error('REGISTRO_INCORRETO');
 const notificacoes=criarNotificacoes({control,pool,tenant,filiais,config,enviar:criarTransportePush(config)});
 do{
  try{const r=await notificacoes.executar();await writeFile('/tmp/notificacoes-heartbeat',String(Date.now()),{mode:0o600});if(r.geradas||r.aceitas)console.log(JSON.stringify({evento:'push_ciclo',geradas:r.geradas,aceitas:r.aceitas}));}
  catch(e){console.error(JSON.stringify({evento:'push_ciclo_falhou',codigo:erroSeguro(e)}));if(process.argv.includes('--once'))throw e;}
  if(!parar&&!process.argv.includes('--once'))await new Promise(r=>{const timer=setTimeout(r,60000);despertar=()=>{clearTimeout(timer);r();};});
 }while(!parar&&!process.argv.includes('--once'));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{await Promise.all([control?.end(),pool?.end()]);}
