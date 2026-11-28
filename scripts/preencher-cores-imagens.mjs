// Executar no coletor remoto. Só escreve metadados visuais; não reinicia importações.
import {readFile} from 'node:fs/promises';
import {setTimeout as pausa} from 'node:timers/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {consultarVendas,diaMillennium} from '../backend/src/vendas.mjs';
import {chaveOperacao} from '../backend/src/cancelamentos.mjs';
import {corDaImagem,registrarCoresImagens} from '../backend/src/cores-imagens.mjs';
const args=process.argv.slice(2),filial=args[0],limite=Number(args[1]??60);
// Não importar documentos fiscais, valores ou dados pessoais nesta releitura.
function normalizador(v,filial,inicio,fim){
 chaveOperacao(v.cod_operacao,v.tipo_operacao,v.filial);const data_operacao=diaMillennium(v.data);
 if(String(v.filial)!==String(filial)||data_operacao<inicio||data_operacao>fim||!Array.isArray(v.produtos))throw Error('CORES_ORIGEM_INVALIDA');
 return {cod_operacao:String(v.cod_operacao),tipo_operacao:v.tipo_operacao,filial:String(filial),data_operacao,
  produtos:v.produtos.map(i=>({sku:i.sku,cod_produto:i.cod_produto,...corDaImagem(i)}))};
}
let pool,db;
try{
 if(args.length>2||!/^\d{1,18}$/.test(filial??'')||!Number.isSafeInteger(limite)||limite<1||limite>366)throw Error('ARGUMENTO_INVALIDO');
 const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
 if(!(config.tenantGroupingConfirmed?config.branchIds:['30098297']).includes(filial))throw Error('FILIAL_NAO_AUTORIZADA');
 pool=criarPool(process.env.TENANT_DATABASE_URL);db=await pool.connect();
 if((await db.query('SELECT tenant_key FROM tenant_identity WHERE singleton')).rows[0]?.tenant_key!==process.env.TENANT_KEY)throw Error('TENANT_INCORRETO');
 if(!(await db.query("SELECT pg_try_advisory_lock(hashtextextended('cores-imagens:'||$1||':'||$2,0)) AS ok",[process.env.TENANT_KEY,filial])).rows[0].ok)throw Error('CORES_JA_EM_EXECUCAO');
 await db.query("SET statement_timeout='20s'");
 const dias=(await db.query(`SELECT DISTINCT o.data_operacao::text AS dia
  FROM operacao_itens i JOIN operacoes o USING(cod_operacao,tipo_operacao,filial)
  JOIN estoque_atual e ON e.filial=i.filial AND e.sku=i.sku AND e.presente_ultima_carga
  JOIN cadastro_produtos p ON p.produto=e.produto AND p.cod_produto=i.cod_produto
  LEFT JOIN produto_cores_imagem c ON c.produto=e.produto AND c.cod_produto=p.cod_produto AND c.cor=e.cor
  WHERE i.filial=$1 AND NULLIF(e.cor,'') IS NOT NULL AND c.produto IS NULL
  ORDER BY dia DESC LIMIT $2`,[filial,limite])).rows;
 let confirmacoes=0;
 for(const {dia} of dias){
  const ops=await consultarVendas({baseUrl:process.env.MILLENNIUM_BASE_URL,token:process.env.MILLENNIUM_BASIC_TOKEN,filial,inicio:dia,fim:dia,normalizador});
  await db.query('BEGIN');
  try{confirmacoes+=await registrarCoresImagens(db,filial,ops.flatMap(o=>o.produtos));await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}
  console.log(JSON.stringify({evento:'cores_dia_conferido',dia}));await pausa(1100);
 }
 const cobertura=(await db.query(`SELECT count(*)::int AS skus,count(*) FILTER(WHERE c.produto IS NOT NULL AND NOT c.conflitante)::int AS cor_confirmada,count(*) FILTER(WHERE c.conflitante)::int AS cor_conflitante
  FROM estoque_atual e JOIN cadastro_produtos p USING(produto)
  LEFT JOIN produto_cores_imagem c ON c.produto=e.produto AND c.cod_produto=p.cod_produto AND c.cor=e.cor WHERE e.filial=$1 AND e.presente_ultima_carga`,[filial])).rows[0];
 console.log(JSON.stringify({evento:'cores_imagens_concluidas',dias:dias.length,confirmacoes,cobertura}));
}catch(e){console.error(erroSeguro(e));process.exitCode=1;}
finally{if(db){await db.query('SELECT pg_advisory_unlock_all()');db.release();}await pool?.end();}
