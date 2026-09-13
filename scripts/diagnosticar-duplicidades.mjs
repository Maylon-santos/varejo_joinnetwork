import {writeFile} from 'node:fs/promises';
import {criarPool,erroSeguro} from '../backend/src/postgres.mjs';
import {normalizarVenda} from '../backend/src/vendas.mjs';
const pool=criarPool(process.env.TENANT_DATABASE_URL);
let etapa="checkpoint";
try{
 const r=await pool.query("SELECT (ate+1)::text AS dia FROM sync_checkpoints WHERE filial=30098297 AND recurso='vendas'");
 if(!r.rows.length)throw new Error("CHECKPOINT_AUSENTE");const dia=r.rows[0].dia;etapa="consulta";
 const url=new URL(process.env.MILLENNIUM_BASE_URL);url.pathname=url.pathname.replace(/\/$/,'')+'/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDAS';
 url.search=new URLSearchParams({filial:'30098297',data_inicial:dia,data_final:dia}).toString();
 const response=await fetch(url,{headers:{Accept:'application/json',Authorization:`Basic ${process.env.MILLENNIUM_BASIC_TOKEN}`},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok){
  const text=await response.text();
  // Diagnóstico técnico do erro, nunca corpo de vendas nem token.
  let clean=text.replaceAll(process.env.MILLENNIUM_BASIC_TOKEN,'[redigido]').replace(/https?:\/\/[^\s"<>]+/g,'[URL]').replace(/[\w.+-]+@[\w.-]+/g,'[email]');
  console.log(JSON.stringify({dia,status:response.status,erro:clean.slice(0,1200)}));
  throw new Error(`HTTP_${response.status}`);
 }
 const body=await response.json();etapa="normalizacao";if(!Array.isArray(body.value))throw new Error("VALUE_AUSENTE");const grupos=new Map();
 for(const v of body.value){const op=normalizarVenda(v,'30098297',dia,dia);const k=`${op.cod_operacao}:${op.tipo_operacao}:${op.filial}`;const rows=grupos.get(k)||[];rows.push(op);grupos.set(k,rows);}
 const duplicados=[...grupos.entries()].filter(([,rows])=>rows.length>1).map(([key,rows])=>({chave:key,repeticoes:rows.length,normalizadosIdenticos:rows.every(x=>JSON.stringify(x)===JSON.stringify(rows[0])),registros:rows.map(x=>({data:x.data_operacao,total:x.valor_final_centavos,quantidade:x.quantidade,itens:x.produtos.length,cancelada:x.cancelada}))}));
 const report={dia,total:body.value.length,duplicados};await writeFile('docs/duplicidades-importacao.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){console.error(JSON.stringify({etapa,codigo:erroSeguro(e),tipo:e.name}));process.exitCode=1;}finally{await pool.end();}
