import test from 'node:test';import assert from 'node:assert/strict';
import {ambienteFila} from '../fixtures/fila.mjs';import {semearVisaoGeral,fotoTeste} from '../fixtures/visao-geral.mjs';
const filtros='filial=1&inicio=2026-01-01&fim=2026-09-16';
const get=async(e,path,role='admin')=>{const r=await fetch(e.base+'/api/v1'+path,{headers:{Authorization:'Bearer '+e.tokens[role]}});return {status:r.status,body:await r.json()};};
test('Top 20 por produto soma variações, exclui entradas/cancelamentos e calcula participação sobre todos os itens',async()=>{
 const e=await ambienteFila({imagemProduto:async()=>fotoTeste});try{await semearVisaoGeral(e);
 const r=await get(e,'/produtos/top?'+filtros);assert.equal(r.status,200);const d=r.body;assert.equal(d.top.length,20);assert.equal(d.total.produtos,22);assert.equal(d.total.pecas,'39');assert.equal(d.top[0].cod_produto,'P01');assert.equal(d.top[0].pecas,'10');assert.equal(d.top[1].pecas,'9');for(let i=1;i<d.top.length;i++)assert.ok(BigInt(d.top[i-1].pecas)>=BigInt(d.top[i].pecas));assert.equal(d.top[0].vendas,3);assert.equal(d.top[0].participacao_percentual,'25.6410');assert.equal(d.top[0].imagem.cod_operacao,'200');assert.ok(!JSON.stringify(d).includes('SEGREDO'));assert.equal(d.top.find(p=>p.cod_produto==='P02').imagem,null);
 const v=(await get(e,'/produtos/top?'+filtros,'vendas')).body;assert.equal(v.top[0].pecas,'6');assert.equal(v.top[0].imagem.cod_operacao,'100');assert.equal(v.total.pecas,'27');assert.equal((await get(e,'/produtos/top?'+filtros.replace('filial=1','filial=2'),'vendas')).status,403);
 const imagem=d.top[0].imagem;const path=`/operacoes/${imagem.filial}/${imagem.tipo_operacao}/${imagem.cod_operacao}/itens/${imagem.ordem}/imagem`;
 assert.equal((await fetch(e.base+'/api/v1'+path,{headers:{Authorization:'Bearer '+e.tokens.admin}})).status,200);assert.equal((await fetch(e.base+'/api/v1'+path,{headers:{Authorization:'Bearer '+e.tokens.vendas}})).status,404);
 await e.control.query("UPDATE access_roles SET permissoes=permissoes-'imagens:ler' WHERE role='Vendas' AND tenant_key='teste'");assert.ok((await get(e,'/produtos/top?'+filtros,'vendas')).body.top.every(p=>p.imagem===null));
 assert.equal((await get(e,'/produtos/top?'+filtros+'&limite=100')).status,400);
 }finally{await e.close();}
});
test('condições não duplicam vendas, preservam códigos com mesmo nome e totais mensais; participação do vendedor independe da página',async()=>{
 const e=await ambienteFila();try{await semearVisaoGeral(e);
 const d=(await get(e,'/indicadores?'+filtros)).body;assert.equal(d.valor_vendas_centavos,'43000');assert.equal(d.condicoes_pagamento.length,3);assert.equal(d.condicoes_pagamento.reduce((sum,c)=>sum+BigInt(c.valor_centavos),0n),43000n);assert.equal(d.condicoes_pagamento.find(c=>c.codigo==='nao_informada').vendas,1);assert.equal(d.serie_diaria.reduce((sum,c)=>sum+BigInt(c.valor_vendas_centavos),0n),43000n);
 const rank=(await get(e,'/ranking?'+filtros+'&limite=1')).body;assert.equal(rank.ranking.length,1);assert.equal(rank.ranking[0].participacao_percentual,'72.0930');
 const own=(await get(e,'/indicadores?'+filtros,'vendas')).body;assert.equal(own.valor_vendas_centavos,'31000');assert.ok(!own.condicoes_pagamento.some(c=>c.codigo==='B'));assert.equal((await get(e,'/ranking?'+filtros,'vendas')).body.ranking[0].participacao_percentual,'100.0000');
 const empty=(await get(e,'/indicadores?filial=1&inicio=2025-01-01&fim=2025-01-01')).body;assert.deepEqual(empty.condicoes_pagamento,[]);
 }finally{await e.close();}
});
test('resumo de estoque separa desconhecido/negativo/sem classificação e exige recurso por filial',async()=>{
 const e=await ambienteFila();try{await semearVisaoGeral(e);
 const d=(await get(e,'/produtos/resumo-estoque?filial=1')).body;assert.equal(d.grupos.marca.length,3);const a=d.grupos.marca.find(g=>g.codigo==='A');assert.equal(a.saldo_disponivel,'3.000000');assert.equal(a.negativos,1);assert.equal(a.skus,2);assert.equal(d.grupos.marca.find(g=>g.codigo==='B').saldo_disponivel,null);assert.equal(d.grupos.marca.find(g=>g.codigo==='nao_classificado').sem_saldo,1);assert.equal(d.grupos.categoria.find(g=>g.codigo==='nao_classificado').sem_saldo,2);
 assert.equal((await get(e,'/produtos/resumo-estoque?filial=1','vendas')).status,403);assert.equal((await get(e,'/produtos/resumo-estoque?filial=999')).status,403);assert.equal((await get(e,'/produtos/resumo-estoque?filial=1&inicio=2026-01-01')).status,400);
 }finally{await e.close();}
});

test('indicadores por SKU ordenam 10 antes de 9, sem ordenar a representação textual',async()=>{
 const e=await ambienteFila();try{await semearVisaoGeral(e);await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,descricao,quantidade,preco_centavos) VALUES(200,'S',1,3,'SKU99','P99','Dez peças',10,1000)");
 const r=await get(e,'/produtos/indicadores?'+filtros);assert.equal(r.status,200);assert.equal(r.body.produtos[0].pecas,'10');assert.equal(r.body.produtos[1].pecas,'9');
 }finally{await e.close();}
});
