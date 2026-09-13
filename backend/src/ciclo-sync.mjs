import {validarDia,janelaCancelamentos} from './sincronizar-cancelamentos.mjs';
export function* dias(inicio,fim){
 validarDia(inicio);validarDia(fim);if(inicio>fim)throw new Error('PERIODO_INVALIDO');
 for(let d=new Date(`${inicio}T00:00:00Z`);d.toISOString().slice(0,10)<=fim;d.setUTCDate(d.getUTCDate()+1))yield d.toISOString().slice(0,10);
}
export function atrasoAposFalhas(intervalo,falhas){
 if(!Number.isFinite(intervalo)||intervalo<1||!Number.isSafeInteger(falhas)||falhas<0)throw new Error('INTERVALO_INVALIDO');
 return intervalo*Math.min(16,falhas<3?1:2**Math.min(falhas-2,4));
}
export async function sincronizarRecurso({repositorio,tenant,filial,recurso,inicioHistorico,fim,consultar,progresso=()=>{},parar=()=>false}){
 if(!['vendas','cancelamentos'].includes(recurso))throw new Error('RECURSO_INVALIDO');
 const checkpoint=await repositorio.transacao({tenant,filial},tx=>tx.lerCheckpoint(recurso));
 const janela=janelaCancelamentos(inicioHistorico,checkpoint,fim);
 let quantidade=0,janelas=0;
 for(const dia of dias(janela.inicio,janela.fim)){
  if(parar())throw new Error('INTERRUPCAO_SOLICITADA');
  const total=await repositorio.transacao({tenant,filial},async tx=>{
   const itens=await consultar({filial,inicio:dia,fim:dia});
   if(recurso==='vendas')await tx.salvarOperacoes(itens);else await tx.salvarCancelamentos(itens);
   await tx.salvarCheckpoint(dia,recurso);
   return itens.length;
  });
  quantidade+=total;janelas++;
  progresso({recurso,filial,dia,quantidade:total,janelas});
 }
 return {recurso,filial,...janela,quantidade,janelas};
}
