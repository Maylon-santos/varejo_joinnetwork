import {writeFile} from 'node:fs/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
const pool=criarPool(process.env.TENANT_DATABASE_URL);
try {
 const cancelamento=await pool.query("SELECT count(*)::integer AS quantidade FROM cancelamentos WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3",['30836007','S','30098297']);
 const checkpoint=await pool.query("SELECT ate::text FROM sync_checkpoints WHERE filial=$1 AND recurso='cancelamentos'",['30098297']);
 const tables=await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
 const report={verificadoEm:new Date().toISOString(),tabelas:tables.rows.map(x=>x.tablename),operacao:'30836007',tipo:'S',filial:'30098297',registrosAposReprocessar:cancelamento.rows[0].quantidade,checkpoint:checkpoint.rows[0]?.ate??null};
 if(report.registrosAposReprocessar!==1)throw new Error('Validação da amostra divergente');
 await writeFile('docs/validacao-persistencia.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}catch(error){console.error('Verificação não concluída:',erroSeguro(error));process.exitCode=1;}
finally{await pool.end();}
