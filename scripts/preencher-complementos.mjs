import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {RepositorioPostgres} from '../backend/src/repositorio-postgres.mjs';
import {consultarVendas} from '../backend/src/vendas.mjs';
import {readFile} from 'node:fs/promises';
const pool=criarPool(process.env.TENANT_DATABASE_URL);let lock;
try{
 const tenant=process.env.TENANT_KEY,filial=process.env.COMPLEMENTOS_FILIAL||'30098297',dia=process.env.COMPLEMENTOS_DIA||'2026-09-13';
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));if(!config.branchIds.includes(filial))throw new Error('FILIAL_NAO_AUTORIZADA');
 const repo=new RepositorioPostgres(pool,tenant);await repo.transacao({tenant,filial},async()=>{});
 lock=await pool.connect();if(!(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('worker:' || $1,0)) AS ok",[tenant])).rows[0].ok)throw new Error('WORKER_JA_ATIVO');
 const assinatura=async()=>JSON.stringify((await pool.query(`SELECT
 (SELECT md5(string_agg(md5((to_jsonb(o)-'complementos'-'complementos_importados_em')::text),'' ORDER BY filial,tipo_operacao,cod_operacao)) FROM operacoes o) AS operacoes,
 (SELECT md5(string_agg(md5((to_jsonb(i)-'preco_tabela_centavos'-'desconto_informado'-'preco_aplicado_centavos')::text),'' ORDER BY filial,tipo_operacao,cod_operacao,ordem)) FROM operacao_itens i) AS itens,
 (SELECT md5(string_agg(row_to_json(c)::text,'' ORDER BY filial,recurso)) FROM sync_checkpoints c) AS checkpoints`)).rows[0]);
 const antes=await assinatura();const ops=await consultarVendas({baseUrl:process.env.MILLENNIUM_BASE_URL,token:process.env.MILLENNIUM_BASIC_TOKEN,filial,inicio:dia,fim:dia});
 const atualizadas=await repo.transacao({tenant,filial},tx=>tx.preencherComplementos(ops));const preservado=antes===await assinatura();if(!preservado)throw new Error('BASE_COMERCIAL_ALTERADA');
 console.log(JSON.stringify({evento:'amostra_complementos',filial,dia,atualizadas,baseComercialECheckpointsPreservados:preservado}));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{lock?.release();await pool.end();}
