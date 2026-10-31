import test from 'node:test';
import assert from 'node:assert/strict';
import {periodoExportacao,decimalCentavos,serializarCsv,montarRelatorios} from '../src/exportacao-csv.mjs';
test('janela diária usa São Paulo, virada de ano e ano bissexto',()=>{
 assert.deepEqual(periodoExportacao({agora:new Date('2026-11-01T01:00:00Z')}),{inicio:'2026-09-01',fim:'2026-10-30'});
 assert.deepEqual(periodoExportacao({agora:new Date('2026-01-01T12:00:00Z')}),{inicio:'2025-12-01',fim:'2025-12-31'});
 assert.deepEqual(periodoExportacao({agora:new Date('2024-03-01T12:00:00Z')}),{inicio:'2024-02-01',fim:'2024-02-29'});
 assert.deepEqual(periodoExportacao({ano:2025}),{inicio:'2025-01-01',fim:'2025-12-31'});
 for(const op of [{inicio:'2026-02-30',fim:'2026-03-01'},{inicio:'2026-10-20',fim:'2026-10-01'},{ano:'2025',inicio:'2025-01-01'}])assert.throws(()=>periodoExportacao(op));
});
test('CSV preserva acentos, delimitadores, aspas e quebras e centavos grandes/negativos',()=>{
 assert.equal(serializarCsv(['nome','valor'],[{nome:'São; "Paulo"\nSul',valor:'1.00'}]),'nome;valor\r\n"São; ""Paulo""\nSul";1.00\r\n');
 assert.equal(decimalCentavos('9007199254740993'),'90071992547409.93');assert.equal(decimalCentavos('-1'),'-0.01');assert.equal(decimalCentavos(null),'');assert.equal(decimalCentavos('0'),'0.00');
});
const base=()=>({origem:'banco_piloto',inicio:'2026-10-01',fim:'2026-10-20',filiais:[{filial:'1',cod_filial:'A',fantasia:'São Paulo'},{filial:'2',cod_filial:'B',fantasia:null}],cobertura:[],excluidas:[],
 operacoes:[{filial:'1',cod_operacao:'001',data_operacao:'2026-10-01',quantidade:2,valor_final_centavos:'10001',subtotal_itens_centavos:null,ajuste_centavos:null},{filial:'1',cod_operacao:'002',data_operacao:'2026-10-01',quantidade:1,valor_final_centavos:'20002'}],marcas:[]});
test('conserva totais e filiais sem movimento, sem presumir dimensões, devolução ou número fiscal',()=>{
 const {relatorios:r}=montarRelatorios(base());const d=r.faturamento_diario.linhas;
 assert.equal(d.length,1);assert.equal(d[0].valor,'300.03');assert.equal(d[0].pecas,'3');assert.equal(d[0].operacoes,2);assert.equal(d[0].empresa,'');assert.equal(d[0].marca,'');assert.equal(d[0].tipo_movimento,'venda');
 assert.equal(r.cadastro_filiais.linhas.length,2);assert.equal(r.vendas_por_cupom.linhas[0].cod_operacao,'001');assert.equal(r.vendas_por_cupom.linhas[0].cupom_fiscal,'');assert.equal(r.vendas_por_cupom.linhas[0].subtotal_itens,'');
});
test('marca única exige cobertura de peças e não rateia cupons mistos',()=>{
 const b=base();b.marcas=[{filial:'1',cod_operacao:'001',quantidade:1,marca_codigo:'A',marca:'Marca A'},{filial:'1',cod_operacao:'001',quantidade:1,marca_codigo:'B',marca:'Marca B'},{filial:'1',cod_operacao:'002',quantidade:1,marca_codigo:'A',marca:'Marca A'}];
 const {relatorios:r}=montarRelatorios(b,{'1':{empresa:'Empresa confirmada',canal:'Canal confirmado'}});
 assert.deepEqual(r.vendas_por_cupom.linhas.map(c=>c.situacao_marca),['multiplas','unica']);assert.equal(r.vendas_por_cupom.linhas[0].marca,'');assert.equal(r.vendas_por_cupom.linhas[1].marca,'Marca A');assert.equal(r.vendas_por_cupom.linhas[0].empresa,'Empresa confirmada');
 b.marcas[2].quantidade=2;assert.equal(montarRelatorios(b).relatorios.vendas_por_cupom.linhas[1].situacao_marca,'incompleta');
});
test('histórico sem carga recebe aviso e operações fora do escopo são rejeitadas',()=>{
 const b=base();b.inicio='2025-01-01';b.fim='2025-12-31';b.operacoes=[];assert.ok(montarRelatorios(b).manifesto.avisos.some(a=>a.includes('não carregado')));
 b.operacoes=base().operacoes;assert.throws(()=>montarRelatorios(b),/FORA_DO_ESCOPO/);
});
