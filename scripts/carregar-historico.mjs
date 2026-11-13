import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as esperar} from 'node:timers/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {RepositorioPostgres} from '../backend/src/repositorio-postgres.mjs';
import {consultarCancelamentos,validarDia} from '../backend/src/sincronizar-cancelamentos.mjs';
import {iniciarCarga,carregarJanela,proximaJanela,consultarVendasHistoricas} from '../backend/src/carga-historica.mjs';

let pool,lock,parar=false;process.once('SIGTERM',()=>{parar=true;});process.once('SIGINT',()=>{parar=true;});
try{
 const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');if(i<0)throw Error('ARGUMENTO_INVALIDO');return [a.slice(0,i),a.slice(i+1)];}));
 if(Object.keys(args).some(k=>!['--inicio','--fim','--estado','--cobertura-desde'].includes(k)))throw Error('ARGUMENTO_INVALIDO');
 const {['--inicio']:inicio,['--fim']:fim,['--estado']:path,['--cobertura-desde']:coberturaDesde}=args;
 validarDia(coberturaDesde);if(!path||fim>=coberturaDesde)throw Error('HISTORICO_PLANO_INVALIDO');
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
 if(!config.tenantGroupingConfirmed||config.branchIds[0]!=='30098297'||config.initialImport.from!==coberturaDesde)throw Error('HISTORICO_ESCOPO_INVALIDO');
 const plano={tenant:process.env.TENANT_KEY,inicio,fim,coberturaDesde,filiais:config.branchIds};let estado=iniciarCarga(plano);
 await mkdir(dirname(path),{recursive:true,mode:0o700});
 const salvar=async value=>{const tmp=path+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx',flush:true});await rename(tmp,path);};
 try{const anterior=JSON.parse(await readFile(path,'utf8'));if(anterior.versao!==1||JSON.stringify(anterior.plano)!==JSON.stringify(plano)||JSON.stringify(anterior.filiais.map(f=>f.filial))!==JSON.stringify(plano.filiais)||anterior.filiais.some(f=>{validarDia(f.proximoDia);return f.proximoDia<inicio||f.proximoDia>new Date(Date.parse(fim)+86400000).toISOString().slice(0,10);}))throw Error('HISTORICO_ESTADO_INCOMPATIVEL');estado=anterior;}catch(e){if(e.code!=='ENOENT')throw e;await salvar(estado);}
 pool=criarPool(process.env.TENANT_DATABASE_URL,{max:3,application_name:'varejo-carga-historica'});lock=await pool.connect();
 if((await lock.query('SELECT tenant_key FROM tenant_identity')).rows[0]?.tenant_key!==plano.tenant)throw Error('TENANT_INCORRETO');
 if(!(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('historico:'||$1,0)) ok",[plano.tenant])).rows[0].ok)throw Error('HISTORICO_JA_ATIVO');
 const repositorio=new RepositorioPostgres(pool,plano.tenant),base={baseUrl:process.env.MILLENNIUM_BASE_URL,token:process.env.MILLENNIUM_BASIC_TOKEN};
 const confirmarCobertura=async filial=>{const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});return (await pool.query("SELECT count(*)::int n FROM sync_checkpoints WHERE filial=$1 AND recurso IN ('vendas','cancelamentos') AND ate>=$2",[filial,hoje])).rows[0].n===2;};
 let falhas=0,diasPorJanela=1;
 while(!parar){
  const janela=proximaJanela(estado,diasPorJanela);
  if(!janela){
   const n=(await pool.query('SELECT count(*)::int n FROM integration_dirty')).rows[0].n;
   if(n){await esperar(5000);continue;}estado.estado='concluido';estado.atualizadoEm=new Date().toISOString();await salvar(estado);console.log(JSON.stringify({evento:'historico_concluido',filiais:estado.filiais.length}));break;
  }
  try{
   if((await pool.query('SELECT count(*)::int n FROM integration_dirty')).rows[0].n>1000){await esperar(5000);continue;}
   const result=await carregarJanela({estado,maxDias:diasPorJanela,repositorio,salvar,confirmarCobertura,consultarVendas:p=>consultarVendasHistoricas({...base,...p}),consultarCancelamentos:p=>consultarCancelamentos({...base,...p})});
   estado=result.estado;falhas=0;diasPorJanela=1;
   console.log(JSON.stringify({evento:'historico_janela_concluida',...result.janela,operacoes:result.operacoes,cancelamentos:result.cancelamentos,clientesPendentes:result.clientesPendentes,pagamentosPendentes:result.pagamentosPendentes}));
   await esperar(500);
  }catch(e){
   const codigo=erroSeguro(e);falhas++;diasPorJanela=1;
   estado.estado='aguardando_retentativa';estado.atualizadoEm=new Date().toISOString();estado.ultimoErro={...janela,codigo,tentativas:falhas};await salvar(estado);
   console.error(JSON.stringify({evento:'historico_retentativa',...estado.ultimoErro}));
   // Retomar sempre o mesmo dia; nenhuma filial ou data é pulada.
   for(let i=0;i<Math.min(300,5*2**Math.min(falhas-1,6))&&!parar;i++)await esperar(1000);
  }
 }
}catch(e){console.error(JSON.stringify({evento:'historico_interrompido',codigo:erroSeguro(e)}));process.exitCode=1;}
finally{if(lock){await lock.query('SELECT pg_advisory_unlock_all()').catch(()=>{});lock.release();}await pool?.end();}
