// Consulta uma data por filial, sequencialmente. Registra apenas estrutura e contagens.
import {readFile,writeFile} from 'node:fs/promises';
import {consultarVendas} from '../backend/src/vendas.mjs';
const config=JSON.parse(await readFile(new URL('../config/piloto.json',import.meta.url)));
const dia=process.env.CLIENTES_DIA??'2026-09-13';
const filiais=config.tenantGroupingConfirmed?config.branchIds:['30098297'];
const resultados=[];
for(const filial of filiais){
 const linha={filial,dia,operacoes:0,clientes:0,identificados:0,identificadoresInvalidos:0,aniversariosPreenchidos:0,formatosAniversario:{},campos:[]};
 try{
  await consultarVendas({baseUrl:process.env.MILLENNIUM_BASE_URL,token:process.env.MILLENNIUM_BASIC_TOKEN,filial,inicio:dia,fim:dia,fetchImpl:async(url,opts)=>{
   const r=await fetch(url,opts);if(!r.ok)return r;
   const b=await r.json();
   const cs=(b.value??[]).flatMap(v=>Array.isArray(v.customers)?v.customers:[]).filter(c=>c&&typeof c==='object');
   linha.operacoes=b.value?.length??0;linha.clientes=cs.length;
   linha.campos=[...new Set(cs.flatMap(c=>Object.keys(c)))].sort();
   for(const c of cs){
    if(c.cliente!=null){
     const valido=(typeof c.cliente==='number'?Number.isSafeInteger(c.cliente)&&c.cliente>0:typeof c.cliente==='string'&&/^[1-9]\d*$/.test(c.cliente));
     if(valido)linha.identificados++;else linha.identificadoresInvalidos++;
    }
    if(c.data_aniversario!=null&&c.data_aniversario!==''){
     linha.aniversariosPreenchidos++;
     const tipo=typeof c.data_aniversario==='string'&&/^\/Date\(-?\d+(?:[+-]\d+)?\)\/$/.test(c.data_aniversario)?'millennium':typeof c.data_aniversario==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(c.data_aniversario)?'data_iso':'outro';
     linha.formatosAniversario[tipo]=(linha.formatosAniversario[tipo]??0)+1;
    }
   }
   return new Response(JSON.stringify(b),{status:200});
  }});
  linha.consultaValida=true;
 }catch{linha.consultaValida=false;process.exitCode=1;}
 resultados.push(linha);
}
const report={consultadoEm:new Date().toISOString(),fonte:'LISTAVENDAS.customers',escopo:'Amostra de um dia por filial; ausência de aniversário na amostra não comprova ausência no cadastro completo.',resultados};
await writeFile(new URL('../docs/validacao-fonte-clientes.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({filiais:resultados.length,consultasValidas:resultados.filter(r=>r.consultaValida).length,clientes:resultados.reduce((s,r)=>s+r.clientes,0),identificados:resultados.reduce((s,r)=>s+r.identificados,0),aniversariosPreenchidos:resultados.reduce((s,r)=>s+r.aniversariosPreenchidos,0)}));
