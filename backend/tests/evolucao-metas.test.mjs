import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararEvolucao} from '../../frontend/assets/evolucao.js';
const dados=(inicio='2026-11-01',fim='2026-11-30',metas=[{competencia:'2026-11-01',valor_centavos:'100'}])=>({filtros:{inicio,fim},sincronizacao:[],serie_diaria:[],...(metas===undefined?{}:{metas_mensais:metas})});
test('referência visual distribui centavos sem alterar o total mensal e mantém meta zero distinta da ausente',()=>{
 const r=prepararEvolucao(dados(),'2026-12-31');assert.equal(r.pontos.length,30);assert.equal(r.pontos.reduce((n,p)=>n+p.referencia,0n),100n);assert.equal(r.referencia,100n);assert.equal(r.metaTotal,100n);
 const zero=prepararEvolucao(dados('2026-11-01','2026-11-30',[{competencia:'2026-11-01',valor_centavos:'0'}]),'2026-12-31');assert.equal(zero.referencia,0n);assert.equal(zero.completas,true);
 const sem=prepararEvolucao(dados('2026-11-01','2026-11-30',[]),'2026-12-31');assert.equal(sem.referencia,null);assert.equal(sem.metaTotal,null);
});
test('intervalo parcial usa somente os dias exibidos, com acumulado iniciado no filtro e precisão acima de Number seguro',()=>{
 const d=dados('2026-11-10','2026-11-20',[{competencia:'2026-11-01',valor_centavos:'9007199254740993'}]);d.serie_diaria=[{data:'2026-11-10',valor_vendas_centavos:'9007199254740993',vendas:1,pecas_cabecalho:'2'},{data:'2026-11-11',valor_vendas_centavos:'-10',vendas:1,pecas_cabecalho:'1'}];
 const r=prepararEvolucao(d,'2026-12-31');assert.equal(r.pontos[0].acumulado,9007199254740993n);assert.equal(r.realizado,9007199254740983n);assert.equal(r.referencia,9007199254740993n*20n/30n-9007199254740993n*9n/30n);
});
test('fevereiro bissexto e mudança de mês usam a meta e duração corretas',()=>{
 const d=dados('2024-02-01','2024-03-31',[{competencia:'2024-02-01',valor_centavos:'29000'},{competencia:'2024-03-01',valor_centavos:'62000'}]),r=prepararEvolucao(d,'2026-01-01');
 assert.equal(r.pontos.length,60);assert.equal(r.pontos[28].referencia,1000n);assert.equal(r.pontos[29].referencia,2000n);assert.equal(r.referencia,91000n);
});
test('meta ausente interrompe o acumulado sem presumir zero; datas futuras ou ainda não sincronizadas não são realizadas',()=>{
 const d=dados('2026-10-31','2026-12-31');d.sincronizacao=[{recurso:'vendas',ate:'2026-11-26'},{recurso:'cancelamentos',ate:'2026-11-25'}];const r=prepararEvolucao(d,'2026-11-27');
 assert.equal(r.fim,'2026-11-25');assert.equal(r.pontos.at(-1).data,'2026-11-25');assert.equal(r.pontos[1].referencia!==null,true);assert.equal(r.referencia,null);assert.equal(r.completas,false);
 const futuro=prepararEvolucao(dados('2026-12-01','2026-12-31'),'2026-11-27');assert.equal(futuro.pontos.length,0);
});
test('agrupamento mensal preserva vendas, peças, valores e referências e não revela metas sem autorização',()=>{
 const d=dados('2026-09-01','2026-11-30',[{competencia:'2026-09-01',valor_centavos:'100'},{competencia:'2026-10-01',valor_centavos:'101'},{competencia:'2026-11-01',valor_centavos:'102'}]);d.serie_diaria=[{data:'2026-09-10',valor_vendas_centavos:'200',vendas:2,pecas_cabecalho:'3'}];const r=prepararEvolucao(d,'2026-12-31');assert.equal(r.valores.length,3);assert.equal(r.valores[0].vendas,2n);assert.equal(r.valores[0].pecas,3n);assert.equal(r.valores[0].referencia,100n);assert.equal(r.valores.at(-1).referenciaAcumulada,303n);
 delete d.metas_mensais;const sem=prepararEvolucao(d,'2026-12-31');assert.equal(sem.metasPermitidas,false);assert.equal(sem.metaTotal,null);assert.equal(sem.valores[0].referencia,null);
});
