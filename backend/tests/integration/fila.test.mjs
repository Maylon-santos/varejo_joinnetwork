import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {ambienteFila} from '../fixtures/fila.mjs';import {criarFila} from '../../src/fila-atendimento.mjs';import {validarPerfil} from '../../src/gestao-permissoes.mjs';
let e;before(async()=>{e=await ambienteFila();});after(async()=>{await e?.close();});
const req=async(method,path,body,role='admin')=>{const r=await fetch(e.base+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+(e.tokens[role]??''),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
const ler=async(f,role='admin')=>(await req('GET','/fila?'+new URLSearchParams({filial:f,dia:e.dia}),null,role)).data;
const body=async(f,acao,extra={})=>({filial:f,dia:e.dia,acao,versao:(await ler(f)).jornada?.versao??0,requisicao:randomUUID(),...extra});
const agir=async(f,acao,extra={},role='admin')=>req('POST','/fila',await body(f,acao,extra),role);
test('Abertura, concorrência da vez, retry idempotente e histórico preservado',async()=>{
 assert.equal((await agir('1','abrir',{vendedores:['10','20']})).status,200);
 const b=await body('1','abordar',{vendedor:'10',modalidade:'vez'});const results=await Promise.all([req('POST','/fila',b),req('POST','/fila',{...b,requisicao:randomUUID()})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const before=await ler('1');assert.equal(before.atendimentos.length,1);assert.equal((await req('POST','/fila',b)).data.repetida,true);assert.equal((await ler('1')).jornada.versao,before.jornada.versao);
 assert.equal((await req('POST','/fila',{...b,vendedor:'20'})).status,409);
 const id=before.atendimentos[0].id;assert.equal((await agir('1','concluir',{atendimento:id,resultado:'nao_iniciado',motivo:'Só olhando'})).status,200);
 const after=await ler('1');assert.equal(after.participantes[0].estado,'disponivel');assert.equal((await e.pool.query('SELECT count(*) FROM fila_atendimentos WHERE filial=1')).rows[0].count,'1');assert.equal((await e.pool.query('SELECT count(*) FROM fila_eventos WHERE filial=1')).rows[0].count,'3');
});
test('Operador vê somente seu atendimento, leitor só vê ordem, e mudanças de acesso valem imediatamente',async()=>{
 await agir('2','abrir',{vendedores:['10','20']});await agir('2','abordar',{vendedor:'20',modalidade:'reservado',motivo:'Retorno'});
 const seller=await ler('2','vendas');assert.equal(seller.participantes.length,2);assert.equal(seller.atendimentos.length,0);assert.equal(seller.candidatos.length,0);
 const manager=await ler('2');const id=manager.atendimentos[0].id;assert.equal((await agir('2','concluir',{atendimento:id,resultado:'nao_iniciado',motivo:'Teste'},'vendas')).status,403);
 assert.equal((await agir('2','pausar',{vendedor:'10',motivo:'Teste'},'vendas')).status,403);assert.equal((await agir('2','abordar',{vendedor:'10',modalidade:'vez'},'leitor')).status,403);
 assert.equal((await agir('2','abordar',{vendedor:'10',modalidade:'vez'},'vendas')).status,200);assert.equal((await ler('2','vendas')).atendimentos.length,1);assert.equal((await ler('2','leitor')).atendimentos.length,0);
 assert.equal((await req('GET','/fila?filial=999&dia='+e.dia)).status,403);assert.equal((await req('GET','/fila?filial=2&dia='+e.dia,null,'anonimo')).status,401);
 const actor=await e.auth.autenticar(e.tokens.admin);await assert.rejects(criarFila(e.pool,'outro',e.filiais).ler(actor,'2',e.dia));
 const b=await body('2','fechar');await assert.rejects(e.fila.executar(actor,b,async()=>null));
 await e.control.query("UPDATE access_roles SET permissoes='[]' WHERE tenant_key='teste' AND role='Gerentes'");assert.equal((await req('GET','/fila?filial=2&dia='+e.dia,null,'leitor')).status,403);
});
test('Conclusão, reservado, pausa e ausência preservam regras e fechamento bloqueia atendimento aberto',async()=>{
 await agir('3','abrir',{vendedores:['10','20','30']});await agir('3','pausar',{vendedor:'10',motivo:'Almoço'});await agir('3','retornar',{vendedor:'10'});assert.deepEqual((await ler('3')).participantes.map(p=>p.vendedor_codigo),['20','30','10']);
 await agir('3','abordar',{vendedor:'20',modalidade:'vez'});assert.equal((await agir('3','fechar')).status,409);const id=(await ler('3')).atendimentos[0].id;
 await agir('3','iniciar',{atendimento:id});const version=(await ler('3')).jornada.versao;assert.equal((await agir('3','concluir',{atendimento:id,resultado:'sem_venda'})).status,400);assert.equal((await ler('3')).jornada.versao,version);
 await agir('3','concluir',{atendimento:id,resultado:'sem_venda',motivo:'Tamanho'});assert.deepEqual((await ler('3')).participantes.map(p=>p.vendedor_codigo),['30','10','20']);
 await agir('3','abordar',{vendedor:'10',modalidade:'reservado',motivo:'Cliente retornou'});assert.equal((await agir('3','abordar',{vendedor:'10',modalidade:'reservado',motivo:'Outro'})).status,409);
 const a=(await ler('3')).atendimentos[0];await agir('3','iniciar',{atendimento:a.id});await agir('3','concluir',{atendimento:a.id,resultado:'com_venda'});assert.deepEqual((await ler('3')).participantes.map(p=>p.vendedor_codigo),['30','10','20']);
 await agir('3','ausente',{vendedor:'30',motivo:'Saída'});await agir('3','chegada',{vendedor:'30'});assert.equal((await ler('3')).participantes.at(-1).vendedor_codigo,'30');
 assert.equal((await agir('3','fechar')).status,200);assert.equal((await agir('3','abrir',{vendedores:['10']})).status,409);
 assert.equal((await e.pool.query("SELECT count(*) FROM fila_atendimentos WHERE filial=3 AND finalizado_em IS NOT NULL")).rows[0].count,'2');
});
test('Banco bloqueia duplicidade de ocupação e jornada anterior precisa encerrar antes de abrir o dia',async()=>{
 const ontem=new Date(Date.parse(e.dia+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 await e.pool.query("INSERT INTO fila_jornadas(filial,dia,estado,aberta_em) VALUES(4,$1,'aberta',now())",[ontem]);assert.equal((await agir('4','abrir',{vendedores:['10']})).status,409);assert.equal((await ler('4')).pendente_dia,ontem);
 const response=await req('POST','/fila',{filial:'4',dia:ontem,acao:'fechar',versao:1,requisicao:randomUUID()});assert.equal(response.status,200);assert.equal((await agir('4','abrir',{vendedores:['10']})).status,200);
 await agir('4','abordar',{vendedor:'10',modalidade:'vez'});await assert.rejects(e.pool.query("INSERT INTO fila_atendimentos(id,filial,dia,vendedor_codigo,modalidade,abordado_em) VALUES($1,4,$2,'10','vez',now())",[randomUUID(),e.dia]),{code:'23505'});
});
test('Novas permissões preservam padrão fechado e não permitem gestão com escopo de vendas próprias',async()=>{
 const rows=(await e.control.query("SELECT role,permissoes FROM access_roles WHERE tenant_key='outro'")).rows;assert.ok(rows.find(r=>r.role==='Admin').permissoes.includes('fila:gerenciar'));assert.ok(!rows.find(r=>r.role==='Vendas').permissoes.includes('fila:ler'));
 const p={nome:'Vendas',permissoes:['fila:ler','fila:operar','fila:gerenciar'],todas_filiais:false,somente_proprias_vendas:true};assert.throws(()=>validarPerfil('Vendas',p),/FILA_GESTAO_INCOMPATIVEL/);assert.throws(()=>validarPerfil('Gerentes',{...p,permissoes:['fila:operar'],somente_proprias_vendas:false}),/FILA_PERMISSAO_DEPENDENTE/);
});
