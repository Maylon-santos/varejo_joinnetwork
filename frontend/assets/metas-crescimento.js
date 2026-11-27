const $=id=>document.getElementById(id);
const node=(tag,text,classe)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(classe)e.className=classe;return e;};
const dinheiro=v=>{if(v===null)return '—';const n=BigInt(v),a=n<0n?-n:n;return `${n<0n?'-':''}R$ ${new Intl.NumberFormat('pt-BR').format(a/100n)},${String(a%100n).padStart(2,'0')}`;};
const mes=v=>new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(v+'-01T12:00:00Z'));
const impedimentos={MES_BASE_NAO_ENCERRADO:'O mês do ano anterior ainda não foi encerrado.',SEM_BASE_POSITIVA:'Sem vendas positivas para calcular. Defina o valor manualmente.',SUGESTAO_ACIMA_DO_LIMITE:'Sugestão acima do limite permitido. Defina o valor manualmente.'};
export function criarSugestoesMetas({api,estaAtivo,onSaved}){
 let auto=false,previa=null,geracao=0,abort=null,enviando=false,requisicao=null,pedidoAnterior=null;
 const botoes=[...document.querySelectorAll('[data-goal-method]')];
 const limparPrevia=()=>{geracao++;abort?.abort();previa=null;requisicao=null;pedidoAnterior=null;$('goal-growth-results').hidden=true;$('goal-growth-rows').replaceChildren();$('goal-growth-total').textContent='';$('goal-growth-status').textContent='';if(auto)$('goal-save').disabled=true;if(!enviando)$('goal-growth-preview').disabled=false;};
 const selecionados=()=>previa?.meses.filter(r=>$('goal-growth-rows').querySelector(`[data-mes="${r.competencia}"]`)?.checked)||[];
 function total(){const rows=selecionados(),valor=rows.reduce((a,r)=>a+BigInt(r.sugestao_centavos),0n);$('goal-growth-total').replaceChildren(node('span',`${rows.length} ${rows.length===1?'mês selecionado':'meses selecionados'}`),node('strong',dinheiro(valor.toString())));$('goal-save').textContent=rows.length?`Confirmar e salvar ${rows.length} ${rows.length===1?'meta':'metas'}`:'Selecione os meses';$('goal-save').disabled=!rows.length||enviando;}
 function modo(valor){
  if(enviando)return;auto=valor==='crescimento';limparPrevia();$('goal-dialog').classList.toggle('goal-batch',auto);$('goal-growth').hidden=!auto;$('goal-value-field').hidden=auto;$('goal-value').required=!auto;$('goal-help').hidden=auto;$('goal-error').textContent='';
  botoes.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.goalMethod===valor)));$('goal-remove').hidden=auto||!$('goal-value').value;$('goal-save').textContent=auto?'Gere a prévia para continuar':'Salvar meta';$('goal-save').disabled=auto;
 }
 function render(){
  const root=$('goal-growth-rows');root.replaceChildren();
  for(const r of previa.meses){
   const card=node('label',undefined,'goal-growth-row'),check=node('input');check.type='checkbox';check.dataset.mes=r.competencia;check.disabled=!!r.impedimento;check.checked=!r.impedimento&&r.base.cobertura_completa&&r.meta_atual.valor_centavos===null;check.setAttribute('aria-label','Salvar meta de '+mes(r.competencia));
   const main=node('div',undefined,'goal-growth-month');main.append(node('strong',mes(r.competencia)),node('small',`${r.base.vendas} vendas · ${r.base.pecas} peças`));
   const base=node('div',undefined,'goal-growth-value');base.append(node('small',mes(r.base.inicio.slice(0,7))),node('strong',dinheiro(r.base.valor_centavos)));
   const sugestao=node('div',undefined,'goal-growth-value goal-growth-suggestion');sugestao.append(node('small','Meta sugerida · +'+previa.crescimento_percentual.replace('.',',')+'%'),node('strong',dinheiro(r.sugestao_centavos)));
   card.append(check,main,base,sugestao);
   const avisos=[];
   if(r.impedimento)avisos.push(impedimentos[r.impedimento]||'Base indisponível.');
   if(r.meta_atual.valor_centavos!==null)avisos.push('Meta atual: '+dinheiro(r.meta_atual.valor_centavos)+'. Selecionar este mês autoriza substituí-la.');
   if(!r.base.cobertura_completa&&!r.impedimento)avisos.push('Cobertura parcial: selecionar autoriza usar esta base incompleta.');
   if(r.base.pendencias)avisos.push(`${r.base.pendencias} ${r.base.pendencias===1?'venda com pendência de conferência incluída':'vendas com pendência de conferência incluídas'} na base.`);
   if(avisos.length)card.append(node('span',avisos.join(' '),'goal-growth-warning'));
   card.classList.toggle('unavailable',!!r.impedimento);check.addEventListener('change',total);root.append(card);
  }
  $('goal-growth-results').hidden=false;$('goal-growth-status').textContent='Prévia calculada. Revise os meses antes de salvar.';total();
 }
 async function gerar(){
  if(enviando||!auto||!estaAtivo())return;limparPrevia();$('goal-error').textContent='';
  const filial=$('goal-branch').value,inicio=$('goal-competence').value,fim=$('goal-growth-end').value,v=$('goal-growth-percent').value.trim();
  if(!filial){$('goal-error').textContent='Selecione a loja para gerar a prévia.';return;}
  if(!/^\d{1,4}(?:[,.]\d{1,2})?$/.test(v)||Number(v.replace(',','.'))>1000){$('goal-error').textContent='Informe um crescimento entre 0 e 1.000%, com até duas casas decimais.';return;}
  const [inteiro,decimal='']=v.replace(',','.').split('.'),crescimento=BigInt(inteiro).toString()+'.'+decimal.padEnd(2,'0'),g=geracao;abort=new AbortController();$('goal-growth-preview').disabled=true;$('goal-growth-status').textContent='Consultando o ano anterior…';
  try{const d=await api('/metas/crescimento/previa?'+new URLSearchParams({filial,inicio,fim,crescimento}),{signal:abort.signal});if(g!==geracao||!auto||!estaAtivo()||!$('goal-dialog').open)return;previa=d;render();}
  catch(e){if(e.name!=='AbortError'&&g===geracao&&estaAtivo()){$('goal-error').textContent=e.message;$('goal-growth-status').textContent='';}}
  finally{if(g===geracao)$('goal-growth-preview').disabled=false;}
 }
 async function salvar(){
  if(enviando||!auto||!previa||!estaAtivo())return;const rows=selecionados();if(!rows.length)return;
  const body={filial:previa.filial,inicio:previa.inicio,fim:previa.fim,crescimento:previa.crescimento_percentual,meses:rows.map(r=>({competencia:r.competencia,assinatura:r.assinatura,substituir:r.meta_atual.valor_centavos!==null,aceitar_base_parcial:!r.base.cobertura_completa}))};
  const hash=JSON.stringify(body);if(hash!==pedidoAnterior){requisicao=crypto.randomUUID();pedidoAnterior=hash;}body.requisicao=requisicao;
  const g=geracao,controles=[...$('goal-form').querySelectorAll('input,select,button')],estados=controles.map(c=>c.disabled);enviando=true;controles.forEach(c=>c.disabled=true);$('goal-error').textContent='Salvando o lote…';
  try{const d=await api('/metas/crescimento/confirmar',{method:'POST',body:JSON.stringify(body)});if(g!==geracao||!estaAtivo())return;$('goal-dialog').close();await onSaved(d.metas.length);}
  catch(e){if(g!==geracao||!estaAtivo())return;$('goal-error').textContent=e.message;if(['META_PREVIA_DESATUALIZADA','META_BASE_INDISPONIVEL','REQUISICAO_REUTILIZADA'].includes(e.codigo))limparPrevia();}
  finally{enviando=false;controles.forEach((c,i)=>c.disabled=estados[i]);if(auto){if(previa)total();else $('goal-save').disabled=true;}}
 }
 botoes.forEach(b=>b.addEventListener('click',()=>modo(b.dataset.goalMethod)));
 for(const id of ['goal-growth-percent','goal-growth-end'])$(id).addEventListener('input',()=>{if(!enviando){limparPrevia();$('goal-error').textContent='';}});
 $('goal-branch').addEventListener('change',()=>{if(auto){limparPrevia();$('goal-remove').hidden=true;}});
 $('goal-growth-preview').addEventListener('click',gerar);
 $('goal-dialog').addEventListener('cancel',e=>{if(enviando)e.preventDefault();});
 $('goal-dialog').addEventListener('close',()=>{limparPrevia();});
 return {automatico:()=>auto,salvar,abrir(inicio){enviando=false;$('goal-growth-end').value=inicio;$('goal-growth-end').min=inicio;const d=new Date(inicio+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+11);$('goal-growth-end').max=d.toISOString().slice(0,7)>'2099-12'?'2099-12':d.toISOString().slice(0,7);$('goal-growth-percent').value='10';$('goal-growth-preview').disabled=false;botoes.forEach(b=>b.disabled=false);modo('manual');}};
}
