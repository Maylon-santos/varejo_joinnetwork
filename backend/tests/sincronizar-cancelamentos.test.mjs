import test from 'node:test';
import assert from 'node:assert/strict';
import {consultarCancelamentos, janelaCancelamentos, sincronizarCancelamentos} from '../src/sincronizar-cancelamentos.mjs';
const evento={cod_operacao:30836007,tipo_operacao:'S',filial:30098297,data_cancelou:'/Date(1788922800000-180)/'};
const config={baseUrl:'http://example.invalid/api',token:'fake-test-token',filial:'30098297',inicio:'2026-09-09',fim:'2026-09-09'};
test('Envia filtros de cancelamento e valida retorno do mesmo dia',async()=>{
 const r=await consultarCancelamentos({...config,fetchImpl:async(url,options)=>{
 assert.equal(url.searchParams.get('data_caninicial'),'2026-09-09');
 assert.equal(url.searchParams.has('data_inicial'),false);
 assert.equal(options.redirect,'error');
 return {ok:true,json:async()=>({'odata.count':1,value:[evento]})};
 }});
 assert.equal(r[0].cancelada,true);
});
test('Rejeita páginas incompletas e retorno fora da janela',async()=>{
 for(const body of [{'odata.count':2,value:[evento]},{'odata.count':1,value:[evento],'@odata.nextLink':'next'},{'odata.count':1,value:[{...evento,data_cancelou:'/Date(1788750000000-180)/'}]}]){
 await assert.rejects(consultarCancelamentos({...config,fetchImpl:async()=>({ok:true,json:async()=>body})}));
 }
});
test('Retoma todo o período parado com sobreposição de um dia',()=>{
 assert.deepEqual(janelaCancelamentos('2026-01-01','2026-09-02','2026-09-09'),{inicio:'2026-09-01',fim:'2026-09-09'});
 assert.throws(()=>janelaCancelamentos('2026-02-30',null,'2026-09-09'));
});
test('Só solicita checkpoint após gravar eventos; falha de gravação não avança',async()=>{
 for(const falhar of [false,true]){
 const chamadas=[];
 const repositorio={transacao:async(escopo,fn)=>{assert.equal(escopo.tenant,'piloto');return fn({lerCheckpoint:async()=>null,salvarCancelamentos:async()=>{chamadas.push('eventos');if(falhar)throw new Error('gravação');},salvarCheckpoint:async()=>chamadas.push('checkpoint')});}};
 const executar=()=>sincronizarCancelamentos({repositorio,tenant:'piloto',filial:'30098297',inicioHistorico:'2026-09-09',fim:'2026-09-09',consultar:async()=>[evento]});
 if(falhar)await assert.rejects(executar());else await executar();
 assert.deepEqual(chamadas,falhar?['eventos']:['eventos','checkpoint']);
 }
});
