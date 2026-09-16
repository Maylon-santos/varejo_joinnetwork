import {readFile} from 'node:fs/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {sincronizarEstoque,enriquecerProdutos} from '../backend/src/sincronizar-estoque.mjs';
import {consultarEstoque,consultarProduto} from '../backend/src/produtos-estoque-erp.mjs';
const pool=criarPool(process.env.TENANT_DATABASE_URL);let lock;
try{
 const tenant=process.env.TENANT_KEY,config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url))),filiais=config.tenantGroupingConfirmed?config.branchIds:['30098297'];
 lock=await pool.connect();if((await lock.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');
 if(!(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('worker:' || $1,0)) AS ok",[tenant])).rows[0].ok)throw Error('WORKER_JA_ATIVO');
 const assinatura=async()=>JSON.stringify((await pool.query(`SELECT
 (SELECT md5(string_agg(md5(to_jsonb(o)::text),'' ORDER BY filial,tipo_operacao,cod_operacao)) FROM operacoes o) AS operacoes,
 (SELECT md5(string_agg(md5(to_jsonb(i)::text),'' ORDER BY filial,tipo_operacao,cod_operacao,ordem)) FROM operacao_itens i) AS itens,
 (SELECT md5(string_agg(row_to_json(c)::text,'' ORDER BY filial,recurso)) FROM sync_checkpoints c) AS checkpoints`)).rows[0]);
 const antes=await assinatura(),base={baseUrl:process.env.MILLENNIUM_BASE_URL,token:process.env.MILLENNIUM_BASIC_TOKEN},resultados=[];
 for(const filial of filiais){try{const r=await sincronizarEstoque({pool,tenant,filial,forcar:true,consultar:p=>consultarEstoque({...base,...p})});resultados.push(r);console.log(JSON.stringify({evento:'estoque_inicial',...r}));}catch(e){resultados.push({filial,erro:erroSeguro(e)});console.log(JSON.stringify({evento:'estoque_inicial_pendente',filial,codigo:erroSeguro(e)}));}}
 const enriquecimento=await enriquecerProdutos({pool,tenant,consultar:p=>consultarProduto({...base,...p}),limite:5});
 const preservado=antes===await assinatura();if(!preservado)throw Error('BASE_COMERCIAL_ALTERADA');
 const cobertura=(await pool.query(`SELECT count(*)::int AS produtos,count(*) FILTER(WHERE enriquecido_em IS NOT NULL)::int AS classificados FROM cadastro_produtos`)).rows[0];
 console.log(JSON.stringify({evento:'carga_estoques_concluida',resultados,enriquecimento,cobertura,baseComercialECheckpointsPreservados:preservado}));
 if(resultados.every(r=>r.erro))process.exitCode=1;
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{if(lock){await lock.query('SELECT pg_advisory_unlock_all()');lock.release();}await pool.end();}
