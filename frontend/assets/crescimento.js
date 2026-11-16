const $=id=>document.getElementById(id);
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const inteiro=new Intl.NumberFormat('pt-BR');
const moeda=v=>{if(v===null)return '—';const n=BigInt(v),a=n<0n?-n:n;return `${n<0n?'− ':''}R$ ${inteiro.format(a/100n)},${String(a%100n).padStart(2,'0')}`;};
const data=d=>d.split('-').reverse().join('/');
const nome=b=>[b.cod_filial||'Filial '+b.filial,b.fantasia].filter(Boolean).join(' - ');
const zero=()=>({valor_centavos:'0',vendas:0,pecas:'0',pendencias:0,ticket_medio_centavos:null});
const soma=(a,b)=>{for(const k of ['valor_centavos','pecas'])a[k]=(BigInt(a[k])+BigInt(b[k])).toString();a.vendas+=b.vendas;a.pendencias+=b.pendencias;};
const ticket=a=>{const n=BigInt(a.valor_centavos),abs=n<0n?-n:n;a.ticket_medio_centavos=a.vendas?((n<0n?-1n:1n)*((abs+BigInt(Math.floor(a.vendas/2)))/BigInt(a.vendas))).toString():null;return a;};
const diferenca=(a,b)=>a===null||b===null?null:(BigInt(a)-BigInt(b)).toString();
const percentual=(a,b)=>{if(a===null||b===null||BigInt(b)<=0n)return null;const n=(BigInt(a)-BigInt(b))*10000n/BigInt(b),abs=n<0n?-n:n;return `${n<0n?'−':n>0n?'+':''}${abs/100n},${String(abs%100n).padStart(2,'0')}%`;};
const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const dinheiro=k=>['valor_centavos','ticket_medio_centavos'].includes(k);
const formato=(v,k)=>v===null?'—':dinheiro(k)?moeda(v):inteiro.format(BigInt(v));
const campos=['growth-metrics','growth-chart','growth-legend','growth-body','growth-total','growth-months'];
function linha(valores,labels){const tr=el('tr');valores.forEach((v,i)=>{const td=el('td');td.dataset.label=labels[i];if(v instanceof Node)td.append(v);else td.textContent=v;tr.append(td);});return tr;}
function variacao(a,b){return el('strong',percentual(a,b)??'Sem base percentual',a!==null&&b!==null&&BigInt(b)>0n?(BigInt(a)>=BigInt(b)?'growth-up':'growth-down'):'growth-neutral');}
function grafico(root,serie,k,anterior,atual){
 root.replaceChildren();const ns='http://www.w3.org/2000/svg',svg=(tag,attrs={})=>{const n=document.createElementNS(ns,tag);for(const [a,b]of Object.entries(attrs))n.setAttribute(a,String(b));return n;};
 const chart=svg('svg',{viewBox:'0 0 920 300',role:'img','aria-labelledby':'growth-svg-title growth-svg-desc'});
 const title=svg('title',{id:'growth-svg-title'});title.textContent=`Comparativo mensal de ${anterior} e ${atual}`;
 const desc=svg('desc',{id:'growth-svg-desc'});desc.textContent='Valores exatos disponíveis na tabela de detalhamento mensal abaixo. Meses posteriores ao corte não são exibidos.';chart.append(title,desc);
 const valores=serie.flatMap(m=>[BigInt(m.anterior[k]??0),BigInt(m.atual[k]??0)]),min=valores.reduce((a,b)=>b<a?b:a,0n),max=valores.reduce((a,b)=>b>a?b:a,0n),range=max-min||1n;
 const y=v=>24+Number((max-v)*100000n/range)/100000*220,base=y(0n),step=800/Math.max(serie.length,1),width=Math.min(24,step*.32);
 for(let i=0;i<=4;i++){const value=max-range*BigInt(i)/4n,yy=y(value);chart.append(svg('line',{x1:98,x2:905,y1:yy,y2:yy,class:'growth-grid'}));const t=svg('text',{x:88,y:yy+4,'text-anchor':'end',class:'growth-axis'});t.textContent=new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(value)/(dinheiro(k)?100:1));chart.append(t);}
 serie.forEach((m,i)=>{const x=106+i*step+step/2;for(const [j,lado]of ['anterior','atual'].entries()){if(m[lado][k]===null)continue;const value=BigInt(m[lado][k]),yy=y(value),r=svg('rect',{x:x+(j===0?-width-2:2),y:Math.min(yy,base),width,height:Math.abs(base-yy),rx:3,class:'growth-bar-'+lado});const tip=svg('title');tip.textContent=`${meses[i]} ${lado==='atual'?atual:anterior}: ${formato(m[lado][k],k)}`;r.append(tip);chart.append(r);}const text=svg('text',{x,y:276,'text-anchor':'middle',class:'growth-axis'});text.textContent=meses[i];chart.append(text);});
 root.append(chart);if(valores.every(v=>v===0n))root.append(el('p','Sem valores de venda nos períodos selecionados.','growth-chart-empty'));
}
const cores=['#7b91b3','#b67943','#458d80','#253f69','#946bb0','#b34e64','#536976','#7e7c42'];
function graficoHistorico(root,series,k){
 root.replaceChildren();const ns='http://www.w3.org/2000/svg',svg=(tag,attrs={})=>{const n=document.createElementNS(ns,tag);for(const [a,b]of Object.entries(attrs))n.setAttribute(a,String(b));return n;};
 const chart=svg('svg',{viewBox:'0 0 920 300',role:'img','aria-labelledby':'growth-svg-title growth-svg-desc'}),title=svg('title',{id:'growth-svg-title'}),desc=svg('desc',{id:'growth-svg-desc'});title.textContent='Comparativo mensal de todos os anos: '+series.map(s=>s.ano).join(', ');desc.textContent='Cada linha representa um ano. Valores exatos e variações disponíveis nas tabelas abaixo.';chart.append(title,desc);
 const valores=series.flatMap(s=>s.mensal.map(m=>BigInt(m[k]??0))),min=valores.reduce((a,b)=>b<a?b:a,0n),max=valores.reduce((a,b)=>b>a?b:a,0n),range=max-min||1n;
 const y=v=>24+Number((max-v)*100000n/range)/100000*220,n=series[0]?.mensal.length??1,x=i=>112+i*780/Math.max(n-1,1);
 for(let i=0;i<=4;i++){const value=max-range*BigInt(i)/4n,yy=y(value);chart.append(svg('line',{x1:98,x2:905,y1:yy,y2:yy,class:'growth-grid'}));const t=svg('text',{x:88,y:yy+4,'text-anchor':'end',class:'growth-axis'});t.textContent=new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(Number(value)/(dinheiro(k)?100:1));chart.append(t);}
 for(let i=0;i<n;i++){const t=svg('text',{x:x(i),y:276,'text-anchor':'middle',class:'growth-axis'});t.textContent=meses[i];chart.append(t);}
 series.forEach((s,i)=>{const color=cores[i%cores.length];let points=[];const flush=()=>{if(points.length)chart.append(svg('polyline',{points:points.join(' '),fill:'none',stroke:color,'stroke-width':2.5}));points=[];};for(const [j,m]of s.mensal.entries()){if(m[k]===null){flush();continue;}const xx=x(j),yy=y(BigInt(m[k]));points.push(xx+','+yy);const dot=svg('circle',{cx:xx,cy:yy,r:3,fill:color}),tip=svg('title');tip.textContent=`${meses[j]} ${s.ano}: ${formato(m[k],k)}`;dot.append(tip);chart.append(dot);}flush();});root.append(chart);
 if(valores.every(v=>v===0n))root.append(el('p','Sem valores nos períodos selecionados.','growth-chart-empty'));
}
export function criarDashboardCrescimento({api,ativo,carregando,erro,limparErro}){
 let dados=null,versao=0,abort=null;
 const headers={filiais:$('growth-table-head').cloneNode(true),mensal:$('growth-month-head').cloneNode(true)};
 const restaurarCabecalhos=()=>{for(const [id,key]of [['growth-table-head','filiais'],['growth-month-head','mensal']])$(id).replaceChildren(...[...headers[key].childNodes].map(n=>n.cloneNode(true)));};
 const anoAtual=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric'}).format(new Date());
 $('growth-year').append(new Option(anoAtual(),anoAtual()));
 const ajustarModo=()=>{const corrente=$('growth-year').value===anoAtual();$('growth-mode').querySelector('[value="completo"]').disabled=corrente;if(corrente)$('growth-mode').value='acumulado';};
 ajustarModo();
 function limparValores(){for(const id of campos)$(id).replaceChildren();}
 function cancelar(){versao++;abort?.abort();}
 function abrir(){$('growth-comparison').value='anterior';}
 function limpar(){abrir();restaurarCabecalhos();cancelar();dados=null;limparValores();$('growth-period').textContent='';$('growth-branch').replaceChildren(new Option('Todas as autorizadas',''));$('growth-year').replaceChildren(new Option(anoAtual(),anoAtual()));$('growth-metric').value='valor_centavos';$('growth-mode').value='acumulado';ajustarModo();}
 function renderTodos(filiais,k,rotulo,selecao){
  const historico=dados.historico,periodos=historico.periodos,ids=new Set(filiais.map(b=>b.filial)),lojas=historico.filiais.filter(b=>ids.has(b.filial));
  const totais=periodos.map(p=>{const total={ano:p.ano,...zero(),mensal:Array.from({length:Number(p.fim.slice(5,7))},(_,i)=>({mes:i+1,...zero()}))};for(const b of lojas){const a=b.anos.find(a=>a.ano===p.ano);soma(total,a);a.mensal.forEach((m,i)=>soma(total.mensal[i],m));}ticket(total);total.mensal.forEach(ticket);return total;});
  $('growth-period').textContent=selecao+' · Todos os anos até '+dados.periodos.atual.ano+' · '+periodos.map(p=>`${p.ano}: ${data(p.inicio)} a ${data(p.fim)}`).join(' · ')+'. Os cartões resumem o ano de referência e seu anterior.';
  $('growth-chart-title').textContent=rotulo+' · todos os anos';$('growth-chart-description').textContent='Uma linha por ano, com os mesmos meses e corte de data. Deslize o gráfico no celular para consultar todos os meses.';
  $('growth-table-description').textContent=rotulo+' por ano e filial. Cada variação compara o valor com o ano imediatamente anterior exibido.';
  $('growth-month-description').textContent=selecao+' · '+rotulo+' por mês em todos os anos selecionados.';
  $('growth-legend').replaceChildren(...periodos.map((p,i)=>el('span',String(p.ano),'growth-key history-'+i%cores.length)));graficoHistorico($('growth-chart'),totais,k);
  const labels=['Filial',...periodos.map(p=>String(p.ano)),'Atualização'];$('growth-table-head').replaceChildren(linha(labels,labels));for(const td of [...$('growth-table-head').querySelector('tr').children]){const th=el('th',td.textContent);td.replaceWith(th);}
  const celula=(a,anterior)=>{const box=el('div');box.append(el('strong',formato(a[k],k)));if(anterior){const small=el('small','vs '+anterior.ano+': ');small.append(variacao(a[k],anterior[k]));box.append(small);}else box.append(el('small','Primeiro ano exibido'));return box;};
  $('growth-body').replaceChildren();for(const b of lojas){const button=el('button',nome(b),'text-button growth-detail');button.type='button';button.addEventListener('click',()=>{$('growth-branch').value=b.filial;render();$('growth-period').scrollIntoView({block:'start',behavior:'smooth'});});const status=el('div',b.atualizado_ate?'Atualização até '+data(b.atualizado_ate):'Atualização ainda não informada');if(!b.atualizado_ate||b.atualizado_ate<periodos.at(-1).fim)status.append(el('small','Atualização não alcançou o fim selecionado.'));if(b.primeira_operacao)status.append(el('small','Primeiro registro importado: '+data(b.primeira_operacao)));$('growth-body').append(linha([button,...b.anos.map((a,i)=>celula(a,b.anos[i-1])),status],labels));}
  if(!lojas.length)$('growth-body').append(linha(['Nenhuma filial atribuída',...periodos.map(()=> '—'),'Solicite a atribuição de filiais.'],labels));
  $('growth-total').replaceChildren(linha(['Total selecionado',...totais.map((a,i)=>celula(a,totais[i-1])),lojas.length+' filiais'],labels));
  const mensalLabels=['Mês',...periodos.map(p=>String(p.ano))];$('growth-month-head').replaceChildren(linha(mensalLabels,mensalLabels));for(const td of [...$('growth-month-head').querySelector('tr').children])td.replaceWith(el('th',td.textContent));
  $('growth-months').replaceChildren();for(let m=0;m<(totais[0]?.mensal.length??0);m++)$('growth-months').append(linha([meses[m],...totais.map((a,i)=>celula({...a.mensal[m],ano:a.ano},i?{...totais[i-1].mensal[m],ano:totais[i-1].ano}:null))],mensalLabels));
 }
 function render(){
  if(!dados||!ativo())return;
  const k=$('growth-metric').value,rotulo=$('growth-metric').selectedOptions[0].textContent,p=dados.periodos,filiais=dados.filiais.filter(b=>!$('growth-branch').value||b.filial===$('growth-branch').value);
  const atual=zero(),anterior=zero(),serie=Array.from({length:Number(p.atual.fim.slice(5,7))},(_,i)=>({mes:i+1,atual:zero(),anterior:zero()}));
  for(const b of filiais){soma(atual,b.atual);soma(anterior,b.anterior);for(const m of b.mensal){soma(serie[m.mes-1].atual,m.atual);soma(serie[m.mes-1].anterior,m.anterior);}}
  ticket(atual);ticket(anterior);for(const m of serie){ticket(m.atual);ticket(m.anterior);}
  const selecao=filiais.length===1?nome(filiais[0]):`${filiais.length} filiais autorizadas`;
  $('growth-period').textContent=`${selecao} · ${data(p.atual.inicio)} a ${data(p.atual.fim)} versus ${data(p.anterior.inicio)} a ${data(p.anterior.fim)}.${p.atual.ano===Number(p.hoje.slice(0,4))?' Ano em andamento; o dia atual pode receber novas vendas.':''}`;
  $('growth-metrics').replaceChildren();
  const cards=[['Valor de vendas · '+p.atual.ano,moeda(atual.valor_centavos),`${p.anterior.ano}: ${moeda(anterior.valor_centavos)}`],['Crescimento em vendas',percentual(atual.valor_centavos,anterior.valor_centavos)??'Sem base percentual',`Diferença: ${moeda(diferenca(atual.valor_centavos,anterior.valor_centavos))}`],['Vendas realizadas',inteiro.format(atual.vendas),`${p.anterior.ano}: ${inteiro.format(anterior.vendas)} · ${percentual(atual.vendas,anterior.vendas)??'Sem base percentual'}`],['Ticket médio',moeda(atual.ticket_medio_centavos),`${p.anterior.ano}: ${moeda(anterior.ticket_medio_centavos)} · ${inteiro.format(BigInt(atual.pecas))} peças no ano de referência`]];
  for(const [label,value,note]of cards){const card=el('article','','consolidated-metric');card.append(el('span',label),el('strong',value),el('small',note));$('growth-metrics').append(card);}
  if(dados.comparacao==='todos'){renderTodos(filiais,k,rotulo,selecao);return;}
  restaurarCabecalhos();
  for(const id of ['growth-previous-heading','growth-month-previous'])$(id).textContent=String(p.anterior.ano);
  for(const id of ['growth-current-heading','growth-month-current'])$(id).textContent=String(p.atual.ano);
  $('growth-chart-title').textContent=rotulo+' mês a mês';$('growth-chart-description').textContent='Mesmos meses e mesmo corte de data nos dois anos. Valores exatos na tabela abaixo.';
  $('growth-table-description').textContent=rotulo+' por filial. Selecione uma filial para detalhar sua evolução mensal.';
  $('growth-month-description').textContent=selecao+' · '+rotulo+'. O último mês segue as datas de corte indicadas acima.';
  $('growth-legend').replaceChildren(el('span',String(p.anterior.ano),'growth-key previous'),el('span',String(p.atual.ano),'growth-key current'));
  grafico($('growth-chart'),serie,k,p.anterior.ano,p.atual.ano);
  const labels=['Filial',String(p.anterior.ano),String(p.atual.ano),'Diferença','Variação','Base de comparação'];$('growth-body').replaceChildren();
  for(const b of filiais){const n=el('div'),button=el('button',nome(b),'text-button growth-detail');button.type='button';button.addEventListener('click',()=>{$('growth-branch').value=b.filial;render();$('growth-period').scrollIntoView({block:'start',behavior:'smooth'});});n.append(button);const status=el('div');status.append(el('strong',b.sem_base_anterior?'Sem vendas no período anterior':'Com vendas no período anterior'));status.append(el('small',b.atualizado_ate?'Atualização até '+data(b.atualizado_ate):'Atualização ainda não informada'));if(!b.atualizacao_cobre_fim)status.append(el('small','Atualização não alcançou o fim selecionado.'));if(b.primeira_operacao)status.append(el('small','Primeiro registro importado: '+data(b.primeira_operacao)));$('growth-body').append(linha([n,formato(b.anterior[k],k),formato(b.atual[k],k),formato(diferenca(b.atual[k],b.anterior[k]),k),variacao(b.atual[k],b.anterior[k]),status],labels));}
  if(!filiais.length)$('growth-body').append(linha(['Nenhuma filial atribuída','—','—','—','—','Solicite a atribuição de filiais ao administrador.'],labels));
  $('growth-total').replaceChildren(linha(['Total selecionado',formato(anterior[k],k),formato(atual[k],k),formato(diferenca(atual[k],anterior[k]),k),variacao(atual[k],anterior[k]),`${filiais.length} filiais`],labels));
  $('growth-months').replaceChildren();for(const m of serie)$('growth-months').append(linha([meses[m.mes-1],formato(m.anterior[k],k),formato(m.atual[k],k),formato(diferenca(m.atual[k],m.anterior[k]),k),variacao(m.atual[k],m.anterior[k])],['Mês',...labels.slice(1,5)]));
 }
 async function carregar(){
  if(!ativo())return;const v=++versao;abort?.abort();abort=new AbortController();limparErro();carregando(true);dados=null;limparValores();$('data-notice').hidden=true;$('growth-period').textContent='Carregando comparativo…';
  try{const d=await api('/crescimento?'+new URLSearchParams({ano:$('growth-year').value,modo:$('growth-mode').value,comparacao:$('growth-comparison').value}),{signal:abort.signal});if(v!==versao||!ativo())return;dados=d;
   $('growth-year').replaceChildren(...d.anos.map(y=>new Option(String(y),String(y))));$('growth-year').value=String(d.periodos.atual.ano);ajustarModo();
   const filial=$('growth-branch').value;$('growth-branch').replaceChildren(new Option('Todas as autorizadas',''),...d.filiais.map(b=>new Option(nome(b),b.filial)));$('growth-branch').value=d.filiais.some(b=>b.filial===filial)?filial:'';render();
  }catch(e){if(e.name!=='AbortError'&&v===versao&&ativo()){$('growth-period').textContent='Comparativo não carregado. Tente atualizar novamente.';erro(e);}}
  finally{if(v===versao&&ativo())carregando(false);}
 }
 $('growth-filters').addEventListener('submit',e=>{e.preventDefault();carregar();});
 $('growth-year').addEventListener('change',()=>{$('growth-mode').value=$('growth-year').value===anoAtual()?'acumulado':'completo';ajustarModo();if(ativo())carregar();});
 $('growth-comparison').addEventListener('change',()=>{if(ativo())carregar();});
 $('growth-mode').addEventListener('change',()=>{if(ativo())carregar();});
 for(const id of ['growth-branch','growth-metric'])$(id).addEventListener('change',render);
 return {carregar,cancelar,limpar,abrir};
}
