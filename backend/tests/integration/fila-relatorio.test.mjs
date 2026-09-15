import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {ambienteFila} from '../fixtures/fila.mjs';import {semearRelatorioFila} from '../fixtures/fila-relatorio.mjs';
let e,datas;before(async()=>{e=await ambienteFila();datas=await semearRelatorioFila(e);});after(async()=>{await e?.close();});
const req=async(method,path,body,role='admin')=>{const r=await fetch(e.base+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+(e.tokens[role]??''),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
const relatorio=(extra={},role='admin')=>req('GET','/fila/relatorio?'+new URLSearchParams({filial:'5',...datas,...extra}),null,role);
const ler=async(f)=>(await req('GET','/fila?'+new URLSearchParams({filial:f,dia:e.dia}))).data;
const body=async(f,acao,extra={})=>({filial:f,dia:e.dia,acao,versao:(await ler(f)).jornada?.versao??0,requisicao:randomUUID(),...extra});
const agir=async(f,acao,extra={},role='admin')=>req('POST','/fila',await body(f,acao,extra),role);

test('Relatório histórico calcula resultados, média ponderada e disponibilidade excluindo pausa, ausência e abordagem',async()=>{
 const r=await relatorio();assert.equal(r.status,200);const d=r.data;
 assert.equal(d.totais.abordagens,4);assert.equal(d.totais.iniciados,3);assert.equal(d.totais.nao_iniciados,1);assert.equal(d.totais.com_venda,2);assert.equal(d.totais.sem_venda,1);
 assert.equal(d.totais.tempo_medio_segundos,900);assert.equal(d.totais.conversao_informada,200/3);assert.equal(d.totais.tempo_disponivel_segundos,12900);assert.equal(d.totais.em_movimento_intenso,1);
 assert.equal(d.por_vendedor.find(v=>v.vendedor_codigo==='10').tempo_disponivel_segundos,9300);
 assert.equal(d.por_vendedor.find(v=>v.vendedor_codigo==='20').tempo_disponivel_segundos,1800);
 assert.equal(d.por_vendedor.find(v=>v.vendedor_codigo==='30').tempo_disponivel_segundos,1800);
 assert.equal(d.por_dia.length,2);assert.equal(d.motivos.length,2);assert.equal(d.movimentos.length,2);assert.equal(d.registros.length,4);
 assert.equal(d.por_vendedor.find(v=>v.vendedor_codigo==='30').conversao_informada,null);
});

test('Relatório aplica permissões e escopo antes dos totais, motivos, tempos e histórico',async()=>{
 assert.equal((await relatorio({},'vendas')).status,403);assert.equal((await relatorio({},'leitor')).status,403);
 await e.control.query("UPDATE access_roles SET permissoes=permissoes||'[\"fila:relatorios\"]'::jsonb WHERE tenant_key='teste' AND role='Vendas'");
 let r=await relatorio({},'vendas');assert.equal(r.status,200);assert.equal(r.data.totais.abordagens,3);assert.equal(r.data.por_vendedor.length,1);assert.equal(r.data.totais.tempo_medio_segundos,450);assert.equal(r.data.motivos.length,1);assert.equal(r.data.movimentos.length,0);assert.ok(r.data.registros.every(a=>a.vendedor_codigo==='10'));
 assert.equal((await relatorio({vendedor:'20'},'vendas')).status,403);assert.equal((await relatorio({filial:'99'})).status,403);assert.equal((await relatorio({},'anonimo')).status,401);
 r=await relatorio({vendedor:'20'});assert.equal(r.data.totais.abordagens,1);assert.equal(r.data.totais.tempo_medio_segundos,1800);
 const actor=await e.auth.autenticar(e.tokens.admin);await assert.rejects(e.fila.relatorio({...actor,tenant_key:'outro'},{filial:'5',...datas}),/RECURSO_NAO_AUTORIZADO/);
 const defaults=(await e.control.query("SELECT permissoes FROM access_roles WHERE tenant_key='outro' AND role='Vendas'")).rows[0].permissoes;assert.ok(!defaults.includes('fila:relatorios'));
 await e.control.query("UPDATE access_roles SET permissoes=permissoes-'fila:relatorios' WHERE tenant_key='teste' AND role='Vendas'");assert.equal((await relatorio({},'vendas')).status,403);
});

test('Consulta rejeita parâmetros ambíguos e período excessivo; ausência é distinta de zero de conversão',async()=>{
 assert.equal((await relatorio({inicio:'2026-08-01',fim:'2026-09-15'})).status,400);assert.equal((await relatorio({pagina:'0'})).status,400);
 assert.equal((await req('GET','/fila/relatorio?'+new URLSearchParams({filial:'5',...datas})+'&filial=1')).status,400);
 const empty=await relatorio({filial:'6'});assert.equal(empty.status,200);assert.equal(empty.data.totais.conversao_informada,null);assert.equal(empty.data.totais.tempo_medio_segundos,null);
});

test('Movimento intenso persistido, retry idempotente, concorrência, permissões e retorno à ordem',async()=>{
 assert.equal((await agir('1','abrir',{vendedores:['10','20','30']})).status,200);
 assert.equal((await agir('1','movimento_intenso',{ativo:true,motivo:'Pico'},'vendas')).status,403);
 const b=await body('1','movimento_intenso',{ativo:true,motivo:'Pico'});
 const r=await Promise.all([req('POST','/fila',b),req('POST','/fila',{...b,requisicao:randomUUID()})]);assert.deepEqual(r.map(r=>r.status).sort(),[200,409]);assert.equal((await req('POST','/fila',b)).data.repetida,true);
 assert.equal((await ler('1')).jornada.movimento_intenso,true);
 assert.equal((await agir('1','abordar',{vendedor:'30',modalidade:'vez'})).status,200);
 assert.equal((await agir('1','abordar',{vendedor:'30',modalidade:'reservado',motivo:'Outro'})).status,409);
 assert.equal((await agir('1','movimento_intenso',{ativo:false,motivo:'Normalizou'})).status,200);
 assert.equal((await agir('1','abordar',{vendedor:'20',modalidade:'vez'})).status,409);
 let a=(await ler('1')).atendimentos[0];assert.equal(a.movimento_intenso,true);await agir('1','iniciar',{atendimento:a.id});
 const report=await relatorio({filial:'1',inicio:e.dia,fim:e.dia});assert.equal(report.data.totais.em_atendimento,1);assert.equal(report.data.totais.tempo_medio_segundos,null);
 assert.equal((await agir('1','concluir',{atendimento:a.id,resultado:'com_venda'})).status,200);assert.equal((await agir('1','fechar')).status,200);assert.equal((await ler('1')).jornada.movimento_intenso,false);
 const eventos=(await e.pool.query("SELECT dados->'pedido'->>'motivo' AS motivo FROM fila_eventos WHERE filial=1 AND acao='movimento_intenso'")).rows;assert.equal(eventos.length,2);
});

test('Histórico paginado mantém totais e ordem estável entre páginas',async()=>{
 await agir('7','abrir',{vendedores:['10']});
 for(let i=0;i<32;i++){await agir('7','abordar',{vendedor:'10',modalidade:'vez'});const a=(await ler('7')).atendimentos[0];await agir('7','concluir',{atendimento:a.id,resultado:'nao_iniciado',motivo:'Simulação'});}
 const filtro={filial:'7',inicio:e.dia,fim:e.dia};const a=(await relatorio(filtro)).data,b=(await relatorio({...filtro,pagina:'2'})).data;
 assert.equal(a.total_registros,32);assert.equal(b.total_registros,32);assert.equal(a.registros.length,30);assert.equal(b.registros.length,2);assert.equal(new Set([...a.registros,...b.registros].map(r=>r.id)).size,32);assert.equal(a.totais.nao_iniciados,32);
});
