import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarVenda,consultarVendas} from '../src/vendas.mjs';
import {dias,atrasoAposFalhas,sincronizarRecurso} from '../src/ciclo-sync.mjs';
const v={cod_operacao:1,tipo_operacao:'S',filial:30098297,data:'/Date(1788922800000-180)/',qtde:1,valor_final:90,cancelada:false,v_acerto:-10,v_frete:null,cortesia:null,customers:[{nome:'Cliente teste'}],vendedor:[{funcionario:5,nome:'Vendedor teste'}],produtos:[{quantidade:1,preco:100,cod_produto:'A'}]};
test('Importa cliente na mesma resposta de itens, centavos e vendedor',()=>{
 const op=normalizarVenda(v,'30098297','2026-09-09','2026-09-09');
 assert.equal(op.valor_final_centavos,'9000');assert.equal(op.conciliacao,'conciliada');
 assert.equal(op.produtos[0].preco_centavos,'10000');assert.equal('customers' in op,false);assert.deepEqual(op.clientes,[{nome:'Cliente teste',contatos:[]}]);
 assert.throws(()=>normalizarVenda(v,'999','2026-09-09','2026-09-09'));
});
test('Preserva canceladas e sinaliza divergência monetária',()=>{
 assert.equal(normalizarVenda({...v,valor_final:91},'30098297','2026-09-09','2026-09-09').conciliacao,'divergente');
 assert.equal(normalizarVenda({...v,cancelada:true},'30098297','2026-09-09','2026-09-09').cancelada,true);
});
test('armazena frete e cortesia nos complementos sem converter nulo em zero nem perder o tipo',()=>{
 for(const [v_frete,cortesia,frete] of [[null,0,null],[0,'0.00','0'],['12.34',true,'1234'],[null,null,null]]){
  const op=normalizarVenda({...v,v_frete,cortesia},'30098297','2026-09-09','2026-09-09');
  assert.equal(op.complementos.frete_centavos,frete);assert.equal(op.complementos.cortesia_informada,cortesia);
 }
});
test('API incompleta ou chaves duplicadas não são aceitas',async()=>{
 for(const body of [{'odata.count':2,value:[v]},{'odata.count':2,value:[v,{...v,valor_final:91}]}]){
 await assert.rejects(consultarVendas({baseUrl:'http://example.invalid/api',token:'fake',filial:'30098297',inicio:'2026-09-09',fim:'2026-09-09',fetchImpl:async()=>({ok:true,json:async()=>body})}));
 }
});
test('nota fiscal preserva identificadores textuais, zeros, status original e ausência sem alterar a venda',()=>{
 const normal=fields=>normalizarVenda({...v,...fields},'30098297','2026-09-09','2026-09-09');
 const base=normal({}),idnfe='0'.repeat(43)+'1';
 for(const [fields,expected] of [
  [{numero_nota:123,modelo:65,idnfe,status:null},{numero_nota:'123',modelo:'65',idnfe,status:null}],
  [{numero_nota:'000123',modelo:'065',idnfe,status:'100'},{numero_nota:'000123',modelo:'065',idnfe,status:'100'}],
  [{numero_nota:0,modelo:0,status:0},{numero_nota:'0',modelo:'0',idnfe:null,status:'0'}],
  [{},{numero_nota:null,modelo:null,idnfe:null,status:null}]
 ]){
  const op=normal(fields);assert.deepEqual(op.complementos.nota_fiscal,expected);
  assert.deepEqual({...op,complementos:null},{...base,complementos:null});
 }
 for(const fields of [{idnfe:9007199254740992},{status:{}},{modelo:65.5},{numero_nota:'1'.repeat(501)}])assert.throws(()=>normal(fields),/CAMPO_FISCAL_INVALIDO/);
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

test('Histórico limitado libera a próxima filial e retoma com sobreposição sem pular datas',async()=>{
 let checkpoint=null;const consultados=[];
 const repositorio={transacao:async(_,fn)=>fn({lerCheckpoint:async()=>checkpoint,salvarOperacoes:async()=>{},salvarCheckpoint:async d=>{checkpoint=d;}})};
 const base={repositorio,tenant:'teste',filial:'1',recurso:'vendas',inicioHistorico:'2026-01-01',fim:'2026-01-10',maxDias:7,consultar:async({inicio})=>{consultados.push(inicio);return [];}};
 const primeiro=await sincronizarRecurso(base);assert.equal(primeiro.fim,'2026-01-07');assert.equal(primeiro.pendente,true);assert.equal(primeiro.janelas,7);
 const segundo=await sincronizarRecurso(base);assert.equal(segundo.inicio,'2026-01-06');assert.equal(segundo.fim,'2026-01-10');assert.equal(segundo.pendente,false);
 assert.equal(new Set(consultados).size,10);assert.equal(checkpoint,'2026-01-10');
 for(const maxDias of [0,1,2,3.5])await assert.rejects(sincronizarRecurso({...base,maxDias}));
});
