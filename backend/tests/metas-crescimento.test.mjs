import test from 'node:test';import assert from 'node:assert/strict';
import {parametrosCrescimento,sugestaoCrescimento,requisicaoMensal,uuidMeta} from '../src/metas-crescimento.mjs';
test('crescimento usa centavos inteiros e arredondamento monetário, inclusive nos limites',()=>{
 assert.equal(sugestaoCrescimento('10000',1000n),'11000');assert.equal(sugestaoCrescimento('101',5000n),'152');assert.equal(sugestaoCrescimento('99999999999999',0n),'99999999999999');assert.equal(sugestaoCrescimento('99999999999999',1n),null);assert.equal(sugestaoCrescimento('0',1000n),null);assert.equal(sugestaoCrescimento('-10',1000n),null);
});
test('intervalo inclui os extremos, cruza ano e limita 12 meses e percentual a mil',()=>{
 const p=parametrosCrescimento('2026-11','2027-10','10.25');assert.equal(p.meses.length,12);assert.equal(p.meses.at(-1),'2027-10');assert.equal(p.pontos,1025n);assert.equal(parametrosCrescimento('2026-11','2026-11','1000.00').meses.length,1);
 for(const args of [['2026-11','2027-11','10.00'],['2026-11','2026-10','10.00'],['2000-01','2000-01','10.00'],['2026-00','2026-01','10.00'],['2026-01','2026-02','10'],['2026-01','2026-02','-1.00'],['2026-01','2026-02','1000.01']])assert.throws(()=>parametrosCrescimento(...args),{status:400});
});
test('identificação de lote preserva a raiz e gera identificadores estáveis distintos por mês',()=>{
 const id='b1fde6e0-4507-4f22-818b-84e5cf6822dd';assert.equal(requisicaoMensal(id,'2026-11','2026-11'),id);assert.ok(uuidMeta(requisicaoMensal(id,'2026-12','2026-11')));assert.equal(requisicaoMensal(id,'2026-12','2026-11'),requisicaoMensal(id,'2026-12','2026-11'));assert.notEqual(requisicaoMensal(id,'2026-12','2026-11'),requisicaoMensal(id,'2027-01','2026-11'));
});
