import {readFile} from 'node:fs/promises';
import {setTimeout as esperar} from 'node:timers/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {RepositorioPostgres} from '../backend/src/repositorio-postgres.mjs';
import {consultarVendas} from '../backend/src/vendas.mjs';
const pool=criarPool(process.env.TENANT_DATABASE_URL);
const tenant=process.env.TENANT_KEY;
try{
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
 const filiais=config.tenantGroupingConfirmed?config.branchIds:['30098297'];
 const repo=new RepositorioPostgres(pool,tenant);
 // Valida identidade antes de consultar o ERP, mesmo sem pendências.
 for(const filial of filiais)await repo.transacao({tenant,filial},async()=>{});
 const dias=(await pool.query(`SELECT DISTINCT filial::text,data_operacao::text AS dia FROM operacoes
   WHERE clientes IS NULL AND filial=ANY($1::bigint[]) ORDER BY dia DESC,filial`,[filiais])).rows;
 let processados=0,atualizadas=0;const falhas=[];
 for(const {filial,dia} of dias){
  try{
   // Uma consulta por dia/filial, com até três tentativas e espera progressiva.
   let ops;
   for(let tentativa=0;tentativa<3;tentativa++){
    try{ops=await consultarVendas({baseUrl:process.env.MILLENNIUM_BASE_URL,token:process.env.MILLENNIUM_BASIC_TOKEN,filial,inicio:dia,fim:dia});break;}
    catch(e){if(tentativa===2)throw e;await esperar(5000*(tentativa+1));}
   }
   atualizadas+=await repo.transacao({tenant,filial},tx=>tx.preencherClientes(ops));
  }catch(e){falhas.push({filial,dia,erro:erroSeguro(e)});}
  processados++;
  if(processados%10===0)console.log(JSON.stringify({evento:'progresso_clientes',dias:processados,total_dias:dias.length,atualizadas,falhas:falhas.length}));
  await esperar(1000);
 }
 const pendentes=Number((await pool.query('SELECT count(*) FROM operacoes WHERE clientes IS NULL AND filial=ANY($1::bigint[])',[filiais])).rows[0].count);
 console.log(JSON.stringify({evento:'preenchimento_clientes',concluido:pendentes===0&&falhas.length===0,dias:processados,atualizadas,pendentes,falhas}));
 if(pendentes||falhas.length)process.exitCode=1;
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{await pool.end();}
