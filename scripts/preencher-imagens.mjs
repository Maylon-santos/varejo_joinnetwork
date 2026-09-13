import {writeFile} from 'node:fs/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {consultarVendas} from '../backend/src/vendas.mjs';
const pool=criarPool(process.env.TENANT_DATABASE_URL);let dias=0,itens=0;const pendencias=[];
try{
 const identity=(await pool.query('SELECT tenant_key FROM tenant_identity')).rows[0];if(identity?.tenant_key!==process.env.TENANT_KEY)throw new Error('TENANT_INVALIDO');
 const datas=(await pool.query("SELECT DISTINCT o.data_operacao::text AS dia FROM operacoes o JOIN operacao_itens i USING(cod_operacao,tipo_operacao,filial) WHERE o.filial=30098297 AND i.imagem_url IS NULL ORDER BY dia DESC")).rows;
 for(const {dia} of datas){
  let ops;try{ops=await consultarVendas({baseUrl:process.env.MILLENNIUM_BASE_URL,token:process.env.MILLENNIUM_BASIC_TOKEN,filial:'30098297',inicio:dia,fim:dia});}catch(e){pendencias.push({dia,erro:erroSeguro(e)});continue;}
  for(const op of ops)for(const p of op.produtos){if(!p.imagem_url)continue;const r=await pool.query(`UPDATE operacao_itens SET imagem_url=$1 WHERE cod_operacao=$2 AND tipo_operacao=$3 AND filial=$4 AND ordem=$5 AND sku IS NOT DISTINCT FROM $6 AND cod_produto IS NOT DISTINCT FROM $7 AND quantidade=$8 AND preco_centavos=$9 AND imagem_url IS NULL`,[p.imagem_url,op.cod_operacao,op.tipo_operacao,op.filial,p.ordem,p.sku,p.cod_produto,p.quantidade,p.preco_centavos]);itens+=r.rowCount;}
  dias++;if(dias%25===0)console.log(JSON.stringify({dias,itens}));
 }
 const report={concluido:pendencias.length===0,dias,itens,pendencias};await writeFile('docs/validacao-imagens.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{await pool.end();}
