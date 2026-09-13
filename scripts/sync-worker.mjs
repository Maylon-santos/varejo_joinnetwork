import {readFile} from 'node:fs/promises';
import {setTimeout as pausa} from 'node:timers/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {RepositorioPostgres} from '../backend/src/repositorio-postgres.mjs';
import {consultarVendas} from '../backend/src/vendas.mjs';
import {consultarCancelamentos,validarDia} from '../backend/src/sincronizar-cancelamentos.mjs';
import {sincronizarRecurso,atrasoAposFalhas} from '../backend/src/ciclo-sync.mjs';
let pool,lock,encerrar=false;
process.on('SIGTERM',()=>{encerrar=true;});process.on('SIGINT',()=>{encerrar=true;});
const once=process.argv.includes('--once');
const args=process.argv.slice(2);
try{
 if(args.some(x=>x!=='--once'))throw new Error('ARGUMENTO_INVALIDO');
 if(!once&&process.env.SYNC_ENABLED!=='true')throw new Error('SYNC_DESABILITADA');
 const intervalo=Number(process.env.SYNC_INTERVAL_SECONDS);
 if(!Number.isSafeInteger(intervalo)||intervalo<30)throw new Error('INTERVALO_INVALIDO');
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
 const tenant=process.env.TENANT_KEY;
 const inicioHistorico=process.env.SYNC_INITIAL_DATE||config.initialImport.from;validarDia(inicioHistorico);
 // A execução única carrega o período inicial; modo contínuo acompanha a data atual.
 const fimInicial=process.env.SYNC_INITIAL_END_DATE||config.initialImport.through;validarDia(fimInicial);
 const filiais=config.tenantGroupingConfirmed?config.branchIds:['30098297'];
 pool=criarPool(process.env.TENANT_DATABASE_URL);
 lock=await pool.connect();
 const identity=await lock.query('SELECT tenant_key FROM tenant_identity');
 if(identity.rows[0]?.tenant_key!==tenant)throw new Error('TENANT_INCORRETO');
 const locked=await lock.query("SELECT pg_try_advisory_lock(hashtextextended('worker:' || $1,0)) AS ok",[tenant]);
 if(!locked.rows[0].ok)throw new Error('WORKER_JA_ATIVO');
 const repo=new RepositorioPostgres(pool,tenant);
 const base={baseUrl:process.env.MILLENNIUM_BASE_URL,token:process.env.MILLENNIUM_BASIC_TOKEN};
 const consultas={vendas:p=>consultarVendas({...base,...p,onDuplicado:info=>console.log(JSON.stringify({evento:'duplicado_identico_ignorado',...info}))}),cancelamentos:p=>consultarCancelamentos({...base,...p})};
 console.log(JSON.stringify({evento:'worker_iniciado',modo:once?'carga_inicial':'periodico',filiais,intervaloSegundos:intervalo}));
 do{
  const fim=once?fimInicial:new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  for(const filial of filiais)for(const recurso of ['vendas','cancelamentos']){
   if(encerrar)break;
   const state=await pool.query('SELECT falhas_consecutivas,proxima_tentativa > now() AS aguardar FROM sync_status WHERE filial=$1 AND recurso=$2',[filial,recurso]);
   if(!once&&state.rows[0]?.aguardar)continue;
   try{
    const result=await sincronizarRecurso({repositorio:repo,tenant,filial,recurso,inicioHistorico,fim,consultar:consultas[recurso],parar:()=>encerrar,progresso:p=>{
     if(p.janelas===1||p.janelas%10===0||p.dia===fim)console.log(JSON.stringify({evento:'progresso',...p}));
    }});
    await pool.query(`INSERT INTO sync_status(filial,recurso,ultimo_sucesso,proxima_tentativa) VALUES($1,$2,now(),now()+$3*interval '1 second')
      ON CONFLICT(filial,recurso) DO UPDATE SET falhas_consecutivas=0,ultimo_sucesso=now(),ultimo_erro_codigo=NULL,proxima_tentativa=EXCLUDED.proxima_tentativa`,[filial,recurso,intervalo]);
    console.log(JSON.stringify({evento:'ciclo_concluido',...result}));
   }catch(error){
    if(encerrar)break;
    const falhas=(state.rows[0]?.falhas_consecutivas||0)+1;
    const atraso=atrasoAposFalhas(intervalo,falhas),codigo=erroSeguro(error);
    await pool.query(`INSERT INTO sync_status(filial,recurso,falhas_consecutivas,ultimo_erro_codigo,proxima_tentativa)
      VALUES($1,$2,$3,$4,now()+$5*interval '1 second') ON CONFLICT(filial,recurso) DO UPDATE
      SET falhas_consecutivas=EXCLUDED.falhas_consecutivas,ultimo_erro_codigo=EXCLUDED.ultimo_erro_codigo,proxima_tentativa=EXCLUDED.proxima_tentativa`,[filial,recurso,falhas,codigo,atraso]);
    console.error(JSON.stringify({evento:'sync_falhou',filial,recurso,codigo,falhas,repetirEmSegundos:atraso}));
    if(once)process.exitCode=1;
   }
  }
  if(once||encerrar)break;
  // Espera curta permite desligamento sem interromper uma transação no meio.
  for(let i=0;i<Math.min(intervalo,30)&&!encerrar;i++)await pausa(1000);
 }while(!encerrar);
}catch(error){console.error(JSON.stringify({evento:'worker_interrompido',codigo:erroSeguro(error)}));process.exitCode=1;}
finally{if(lock){try{await lock.query('SELECT pg_advisory_unlock_all()');}finally{lock.release();}}await pool?.end();}
