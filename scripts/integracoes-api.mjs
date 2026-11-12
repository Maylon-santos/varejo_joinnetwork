import {readFile} from 'node:fs/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {cofre,exigir} from '../backend/src/integracoes/seguranca.mjs';
import {identidade} from '../backend/src/integracoes/banco.mjs';
import {criarApiIntegracoes} from '../backend/src/integracoes/http.mjs';
import {criarAdministracao} from '../backend/src/integracoes/administracao.mjs';
import {criarAuth} from '../backend/src/admin-auth.mjs';

let pool,control,server;
try{
 exigir(process.env.INTEGRATIONS_ENABLED==='true',503,'INTEGRATIONS_DISABLED');
 const tenant=process.env.TENANT_KEY;exigir(tenant,503,'TENANT_REQUIRED');
 const crypt=cofre(process.env.INTEGRATIONS_ENCRYPTION_KEY),base=new URL(process.env.INTEGRATIONS_BASE_URL??'https://api-varejo.aeropostale.joinnetwork.com.br');exigir(base.protocol==='https:'&&base.pathname==='/'&&!base.search&&!base.hash&&!base.username&&!base.password,503,'INVALID_BASE_URL');
 pool=criarPool(process.env.INTEGRATIONS_DATABASE_URL??process.env.TENANT_DATABASE_URL,{max:4,statement_timeout:3000,application_name:'varejo-integracoes-api'});await identidade(pool,tenant);await pool.query('SELECT posicao FROM integration_dispatch_checkpoint WHERE singleton');
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url))),filiais=config.tenantGroupingConfirmed?config.branchIds:['30098297'];
 let administracao;
 if(process.env.INTEGRATIONS_ADMIN_ENABLED==='true'){control=criarPool(process.env.INTEGRATIONS_CONTROL_DATABASE_URL??process.env.CONTROL_DATABASE_URL,{max:2,application_name:'varejo-integracoes-admin'});administracao=criarAdministracao(pool,tenant,crypt,await criarAuth(control,tenant),filiais);}
 const ambiente=process.env.INTEGRATIONS_ENVIRONMENT??'homologacao';exigir(['homologacao','producao'].includes(ambiente),503,'INVALID_ENVIRONMENT');
 server=criarApiIntegracoes({pool,tenant,cofre:crypt,filiais,audience:base.origin+'/oauth/token',ambiente,administracao,proxyConfiavel:(process.env.INTEGRATIONS_TRUSTED_PROXIES??'').split(',').filter(Boolean),log:e=>console.error(JSON.stringify(e))});
 const port=Number(process.env.INTEGRATIONS_PORT??3200);exigir(Number.isInteger(port)&&port>=1&&port<=65535,503,'INVALID_PORT');
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,process.env.INTEGRATIONS_HOST??'127.0.0.1',resolve);});console.log(JSON.stringify({evento:'integrations_api_started',porta:port,administracao:!!administracao}));
 let closing=false;const stop=()=>{if(closing)return;closing=true;server.close(async()=>{await Promise.all([pool.end(),control?.end()]);});};process.once('SIGTERM',stop);process.once('SIGINT',stop);
}catch(e){console.error(erroSeguro(e));server?.close();await Promise.all([pool?.end(),control?.end()]);process.exitCode=1;}
