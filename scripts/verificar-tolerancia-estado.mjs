import {criarPool} from '../backend/src/postgres.mjs';
const pool=criarPool(process.env.TENANT_DATABASE_URL);try{
 const hashes={};for(const [key,tabela,expr,ordem] of [['operacoes','operacoes',"to_jsonb(t)-'conciliacao'",'filial,tipo_operacao,cod_operacao'],['itens','operacao_itens','to_jsonb(t)','filial,tipo_operacao,cod_operacao,ordem'],['checkpoints','sync_checkpoints','to_jsonb(t)','filial,recurso'],['cancelamentos','cancelamentos','to_jsonb(t)','filial,tipo_operacao,cod_operacao']])hashes[key]=(await pool.query(`SELECT md5(string_agg((${expr})::text,'' ORDER BY ${ordem})) AS h FROM ${tabela} t`)).rows[0].h;
 const estados=(await pool.query('SELECT conciliacao,count(*)::int AS quantidade FROM operacoes GROUP BY conciliacao ORDER BY conciliacao')).rows;
 console.log(JSON.stringify({verificadoEm:new Date().toISOString(),hashes,estados}));
}finally{await pool.end();}
