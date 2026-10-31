import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {sincronizarEstoque,enriquecerProdutos} from '../backend/src/sincronizar-estoque.mjs';
import {consultarEstoque,consultarProduto} from '../backend/src/produtos-estoque-erp.mjs';
process.umask(0o077);
let pool,lock;let relatorio;
try{
 if(process.argv.length!==3||process.argv[2]!=='--executar')throw Error('CONFIRMACAO_EXECUTAR_AUSENTE');
 const tenant=process.env.TENANT_KEY,config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
 const filiais=config.tenantGroupingConfirmed?config.branchIds:['30098297'];
 pool=criarPool(process.env.TENANT_DATABASE_URL);lock=await pool.connect();
 if((await lock.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==tenant)throw Error('TENANT_INCORRETO');
 if(!(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('worker:' || $1,0)) AS ok",[tenant])).rows[0].ok)throw Error('WORKER_JA_ATIVO');
 const raiz=resolve('artifacts/estoque-cadastro'),pasta=resolve(process.env.ESTOQUE_RELATORIO_DIR||`${raiz}/${new Date().toISOString().replace(/[:.]/g,'-')}`);
 if(!relative(raiz,pasta)||relative(raiz,pasta).startsWith('..'))throw Error('PASTA_FORA_DO_ESCOPO');await mkdir(pasta,{recursive:true,mode:0o700});
 const salvar=async()=>writeFile(`${pasta}/resultado.json`,JSON.stringify(relatorio,null,2)+'\n',{mode:0o600});
 const assinatura=async()=>JSON.stringify((await pool.query(`SELECT
  (SELECT md5(COALESCE(string_agg(md5(to_jsonb(o)::text),'' ORDER BY filial,tipo_operacao,cod_operacao),'')) FROM operacoes o) AS operacoes,
  (SELECT md5(COALESCE(string_agg(md5(to_jsonb(i)::text),'' ORDER BY filial,tipo_operacao,cod_operacao,ordem),'')) FROM operacao_itens i) AS itens,
  (SELECT md5(COALESCE(string_agg(md5(to_jsonb(c)::text),'' ORDER BY filial,tipo_operacao,cod_operacao),'')) FROM cancelamentos c) AS cancelamentos,
  (SELECT md5(COALESCE(string_agg(md5(to_jsonb(c)::text),'' ORDER BY filial,recurso),'')) FROM sync_checkpoints c) AS checkpoints`)).rows[0]);
 const antes=await assinatura(),base={baseUrl:process.env.MILLENNIUM_BASE_URL,token:process.env.MILLENNIUM_BASIC_TOKEN};
 relatorio={inicio:new Date().toISOString(),estoques:[],produtos_consultados:0,produtos_atualizados:0,falhas_cadastro:[],classificacao_cadastro_principal:true};await salvar();
 for(const filial of filiais){
  let resultado;
  for(let tentativa=1;tentativa<=2;tentativa++){
   try{resultado=await sincronizarEstoque({pool,tenant,filial,forcar:true,cargaCompleta:true,consultar:p=>consultarEstoque({...base,...p})});resultado.tentativas=tentativa;break;}
   catch(e){resultado={filial,erro:erroSeguro(e),tentativas:tentativa};await pool.query('UPDATE sync_estoques SET ultima_carga_completa=NULL WHERE filial=$1',[filial]);}
  }
  relatorio.estoques.push(resultado);await salvar();console.log(JSON.stringify({evento:'recarga_estoque',...resultado}));
 }
 const produtos=(await pool.query('SELECT DISTINCT e.produto::text FROM estoque_atual e WHERE e.presente_ultima_carga AND e.filial=ANY($1::bigint[]) ORDER BY e.produto::text',[filiais])).rows.map(p=>p.produto);
 relatorio.produtos_alvo=produtos.length;await salvar();
 for(let i=0;i<produtos.length;i+=20){
  const lote=produtos.slice(i,i+20);
  const r=await enriquecerProdutos({pool,tenant,produtos:lote,limite:20,consultar:async p=>{
   relatorio.produtos_consultados++;
   try{return await consultarProduto({...base,...p});}catch(e){relatorio.falhas_cadastro.push({produto:p.produto,erro:erroSeguro(e)});throw e;}
  }});
  relatorio.produtos_atualizados+=r.enriquecidos;await salvar();
  if((i+lote.length)%100===0||i+lote.length===produtos.length)console.log(JSON.stringify({evento:'classificacao_cadastro',consultados:relatorio.produtos_consultados,alvo:produtos.length,atualizados:relatorio.produtos_atualizados,falhas:relatorio.falhas_cadastro.length}));
 }
 relatorio.cobertura=(await pool.query(`SELECT e.filial::text,count(*)::int AS skus,
  count(*) FILTER(WHERE COALESCE(p.tipo_prod,e.tipo_prod) IS NOT NULL)::int AS classificados,
  count(*) FILTER(WHERE COALESCE(p.tipo_prod,e.tipo_prod)='AC')::int AS acabados,
  count(*) FILTER(WHERE COALESCE(p.tipo_prod,e.tipo_prod) IS NULL)::int AS sem_tipo
  FROM estoque_atual e JOIN cadastro_produtos p USING(produto) WHERE e.presente_ultima_carga AND e.filial=ANY($1::bigint[]) GROUP BY e.filial ORDER BY e.filial`,[filiais])).rows;
 relatorio.tipos=(await pool.query(`SELECT COALESCE(p.tipo_prod,e.tipo_prod) AS tipo_prod,count(*)::int AS skus FROM estoque_atual e JOIN cadastro_produtos p USING(produto) WHERE e.presente_ultima_carga AND e.filial=ANY($1::bigint[]) GROUP BY 1 ORDER BY 1`,[filiais])).rows;
 relatorio.base_comercial_itens_cancelamentos_checkpoints_preservados=antes===await assinatura();relatorio.fim=new Date().toISOString();await salvar();
 console.log(JSON.stringify({evento:'reprocessamento_estoque_concluido',produtos_consultados:relatorio.produtos_consultados,produtos_atualizados:relatorio.produtos_atualizados,falhas_cadastro:relatorio.falhas_cadastro.length,tipos:relatorio.tipos,preservado:relatorio.base_comercial_itens_cancelamentos_checkpoints_preservados}));
 if(!relatorio.base_comercial_itens_cancelamentos_checkpoints_preservados)throw Error('BASE_COMERCIAL_ALTERADA');
 if(relatorio.estoques.some(e=>e.erro))process.exitCode=1;
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}finally{if(lock){await lock.query('SELECT pg_advisory_unlock_all()');lock.release();}await pool?.end();}
