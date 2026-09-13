import test from 'node:test';
import assert from 'node:assert/strict';
import {aplicarCancelamentos, chaveOperacao} from '../src/cancelamentos.mjs';
const evento={cod_operacao:30836007,tipo_operacao:'S',data_cancelou:'/Date(1788922800000-180)/'};
test('Completa a chave com a filial consultada e guarda cancelamento antes da venda',()=>{
 const resultado=aplicarCancelamentos(new Map(),[evento],'30098297');
 assert.equal(resultado.get('30836007:S:30098297').cancelada,true);
});
test('Repetir lote é idempotente',()=>{
 const um=aplicarCancelamentos(new Map(),[evento],'30098297');
 assert.deepEqual(aplicarCancelamentos(um,[evento,evento],'30098297'),um);
});
test('Isola tipos e filiais para o mesmo código',()=>{
 let resultado=aplicarCancelamentos(new Map(),[evento,{...evento,tipo_operacao:'E'}],'30098297');
 resultado=aplicarCancelamentos(resultado,[evento],'30098400');
 assert.equal(resultado.size,3);
});
test('Lote inválido não altera estado anterior',()=>{
 const anterior=aplicarCancelamentos(new Map(),[evento],'30098297');
 assert.throws(()=>aplicarCancelamentos(anterior,[{...evento,cod_operacao:1},{...evento,data_cancelou:null}],'30098297'));
 assert.equal(anterior.size,1);
 assert.throws(()=>aplicarCancelamentos(anterior,[{...evento,filial:'999'}],'30098297'));
 assert.throws(()=>chaveOperacao(undefined,'S','30098297'));
});
