import {writeFile} from 'node:fs/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
const pool=criarPool(process.env.TENANT_DATABASE_URL);
try{
 const report={verificadoEm:new Date().toISOString()};
 report.operacoes=(await pool.query("SELECT tipo_operacao,count(*)::integer AS quantidade,min(data_operacao)::text AS primeira_data,max(data_operacao)::text AS ultima_data FROM operacoes WHERE filial=30098297 GROUP BY tipo_operacao ORDER BY tipo_operacao")).rows;
 report.itens=(await pool.query('SELECT count(*)::integer AS total FROM operacao_itens WHERE filial=30098297')).rows[0].total;
 report.cancelamentos=(await pool.query('SELECT count(*)::integer AS total FROM cancelamentos WHERE filial=30098297')).rows[0].total;
 report.conciliacao=(await pool.query('SELECT conciliacao,count(*)::integer AS total FROM operacoes WHERE filial=30098297 GROUP BY conciliacao ORDER BY conciliacao')).rows;
 report.checkpoints=(await pool.query('SELECT recurso,ate::text FROM sync_checkpoints WHERE filial=30098297 ORDER BY recurso')).rows;
 report.status=(await pool.query('SELECT recurso,falhas_consecutivas,ultimo_erro_codigo,ultimo_sucesso,proxima_tentativa FROM sync_status WHERE filial=30098297 ORDER BY recurso')).rows;
 report.duplicidades=(await pool.query('SELECT count(*)::integer AS total FROM (SELECT cod_operacao,tipo_operacao,filial FROM operacoes GROUP BY 1,2,3 HAVING count(*)>1) d')).rows[0].total;
 await writeFile('docs/validacao-historico.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{await pool.end();}
