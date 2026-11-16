import test from 'node:test';
import assert from 'node:assert/strict';
import {periodosCrescimento,variacaoCrescimento} from '../src/crescimento.mjs';
test('comparação acumulada usa mesmo corte nos dois anos e ano encerrado permite dezembro',()=>{
 const d=periodosCrescimento('2026','acumulado','2026-11-16');assert.equal(d.atual.fim,'2026-11-16');assert.equal(d.anterior.fim,'2025-11-16');
 const completo=periodosCrescimento('2025','completo','2026-11-16');assert.equal(completo.atual.fim,'2025-12-31');assert.equal(completo.anterior.fim,'2024-12-31');
 assert.equal(periodosCrescimento('2024','acumulado','2026-11-16').atual.fim,'2024-11-16');
});
test('29 de fevereiro é ajustado ao último dia válido sem avançar para março',()=>{
 const d=periodosCrescimento('2024','acumulado','2024-02-29');assert.equal(d.atual.fim,'2024-02-29');assert.equal(d.anterior.fim,'2023-02-28');
});
test('rejeita ano futuro, período inválido e ano completo ainda em andamento',()=>{
 for(const ano of ['2027','2000','1999','26',2025,'2025 OR 1=1'])assert.throws(()=>periodosCrescimento(ano,'acumulado','2026-11-16'),{status:400});
 assert.throws(()=>periodosCrescimento('2025','mes','2026-11-16'),{status:400});assert.throws(()=>periodosCrescimento('2026','completo','2026-11-16'),{message:'ANO_EM_ANDAMENTO'});
});
test('variações preservam centavos grandes e tratam queda, zero e base não positiva',()=>{
 assert.deepEqual(variacaoCrescimento('12500','10000'),{diferenca:'2500',percentual:'25.00'});
 assert.deepEqual(variacaoCrescimento('0','10000'),{diferenca:'-10000',percentual:'-100.00'});
 assert.deepEqual(variacaoCrescimento('100','0'),{diferenca:'100',percentual:null});assert.equal(variacaoCrescimento('100','-1').percentual,null);
 assert.equal(variacaoCrescimento('9007199254740994','9007199254740993').diferenca,'1');
});
