import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarVenda} from '../src/vendas.mjs';
const venda={cod_operacao:1,tipo_operacao:'S',filial:1,data:'/Date(1789268400000-180)/',qtde:1,valor_final:100,cancelada:false,v_acerto:0,produtos:[{quantidade:1,preco:100,preco_tabela:150,preco_aplicado:100,desconto:0,cod_produto:'P1'}],condicoes_pgto:5,codigo_condicaopgto:'Q4',desc_condicoes_pgto:'CRÉDITO 2X',lancamentos:[{n_documento:'1/1',data_emissao:'/Date(1789268400000-180)/',data_vencimento:'/Date(1791860400000-180)/',valor_inicial:50,desc_tipopgto:'CARTÃO'},{n_documento:'1/2',valor_inicial:50}]};
const normal=v=>normalizarVenda(v,'1','2026-09-13','2026-09-13');
test('Importa preços e parcelas sem recalcular cabeçalho nem subtotal',()=>{
 const o=normal(venda);assert.equal(o.produtos[0].preco_tabela_centavos,'15000');assert.equal(o.produtos[0].preco_aplicado_centavos,'10000');assert.equal(o.produtos[0].desconto_informado,'0');assert.equal(o.valor_final_centavos,'10000');assert.equal(o.subtotal_itens_centavos,'10000');assert.equal(o.conciliacao,'conciliada');assert.equal(o.complementos.condicoes_pgto,'5');assert.equal(o.complementos.lancamentos.length,2);assert.equal(o.complementos.lancamentos[0].valor_inicial_centavos,'5000');assert.equal(o.complementos.lancamentos[0].data_vencimento,'2026-10-13');
});
test('Distingue dados ausentes, desconto zero e parcelas vazias; rejeita dados inválidos',()=>{
 const missing=normal({...venda,produtos:[{quantidade:1,preco:100}],lancamentos:undefined});assert.equal(missing.produtos[0].desconto_informado,null);assert.equal(missing.produtos[0].preco_aplicado_centavos,null);assert.equal(missing.complementos.lancamentos,null);assert.deepEqual(normal({...venda,lancamentos:[]}).complementos.lancamentos,[]);
 for(const lancamentos of [{},[null],[{valor_inicial:'x'}],[{data_emissao:'invalid'}]])assert.throws(()=>normal({...venda,lancamentos}));
});

test('Associa preços por produto/SKU sem depender da ordem e recusa duplicidade ambígua',async()=>{
 const {associarItensComplementares}=await import('../src/complementos-venda.mjs');
 const a={ordem:0,cod_produto:'P',sku:'A',quantidade:1,preco_centavos:'100'},b={...a,ordem:1,sku:'B'};
 const linked=associarItensComplementares([a,b],[{...b,ordem:0,preco_tabela_centavos:'300'},{...a,ordem:1,preco_tabela_centavos:'200'}]);assert.equal(linked[0].ordem,0);assert.equal(linked[0].preco_tabela_centavos,'200');assert.equal(linked[1].preco_tabela_centavos,'300');
 assert.throws(()=>associarItensComplementares([a,a],[{...a,preco_tabela_centavos:'200'},{...a,preco_tabela_centavos:'300'}]),/COMPLEMENTOS_ITENS_AMBIGUOS/);
 assert.throws(()=>associarItensComplementares([a],[{...a,preco_centavos:'999'}]),/COMPLEMENTOS_ITENS_DIVERGENTES/);
});
