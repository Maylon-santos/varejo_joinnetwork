import {readFile} from 'node:fs/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {sincronizarFiliais,consultarFiliais} from '../backend/src/filiais.mjs';
const pool=criarPool(process.env.TENANT_DATABASE_URL);
try{
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
 const filiais=config.tenantGroupingConfirmed?config.branchIds:['30098297'];
 const r=await sincronizarFiliais({pool,tenant:process.env.TENANT_KEY,filiais,forcar:true,consultar:p=>consultarFiliais({...p,baseUrl:process.env.MILLENNIUM_BASE_URL,token:process.env.MILLENNIUM_BASIC_TOKEN})});
 console.log(JSON.stringify(r));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{await pool.end();}
