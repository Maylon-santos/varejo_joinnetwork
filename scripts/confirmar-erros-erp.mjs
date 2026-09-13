import {writeFile} from 'node:fs/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
const pool=criarPool(process.env.TENANT_DATABASE_URL);
const codigos=['30816297','30817402','30824570','30824900','30826165'];
const db=await pool.connect();
try{
 await db.query('BEGIN');
 const identidade=(await db.query('SELECT tenant_key FROM tenant_identity')).rows[0];if(identidade?.tenant_key!==process.env.TENANT_KEY)throw Error('TENANT_INVALIDO');
 const antes=(await db.query("SELECT cod_operacao::text,quantidade,valor_final_centavos::text,conciliacao FROM operacoes WHERE filial=30098297 AND tipo_operacao='S' AND cod_operacao=ANY($1::bigint[]) ORDER BY cod_operacao FOR UPDATE",[codigos])).rows;
 if(antes.length!==5)throw Error('OPERACOES_NAO_ENCONTRADAS');
 await db.query("UPDATE operacoes SET erro_erp_confirmado_por='Maylon',erro_erp_confirmado_em=COALESCE(erro_erp_confirmado_em,now()) WHERE filial=30098297 AND tipo_operacao='S' AND cod_operacao=ANY($1::bigint[])",[codigos]);
 const depois=(await db.query("SELECT cod_operacao::text,quantidade,valor_final_centavos::text,conciliacao FROM operacoes WHERE filial=30098297 AND tipo_operacao='S' AND cod_operacao=ANY($1::bigint[]) ORDER BY cod_operacao",[codigos])).rows;
 if(JSON.stringify(antes)!==JSON.stringify(depois))throw Error('DADOS_ALTERADOS');
 await db.query('COMMIT');
 const report={verificadoEm:new Date().toISOString(),confirmadoPor:'Maylon',filial:'30098297',tipo:'S',operacoes:depois,contabilizacao:'Cabeçalho',valoresEQuantidadesPreservados:true};await writeFile('docs/validacao-erros-erp.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){await db.query('ROLLBACK');console.error(erroSeguro(e));process.exitCode=1;}finally{db.release();await pool.end();}
