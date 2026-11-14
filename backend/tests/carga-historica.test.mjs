import test from 'node:test';
import assert from 'node:assert/strict';
import {iniciarCarga,proximaJanela,carregarJanela,normalizarVendaHistorica,consultarVendasHistoricas} from '../src/carga-historica.mjs';
import {normalizarVenda,consultarVendas} from '../src/vendas.mjs';

const plano={tenant:'teste',inicio:'2023-01-01',fim:'2023-01-03',filiais:['1','2']};
test('carga histórica conclui uma filial antes da próxima e retoma sem pular datas',async()=>{
 let estado=iniciarCarga(plano);const calls=[];
 const dependencias={consultarVendas:async p=>{calls.push('vendas:'+p.filial+':'+p.inicio);return [];},consultarCancelamentos:async p=>{calls.push('cancelamentos:'+p.filial+':'+p.inicio);return [];},repositorio:{transacao:async(scope,fn)=>fn({salvarHistorico:async()=>{}})},salvar:async()=>{}};
 for(let i=0;i<6;i++){const r=await carregarJanela({estado,maxDias:1,...dependencias});estado=JSON.parse(JSON.stringify(r.estado));}
 assert.deepEqual(calls.filter(x=>x.startsWith('vendas')),['vendas:1:2023-01-01','vendas:1:2023-01-02','vendas:1:2023-01-03','vendas:2:2023-01-01','vendas:2:2023-01-02','vendas:2:2023-01-03']);
 assert.equal(proximaJanela(estado),null);assert.equal(estado.estado,'carga_concluida');
});
test('histórico separa cadastro inválido sem aceitar erros financeiros ou mudar a importação atual',async()=>{
 const v={cod_operacao:1,tipo_operacao:'S',filial:1,data:'/Date(1672542000000)/',qtde:1,valor_final:10,cancelada:false,v_acerto:0,customers:[{cliente:0,nome:'Cliente fictício'}],produtos:[{quantidade:1,preco:10}]};
 const escopo=['1','2023-01-01','2023-01-01'];
 assert.throws(()=>normalizarVenda(v,...escopo),/CLIENTE_CODIGO_INVALIDO/);
 const op=normalizarVendaHistorica(v,...escopo);
 assert.equal(op.clientes,null);assert.equal(op.clientes_pendencia,'CLIENTE_CODIGO_INVALIDO');
 assert.deepEqual({...op,clientes:[],clientes_pendencia:undefined},{...normalizarVenda({...v,customers:[]},...escopo),clientes_pendencia:undefined});
 assert.throws(()=>normalizarVendaHistorica({...v,produtos:[]},...escopo),/ITENS_AUSENTES/);
 assert.throws(()=>normalizarVendaHistorica({...v,filial:2},...escopo),/FILIAL_INESPERADA/);
 const valido={...v,customers:[{cliente:123,nome:'Exemplo'}]};
 assert.deepEqual(normalizarVendaHistorica(valido,...escopo),normalizarVenda(valido,...escopo));
 const args={baseUrl:'https://example.invalid',token:'ficticio',filial:'1',inicio:escopo[1],fim:escopo[2],fetchImpl:async()=>({ok:true,json:async()=>({'odata.count':1,value:[v]})})};
 await assert.rejects(consultarVendas(args),/CLIENTE_CODIGO_INVALIDO/);
 const ops=await consultarVendasHistoricas(args);assert.equal(ops[0].clientes,null);
 await assert.rejects(consultarVendasHistoricas({...args,fetchImpl:async()=>({ok:true,json:async()=>({'odata.count':2,value:[v,{...v,valor_final:11}]})})}),/CHAVE_DUPLICADA_CONFLITANTE/);
 const estado=iniciarCarga({...plano,fim:plano.inicio});
 const r=await carregarJanela({estado,consultarVendas:async()=>ops,consultarCancelamentos:async()=>[],repositorio:{transacao:async(s,fn)=>fn({salvarHistorico:async()=>{}})},salvar:async()=>{}});
 assert.equal(r.estado.filiais[0].clientesPendentes,1);assert.equal(r.clientesPendentes,1);
});
test('falha na consulta ou na gravação preserva a posição e não marca conclusão',async()=>{
 const estado=iniciarCarga(plano);let salvos=0;
 const options={estado,consultarVendas:async()=>[],consultarCancelamentos:async()=>{throw Error('ERP_HTTP_503');},repositorio:{transacao:async(s,fn)=>fn({salvarHistorico:async()=>{}})},salvar:async()=>{salvos++;}};
 await assert.rejects(()=>carregarJanela(options),/ERP_HTTP_503/);assert.equal(salvos,0);assert.equal(estado.filiais[0].proximoDia,'2023-01-01');
 await assert.rejects(()=>carregarJanela({...options,consultarCancelamentos:async()=>[],repositorio:{transacao:async()=>{throw Error('ROLLBACK');}}}),/ROLLBACK/);assert.equal(salvos,0);
 await assert.rejects(()=>carregarJanela({...options,consultarCancelamentos:async()=>[],confirmarCobertura:async()=>false}),/COBERTURA_ATUAL/);assert.equal(salvos,0);
});
test('parcelas fora do contrato ficam pendentes sem arredondar ou dispensar validação dos totais e itens',()=>{
 const v={cod_operacao:1,tipo_operacao:'S',filial:1,data:'/Date(1672542000000)/',qtde:1,valor_final:10,cancelada:false,v_acerto:0,customers:[{cliente:0}],numero_nota:'0001',lancamentos:[{valor_inicial:3.333333}],produtos:[{quantidade:1,preco:10}]};
 const escopo=['1','2023-01-01','2023-01-01'];
 const op=normalizarVendaHistorica(v,...escopo);
 assert.equal(op.pagamentos_pendencia,'LANCAMENTOS_ERP_INVALIDOS');assert.equal(op.complementos.lancamentos,null);
 assert.equal(op.clientes,null);assert.equal(op.clientes_pendencia,'CLIENTE_CODIGO_INVALIDO');
 assert.equal(op.complementos.nota_fiscal.numero_nota,'0001');assert.equal(op.valor_final_centavos,'1000');assert.equal(op.produtos[0].preco_centavos,'1000');
 for(const fields of [{valor_final:10.001},{v_acerto:0.001},{v_frete:0.001},{produtos:[{quantidade:1,preco:10.001}]}])assert.throws(()=>normalizarVendaHistorica({...v,...fields},...escopo),/monetário/);
 const valido={...v,customers:[],lancamentos:[{valor_inicial:10}]};
 assert.deepEqual(normalizarVendaHistorica(valido,...escopo),normalizarVenda(valido,...escopo));
});
test('somente notas fiscais divergentes ficam pendentes e suas versões são preservadas sem liberar conflitos comerciais',async()=>{
 const v={cod_operacao:1,tipo_operacao:'S',filial:1,data:'/Date(1672542000000)/',qtde:1,valor_final:10,cancelada:false,v_acerto:0,numero_nota:'0001',status:'100',produtos:[{quantidade:1,preco:10}]};
 const rows=[v,{...v,numero_nota:'0002'},{...v,numero_nota:'0003'}];
 const args={baseUrl:'https://example.invalid',token:'ficticio',filial:'1',inicio:'2023-01-01',fim:'2023-01-01',fetchImpl:async()=>({ok:true,json:async()=>({'odata.count':rows.length,value:rows})})};
 await assert.rejects(consultarVendas(args),/CHAVE_DUPLICADA_CONFLITANTE/);
 const ops=await consultarVendasHistoricas(args);assert.equal(ops.length,1);
 assert.equal(ops[0].complementos.nota_fiscal,null);assert.equal(ops[0].nota_fiscal_pendencia,'NOTA_FISCAL_DIVERGENTE');
 assert.deepEqual(ops[0].complementos.notas_fiscais_divergentes.map(n=>n.numero_nota),['0001','0002','0003']);
 for(const fields of [{valor_final:11},{v_acerto:1},{qtde:2},{cancelada:true},{v_frete:1},{cortesia:1},{vendedor:[{funcionario:1,nome:'Exemplo'}]},{produtos:[{quantidade:1,preco:11}]}]){
  const value=[v,{...v,numero_nota:'0002',...fields}];
  await assert.rejects(consultarVendasHistoricas({...args,fetchImpl:async()=>({ok:true,json:async()=>({'odata.count':value.length,value})})}),/CHAVE_DUPLICADA_CONFLITANTE/);
 }
 const r=await carregarJanela({estado:iniciarCarga({...plano,fim:plano.inicio}),consultarVendas:async()=>ops,consultarCancelamentos:async()=>[],repositorio:{transacao:async(s,fn)=>fn({salvarHistorico:async()=>{}})},salvar:async()=>{}});
 assert.equal(r.estado.filiais[0].notasFiscaisPendentes,1);
});
