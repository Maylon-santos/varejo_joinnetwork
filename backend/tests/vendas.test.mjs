import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarVenda,consultarVendas} from '../src/vendas.mjs';
import {dias,atrasoAposFalhas,sincronizarRecurso} from '../src/ciclo-sync.mjs';
const v={cod_operacao:1,tipo_operacao:'S',filial:30098297,data:'/Date(1788922800000-180)/',qtde:1,valor_final:90,cancelada:false,v_acerto:-10,v_frete:null,cortesia:null,customers:[{nome:'Não persistir'}],vendedor:[{funcionario:5,nome:'Vendedor teste'}],produtos:[{quantidade:1,preco:100,cod_produto:'A'}]};
test('Normaliza itens, centavos e vendedor sem copiar cadastro de cliente',()=>{
 const op=normalizarVenda(v,'30098297','2026-09-09','2026-09-09');
 assert.equal(op.valor_final_centavos,'9000');assert.equal(op.conciliacao,'conciliada');
 assert.equal(op.produtos[0].preco_centavos,'10000');assert.equal('customers' in op,false);
 assert.throws(()=>normalizarVenda(v,'999','2026-09-09','2026-09-09'));
});
test('Preserva canceladas e sinaliza divergência monetária',()=>{
 assert.equal(normalizarVenda({...v,valor_final:91},'30098297','2026-09-09','2026-09-09').conciliacao,'divergente');
 assert.equal(normalizarVenda({...v,cancelada:true},'30098297','2026-09-09','2026-09-09').cancelada,true);
});
test('API incompleta ou chaves duplicadas não são aceitas',async()=>{
 for(const body of [{'odata.count':2,value:[v]},{'odata.count':2,value:[v,{...v,valor_final:91}]}]){
 await assert.rejects(consultarVendas({baseUrl:'http://example.invalid/api',token:'fake',filial:'30098297',inicio:'2026-09-09',fim:'2026-09-09',fetchImpl:async()=>({ok:true,json:async()=>body})}));
 }
});
test('Janelas diárias incluem bordas e backoff começa após três erros',()=>{
 assert.deepEqual([...dias('2026-01-31','2026-02-01')],['2026-01-31','2026-02-01']);
 assert.equal(atrasoAposFalhas(360,2),360);assert.equal(atrasoAposFalhas(360,3),720);assert.equal(atrasoAposFalhas(360,100),5760);
});
test('Falha no segundo dia não solicita checkpoint desse dia nem dos seguintes',async()=>{
 const salvos=[];
 const repositorio={transacao:async(_,fn)=>fn({lerCheckpoint:async()=>null,salvarOperacoes:async()=>{},salvarCheckpoint:async d=>salvos.push(d)})};
 await assert.rejects(sincronizarRecurso({repositorio,tenant:'teste',filial:'1',recurso:'vendas',inicioHistorico:'2026-01-01',fim:'2026-01-03',consultar:async({inicio})=>{if(inicio==='2026-01-02')throw new Error('falha');return [];}}));
 assert.deepEqual(salvos,['2026-01-01']);
});

test('Colapsa apenas cópias normalizadas idênticas e informa a ocorrência',async()=>{
 const vistos=[];
 const rows=await consultarVendas({baseUrl:'http://example.invalid/api',token:'fake',filial:'30098297',inicio:'2026-09-09',fim:'2026-09-09',onDuplicado:x=>vistos.push(x),fetchImpl:async()=>({ok:true,json:async()=>({'odata.count':2,value:[v,v]})})});
 assert.equal(rows.length,1);assert.equal(vistos.length,1);
});
