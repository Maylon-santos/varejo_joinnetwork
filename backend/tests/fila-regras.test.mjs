import test from 'node:test';import assert from 'node:assert/strict';
import {aplicarAcaoFila} from '../src/fila-regras.mjs';
const ctx={agora:'2026-09-15T12:00:00Z',hoje:'2026-09-15',id:'atendimento',gerente:true,codigoProprio:null,nomes:{10:'Ana',20:'Bruno',30:'Carla'}};
const run=(s,b,c={})=>aplicarAcaoFila(s,{dia:ctx.hoje,...b},{...ctx,...c});
const start=()=>run({jornada:null,participantes:[],atendimentos:[]},{acao:'abrir',vendedores:['10','20','30']});
const ordem=s=>s.participantes.filter(p=>p.estado==='disponivel').sort((a,b)=>a.posicao-b.posicao).map(p=>p.vendedor_codigo);
test('Não iniciado preserva a vez; conclusão sem venda consome a vez com motivo',()=>{
 const original=start();let s=run(original,{acao:'abordar',vendedor:'10',modalidade:'vez'});assert.deepEqual(ordem(s),['20','30']);assert.equal(original.atendimentos.length,0);
 s=run(s,{acao:'concluir',atendimento:'atendimento',resultado:'nao_iniciado',motivo:'Só olhando'});assert.deepEqual(ordem(s),['10','20','30']);
 s=run(s,{acao:'abordar',vendedor:'10',modalidade:'vez'},{id:'segundo'});s=run(s,{acao:'iniciar',atendimento:'segundo'});
 assert.throws(()=>run(s,{acao:'concluir',atendimento:'segundo',resultado:'nao_iniciado',motivo:'Teste'}),/FILA_JA_INICIADO/);
 assert.throws(()=>run(s,{acao:'concluir',atendimento:'segundo',resultado:'sem_venda'}),/FILA_MOTIVO_OBRIGATORIO/);
 s=run(s,{acao:'concluir',atendimento:'segundo',resultado:'sem_venda',motivo:'Tamanho indisponível'});assert.deepEqual(ordem(s),['20','30','10']);
});
test('Pausa retorna ao final, ausência não recebe vez e chegada entra no final',()=>{
 let s=start();s=run(s,{acao:'pausar',vendedor:'10',motivo:'Almoço'});assert.deepEqual(ordem(s),['20','30']);s=run(s,{acao:'retornar',vendedor:'10'});assert.deepEqual(ordem(s),['20','30','10']);
 s=run(s,{acao:'ausente',vendedor:'20',motivo:'Saída'});s=run(s,{acao:'chegada',vendedor:'20'});assert.deepEqual(ordem(s),['30','10','20']);
});
test('Reservado preserva prioridade, não permite outro atendimento nem mudança de presença ocupado',()=>{
 let s=start();s=run(s,{acao:'abordar',vendedor:'20',modalidade:'reservado',motivo:'Cliente retornou'});
 assert.throws(()=>run(s,{acao:'abordar',vendedor:'20',modalidade:'reservado',motivo:'Outro cliente'}),/FILA_VENDEDOR_OCUPADO/);
 assert.throws(()=>run(s,{acao:'pausar',vendedor:'20',motivo:'Almoço'}),/FILA_VENDEDOR_OCUPADO/);
 s=run(s,{acao:'iniciar',atendimento:'atendimento'});s=run(s,{acao:'concluir',atendimento:'atendimento',resultado:'com_venda'});assert.deepEqual(ordem(s),['10','20','30']);
});
test('Dia anterior permite resolver pendências, mas não começar nova abordagem; fechamento exige zero abertos',()=>{
 let s=run(start(),{acao:'abordar',vendedor:'10',modalidade:'vez'});assert.throws(()=>run(s,{acao:'fechar'}),/FILA_ATENDIMENTOS_ABERTOS/);
 assert.throws(()=>run(s,{acao:'abordar',vendedor:'20',modalidade:'vez'},{hoje:'2026-09-16'}),/FILA_DIA_ENCERRADO/);
 s=run(s,{acao:'concluir',atendimento:'atendimento',resultado:'nao_iniciado',motivo:'Encerramento'},{hoje:'2026-09-16'});s=run(s,{acao:'fechar'},{hoje:'2026-09-16'});assert.equal(s.jornada.estado,'fechada');
});
test('Operador só atua no próprio código e na ordem correta',()=>{
 assert.throws(()=>run(start(),{acao:'abordar',vendedor:'20',modalidade:'vez'}),/FILA_NAO_E_SUA_VEZ/);
 assert.throws(()=>run(start(),{acao:'abordar',vendedor:'10',modalidade:'vez'},{gerente:false,codigoProprio:'20'}),/RECURSO_NAO_AUTORIZADO/);
 assert.throws(()=>run(start(),{acao:'pausar',vendedor:'20',motivo:'Teste'},{gerente:false,codigoProprio:'20'}),/RECURSO_NAO_AUTORIZADO/);
});

test('Abordagem já aberta pode prosseguir após a meia-noite sem perder o registro',()=>{
 let s=run(start(),{acao:'abordar',vendedor:'10',modalidade:'vez'});
 s=run(s,{acao:'iniciar',atendimento:'atendimento'},{hoje:'2026-09-16',agora:'2026-09-16T03:01:00Z'});
 s=run(s,{acao:'concluir',atendimento:'atendimento',resultado:'com_venda'},{hoje:'2026-09-16',agora:'2026-09-16T03:02:00Z'});
 assert.equal(s.atendimentos[0].resultado,'com_venda');assert.equal(s.atendimentos[0].abordado_em,ctx.agora);
});

test('Movimento intenso exige gestão e motivo, flexibiliza somente a ordem e preserva fotografia na abordagem',()=>{
 let s=start();
 assert.throws(()=>run(s,{acao:'movimento_intenso',ativo:true,motivo:'Pico'},{gerente:false}),/RECURSO_NAO_AUTORIZADO/);
 assert.throws(()=>run(s,{acao:'movimento_intenso',ativo:true}),/FILA_MOTIVO_OBRIGATORIO/);
 assert.throws(()=>run(s,{acao:'movimento_intenso',ativo:'true',motivo:'Pico'}),/FILA_MODO_INVALIDO/);
 s=run(s,{acao:'movimento_intenso',ativo:true,motivo:'Pico'});
 s=run(s,{acao:'abordar',vendedor:'30',modalidade:'vez'},{gerente:false,codigoProprio:'30'});
 assert.equal(s.atendimentos[0].movimento_intenso,true);
 assert.throws(()=>run(s,{acao:'abordar',vendedor:'30',modalidade:'reservado',motivo:'Outro cliente'}),/FILA_VENDEDOR_OCUPADO/);
 s=run(s,{acao:'movimento_intenso',ativo:false,motivo:'Normalizou'});
 assert.throws(()=>run(s,{acao:'abordar',vendedor:'20',modalidade:'vez'}),/FILA_NAO_E_SUA_VEZ/);
 s=run(s,{acao:'iniciar',atendimento:'atendimento'});s=run(s,{acao:'concluir',atendimento:'atendimento',resultado:'com_venda'});
 assert.equal(s.atendimentos[0].movimento_intenso,true);assert.deepEqual(ordem(s),['10','20','30']);
});

test('Virada e fechamento não deixam movimento intenso ativo na jornada seguinte',()=>{
 let s=run(start(),{acao:'movimento_intenso',ativo:true,motivo:'Pico'});
 assert.throws(()=>run(s,{acao:'movimento_intenso',ativo:true,motivo:'Pico'},{hoje:'2026-09-16'}),/FILA_DIA_ENCERRADO/);
 s=run(s,{acao:'movimento_intenso',ativo:false,motivo:'Normalizou'},{hoje:'2026-09-16'});
 assert.equal(s.jornada.movimento_intenso,false);
 s=run(s,{acao:'movimento_intenso',ativo:true,motivo:'Pico'});s=run(s,{acao:'fechar'});
 assert.equal(s.jornada.movimento_intenso,false);assert.equal(start().jornada.movimento_intenso,false);
});
