import {writeFile} from 'node:fs/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
const pool=criarPool(process.env.TENANT_DATABASE_URL);
try{
 const r=await pool.query(`SELECT o.cod_operacao,o.tipo_operacao,o.filial,o.data_operacao::text,
 o.quantidade AS quantidade_cabecalho,sum(i.quantidade)::integer AS quantidade_itens,
 o.valor_final_centavos,o.ajuste_centavos,o.subtotal_itens_centavos,
 (o.subtotal_itens_centavos+o.ajuste_centavos-o.valor_final_centavos)::text AS diferenca_valor_centavos
 FROM operacoes o JOIN operacao_itens i USING(cod_operacao,tipo_operacao,filial)
 WHERE o.conciliacao='quantidade_divergente'
 GROUP BY o.cod_operacao,o.tipo_operacao,o.filial ORDER BY o.data_operacao,o.cod_operacao`);
 const report={verificadoEm:new Date().toISOString(),operacoes:r.rows};
 await writeFile('docs/divergencias-quantidades.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{await pool.end();}
