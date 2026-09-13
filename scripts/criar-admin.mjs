import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {criarAdmin} from '../backend/src/admin-auth.mjs';
const pool=criarPool(process.env.CONTROL_DATABASE_URL);
try{const result=await criarAdmin(pool,{tenant:process.env.TENANT_KEY,email:process.env.ADMIN_EMAIL,senha:process.env.ADMIN_PASSWORD});console.log(result.criado?'Admin criado. Credenciais somente no .env.':'Admin já existe; senha preservada.');}
catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{await pool.end();}
