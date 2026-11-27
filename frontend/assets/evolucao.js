const $=id=>document.getElementById(id);
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const inteiro=new Intl.NumberFormat('pt-BR');
const moeda=v=>{if(v===null)return '—';const n=BigInt(v),a=n<0n?-n:n;return `${n<0n?'− ':''}R$ ${inteiro.format(a/100n)},${String(a%100n).padStart(2,'0')}`;};
const data=d=>d.split('-').reverse().join('/');
const percentual=(a,b)=>{if(b===null||b<=0n)return 'Sem base percentual';const n=a*10000n/b,abs=n<0n?-n:n;return `${n<0n?'−':''}${abs/100n},${String(abs%100n).padStart(2,'0')}% da referência`;};
const diferenca=(a,b)=>b===null?'—':(a>b?'+ ':'')+moeda(a-b);
const hoje=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

// Referência visual em centavos: diferenças dos acumulados do mês preservam o total exato.
export function prepararEvolucao(d,diaAtual=hoje()){
 const f=d.filtros,fim=[f.fim,diaAtual,...d.sincronizacao.filter(s=>['vendas','cancelamentos'].includes(s.recurso)&&s.ate).map(s=>s.ate)].sort()[0];
 const metas=Array.isArray(d.metas_mensais)?new Map(d.metas_mensais.map(m=>[m.competencia.slice(0,7),BigInt(m.valor_centavos)])):null;
 const dias=new Map(d.serie_diaria.map(p=>[p.data,p])),pontos=[];let acumulado=0n,referencia=0n;
 for(let dt=new Date(f.inicio+'T12:00:00Z');dt.toISOString().slice(0,10)<=fim;dt.setUTCDate(dt.getUTCDate()+1)){
  const date=dt.toISOString().slice(0,10),mes=date.slice(0,7),dia=BigInt(dt.getUTCDate()),n=BigInt(new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,0)).getUTCDate());
  const meta=metas?.get(mes)??null,ref=meta===null?null:meta*dia/n-meta*(dia-1n)/n,p=dias.get(date),valor=BigInt(p?.valor_vendas_centavos??0);
  acumulado+=valor;referencia=ref===null||referencia===null?null:referencia+ref;
  pontos.push({data:date,fim:date,valor,acumulado,referencia:ref,referenciaAcumulada:referencia,meta,vendas:BigInt(p?.vendas??0),pecas:BigInt(p?.pecas_cabecalho??0)});
 }
 const meses=[...new Set(pontos.map(p=>p.data.slice(0,7)))],completas=!!metas&&meses.every(m=>metas.has(m));
 let valores=pontos;
 if(pontos.length>62){const grupos=new Map();for(const p of pontos){const key=p.data.slice(0,7);if(!grupos.has(key))grupos.set(key,{...p,valor:0n,referencia:0n,vendas:0n,pecas:0n});const g=grupos.get(key);g.fim=p.fim;g.valor+=p.valor;g.referencia=g.referencia===null||p.referencia===null?null:g.referencia+p.referencia;g.acumulado=p.acumulado;g.referenciaAcumulada=p.referenciaAcumulada;g.vendas+=p.vendas;g.pecas+=p.pecas;}valores=[...grupos.values()];}
 return {pontos,valores,metasPermitidas:metas!==null,completas,meses,fim,metaTotal:completas?meses.reduce((n,m)=>n+metas.get(m),0n):null,realizado:acumulado,referencia};
}

export function criarEvolucaoVendas(){
 let dados=null,modelo=null,modo='diario',interacao=null;
 function limparGrafico(){interacao?.abort();interacao=null;$('chart').replaceChildren();}
 function limpar(){limparGrafico();dados=null;modelo=null;modo='diario';$('chart-goal-summary').replaceChildren();$('chart-goal-summary').hidden=true;$('chart-legend').replaceChildren();$('chart-goal-note').textContent='';$('chart-period').textContent='';for(const b of document.querySelectorAll('[data-chart-mode]'))b.setAttribute('aria-pressed',String(b.dataset.chartMode===modo));}
 function render(){
  limparGrafico();if(!dados)return;const m=modelo=prepararEvolucao(dados),lista=m.valores,acum=modo==='acumulado',root=$('chart');
  $('chart-period').textContent=`${data(dados.filtros.inicio)} — ${data(dados.filtros.fim)}`;
  $('chart-description').textContent=acum?'Vendas acumuladas desde o início do intervalo selecionado':'Vendas por '+(m.pontos.length>62?'mês':'dia')+' no intervalo selecionado';
  for(const b of document.querySelectorAll('[data-chart-mode]'))b.setAttribute('aria-pressed',String(b.dataset.chartMode===modo));
  const legend=$('chart-legend');legend.replaceChildren(el('span',acum?'Vendas acumuladas':'Vendas','evolution-key'));
  const temReferencia=lista.some(p=>p.referencia!==null);
  if(temReferencia)legend.append(el('span',acum?'Referência acumulada da meta':'Referência da meta','evolution-key goal'));
  const summary=$('chart-goal-summary');summary.replaceChildren();summary.hidden=!m.metasPermitidas||!lista.length;
  if(m.metasPermitidas&&lista.length){
   for(const [label,valor,nota] of [[m.meses.length===1?'Meta mensal · '+m.meses[0].split('-').reverse().join('/'):'Soma das metas mensais',moeda(m.metaTotal),m.completas?'Valor cadastrado para a loja':'Há meses sem meta cadastrada'],['Referência no intervalo',moeda(m.referencia),'Até '+data(m.fim)],['Realizado no intervalo',moeda(m.realizado),m.completas?percentual(m.realizado,m.referencia):'Sem comparação completa de metas']]){const card=el('div','','evolution-stat'+(label==='Realizado no intervalo'?' is-realized':''));card.append(el('span',label),el('strong',valor),el('small',nota));summary.append(card);}
  }
  if(m.completas&&m.referencia>0n){const pace=el('div','','evolution-pace'),labels=el('div','','evolution-pace-labels'),bar=el('progress'),percent=m.realizado*10000n/m.referencia;labels.append(el('span','Ritmo de vendas no intervalo'),el('strong',percentual(m.realizado,m.referencia).replace(' da referência','')));bar.max=100;bar.value=Math.max(0,Math.min(100,Number(percent)/100));bar.setAttribute('aria-label','Realizado em relação à referência da meta no intervalo');const gap=m.realizado-m.referencia;pace.classList.toggle('is-ahead',gap>=0n);pace.append(labels,bar,el('small',moeda(gap<0n?-gap:gap)+(gap<0n?' para acompanhar a referência':' acima da referência')));summary.append(pace);}
  $('chart-goal-note').textContent=m.metasPermitidas?(temReferencia?'Referência visual: meta mensal distribuída por dias corridos. Não altera a meta cadastrada.':lista.length?'Nenhuma meta cadastrada para os meses exibidos. Defina os valores em Menu → Metas.':''):'Passe o mouse ou toque no gráfico para consultar os valores.';
  if(m.metasPermitidas&&temReferencia&&!m.completas)$('chart-goal-note').textContent+=' Meses sem meta ficam sem linha de referência; o acumulado não presume meta zero.';
  if(!lista.length){root.append(el('div','Não há dias sincronizados neste intervalo.','empty'));return;}
  const largura=Math.max(matchMedia('(max-width:760px)').matches?350:680,lista.length>35?lista.length*20+76:matchMedia('(max-width:760px)').matches?lista.length*25+76:680),altura=266,pad={left:66,right:18,top:20,bottom:36},pw=largura-pad.left-pad.right,ph=altura-pad.top-pad.bottom;
  const valor=p=>acum?p.acumulado:p.valor,ref=p=>acum?p.referenciaAcumulada:p.referencia;
  const numeros=lista.flatMap(p=>[Number(valor(p)),...(ref(p)===null?[]:[Number(ref(p))])]),min=Math.min(0,...numeros),max=Math.max(100,...numeros),margem=(max-min)*.12,baixo=min<0?min-margem:0,cima=max+margem;
  const x=i=>pad.left+(lista.length===1?pw/2:i*pw/(lista.length-1)),y=n=>pad.top+(cima-Number(n))/(cima-baixo)*ph;
  const chart=svg('svg',{viewBox:`0 0 ${largura} ${altura}`,role:'group','aria-label':'Evolução das vendas '+(acum?'acumuladas':'diárias')+' em reais'});chart.style.minWidth=largura+'px';
  const desc=svg('desc');desc.textContent='Passe o mouse ou toque para consultar vendas e referência da meta. Use as setas, Home, End e Escape no teclado.';chart.append(desc);
  for(let i=0;i<=4;i++){const n=baixo+(cima-baixo)*i/4,yy=y(n);chart.append(svg('line',{x1:pad.left,x2:largura-pad.right,y1:yy,y2:yy,stroke:'#e7ebf2','stroke-dasharray':'4 5'}));const t=svg('text',{x:pad.left-10,y:yy+4,'text-anchor':'end'});t.textContent=new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(n/100);chart.append(t);}
  const caminho=fn=>{let aberto=false;return lista.map((p,i)=>{const n=fn(p);if(n===null){aberto=false;return '';}const d=`${aberto?'L':'M'}${x(i)},${y(n)}`;aberto=true;return d;}).join(' ');};
  const defs=svg('defs'),gradient=svg('linearGradient',{id:'evolution-fill',x1:0,y1:0,x2:0,y2:1});gradient.append(svg('stop',{offset:'0%','stop-color':'#168b82','stop-opacity':'.18'}),svg('stop',{offset:'100%','stop-color':'#168b82','stop-opacity':'.01'}));defs.append(gradient);chart.append(defs);
  const linha=caminho(valor);
  chart.append(svg('path',{d:`${linha} L${x(lista.length-1)},${y(0)} L${x(0)},${y(0)} Z`,fill:'url(#evolution-fill)'}));
  chart.append(svg('path',{d:linha,fill:'none',stroke:'#168b82','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));
  if(temReferencia)chart.append(svg('path',{d:caminho(ref),fill:'none',stroke:'#8b6bb2','stroke-width':2,'stroke-dasharray':'6 5','stroke-linecap':'round'}));
  const ticks=new Set([0,Math.round((lista.length-1)/4),Math.round((lista.length-1)/2),Math.round((lista.length-1)*3/4),lista.length-1]);
  lista.forEach((p,i)=>{chart.append(svg('circle',{cx:x(i),cy:y(valor(p)),r:3.5,fill:'#168b82',stroke:'#fff','stroke-width':1.5}));if(ref(p)!==null)chart.append(svg('circle',{cx:x(i),cy:y(ref(p)),r:2.5,fill:'#8b6bb2'}));if(ticks.has(i)){const t=svg('text',{x:x(i),y:altura-10,'text-anchor':'middle'});t.textContent=m.pontos.length>62?p.data.slice(5,7)+'/'+p.data.slice(2,4):p.data.slice(8)+'/'+p.data.slice(5,7);chart.append(t);}});
  root.append(chart);interagir(root,chart,lista,x,y,valor,ref,pad.top,ph,m.pontos.length>62);
 }
 function interagir(root,chart,lista,x,y,valor,ref,top,height,mensal){
  interacao=new AbortController();const options={signal:interacao.signal},targets=[],tip=el('div','','growth-tooltip evolution-tooltip');tip.id='evolution-tooltip';tip.hidden=true;tip.setAttribute('role','tooltip');root.append(tip);
  let indice=-1,fixado=false;
  function esconder(){tip.hidden=true;indice=-1;fixado=false;for(const t of targets){t.classList.remove('is-active');t.setAttribute('aria-pressed','false');t.removeAttribute('aria-describedby');}}
  function posicionar(){if(indice<0||tip.hidden)return;const b=targets[indice].getBoundingClientRect(),v=window.visualViewport,left=v?.offsetLeft||0,top=v?.offsetTop||0,w=v?.width||innerWidth,h=v?.height||innerHeight;
   const r=root.getBoundingClientRect();if(b.right<Math.max(left,r.left)||b.left>Math.min(left+w,r.right)||b.bottom<top||b.top>top+h){esconder();return;}const tw=tip.offsetWidth,th=tip.offsetHeight;
   tip.style.left=Math.max(left+12,Math.min(left+w-tw-12,b.left+b.width/2-tw/2))+'px';tip.style.top=Math.max(top+12,Math.min(top+h-th-12,b.top+40))+'px';
  }
  function mostrar(i){indice=i;const p=lista[i];tip.replaceChildren(el('strong',mensal?data(p.data)+' a '+data(p.fim):data(p.data),'growth-tooltip-title'),el('span',modo==='acumulado'?'Acumulado no intervalo':'Resultado '+(mensal?'do mês exibido':'do dia'),'growth-tooltip-metric'));
   const row=(label,value)=>{const r=el('div','','growth-tooltip-row');r.append(el('span',label),el('strong',value));tip.append(r);};
   row('Vendas realizadas',moeda(valor(p)));if(modelo.metasPermitidas){row('Referência da meta',moeda(ref(p)));row('Diferença',diferenca(valor(p),ref(p)));row('Meta mensal',moeda(p.meta));}
   row(mensal?'Vendas / peças do mês':'Vendas / peças do dia',inteiro.format(p.vendas)+' / '+inteiro.format(p.pecas));
   tip.append(el('small',fixado?'Toque novamente ou fora para fechar.':'Toque para manter aberto. Esc fecha.','growth-tooltip-hint'));tip.hidden=false;
   targets.forEach((t,j)=>{t.classList.toggle('is-active',j===i);t.setAttribute('aria-pressed',String(j===i&&fixado));if(j===i)t.setAttribute('aria-describedby',tip.id);else t.removeAttribute('aria-describedby');});posicionar();
  }
  lista.forEach((p,i)=>{const t=svg('g',{tabindex:i===0?0:-1,role:'button','aria-pressed':'false','aria-label':data(p.data)+': vendas '+moeda(valor(p))+(modelo.metasPermitidas?', referência '+moeda(ref(p)):''),class:'evolution-target','data-date':p.data});
   const left=i===0?x(i)-12:(x(i-1)+x(i))/2,right=i===lista.length-1?x(i)+12:(x(i)+x(i+1))/2;
   t.append(svg('rect',{x:left,y:top,width:right-left,height,rx:5,class:'evolution-hit'}));chart.append(t);targets.push(t);
   t.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'&&!fixado)mostrar(i);},options);
   t.addEventListener('focus',()=>{targets.forEach((t,j)=>t.setAttribute('tabindex',j===i?0:-1));if(!fixado&&t.matches(':focus-visible'))mostrar(i);},options);
   t.addEventListener('click',()=>{if(fixado&&indice===i)esconder();else{fixado=true;mostrar(i);}},options);
   t.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?targets.length-1:Math.max(0,Math.min(targets.length-1,i+(e.key==='ArrowRight'?1:-1)));fixado=false;targets[next].focus({preventScroll:true});const b=targets[next].getBoundingClientRect(),r=root.getBoundingClientRect();if(b.left<r.left)root.scrollLeft-=r.left-b.left+12;else if(b.right>r.right)root.scrollLeft+=b.right-r.right+12;mostrar(next);}else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(fixado&&indice===i)esconder();else{fixado=true;mostrar(i);}}},options);
  });
  root.addEventListener('pointerleave',()=>{if(!fixado)esconder();},options);root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget))esconder();},options);
  document.addEventListener('pointerdown',e=>{if(!root.contains(e.target)||!e.target.closest('.evolution-target,.evolution-tooltip'))esconder();},options);document.addEventListener('keydown',e=>{if(e.key==='Escape')esconder();},options);
  window.addEventListener('scroll',posicionar,{...options,capture:true,passive:true});window.addEventListener('resize',posicionar,options);window.visualViewport?.addEventListener('resize',posicionar,options);
 }
 for(const b of document.querySelectorAll('[data-chart-mode]'))b.addEventListener('click',()=>{modo=b.dataset.chartMode;render();});
 return {renderizar:d=>{dados=d;render();},cancelar:()=>{interacao?.abort();interacao=null;$('evolution-tooltip')?.remove();},limpar};
}
