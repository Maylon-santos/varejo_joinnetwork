import test from 'node:test';import assert from 'node:assert/strict';
import {consolidarFila,filtrosRelatorioFila} from '../src/fila-relatorio.mjs';
test('Consolidação usa quantidade de concluídos como peso e não inventa taxa para denominador zero',()=>{
 const r=consolidarFila([
  {dia:'2026-09-01',vendedor_codigo:'10',nome:'Ana',abordagens:2,iniciados:1,concluidos:1,com_venda:1,nao_iniciados:1,tempo_atendimento_segundos:600},
  {dia:'2026-09-02',vendedor_codigo:'20',nome:'Bruno',abordagens:4,iniciados:4,concluidos:3,sem_venda:3,em_atendimento:1,tempo_atendimento_segundos:3600},
 ]);
 assert.equal(r.totais.conversao_informada,25);assert.equal(r.totais.tempo_medio_segundos,1050);assert.equal(r.totais.abordagens,6);assert.equal(r.por_dia.length,2);
 assert.equal(consolidarFila([]).totais.conversao_informada,null);assert.equal(consolidarFila([]).totais.tempo_medio_segundos,null);
});
test('Relatório exige recurso próprio, limita datas e nunca amplia escopo do vendedor',()=>{
 const u={tenant_key:'teste',role:'Vendas',permissoes:['fila:ler','fila:relatorios'],somente_proprias_vendas:true,vinculos:[{filial:'1',vendedor_codigo:'10'}]};
 const params={filial:'1',inicio:'2026-09-01',fim:'2026-09-30'};
 assert.equal(filtrosRelatorioFila(u,'teste',['1'],params).vendedor,'10');
 for(const [override,error] of [[{filial:'2'},'FILIAL_NAO_AUTORIZADA'],[{vendedor:'20'},'RECURSO_NAO_AUTORIZADO'],[{fim:'2026-10-02'},'FILA_PERIODO_RELATORIO_INVALIDO'],[{inicio:'2026-09-31'},'PERIODO_INVALIDO'],[{pagina:'0'},'PARAMETRO_INVALIDO']])assert.throws(()=>filtrosRelatorioFila(u,'teste',['1'],{...params,...override}),new RegExp(error));
 assert.throws(()=>filtrosRelatorioFila({...u,permissoes:['fila:ler']},'teste',['1'],params),/RECURSO_NAO_AUTORIZADO/);
 assert.throws(()=>filtrosRelatorioFila({...u,vinculos:[{filial:'1',vendedor_codigo:null}]},'teste',['1'],params),/RECURSO_NAO_AUTORIZADO/);
});
