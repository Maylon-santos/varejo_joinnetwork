import test from 'node:test';import assert from 'node:assert/strict';
import {ambienteFila} from '../fixtures/fila.mjs';import {semearVisaoGeral,fotoTeste} from '../fixtures/visao-geral.mjs';
const filtros='filial=1&inicio=2026-01-01&fim=2026-09-16';
const get=async(e,path,role='admin')=>{const r=await fetch(e.base+'/api/v1'+path,{headers:{Authorization:'Bearer '+e.tokens[role]}});return {status:r.status,body:await r.json()};};
test('Top 20 por produto soma variações, exclui entradas/cancelamentos e calcula participação sobre todos os itens',async()=>{
 const e=await ambienteFila({imagemProduto:async()=>fotoTeste});try{await semearVisaoGeral(e);
 const r=await get(e,'/produtos/top?ordenar=quantidade&'+filtros);assert.equal(r.status,200);const d=r.body;assert.equal(d.top.length,20);assert.equal(d.total.produtos,22);assert.equal(d.total.pecas,'39');assert.equal(d.top[0].cod_produto,'P01');assert.equal(d.top[0].pecas,'10');assert.equal(d.top[1].pecas,'9');for(let i=1;i<d.top.length;i++)assert.ok(BigInt(d.top[i-1].pecas)>=BigInt(d.top[i].pecas));assert.equal(d.top[0].vendas,3);assert.equal(d.top[0].participacao_percentual,'25.6410');assert.equal(d.top[0].imagem.cod_operacao,'200');assert.ok(!JSON.stringify(d).includes('SEGREDO'));assert.equal(d.top.find(p=>p.cod_produto==='P02').imagem,null);
 const v=(await get(e,'/produtos/top?ordenar=quantidade&'+filtros,'vendas')).body;assert.equal(v.top[0].pecas,'6');assert.equal(v.top[0].imagem.cod_operacao,'100');assert.equal(v.total.pecas,'27');assert.equal((await get(e,'/produtos/top?ordenar=quantidade&'+filtros.replace('filial=1','filial=2'),'vendas')).status,403);
 const imagem=d.top[0].imagem;const path=`/operacoes/${imagem.filial}/${imagem.tipo_operacao}/${imagem.cod_operacao}/itens/${imagem.ordem}/imagem`;
 assert.equal((await fetch(e.base+'/api/v1'+path,{headers:{Authorization:'Bearer '+e.tokens.admin}})).status,200);assert.equal((await fetch(e.base+'/api/v1'+path,{headers:{Authorization:'Bearer '+e.tokens.vendas}})).status,404);
 await e.control.query("UPDATE access_roles SET permissoes=permissoes-'imagens:ler' WHERE role='Vendas' AND tenant_key='teste'");assert.ok((await get(e,'/produtos/top?ordenar=quantidade&'+filtros,'vendas')).body.top.every(p=>p.imagem===null));
 assert.equal((await get(e,'/produtos/top?ordenar=quantidade&'+filtros+'&limite=100')).status,400);
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
 const d=(await get(e,'/produtos/resumo-estoque?filial=1')).body;assert.equal(d.grupos.marca.length,2);const a=d.grupos.marca.find(g=>g.codigo==='A');assert.equal(a.saldo_disponivel,'3.000000');assert.equal(a.negativos,1);assert.equal(a.skus,2);assert.equal(d.grupos.marca.find(g=>g.codigo==='B').saldo_disponivel,null);assert.ok(!d.grupos.marca.some(g=>g.codigo==='nao_classificado'));assert.equal(d.grupos.categoria.find(g=>g.codigo==='nao_classificado').sem_saldo,1);
 assert.equal((await get(e,'/produtos/resumo-estoque?filial=1','vendas')).status,403);assert.equal((await get(e,'/produtos/resumo-estoque?filial=999')).status,403);assert.equal((await get(e,'/produtos/resumo-estoque?filial=1&inicio=2026-01-01')).status,400);
 }finally{await e.close();}
});

test('indicadores por SKU ordenam 10 antes de 9, sem ordenar a representação textual',async()=>{
 const e=await ambienteFila();try{await semearVisaoGeral(e);await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,descricao,quantidade,preco_centavos) VALUES(200,'S',1,3,'SKU99','P99','Dez peças',10,1000)");
 const r=await get(e,'/produtos/indicadores?'+filtros);assert.equal(r.status,200);assert.equal(r.body.produtos[0].pecas,'10');assert.equal(r.body.produtos[1].pecas,'9');
 }finally{await e.close();}
});

test('Top 20 usa valor por padrão sobre todos os produtos e aceita quantidade com desempate estável',async()=>{
 const e=await ambienteFila();try{await semearVisaoGeral(e);
 const d=(await get(e,'/produtos/top?'+filtros)).body;assert.equal(d.criterio,'valor');assert.equal(d.top[0].cod_produto,'P22');assert.equal(d.top[0].subtotal_centavos,'50000');assert.equal(d.total.subtotal_centavos,'88000');assert.equal(d.top[0].participacao_percentual,'56.8182');
 for(let i=1;i<d.top.length;i++)assert.ok(BigInt(d.top[i-1].subtotal_centavos)>=BigInt(d.top[i].subtotal_centavos));
 const qty=(await get(e,'/produtos/top?'+filtros+'&ordenar=quantidade')).body;assert.equal(qty.top[0].cod_produto,'P01');assert.equal(qty.top[0].pecas,'10');assert.equal(qty.top[0].participacao_percentual,'25.6410');
 assert.equal((await get(e,'/produtos/top?'+filtros+'&ordenar=desconhecido')).status,400);
 }finally{await e.close();}
});
test('detalhes do produto usam identidade exata, período e vendedor antes de agregar e não expõem estoque sem permissão',async()=>{
 const e=await ambienteFila();try{await semearVisaoGeral(e);
 await e.pool.query("UPDATE estoque_atual SET sku='SKU-1',cor='AZUL',tamanho='P' WHERE filial=1 AND sku='SKU1'");
 const path='/produtos/detalhe?'+filtros+'&chave=produto%3AP01';const r=await get(e,path);assert.equal(r.status,200);assert.equal(r.body.produto.pecas,'10');assert.equal(r.body.produto.vendas,3);assert.equal(r.body.total,4);assert.equal(r.body.variacoes.reduce((a,x)=>a+BigInt(x.subtotal_centavos),0n),10000n);assert.equal(r.body.variacoes.find(v=>v.sku==='SKU-1').cor,'AZUL');assert.equal(r.body.variacoes.find(v=>v.sku==='SKU-1').saldo_disponivel,'5.000000');
 const own=(await get(e,path,'vendas')).body;assert.equal(own.produto.pecas,'6');assert.equal(own.total,3);assert.equal(own.estoque_permitido,false);assert.ok(own.variacoes.every(v=>!('saldo_disponivel' in v)));assert.ok(!own.variacoes.some(v=>v.sku==='SKU-1-G'));
 assert.equal((await get(e,path.replace('filial=1','filial=2'),'vendas')).status,403);assert.equal((await get(e,path.replace('P01','SEGREDO'))).status,404);assert.equal((await get(e,path.replace('2026-01-01','2025-01-01').replace('2026-09-16','2025-01-02'))).status,404);
 assert.equal((await get(e,'/produtos/detalhe?'+filtros)).status,400);
 await e.control.query("UPDATE access_roles SET permissoes=permissoes-'produtos:ler' WHERE tenant_key='teste' AND role='Vendas'");assert.equal((await get(e,path,'vendas')).status,403);
 // Mais de uma página: a soma geral continua abrangendo todas as variações.
 for(let i=0;i<32;i++)await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,descricao,quantidade,preco_centavos) VALUES(100,'S',1,$1,$2,'P01','Variação',1,10)",[100+i,'NOVO-'+i]);
 const first=(await get(e,path)).body,second=(await get(e,path+'&pagina=2')).body;assert.equal(first.total,36);assert.equal(first.variacoes.length,30);assert.equal(second.variacoes.length,6);assert.equal(first.produto.pecas,'42');assert.equal(new Set([...first.variacoes,...second.variacoes].map(v=>v.sku)).size,36);
 }finally{await e.close();}
});
