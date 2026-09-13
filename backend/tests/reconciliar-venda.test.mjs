import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { centavos, reconciliarVenda } from '../src/reconciliar-venda.mjs';
const casos = JSON.parse(readFileSync(new URL('./fixtures/descontos.json', import.meta.url)));
for (const venda of casos) {
  test(`Reconcilia operação ${venda.cod_operacao} sem descontar percentual duas vezes`, () => {
    const r = reconciliarVenda(venda);
    assert.equal(r.status, 'conciliada');
    assert.equal(r.diferencaCentavos, '0');
    assert.equal(r.totalEsperadoCentavos, venda.cod_operacao === 30835456 ? '41389' : '31198');
  });
}
test('Preserva divergência de um centavo', () => {
  assert.equal(reconciliarVenda({ ...casos[0], valor_final: '413.88' }).diferencaCentavos, '1');
});
test('Não presume ajuste ausente como zero', () => {
  assert.equal(reconciliarVenda({ ...casos[0], v_acerto: undefined }).status, 'contrato_incompleto');
});
test('Não inventa composição de frete ou cortesia', () => {
  assert.equal(reconciliarVenda({ ...casos[0], v_frete: 12 }).status, 'regra_pendente');
  assert.equal(reconciliarVenda({ ...casos[0], cortesia: true }).status, 'regra_pendente');
});
test('Não inclui cancelamentos e entradas', () => {
  assert.equal(reconciliarVenda({ ...casos[0], cancelada: true }).status, 'nao_elegivel');
  assert.equal(reconciliarVenda({ ...casos[0], tipo_operacao: 'E' }).status, 'nao_elegivel');
});
test('Confere quantidade de cabeçalho e precisão decimal', () => {
  assert.equal(reconciliarVenda({ ...casos[0], qtde: 99 }).status, 'quantidade_divergente');
  assert.equal(centavos('0.29'), 29n);
  assert.equal(centavos('-45.99'), -4599n);
  assert.throws(() => centavos(null));
  assert.throws(() => centavos('1.001'));
});
