import {criarFila} from '../backend/src/fila-atendimento.mjs';
import {criarGestaoUsuarios} from '../backend/src/gestao-usuarios.mjs';
import {criarGestaoPermissoes} from '../backend/src/gestao-permissoes.mjs';
import {readFile} from 'node:fs/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {criarAuth} from '../backend/src/admin-auth.mjs';
import {criarPainel} from '../backend/src/painel.mjs';
import {criarServidor} from '../backend/src/http-api.mjs';
import {carregarImagemProduto} from '../backend/src/detalhes-erp.mjs';
import {criarFrontend} from '../backend/src/frontend.mjs';
const control=criarPool(process.env.CONTROL_DATABASE_URL),tenantDb=criarPool(process.env.TENANT_DATABASE_URL);
let server;
try{
 const tenant=process.env.TENANT_KEY;
 if(!tenant)throw new Error('TENANT_AUSENTE');
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
 const filiais=config.tenantGroupingConfirmed?config.branchIds:['30098297'];
 const health=async()=>{
  const identity=await tenantDb.query('SELECT tenant_key FROM tenant_identity WHERE singleton');
  if(identity.rows[0]?.tenant_key!==tenant)throw new Error('TENANT_INCORRETO');
  const db=(await tenantDb.query('SELECT current_database() AS nome')).rows[0].nome;
  const registry=await control.query('SELECT database_name FROM tenants WHERE tenant_key=$1',[tenant]);
  if(registry.rows[0]?.database_name!==db)throw new Error('REGISTRO_INCORRETO');
 };
 await health();
 const auth=await criarAuth(control,tenant),painel=criarPainel(tenantDb,tenant,filiais);
 server=criarServidor({auth,painel,filiais,fila:criarFila(tenantDb,tenant,filiais),gestaoPermissoes:criarGestaoPermissoes(control,tenant),gestaoUsuarios:criarGestaoUsuarios(control,tenantDb,tenant,filiais),imagemProduto:carregarImagemProduto,frontend:await criarFrontend(),health,log:e=>console.error(JSON.stringify(e))});
 const port=Number(process.env.PORT||3000);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORTA_INVALIDA');
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,process.env.API_HOST||'127.0.0.1',resolve);});
 console.log(JSON.stringify({evento:'api_iniciada',porta:port}));
 let encerrando=false;
 const fechar=()=>{if(encerrando)return;encerrando=true;server.close(async()=>{await Promise.all([control.end(),tenantDb.end()]);});};
 process.on('SIGTERM',fechar);process.on('SIGINT',fechar);
}catch(e){console.error(erroSeguro(e));server?.close();await Promise.all([control.end(),tenantDb.end()]);process.exitCode=1;}
