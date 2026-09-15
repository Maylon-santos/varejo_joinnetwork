import {ErroApi} from './painel.mjs';
const falha=(codigo,status=409)=>{throw new ErroApi(status,codigo);};
export function aplicarAcaoFila(original,body,{agora,hoje,id,gerente,codigoProprio,nomes={}}){
 const s=structuredClone(original),acao=body.acao;
 const gerenciar=()=>{if(!gerente)falha('RECURSO_NAO_AUTORIZADO',403);};
 const motivo=()=>{if(typeof body.motivo!=='string'||!body.motivo.trim()||body.motivo.trim().length>300)falha('FILA_MOTIVO_OBRIGATORIO',400);return body.motivo.trim();};
 const cauda=()=>Math.max(0,...s.participantes.map(p=>p.posicao))+1;
 const hojeObrigatorio=()=>{if(body.dia!==hoje)falha('FILA_DIA_ENCERRADO');};
 if(acao==='abrir'){
  gerenciar();hojeObrigatorio();if(s.jornada)falha('FILA_JORNADA_EXISTENTE');
  const codes=body.vendedores;
  if(!Array.isArray(codes)||!codes.length||codes.length>60||codes.some(c=>typeof c!=='string'||!Object.hasOwn(nomes,c))||new Set(codes).size!==codes.length)falha('FILA_EQUIPE_INVALIDA',400);
  s.jornada={estado:'aberta',aberta_em:agora,fechada_em:null};
  s.participantes=codes.map((c,i)=>({vendedor_codigo:c,nome:nomes[c],posicao:i+1,estado:'disponivel'}));return s;
 }
 if(!s.jornada||s.jornada.estado!=='aberta')falha('FILA_NAO_ABERTA');
 if(acao==='fechar'){gerenciar();if(s.atendimentos.some(a=>!a.finalizado_em))falha('FILA_ATENDIMENTOS_ABERTOS');s.jornada.estado='fechada';s.jornada.fechada_em=agora;return s;}
 if(['iniciar','concluir'].includes(acao)){
  const a=s.atendimentos.find(a=>a.id===body.atendimento&&!a.finalizado_em);if(!a)falha('FILA_ATENDIMENTO_NAO_ENCONTRADO',404);
  if(!gerente&&a.vendedor_codigo!==codigoProprio)falha('RECURSO_NAO_AUTORIZADO',403);
  const p=s.participantes.find(p=>p.vendedor_codigo===a.vendedor_codigo);
  if(acao==='iniciar'){if(a.iniciado_em)falha('FILA_JA_INICIADO');a.iniciado_em=agora;return s;}
  if(!['com_venda','sem_venda','nao_iniciado'].includes(body.resultado))falha('FILA_RESULTADO_INVALIDO',400);
  if(body.resultado==='nao_iniciado'&&a.iniciado_em)falha('FILA_JA_INICIADO');
  if(body.resultado!=='nao_iniciado'&&!a.iniciado_em)falha('FILA_INICIO_OBRIGATORIO');
  a.motivo=body.resultado==='com_venda'?null:motivo();a.resultado=body.resultado;a.finalizado_em=agora;
  p.estado='disponivel';if(a.modalidade==='vez'&&body.resultado!=='nao_iniciado')p.posicao=cauda();return s;
 }
 hojeObrigatorio();
 let p=s.participantes.find(p=>p.vendedor_codigo===body.vendedor);
 if(acao==='chegada'){
  gerenciar();if(p){if(p.estado!=='ausente')falha('FILA_VENDEDOR_PRESENTE');p.estado='disponivel';p.posicao=cauda();}
  else{if(typeof body.vendedor!=='string'||!Object.hasOwn(nomes,body.vendedor)||s.participantes.length>=60)falha('FILA_EQUIPE_INVALIDA',400);s.participantes.push({vendedor_codigo:body.vendedor,nome:nomes[body.vendedor],posicao:cauda(),estado:'disponivel'});}return s;
 }
 if(!p)falha('FILA_VENDEDOR_NAO_ENCONTRADO',404);
 if(['pausar','retornar','ausente'].includes(acao)){
  gerenciar();if(p.estado==='ocupado')falha('FILA_VENDEDOR_OCUPADO');
  if(acao==='retornar'){if(p.estado!=='pausa')falha('FILA_ESTADO_INVALIDO');p.posicao=cauda();p.estado='disponivel';}
  else{if(p.estado!=='disponivel'&&!(acao==='ausente'&&p.estado==='pausa'))falha('FILA_ESTADO_INVALIDO');motivo();p.estado=acao==='pausar'?'pausa':'ausente';}return s;
 }
 if(acao==='abordar'){
  if(!gerente&&p.vendedor_codigo!==codigoProprio)falha('RECURSO_NAO_AUTORIZADO',403);
  if(p.estado!=='disponivel')falha('FILA_VENDEDOR_OCUPADO');
  if(!['vez','reservado'].includes(body.modalidade))falha('FILA_MODALIDADE_INVALIDA',400);
  const proximo=[...s.participantes].filter(p=>p.estado==='disponivel').sort((a,b)=>a.posicao-b.posicao)[0];
  if(body.modalidade==='vez'&&proximo?.vendedor_codigo!==p.vendedor_codigo)falha('FILA_NAO_E_SUA_VEZ');
  if(body.modalidade==='reservado')motivo();
  p.estado='ocupado';s.atendimentos.push({id,vendedor_codigo:p.vendedor_codigo,modalidade:body.modalidade,abordado_em:agora,iniciado_em:null,finalizado_em:null,resultado:null,motivo:null});return s;
 }
 falha('FILA_ACAO_INVALIDA',400);
}
