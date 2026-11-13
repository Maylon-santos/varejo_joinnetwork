import {validarDia} from './sincronizar-cancelamentos.mjs';
import {normalizarVenda,consultarVendas} from './vendas.mjs';
import {clientesDaVenda} from './clientes.mjs';

export function normalizarVendaHistorica(v,...escopo){
 let fonte=v,clientePendente,op;
 try{clientesDaVenda(v);}catch(e){
  // Cadastro inválido permanece pendente (NULL), nunca como cliente anônimo
  // ou lista vazia confirmada. Todas as outras validações continuam obrigatórias.
  if(!['CLIENTE_CODIGO_INVALIDO','CLIENTE_ANIVERSARIO_INVALIDO','CLIENTES_INVALIDOS','CLIENTE_INVALIDO'].includes(e.message))throw e;
  fonte={...v,customers:undefined};clientePendente=e.message;
 }
 try{op=normalizarVenda(fonte,...escopo);}catch(e){
  if(fonte.lancamentos==null)throw e;
  // Se retirar apenas os lançamentos não resolver, o erro continua bloqueante.
  // Nunca arredondar parcelas ou retirar preços, totais, ajuste ou frete.
  op=normalizarVenda({...fonte,lancamentos:undefined},...escopo);
  op.pagamentos_pendencia='LANCAMENTOS_ERP_INVALIDOS';
 }
 if(clientePendente){op.clientes=null;op.clientes_pendencia=clientePendente;}
 return op;
}
export function consultarVendasHistoricas(options){return consultarVendas({...options,normalizador:normalizarVendaHistorica});}

export function somarDias(dia,n){return new Date(Date.parse(dia+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
export function iniciarCarga(plano){
 validarDia(plano.inicio);validarDia(plano.fim);
 if(plano.inicio>plano.fim||!plano.tenant||!Array.isArray(plano.filiais)||!plano.filiais.length||new Set(plano.filiais).size!==plano.filiais.length||plano.filiais.some(f=>!/^\d+$/.test(f)))throw Error('HISTORICO_PLANO_INVALIDO');
 return {versao:1,plano:structuredClone(plano),estado:'preparado',filiais:plano.filiais.map(filial=>({filial,proximoDia:plano.inicio,ate:null,estado:'pendente',janelas:0,operacoes:0,cancelamentos:0})),atualizadoEm:new Date().toISOString()};
}
export function proximaJanela(estado,maxDias=7){
 if(!Number.isSafeInteger(maxDias)||maxDias<1||maxDias>7)throw Error('HISTORICO_JANELA_INVALIDA');
 const filial=estado.filiais.find(f=>f.estado!=='concluida');if(!filial)return null;
 return {filial:filial.filial,inicio:filial.proximoDia,fim:[somarDias(filial.proximoDia,maxDias-1),estado.plano.fim].sort()[0]};
}
export async function carregarJanela({estado,maxDias=7,consultarVendas,consultarCancelamentos,repositorio,salvar,confirmarCobertura=async()=>true}){
 const janela=proximaJanela(estado,maxDias);if(!janela)return null;
 const operacoes=await consultarVendas(janela),eventos=await consultarCancelamentos(janela);
 if(janela.fim===estado.plano.fim&&!await confirmarCobertura(janela.filial))throw Error('HISTORICO_COBERTURA_ATUAL_PENDENTE');
 await repositorio.transacao({tenant:estado.plano.tenant,filial:janela.filial},tx=>tx.salvarHistorico(operacoes,eventos,janela));
 const novo=structuredClone(estado),f=novo.filiais.find(f=>f.filial===janela.filial);
 f.ate=janela.fim;f.proximoDia=somarDias(janela.fim,1);f.janelas++;f.operacoes+=operacoes.length;f.cancelamentos+=eventos.length;f.estado=janela.fim===novo.plano.fim?'concluida':'processando';
 f.clientesPendentes=(f.clientesPendentes??0)+operacoes.filter(o=>o.clientes_pendencia).length;
 f.pagamentosPendentes=(f.pagamentosPendentes??0)+operacoes.filter(o=>o.pagamentos_pendencia).length;
 novo.estado=novo.filiais.every(f=>f.estado==='concluida')?'carga_concluida':'processando';novo.atualizadoEm=new Date().toISOString();delete novo.ultimoErro;
 await salvar(novo);
 return {estado:novo,janela,operacoes:operacoes.length,cancelamentos:eventos.length,clientesPendentes:operacoes.filter(o=>o.clientes_pendencia).length,pagamentosPendentes:operacoes.filter(o=>o.pagamentos_pendencia).length};
}
