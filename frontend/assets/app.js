const $=id=>document.getElementById(id);
const icons={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',receipt:'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6',check:'M12 3 3 7v6c0 4 9 8 9 8s9-4 9-8V7z M8 12l3 3 5-6',store:'M4 10v11h16V10 M3 10l2-7h14l2 7 M3 10h18 M9 21v-7h6v7',logout:'M10 4H4v16h6 M8 12h13 M17 8l4 4-4 4',filter:'M4 6h16 M7 12h10 M10 18h4',refresh:'M20 7v5h-5 M4 17v-5h5 M5 8a7 7 0 0 1 12-3l3 3 M19 16a7 7 0 0 1-12 3l-3-3',info:'M12 8h.01 M12 11v6 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',alert:'M12 3 2 21h20z M12 9v5 M12 17h.01',trend:'M3 17l6-6 4 4 8-10 M15 5h6v6',bag:'M5 7h14l2 14H3z M8 8V6a4 4 0 0 1 8 0v2',cart:'M2 3h3l3 12h11l3-9H6 M9 20h.01 M18 20h.01'};
function svgEl(name,attrs={}){const e=document.createElementNS('http://www.w3.org/2000/svg',name);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;}
for(const el of document.querySelectorAll('[data-icon]')){const svg=svgEl('svg',{viewBox:'0 0 24 24','aria-hidden':'true'});svg.append(svgEl('path',{d:icons[el.dataset.icon]}));el.append(svg);}
const branchLabel=b=>[b.cod_filial||'Filial sem código cadastrado',b.fantasia].filter(Boolean).join(' - ');
function el(tag,text='',className){const n=document.createElement(tag);if(text!==null)n.textContent=text;if(className)n.className=className;return n;}
const integers=new Intl.NumberFormat('pt-BR');
const number=v=>v==null?'—':integers.format(BigInt(v));
const money=v=>{if(v==null)return '—';const n=BigInt(v),a=n<0n?-n:n;return `${n<0n?'− ':''}R$ ${integers.format(a/100n)},${String(a%100n).padStart(2,'0')}`;};
const decimal=v=>v==null?'—':new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v));
const dateBR=d=>d?d.slice(0,10).split('-').reverse().join('/'):'—';
const when=d=>d?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(d)):'Ainda sem atualização';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const errorText={ESTOQUE_REQUER_PRODUTOS:'Para consultar estoque, habilite também a consulta de produtos.',USUARIO_INVALIDO:'Confira os dados do usuário.',VINCULOS_INVALIDOS:'Confira as filiais e os vínculos.',SENHA_INVALIDA:'Use uma senha com pelo menos 16 caracteres e no máximo 256 bytes.',PROPRIO_ACESSO_PROTEGIDO:'Seu próprio acesso é protegido. Outro Admin deve alterá-lo.',FILIAL_OBRIGATORIA:'Selecione pelo menos uma filial.',VENDEDOR_OBRIGATORIO:'Selecione o vendedor em cada filial.',VENDEDOR_NAO_ENCONTRADO:'Vendedor não encontrado no histórico desta filial.',EMAIL_JA_CADASTRADO:'Este e-mail já está cadastrado nesta empresa.',PERFIL_INVALIDO:'Confira o nome e as opções do cargo.',PERMISSAO_DEPENDENTE_DE_VENDAS:'Clientes, fotos e conferência precisam de acesso às movimentações.',VENDAS_REQUER_ESCOPO_PROPRIO:'O cargo Vendas deve acessar apenas as próprias vendas.',ESCOPO_INCOMPATIVEL:'Escolha filiais atribuídas para limitar às próprias vendas.',PERFIL_ADMIN_PROTEGIDO:'O perfil Admin mantém o acesso completo.',RECURSO_NAO_AUTORIZADO:'Seu acesso não permite consultar este recurso.',LOGIN_INVALIDO:'E-mail ou senha incorretos. Confira os dados e tente novamente.',LIMITE_DE_LOGIN:'Muitas tentativas de acesso. Aguarde 15 minutos antes de tentar novamente.',NAO_AUTENTICADO:'Sua sessão expirou. Entre novamente para continuar.',FILIAL_NAO_AUTORIZADA:'Esta loja ainda não está disponível para o seu acesso.',PERIODO_INVALIDO:'Escolha um período válido de até 366 dias.',LIMITE_DE_REQUISICOES:'Muitas consultas em sequência. Aguarde um minuto e tente novamente.',ERRO_INTERNO:'Não foi possível consultar os dados agora. Tente novamente.'};
let token=null,page='overview',filters=null,rankPage=1,salesPage=1,customerPage=1,abort=null,generation=0,refreshTimer=null,detailGeneration=0;
let lastIndicators=null,permissoes=new Set(),isAdmin=false;
const pode=recurso=>permissoes.has(recurso);
const podePagina=next=>next==='products'?pode('produtos:ler'):next==='queue'?pode('fila:ler'):['permissions','users'].includes(next)?isAdmin:next==='overview'?(pode('indicadores:ler')||pode('ranking:ler')):next==='quality'?(pode('vendas:ler')&&pode('conferencia:ler')):next==='customers'?(pode('clientes:ler')&&pode('vendas:ler')):next==='sales'&&pode('vendas:ler');
let detailAbort=null;const detailImageUrls=new Set();
function clearDetailMedia(){detailAbort?.abort();$('photo-dialog').close();for(const url of detailImageUrls)URL.revokeObjectURL(url);detailImageUrls.clear();}
async function api(path,options={}){
 let response;try{response=await fetch('/api/v1'+path,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...options.headers}});}catch(e){if(e.name==='AbortError')throw e;throw new Error('Não foi possível conectar ao painel. Verifique sua conexão e tente novamente.');}
 const body=await response.json().catch(()=>({}));
 if(!response.ok){if(response.status===401&&path!=='/auth/login')exitSession(errorText.NAO_AUTENTICADO);throw new Error(errorText[body.erro]||'Não foi possível completar a consulta. Tente novamente.');}
 return body;
}
function showToast(text){$('toast').textContent=text;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,4000);}
function busy(active){$('loading').hidden=!active;$('overview-panel').hidden=active||page!=='overview';$('sales-panel').hidden=active||!['sales','quality'].includes(page);$('filters').setAttribute('aria-busy',String(active));}
function resetError(){$('page-error').hidden=true;}
function displayError(e){$('page-error-text').textContent=e.message;$('page-error').hidden=false;}
function exitSession(message=''){
 clearOverviewMedia();$('top-products-list').replaceChildren();$('products-list').replaceChildren();
 for(const id of ['monthly-body','monthly-total','payment-summary-body','payment-summary-total','stock-brand-body','stock-brand-total','stock-category-body','stock-category-total','top-products-status','payment-coverage','stock-summary-status'])$(id).replaceChildren();
 queueReportGeneration++;queueReportAbort?.abort();$('queue-report-content').replaceChildren();$('queue-report-section').open=false;queueReportFilters=null;
 clearInterval(queueTimer);$('queue-action-dialog').close();$('queue-content').replaceChildren();queueData=null;token=null;generation++;detailGeneration++;abort?.abort();clearInterval(refreshTimer);lastIndicators=null;
 $('app-view').hidden=true;$('login-view').hidden=false;$('password').value='';$('login-error').textContent=message;$('login-error').hidden=!message;
 $('products-list').replaceChildren();$('products-query').value='';$('products-mode').value='catalogo';$('products-balance').value='todos';
 $('customers-list').replaceChildren();$('customers-query').value='';$('customers-month').value='';$('detail-dialog').close();$('detail-content').replaceChildren();$('ranking-body').replaceChildren();$('sales-body').replaceChildren();$('chart').replaceChildren();
 for(const id of ['metric-value','metric-ticket','metric-pa','metric-pieces','metric-sales'])$(id).textContent='—';
 $('email').focus();
}
$('show-password').addEventListener('click',()=>{const hidden=$('password').type==='password';$('password').type=hidden?'text':'password';$('show-password').textContent=hidden?'Ocultar':'Mostrar';$('show-password').setAttribute('aria-label',hidden?'Ocultar senha':'Mostrar senha');});
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();$('login-error').hidden=true;$('login-submit').disabled=true;$('login-submit').textContent='Entrando…';
 try{
  const session=await api('/auth/login',{method:'POST',body:JSON.stringify({email:$('email').value,senha:$('password').value})});token=session.token;$('password').value='';
  const [me,branches]=await Promise.all([api('/auth/me'),api('/filiais')]);
  isAdmin=me.usuario.role==='Admin';permissoes=new Set(me.usuario.permissoes||[]);
  $('user-role').textContent=me.usuario.role_nome||me.usuario.role;
  $('workspace-scope').textContent=me.usuario.somente_proprias_vendas?'Minhas vendas':'Filiais autorizadas';
  for(const button of document.querySelectorAll('[data-page]'))button.hidden=!podePagina(button.dataset.page);
  const inicial=['overview','sales','quality','queue','products','customers'].find(podePagina);
  if(!inicial)throw new Error('Seu perfil ainda não possui recursos liberados. Entre em contato com o administrador.');
  $('user-email').textContent=me.usuario.email;$('branch').replaceChildren();$('queue-branch').replaceChildren();$('queue-day').value=today();queueData=null;$('queue-report-branch').replaceChildren();$('queue-report-start').value=today();$('queue-report-end').value=today();$('queue-report-seller').replaceChildren(new Option('Todos os autorizados',''));$('queue-report-section').hidden=!pode('fila:relatorios');$('queue-report-pagination').hidden=true;
  for(const item of branches.filiais){const opt=el('option',branchLabel(item));opt.value=item.filial;$('branch').append(opt);$('queue-branch').append(opt.cloneNode(true));$('queue-report-branch').append(opt.cloneNode(true));}
  if(!branches.filiais.length)throw new Error('Nenhuma loja está liberada para este acesso.');
  $('login-view').hidden=true;$('app-view').hidden=false;page=inicial;rankPage=1;salesPage=1;$('period').value='month';setPeriod();setPage(inicial,false);applyFilters();
  clearInterval(refreshTimer);refreshTimer=setInterval(()=>{if(token&&!['permissions','users'].includes(page)&&!document.hidden&&!$('detail-dialog').open&&!$('product-dialog').open)loadData();},360000);
 }catch(e){if(token){await api('/auth/logout',{method:'POST'}).catch(()=>{});token=null;}$('login-error').textContent=e.message;$('login-error').hidden=false;}
 finally{$('login-submit').disabled=false;$('login-submit').replaceChildren(document.createTextNode('Entrar no painel '),el('span','→'));}
});
$('logout').addEventListener('click',async()=>{try{await api('/auth/logout',{method:'POST'});exitSession();}catch(e){showToast('Não foi possível confirmar o encerramento no servidor.');exitSession();}});
function setPeriod(){
 const end=today();let start=end,finish=end;const d=new Date(end+'T12:00:00Z');
 switch($('period').value){case'month':start=end.slice(0,8)+'01';break;case'last7':d.setUTCDate(d.getUTCDate()-6);start=d.toISOString().slice(0,10);break;case'lastMonth':d.setUTCDate(0);finish=d.toISOString().slice(0,10);start=finish.slice(0,8)+'01';break;case'year':start=end.slice(0,4)+'-01-01';break;case'custom':return;}
 $('start-date').value=start;$('end-date').value=finish;
}
$('period').addEventListener('change',setPeriod);for(const id of ['start-date','end-date'])$(id).addEventListener('input',()=>$('period').value='custom');
$('today').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'numeric',month:'long'}).format(new Date());
function applyFilters(){
 const start=$('start-date').value,end=$('end-date').value;
 if(!start||!end||start>end||(Date.parse(end)-Date.parse(start))/86400000>365){displayError(new Error('Escolha um período válido de até 366 dias.'));return;}
 filters={filial:$('branch').value,inicio:start,fim:end};rankPage=1;salesPage=1;customerPage=1;productPage=1;loadData();
}
$('filters').addEventListener('submit',e=>{e.preventDefault();applyFilters();});$('refresh').addEventListener('click',()=>loadData());$('retry').addEventListener('click',()=>loadData());
function query(extra={}){return new URLSearchParams({...filters,...extra}).toString();}
function setPage(next,load=true){
 if(!podePagina(next))return;
 clearOverviewMedia();
 clearInterval(queueTimer);if(next==='queue')queueTimer=setInterval(()=>{if(token&&!document.hidden&&!queueBusy&&!$('queue-action-dialog').open)loadQueue(true);},30000);
 page=next;salesPage=1;rankPage=1;customerPage=1;productPage=1;generation++;abort?.abort();
 $('products-panel').hidden=page!=='products';
 for(const id of ['period','start-date','end-date'])$(id).parentElement.hidden=page==='products'&&$('products-mode').value==='catalogo';
 $('queue-panel').hidden=page!=='queue';$('customers-panel').hidden=page!=='customers';$('users-panel').hidden=page!=='users';$('permissions-panel').hidden=page!=='permissions';$('filters').hidden=['permissions','users','queue'].includes(page);document.querySelector('.data-caption').hidden=['permissions','users','queue'].includes(page);
 if(['permissions','users','queue'].includes(page)){$('overview-panel').hidden=true;$('sales-panel').hidden=true;$('data-notice').hidden=true;}
 const info={products:['Produtos e estoque','Consulte o saldo atual e os produtos vendidos na loja.'],queue:['Lista da Vez','Organize a equipe e acompanhe os atendimentos da loja.'],customers:['Clientes','Consulte o cadastro e os contatos dos seus clientes.'],users:['Usuários','Gerencie os acessos da sua empresa.'],overview:['Visão geral','Um olhar completo sobre os resultados da sua loja.'],sales:['Movimentações','Acompanhe as operações e consulte os detalhes de cada venda.'],quality:['Conferência','Mais clareza para validar os números da sua loja.'],permissions:['Permissões por cargo','Defina o acesso de cada equipe nesta empresa.']}[page];
 $('page-title').textContent=info[0];$('breadcrumb-page').textContent=info[0];$('page-subtitle').textContent=info[1];
 for(const button of document.querySelectorAll('[data-page]')){const active=button.dataset.page===page;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
 $('sales-title').textContent=page==='quality'?'Conferência das operações':'Todas as movimentações';
 $('sales-description').textContent=page==='quality'?'Diferenças identificadas no período selecionado.':'Consulte os valores e os itens de cada operação.';
 document.querySelector('.sales-options').hidden=page==='quality';$('quality-explanation').hidden=page!=='quality';$('quality-filter').hidden=page!=='quality';
 if(load)loadData();
}
for(const b of document.querySelectorAll('[data-page]'))b.addEventListener('click',()=>setPage(b.dataset.page));
$('review-notice').addEventListener('click',()=>setPage('quality'));
async function loadData(){
 if(!token)return;
 if(page==='products'){await loadProducts();return;}
 if(page==='queue'){await loadQueue();return;}
 if(page==='customers'){await loadCustomers();return;}
 if(page==='users'){await loadUsers();return;}
 if(page==='permissions'){await loadPermissions();return;}
 if(!filters)return;
 const version=++generation;abort?.abort();abort=new AbortController();resetError();busy(true);$('data-notice').hidden=true;
 try{
  const params=page==='quality'?{tipo:'S',estado:'ativas',conciliacao:$('quality-state').value}:{tipo:$('sales-type').value,estado:$('sales-state').value};
  clearOverviewMedia();
  const [ind,data,top,stock]=await Promise.all([pode('indicadores:ler')?api('/indicadores?'+query(),{signal:abort.signal}):null,page==='overview'?(pode('ranking:ler')?api('/ranking?'+query({pagina:rankPage,limite:5,ordenar:$('ranking-sort').value}),{signal:abort.signal}):null):api('/vendas?'+query({...params,pagina:salesPage,limite:10}),{signal:abort.signal}),
   page==='overview'&&pode('produtos:ler')&&pode('vendas:ler')?api('/produtos/top?'+query({ordenar:$('top-products-sort').value}),{signal:abort.signal}).catch(e=>({erro:e.message})):null,
   page==='overview'&&pode('produtos:ler')&&pode('estoque:ler')?api('/produtos/resumo-estoque?'+new URLSearchParams({filial:filters.filial}),{signal:abort.signal}).catch(e=>({erro:e.message})):null]);
  if(version!==generation)return;
  lastIndicators=ind;renderContext(ind||data);document.querySelector('.metrics').hidden=!ind;document.querySelector('.overview-grid').hidden=!ind;document.querySelector('.ranking-panel').hidden=!pode('ranking:ler');if(page==='overview'){if(ind)renderOverview(ind);if(data)renderRanking(data);$('overview-summaries').hidden=!ind;renderTopProducts(top,version);renderStockSummary(stock);}else renderSales(data);
  busy(false);
 }catch(e){if(e.name==='AbortError'||version!==generation)return;busy(false);$('overview-panel').hidden=true;$('sales-panel').hidden=true;displayError(e);}
}
function renderContext(d){
 $('scope-label').textContent=`${$('branch').selectedOptions[0]?.textContent||'Loja'}  ·  ${dateBR(filters.inicio)} a ${dateBR(filters.fim)}`;
 const vendas=d.sincronizacao.find(x=>x.recurso==='vendas');
 $('last-sync').textContent=`Última atualização: ${when(vendas?.ultimo_sucesso)}`;
 $('sync-side').textContent=vendas?.ultimo_erro_codigo?'Atualização em espera':'Dados conectados';$('sync-side-detail').textContent=when(vendas?.ultimo_sucesso);
 $('nav-pending').textContent=number(d.vendas_com_pendencia);$('nav-pending').hidden=!d.vendas_com_pendencia;
 const messages=[];
 if(!d.checkpoints_cobrem_fim)messages.push('O período tem dados ainda não sincronizados.');
 if(d.sincronizacao.some(x=>x.ultimo_erro_codigo))messages.push('Uma atualização está pendente. Exibindo os dados já recebidos.');
 if(d.vendas_com_pendencia)messages.push(`${number(d.vendas_com_pendencia)} ${d.vendas_com_pendencia===1?'venda precisa':'vendas precisam'} de conferência. Os totais do cabeçalho foram preservados.`);
 $('data-notice').hidden=messages.length===0;$('data-notice-text').textContent=messages.join(' ');$('review-notice').hidden=!podePagina('quality')||!d.vendas_com_pendencia||page==='quality';
}
function renderOverview(d){
 $('metric-value').textContent=money(d.valor_vendas_centavos);$('metric-ticket').textContent=money(d.ticket_medio_centavos);$('metric-pa').textContent=decimal(d.pecas_por_venda);$('metric-sales').textContent=number(d.vendas);$('metric-pieces').textContent=number(d.pecas_cabecalho);
 const summary=$('period-summary');summary.replaceChildren();
 for(const[label,value,warning]of [['Vendas realizadas',number(d.vendas)],['Peças vendidas',number(d.pecas_cabecalho)],['Operações canceladas',number(d.excluidas.canceladas)],['Vendas para conferir',number(d.vendas_com_pendencia),true]]){const row=el('div','', 'summary-row');row.append(el('span',label),el('strong',value,warning&&d.vendas_com_pendencia?'warn':null));summary.append(row);}
 renderChart(d);renderOverviewSummaries(d);
}
function emptyTable(tbody,colspan,title,text){const row=el('tr'),cell=el('td',null,'empty');cell.colSpan=colspan;cell.append(el('strong',title),el('span',text));row.append(cell);tbody.append(row);}
function renderChart(d){
 const container=$('chart');container.replaceChildren();$('chart-period').textContent=`${dateBR(filters.inicio)} — ${dateBR(filters.fim)}`;
 if(!d.serie_diaria.length){const box=el('div',null,'empty');box.append(el('strong','Nenhuma venda neste período'),el('span','Escolha outras datas para explorar os resultados.'));container.append(box);return;}
 const end=[filters.fim,...d.sincronizacao.filter(x=>['vendas','cancelamentos'].includes(x.recurso)).map(x=>x.ate)].sort()[0];
 const map=new Map(d.serie_diaria.map(x=>[x.data,Number(x.valor_vendas_centavos)/100]));const points=[];
 for(let dt=new Date(filters.inicio+'T12:00:00Z');dt.toISOString().slice(0,10)<=end;dt.setUTCDate(dt.getUTCDate()+1)){const date=dt.toISOString().slice(0,10);points.push({date,value:map.get(date)||0});}
 let values=points;
 if(points.length>62){const groups=new Map();for(const p of points){const month=p.date.slice(0,7);const existing=groups.get(month)||{date:month+'-01',value:0};existing.value+=p.value;groups.set(month,existing);}values=[...groups.values()];}
 if(!values.length)return;
 const w=window.matchMedia('(max-width:760px)').matches?350:680,h=245,pad={left:53,right:12,top:18,bottom:36},plotW=w-pad.left-pad.right,plotH=h-pad.top-pad.bottom;
 const max=Math.max(...values.map(p=>p.value),1)*1.15;
 const x=i=>pad.left+(values.length===1?plotW/2:i*plotW/(values.length-1));const y=n=>h-pad.bottom-n/max*plotH;
 const svg=svgEl('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':`Evolução das vendas ${points.length>62?'por mês':'por dia'} em reais, no período selecionado`});
 const title=svgEl('title');title.textContent='Evolução do valor das vendas';svg.append(title);
 for(let i=0;i<=4;i++){const n=max*i/4,yy=y(n);svg.append(svgEl('line',{x1:pad.left,y1:yy,x2:w-pad.right,y2:yy,stroke:'#edf0f4','stroke-dasharray':'4 5'}));const label=svgEl('text',{x:pad.left-10,y:yy+3,'text-anchor':'end'});label.textContent=n>=1000?`${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n/1000)} mil`:integers.format(Math.round(n));svg.append(label);}
 const defs=svgEl('defs'),gradient=svgEl('linearGradient',{id:'area-fill',x1:'0',y1:'0',x2:'0',y2:'1'});gradient.append(svgEl('stop',{offset:'0%','stop-color':'#3c5885','stop-opacity':'.16'}),svgEl('stop',{offset:'100%','stop-color':'#3c5885','stop-opacity':'.01'}));defs.append(gradient);svg.append(defs);
 const line=values.map((p,i)=>`${i?'L':'M'}${x(i)},${y(p.value)}`).join(' ');
 svg.append(svgEl('path',{d:`${line} L${x(values.length-1)},${h-pad.bottom} L${x(0)},${h-pad.bottom} Z`,fill:'url(#area-fill)'}));
 svg.append(svgEl('path',{d:line,fill:'none',stroke:'#263e64','stroke-width':'2','stroke-linejoin':'round','stroke-linecap':'round'}));
 const indexes=new Set([0,Math.round((values.length-1)*.25),Math.round((values.length-1)*.5),Math.round((values.length-1)*.75),values.length-1]);
 values.forEach((p,i)=>{const circle=svgEl('circle',{cx:x(i),cy:y(p.value),r:values.length>35?2:3,fill:'#263e64',stroke:'#fff','stroke-width':1});const tt=svgEl('title');tt.textContent=`${dateBR(p.date)}: ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p.value)}`;circle.append(tt);svg.append(circle);if(indexes.has(i)){const label=svgEl('text',{x:x(i),y:h-10,'text-anchor':'middle'});label.textContent=points.length>62?new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(p.date+'T12:00Z')).replace('.',''):p.date.slice(8)+'/'+p.date.slice(5,7);svg.append(label);}});
 container.append(svg);
}
function initials(name){return(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
function renderRanking(d){
 const body=$('ranking-body');body.replaceChildren();
 if(!d.ranking.length)emptyTable(body,7,'Nenhum resultado para este período','O ranking aparecerá quando houver vendas.');
 d.ranking.forEach((r,index)=>{
  const row=el('tr'),seller=el('td'),cell=el('div',null,'seller-cell');
  const name=el('div');name.append(el('strong',r.vendedor_nome),el('small',r.vendas_com_pendencia?`${number(r.vendas_com_pendencia)} para conferir`:'Equipe de vendas'));
  cell.append(el('span',String((rankPage-1)*5+index+1).padStart(2,'0'),'rank-number'),el('span',initials(r.vendedor_nome),'seller-avatar'),name);seller.append(cell);row.append(seller,el('td',number(r.vendas)),el('td',number(r.pecas_cabecalho)),el('td',decimal(r.pecas_por_venda)),el('td',money(r.ticket_medio_centavos)));
  const amount=el('td');amount.append(el('strong',money(r.valor_vendas_centavos)));row.append(amount,el('td',r.participacao_percentual==null?'—':decimal(r.participacao_percentual)+'%'));body.append(row);
 });
 $('ranking-summary').textContent=d.total?`${(rankPage-1)*5+1}–${Math.min(rankPage*5,d.total)} de ${number(d.total)} vendedores`:'Nenhum vendedor com vendas';$('rank-prev').disabled=rankPage===1;$('rank-next').disabled=rankPage*5>=d.total;
}
const statusText={erro_erp_confirmado:'Erro ERP · Cabeçalho validado',conciliada:'Conciliada',quantidade_divergente:'Conferir itens',divergente:'Conferir valor',nao_elegivel:'Não se aplica',pendente:'Pendente',contrato_incompleto:'Dados incompletos',regra_pendente:'Regra pendente'};
function renderSales(d){
 const body=$('sales-body');body.replaceChildren();
 if(!d.operacoes.length)emptyTable(body,6,page==='quality'?'Nenhuma operação nesta situação':'Nenhuma operação encontrada',page==='quality'?'A homologação geral dos indicadores continua em andamento.':'Ajuste o período ou os filtros para consultar outras operações.');
 for(const o of d.operacoes){
  const row=el('tr'),op=el('td');op.append(el('strong',`#${o.cod_operacao}`),el('small',`${dateBR(o.data_operacao)} · ${o.tipo_operacao==='S'?'Venda':'Entrada'}`));
  const status=el('td');status.append(el('span',o.cancelada?'Cancelada':statusText[o.conciliacao]||'Pendente','status-badge '+(o.cancelada?'cancelled':o.conciliacao==='erro_erp_confirmado'?'confirmed':o.conciliacao==='conciliada'?'':'pending')));
  const action=el('td'),button=el('button','Ver detalhes →','operation-link');button.setAttribute('aria-label',`Ver detalhes da operação ${o.cod_operacao}`);button.addEventListener('click',()=>openDetail(o));action.append(button);
  row.append(op,el('td',o.vendedor_nome||'Sem identificação'),el('td',number(o.quantidade)),el('td',money(o.valor_final_centavos)),status,action);body.append(row);
 }
 $('sales-summary').textContent=d.total?`${(salesPage-1)*10+1}–${Math.min(salesPage*10,d.total)} de ${number(d.total)} operações`:'Nenhuma operação no período';$('sales-prev').disabled=salesPage===1;$('sales-next').disabled=salesPage*10>=d.total;
}
$('ranking-sort').addEventListener('change',()=>{rankPage=1;loadRankingPage();});
for(const id of ['sales-type','sales-state'])$(id).addEventListener('change',()=>{salesPage=1;loadData();});
for(const[id,kind,delta]of [['rank-prev','rank',-1],['rank-next','rank',1],['sales-prev','sales',-1],['sales-next','sales',1]])$(id).addEventListener('click',()=>{if(kind==='rank'){rankPage+=delta;loadRankingPage();}else{salesPage+=delta;loadData();}});
async function openDetail(o){
 clearDetailMedia();detailAbort=new AbortController();
 const version=++detailGeneration;$('detail-title').textContent=`Operação #${o.cod_operacao}`;$('detail-content').replaceChildren(el('p','Carregando os detalhes…','empty'));$('detail-dialog').showModal();document.body.classList.add('modal-open');
 try{
  const d=await api(`/operacoes/${encodeURIComponent(o.filial)}/${encodeURIComponent(o.tipo_operacao)}/${encodeURIComponent(o.cod_operacao)}`);
  if(version!==detailGeneration||!$('detail-dialog').open&&!$('product-dialog').open)return;
  const content=$('detail-content');content.replaceChildren();const summary=el('div',null,'detail-summary');
  for(const[label,value]of [['Data',dateBR(d.operacao.data_operacao)],['Situação',d.operacao.cancelada?'Cancelada':'Ativa'],['Vendedor',d.operacao.vendedor_nome||'Sem identificação'],['Valor da operação',money(d.operacao.valor_final_centavos)],['Peças no cabeçalho',number(d.operacao.quantidade)],['Ajuste da operação',money(d.operacao.ajuste_centavos)]]){const cell=el('div');cell.append(el('small',label),el('strong',value));summary.append(cell);}content.append(summary);
  renderPayment(d.operacao,content);
  if(pode('clientes:ler')){const customer=el('section',null,'detail-customer');customer.id='detail-customer';customer.setAttribute('aria-live','polite');content.append(customer);loadCustomer(d.operacao,customer,version);}
  if(d.operacao.conciliacao!=='conciliada'&&!d.operacao.cancelada)content.append(el('div',d.operacao.conciliacao==='erro_erp_confirmado'?`Erro no ERP confirmado por ${d.operacao.erro_erp_confirmado_por}. Contabilização pelo valor e pela quantidade do cabeçalho. Itens originais preservados.`:`Conferência: ${statusText[d.operacao.conciliacao]||'pendente'}. Cabeçalho e itens foram preservados conforme recebidos.`, 'detail-notice'));
  if(d.cancelamento)content.append(el('div',`Cancelamento registrado em ${when(d.cancelamento.data_cancelou)}. Esta operação não compõe o valor das vendas.`, 'detail-notice'));
  const wrap=el('div',null,'detail-table');wrap.append(el('h3','Itens da operação'));const scroll=el('div',null,'table-scroll'),table=el('table'),head=el('thead'),headrow=el('tr');for(const t of ['Produto','Qtd.','Tabela','Desconto informado (%)','Preço','Aplicado','Subtotal'])headrow.append(el('th',t));head.append(headrow);table.append(head);const tbody=el('tbody');
  for(const item of d.itens){const row=el('tr'),product=el('td');const copy=el('div');product.append(copy);product.classList.add('product-cell');addProductImage(product,item,d.operacao,version);copy.append(el('strong',item.descricao||item.cod_produto||'Produto'),el('small',`Código ${item.cod_produto||'não informado'}`));if(item.sku)copy.append(el('small',`SKU ${item.sku}`));const applied=el('td',money(item.preco_aplicado_centavos));if(item.desconto_informado!=null&&Number(item.desconto_informado)===0&&item.preco_aplicado_centavos!=null&&item.preco_tabela_centavos!=null&&BigInt(item.preco_aplicado_centavos)<BigInt(item.preco_tabela_centavos)){const warning=el('span',' ⚠️','price-warning');warning.title='Preço aplicado abaixo da tabela, com desconto informado igual a zero.';warning.setAttribute('aria-label',warning.title);applied.append(warning);}row.append(product,el('td',number(item.quantidade)),el('td',money(item.preco_tabela_centavos)),el('td',item.desconto_informado==null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:6}).format(Number(item.desconto_informado))+'%'),el('td',money(item.preco_centavos)),applied,el('td',money(BigInt(item.preco_centavos)*BigInt(item.quantidade))));tbody.append(row);}if(!d.itens.length)emptyTable(tbody,7,'Itens não disponíveis','O detalhamento ainda não foi importado.');table.append(tbody);scroll.append(table);wrap.append(scroll);content.append(wrap);
 }catch(e){if(version===detailGeneration)$('detail-content').replaceChildren(el('p',e.message,'empty'));}
}
$('detail-close').addEventListener('click',()=>$('detail-dialog').close());$('detail-dialog').addEventListener('close',()=>{detailGeneration++;clearDetailMedia();document.body.classList.remove('modal-open');});
$('detail-dialog').addEventListener('click',e=>{if(e.target===$('detail-dialog')){const r=$('detail-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('detail-dialog').close();}});

window.addEventListener('resize',()=>{if(lastIndicators&&page==='overview'&&token)renderChart(lastIndicators);});

function operationPath(o){return `/operacoes/${encodeURIComponent(o.filial)}/${encodeURIComponent(o.tipo_operacao)}/${encodeURIComponent(o.cod_operacao)}`;}
function loadCustomer(o,container,version){
 if(version!==detailGeneration)return;
 container.replaceChildren(el('h3','Cliente'));container.setAttribute('aria-busy','false');
 if(o.clientes==null){container.append(el('p','Os dados do cliente aguardam importação.'));return;}
 if(!o.clientes.length)container.append(el('p','Cliente não informado pelo ERP.'));
 for(const customer of o.clientes){container.append(el('strong',customer.nome));const contacts=el('ul');for(const c of customer.contatos){const li=el('li');li.append(el('span',`${c.tipo}: `));const display=[c.ddd,c.telefone].filter(Boolean).join(' ');const link=el('a',display);link.href='tel:'+display.replace(/[^+0-9]/g,'');li.append(link);contacts.append(li);}container.append(customer.contatos.length?contacts:el('p','Telefone não informado pelo ERP.'));}
}
async function addProductImage(cell,item,operacao,version){
 if(!pode('imagens:ler')||!item.imagem_url)return;
 const button=el('button',null,'product-photo');button.type='button';button.disabled=true;button.setAttribute('aria-label','Carregando imagem do produto');button.append(el('span','…'));cell.prepend(button);
 try{
  const response=await fetch('/api/v1'+operationPath(operacao)+`/itens/${item.ordem}/imagem`,{headers:{Authorization:`Bearer ${token}`},signal:detailAbort.signal});
  if(response.status===401){exitSession(errorText.NAO_AUTENTICADO);return;}
  if(!response.ok)throw Error('IMAGEM_INDISPONIVEL');
  const blob=await response.blob();if(version!==detailGeneration)return;
  const url=URL.createObjectURL(blob);detailImageUrls.add(url);const img=el('img');img.alt='';img.src=url;
  button.replaceChildren(img,el('span','+','photo-plus'));button.disabled=false;button.setAttribute('aria-label',`Ampliar imagem de ${item.descricao||'produto'}`);
  img.addEventListener('error',()=>{button.replaceChildren(el('span','—'));button.disabled=true;button.setAttribute('aria-label','Imagem indisponível');});
  button.addEventListener('click',()=>{const large=$('photo-large');$('photo-error').hidden=true;large.hidden=false;large.alt=item.descricao||'Produto';large.src=url;$('photo-dialog').showModal();});
 }catch(e){if(version!==detailGeneration||e.name==='AbortError')return;button.replaceChildren(el('span','—'));button.disabled=true;button.setAttribute('aria-label','Imagem indisponível');}
}
$('photo-large').addEventListener('error',()=>{$('photo-large').hidden=true;$('photo-error').hidden=false;});
$('photo-close').addEventListener('click',()=>$('photo-dialog').close());
$('photo-dialog').addEventListener('close',()=>{$('photo-large').removeAttribute('src');});

$('quality-state').addEventListener('change',()=>{salesPage=1;loadData();});

async function loadPermissions(){
 const version=++generation;abort?.abort();abort=new AbortController();resetError();$('loading').hidden=true;
 $('permissions-message').textContent='Carregando cargos…';
 try{
  const data=await api('/acessos/perfis',{signal:abort.signal});if(version!==generation||page!=='permissions')return;
  const list=$('permissions-list');list.replaceChildren();
  const cargos=el('nav',null,'permission-roles');cargos.setAttribute('aria-label','Cargos da empresa');cargos.append(el('h2','Cargos'));const editor=el('div',null,'permission-editor');list.append(cargos,editor);
  let selected=false;
  for(const perfil of data.perfis){
   const form=el('form',null,'permission-card');form.dataset.role=perfil.role;
   const protectedRole=perfil.role==='Admin',vendas=perfil.role==='Vendas';
   const choose=el('button',perfil.nome,'permission-role');choose.type='button';choose.setAttribute('aria-pressed',String(!selected));cargos.append(choose);form.hidden=selected;selected=true;choose.addEventListener('click',()=>{for(const card of editor.children)card.hidden=card!==form;for(const button of cargos.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button===choose));});
   const title=el('h2',perfil.nome);form.append(title);
   const nameLabel=el('label','Nome do cargo');const name=el('input');name.type='text';name.value=perfil.nome;name.maxLength=80;name.required=true;name.disabled=protectedRole;nameLabel.append(name);form.append(nameLabel);
   const group=el('fieldset');group.append(el('legend','Recursos disponíveis'));const checks=new Map();
   for(const recurso of data.recursos){const label=el('label',null,'permission-check');const input=el('input');input.type='checkbox';input.value=recurso.codigo;input.checked=perfil.permissoes.includes(recurso.codigo);input.disabled=protectedRole;label.append(input,el('span',recurso.nome));group.append(label);checks.set(recurso.codigo,input);}
   checks.get('estoque:ler').addEventListener('change',()=>{if(checks.get('estoque:ler').checked)checks.get('produtos:ler').checked=true;});
   checks.get('produtos:ler').addEventListener('change',()=>{if(!checks.get('produtos:ler').checked)checks.get('estoque:ler').checked=false;});
   const tabs=el('div',null,'permission-tabs');tabs.setAttribute('aria-label','Configuração do cargo');const resources=el('button','Recursos');resources.type='button';resources.setAttribute('aria-pressed','true');const access=el('button','Acesso aos dados');access.type='button';access.setAttribute('aria-pressed','false');tabs.append(resources,access);const scope=el('fieldset');scope.hidden=true;scope.append(el('legend','Filiais e vendas'));form.append(tabs,group,scope);for(const [button,show] of [[resources,true],[access,false]])button.addEventListener('click',()=>{group.hidden=!show;scope.hidden=show;resources.setAttribute('aria-pressed',String(show));access.setAttribute('aria-pressed',String(!show));});
   const allLabel=el('label',null,'permission-check');const all=el('input');all.type='checkbox';all.checked=perfil.todas_filiais;all.disabled=protectedRole||vendas;allLabel.append(all,el('span','Todas as filiais autorizadas da empresa'));scope.append(allLabel);
   const ownLabel=el('label',null,'permission-check');const own=el('input');own.type='checkbox';own.checked=perfil.somente_proprias_vendas;own.disabled=protectedRole||vendas;ownLabel.append(own,el('span','Somente as próprias vendas'));scope.append(ownLabel);
   form.append(el('p',protectedRole?'Admin mantém acesso completo e administra as permissões.':vendas?'Vendas acessa somente as filiais atribuídas e as operações do vendedor vinculado.':'Com “Todas as filiais” desmarcado, o usuário acessa apenas as lojas atribuídas a ele.','muted permission-help'));
   own.addEventListener('change',()=>{if(own.checked)all.checked=false;});all.addEventListener('change',()=>{if(all.checked)own.checked=false;});
   for(const key of ['fila:operar','fila:gerenciar'])checks.get(key).addEventListener('change',()=>{if(checks.get(key).checked){checks.get('fila:ler').checked=true;if(key==='fila:gerenciar')checks.get('fila:operar').checked=true;}});
   checks.get('fila:ler').addEventListener('change',()=>{if(!checks.get('fila:ler').checked){checks.get('fila:operar').checked=false;checks.get('fila:gerenciar').checked=false;}});
   checks.get('fila:operar').addEventListener('change',()=>{if(!checks.get('fila:operar').checked)checks.get('fila:gerenciar').checked=false;});
   for(const key of ['conferencia:ler','clientes:ler','imagens:ler'])checks.get(key).addEventListener('change',()=>{if(checks.get(key).checked)checks.get('vendas:ler').checked=true;});
   checks.get('vendas:ler').addEventListener('change',()=>{if(!checks.get('vendas:ler').checked)for(const key of ['conferencia:ler','clientes:ler','imagens:ler'])checks.get(key).checked=false;});
   const message=el('p',null,'permission-result');message.setAttribute('role','status');
   if(!protectedRole){const save=el('button','Salvar permissões','button primary');save.type='submit';form.append(save);form.addEventListener('submit',async e=>{
    e.preventDefault();save.disabled=true;message.textContent='Salvando…';
    try{const atualizado=await api('/acessos/perfis/'+encodeURIComponent(perfil.role),{method:'PUT',body:JSON.stringify({nome:name.value,permissoes:[...checks].filter(([,input])=>input.checked).map(([key])=>key),todas_filiais:all.checked,somente_proprias_vendas:own.checked})});title.textContent=atualizado.nome;choose.textContent=atualizado.nome;message.textContent='Permissões salvas. Valem a partir da próxima consulta do usuário.';}
    catch(e){message.textContent=e.message;}finally{save.disabled=false;}
   });}
   form.append(message);editor.append(form);
  }
  $('permissions-message').textContent='Configurações da empresa Aeropostale. Defina filiais e vendedor de cada pessoa na tela Usuários.';
 }catch(e){if(e.name!=='AbortError'&&version===generation)$('permissions-message').textContent=e.message;}
}

async function loadUsers(){
 const version=++generation;abort?.abort();abort=new AbortController();resetError();$('loading').hidden=true;$('users-message').textContent='Carregando usuários…';
 try{
  const [data,roles,branches,sellers,me]=await Promise.all(['/acessos/usuarios','/acessos/perfis','/filiais','/acessos/vendedores','/auth/me'].map(path=>api(path,{signal:abort.signal})));
  if(version!==generation||page!=='users')return;
  const root=$('users-content');root.replaceChildren();const list=el('nav',null,'permission-roles');list.setAttribute('aria-label','Usuários');const editor=el('div',null,'permission-editor');root.append(list,editor);
  function edit(user={email:'',role:'Vendas',active:true,vinculos:[]}){
   editor.replaceChildren();const form=el('form',null,'permission-card');editor.append(form);form.append(el('h2',user.id?'Editar usuário':'Novo usuário'));const self=user.id===me.usuario.id;
   function field(label,type,value){const wrap=el('label',label),input=el('input');input.type=type;input.value=value;wrap.append(input);form.append(wrap);input.disabled=self;return input;}
   const email=field('E-mail','email',user.email);email.required=true;email.maxLength=254;
   const pass=field(user.id?'Nova senha (deixe em branco para manter)':'Senha inicial (mínimo 16 caracteres)','password','');pass.required=!user.id;pass.minLength=16;pass.autocomplete='new-password';
   const label=el('label','Cargo'),role=el('select');role.disabled=self;for(const r of roles.perfis){const opt=el('option',r.nome);opt.value=r.role;role.append(opt);}role.value=user.role;label.append(role);form.append(label);
   const activeLabel=el('label',null,'permission-check'),active=el('input');active.type='checkbox';active.checked=user.active;active.disabled=self;activeLabel.append(active,el('span','Usuário ativo'));form.append(activeLabel);
   const help=el('p',null,'muted permission-help');form.append(help);const group=el('fieldset');group.append(el('legend','Filiais e vendedor'));form.append(group);const links=[];
   for(const b of branches.filiais){const box=el('div',null,'user-branch'),lab=el('label',null,'permission-check'),check=el('input');check.type='checkbox';check.disabled=self;const existing=user.vinculos.find(v=>v.filial===b.filial);check.checked=!!existing;lab.append(check,el('span',branchLabel(b)));const vendor=el('select');vendor.setAttribute('aria-label','Vendedor em '+branchLabel(b));vendor.append(el('option','Sem vínculo de vendedor'));vendor.firstChild.value='';for(const v of sellers.vendedores.filter(v=>v.filial===b.filial)){const opt=el('option',v.vendedor_codigo+' · '+(v.vendedor_nome||'Sem nome'));opt.value=v.vendedor_codigo;vendor.append(opt);}if(existing?.vendedor_codigo&&!Array.from(vendor.options).some(o=>o.value===existing.vendedor_codigo)){const opt=el('option',existing.vendedor_codigo+' · Não encontrado no histórico');opt.value=existing.vendedor_codigo;vendor.append(opt);}vendor.value=existing?.vendedor_codigo||'';box.append(lab,vendor);group.append(box);links.push({filial:b.filial,check,vendor});check.addEventListener('change',update);}
   function update(){const r=roles.perfis.find(r=>r.role===role.value);help.textContent=self?'Seu próprio acesso é protegido. Peça a outro Admin para alterá-lo.':r.todas_filiais?'Este cargo acessa todas as filiais autorizadas da empresa.':r.somente_proprias_vendas?'Selecione as filiais e o vendedor de cada loja. A pessoa verá somente as próprias vendas.':'Selecione as filiais que esta pessoa pode consultar.';group.hidden=r.todas_filiais;for(const l of links){l.vendor.disabled=self||!l.check.checked;l.vendor.required=r.somente_proprias_vendas&&l.check.checked;}}
   role.addEventListener('change',update);update();const result=el('p',null,'permission-result');result.setAttribute('role','status');form.append(result);
   if(!self){const save=el('button','Salvar usuário','button primary');save.type='submit';form.append(save);form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;result.textContent='Salvando…';try{const r=roles.perfis.find(r=>r.role===role.value);await api('/acessos/usuarios'+(user.id?'/'+user.id:''),{method:user.id?'PUT':'POST',body:JSON.stringify({email:email.value,senha:pass.value,role:role.value,active:active.checked,vinculos:r.todas_filiais?[]:links.filter(l=>l.check.checked).map(l=>({filial:l.filial,vendedor_codigo:l.vendor.value||null}))})});pass.value='';await loadUsers();$('users-message').textContent='Usuário salvo. Alterações encerram as sessões anteriores; a pessoa deve entrar novamente.';}catch(e){result.textContent=e.message;}finally{save.disabled=false;}});}
  }
  const novo=el('button','Novo usuário','button primary');novo.type='button';novo.addEventListener('click',()=>edit());list.append(novo);
  for(const user of data.usuarios){const b=el('button',user.email+(user.active?'':' · Inativo'),'permission-role');b.type='button';b.addEventListener('click',()=>edit(user));list.append(b);}
  edit();$('users-message').textContent=data.usuarios.length+' usuário(s) nesta empresa. Desmarque “Usuário ativo” para desativar o acesso.';
 }catch(e){if(e.name!=='AbortError'&&version===generation)$('users-message').textContent=e.message;}
}

function renderPayment(operation,content){
 const section=el('section',null,'detail-payment');section.append(el('h3','Pagamento'));const p=operation.complementos;
 if(!p){section.append(el('p','Condição de pagamento e parcelas aguardam importação.'));content.append(section);return;}
 section.append(el('strong',p.desc_condicoes_pgto||'Condição não informada pelo ERP'));
 if(p.codigo_condicaopgto)section.append(el('small','Código da condição: '+p.codigo_condicaopgto));
 if(!p.lancamentos?.length){section.append(el('p',p.lancamentos===null?'Parcelas não informadas pelo ERP.':'Nenhum lançamento informado.'));content.append(section);return;}
 const details=el('details');details.append(el('summary','Ver detalhes do pagamento · '+p.lancamentos.length+' lançamento(s)'));const list=el('ol',null,'payment-installments');
 p.lancamentos.forEach((l,i)=>{const item=el('li');item.append(el('strong',`Parcela ${i+1} · ${money(l.valor_inicial_centavos)}`),el('p',l.desc_tipopgto||'Forma de pagamento não informada'),el('p','Vencimento: '+dateBR(l.data_vencimento)));
 if(l.n_documento)item.append(el('small','Documento: '+l.n_documento));if(l.data_emissao)item.append(el('small','Emissão: '+dateBR(l.data_emissao)));if(l.nsu)item.append(el('small','NSU: '+l.nsu));if(l.historico)item.append(el('p',l.historico));list.append(item);});details.append(list);section.append(details);content.append(section);
}

async function loadCustomers(){
 if(!filters)return;
 const version=++generation;abort?.abort();abort=new AbortController();resetError();busy(true);$('data-notice').hidden=true;$('customers-panel').hidden=false;$('customers-list').replaceChildren();$('customers-status').textContent='Carregando clientes…';
 try{
  const d=await api('/clientes?'+query({busca:$('customers-query').value,mes:$('customers-month').value,pagina:customerPage,limite:12}),{signal:abort.signal});if(version!==generation)return;
  renderContext(d);$('customers-status').textContent=`${number(d.total)} clientes identificados. ${number(d.operacoes_pendentes)} movimentações aguardam identificação; ${number(d.operacoes_sem_identificador)} foram recebidas sem código de cliente.`;
  for(const c of d.clientes){
   const card=el('article',null,'customer-card');card.append(el('h2',c.nome),el('small','Código '+c.codigo),el('p',`${number(c.movimentacoes)} movimentações • Última: ${dateBR(c.ultima_movimentacao)}`));
   const contacts=el('ul');for(const contact of c.contatos){const li=el('li');li.textContent=contact.tipo+': '+[contact.ddd,contact.telefone].filter(Boolean).join(' ');contacts.append(li);}card.append(c.contatos.length?contacts:el('p','Telefone não informado.'));
   card.append(el('p',c.aniversario_mm_dd?'Aniversário: '+c.aniversario_mm_dd.split('-').reverse().join('/'):'Aniversário não informado.'));$('customers-list').append(card);
  }
  if(!d.clientes.length)$('customers-list').append(el('p','Nenhum cliente identificado para estes filtros.'));
  const pages=Math.max(1,Math.ceil(d.total/d.limite));$('customers-pagination').textContent=`Página ${d.pagina} de ${pages}`;$('customers-prev').disabled=d.pagina<=1;$('customers-next').disabled=d.pagina>=pages;
 }catch(e){if(e.name!=='AbortError'&&version===generation){$('customers-status').textContent='Consulta não concluída.';displayError(e);}}
 finally{if(version===generation)busy(false);}
}
$('customers-search').addEventListener('submit',e=>{e.preventDefault();customerPage=1;loadData();});
$('customers-prev').addEventListener('click',()=>{customerPage--;loadData();});
$('customers-next').addEventListener('click',()=>{customerPage++;loadData();});

// A fila usa a filial e o dia da jornada, separados do período dos indicadores.
let queueData=null,queueBusy=false,queueTimer=null,queuePending=null,queueVersion=0;
const queueErrors={FILA_DESATUALIZADA:'A fila mudou em outra tela. A lista foi atualizada; confira antes de repetir a ação.',FILA_NAO_E_SUA_VEZ:'Outro vendedor está na vez. Atualize a fila.',FILA_VENDEDOR_OCUPADO:'Este vendedor não está disponível.',FILA_MOTIVO_OBRIGATORIO:'Informe um motivo de até 300 caracteres.',FILA_ATENDIMENTOS_ABERTOS:'Ainda há abordagens ou atendimentos abertos. Use “Encerrar sem iniciar” nas abordagens que não viraram atendimento, ou conclua os atendimentos iniciados, antes de fechar a jornada.',FILA_JORNADA_PENDENTE:'Existe uma jornada anterior aberta. Consulte a data indicada para encerrá-la.',FILA_DIA_ENCERRADO:'Novas operações só podem começar na jornada de hoje.',FILA_JORNADA_EXISTENTE:'Esta jornada já foi aberta. Consulte a fila atual.',FILA_NAO_ABERTA:'A jornada não está aberta.',FILA_JA_INICIADO:'Este atendimento já começou.',FILA_INICIO_OBRIGATORIO:'Inicie o atendimento antes de registrar o resultado.',FILA_ESTADO_INVALIDO:'O estado do vendedor mudou. Confira a fila.',FILA_REQUISICAO_REUTILIZADA:'Esta ação já foi usada com outros dados. Atualize a fila.',FILA_CONFLITO:'A fila mudou durante a operação. Atualize e confira.',FILA_GESTAO_INCOMPATIVEL:'Gerenciar a fila exige operar atendimentos e um perfil sem restrição às próprias vendas.',FILA_PERMISSAO_DEPENDENTE:'Operar, gerenciar ou ver relatórios exige permissão para consultar a fila.'};
Object.assign(errorText,queueErrors);
function queueButton(text,fn,secondary=false){const b=el('button',text,secondary?'button':'button primary');b.type='button';b.addEventListener('click',fn);return b;}
async function loadQueue(quiet=false){
 if(!token||page!=='queue'||queueBusy)return;$('loading').hidden=true;
 const filial=$('queue-branch').value,dia=$('queue-day').value;if(!filial||!dia)return;
 const ver=++generation;abort?.abort();abort=new AbortController();if(!quiet){resetError();$('queue-message').textContent='Carregando fila…';$('queue-content').replaceChildren();}
 try{const d=await api('/fila?'+new URLSearchParams({filial,dia}),{signal:abort.signal});if(ver!==generation||page!=='queue')return;
  const unchanged=quiet&&queueData?.filial===filial&&queueData?.dia===dia&&(queueData?.jornada?.versao??0)===(d.jornada?.versao??0)&&queueData?.pendente_dia===d.pendente_dia&&queueData?.gerenciar===d.gerenciar&&queueData?.operar===d.operar&&queueData?.relatorios===d.relatorios&&queueData?.codigo_proprio===d.codigo_proprio;
  $('queue-report-section').hidden=!d.relatorios;if(!d.relatorios){queueReportGeneration++;queueReportAbort?.abort();$('queue-report-content').replaceChildren();}
  queueData=d;queueVersion=d.jornada?.versao??0;if(!unchanged)renderQueue(d);$('queue-message').textContent='Atualizado às '+new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
 }catch(e){if(e.name!=='AbortError'&&ver===generation){$('queue-message').textContent='Não foi possível atualizar a fila.';displayError(e);}}
}
function renderQueue(d){
 const root=$('queue-content');root.replaceChildren();const atual=d.dia===today(),aberta=d.jornada?.estado==='aberta';
 if(d.pendente_dia){const n=el('div',null,'panel queue-notice');n.append(el('p','Há uma jornada aberta em '+dateBR(d.pendente_dia)+'. Finalize os atendimentos e encerre essa jornada antes de abrir outra.'),queueButton('Consultar jornada pendente',()=>{$('queue-day').value=d.pendente_dia;loadQueue();},true));root.append(n);}
 if(!d.jornada){
  const box=el('section',null,'panel queue-setup');box.append(el('h2','Preparar jornada'),el('p','Selecione os vendedores presentes e ajuste a ordem antes de abrir a fila.'));root.append(box);
  if(!d.gerenciar||!atual||d.pendente_dia){box.append(el('p','Nenhuma jornada nesta data. A abertura é feita por quem tem permissão de gestão, no dia atual.'));return;}
  const selected=[];const picker=el('select');picker.setAttribute('aria-label','Vendedor presente');for(const c of d.candidatos){const o=el('option',c.nome+' · '+c.vendedor_codigo);o.value=c.vendedor_codigo;picker.append(o);}const list=el('ol',null,'queue-selection');
  const draw=()=>{list.replaceChildren();selected.forEach((code,i)=>{const row=el('li');row.append(el('span',(i+1)+'º · '+d.candidatos.find(c=>c.vendedor_codigo===code).nome+' · '+code));const up=queueButton('↑',()=>{[selected[i-1],selected[i]]=[selected[i],selected[i-1]];draw();},true);up.disabled=i===0;up.setAttribute('aria-label','Subir '+(i+1)+'º vendedor');const down=queueButton('↓',()=>{[selected[i+1],selected[i]]=[selected[i],selected[i+1]];draw();},true);down.disabled=i===selected.length-1;down.setAttribute('aria-label','Descer '+(i+1)+'º vendedor');row.append(up,down,queueButton('Remover',()=>{selected.splice(i,1);draw();},true));list.append(row);});};
  const add=queueButton('Adicionar presente',()=>{if(picker.value&&!selected.includes(picker.value)&&selected.length<60){selected.push(picker.value);draw();}},true);add.disabled=!d.candidatos.length;
  box.append(picker,add,list,queueButton('Abrir jornada',()=>{if(!selected.length){showToast('Selecione pelo menos um vendedor.');return;}queueAction({acao:'abrir',vendedores:[...selected]});}));if(!d.candidatos.length)box.append(el('p','Nenhum vendedor encontrado no histórico importado desta filial.'));return;
 }
 const disponiveis=d.participantes.filter(p=>p.estado==='disponivel').sort((a,b)=>a.posicao-b.posicao),proximo=disponiveis[0];
 const head=el('section',null,'panel queue-summary');head.append(el('span',aberta?'Jornada aberta':'Jornada fechada','eyebrow'),el('h2',aberta?(proximo?'Na vez: '+proximo.nome:'Nenhum vendedor disponível'):'Histórico da equipe'),el('p','Pausa retorna ao final · Atendimento reservado preserva a vez · Um atendimento aberto por vendedor'));root.append(head);
 if(aberta&&d.jornada.movimento_intenso){head.classList.add('queue-intense');head.prepend(el('strong','Movimento intenso ativo'));head.querySelector('h2').textContent='Qualquer vendedor disponível pode abordar';head.append(el('p','A ordem está flexibilizada. Continua permitido somente um atendimento aberto por vendedor.'));}
 if(d.gerenciar&&aberta&&(atual||d.jornada.movimento_intenso))head.append(queueButton(d.jornada.movimento_intenso?'Encerrar movimento intenso':'Ativar movimento intenso',()=>queueDialog({acao:'movimento_intenso',ativo:!d.jornada.movimento_intenso},d.jornada.movimento_intenso?'Restaurar ordem da vez':'Ativar movimento intenso',d.jornada.movimento_intenso?'A ordem da vez volta a valer para novas abordagens. Os atendimentos abertos continuam normalmente. Informe o motivo.':'Qualquer vendedor disponível poderá abordar, mantendo um atendimento aberto por vendedor. Informe o motivo da ativação.',true),true));
 if(d.gerenciar&&aberta){head.append(el('p',queueClosingText(d),'queue-pending'));const actions=el('div',null,'queue-actions');if(atual){const select=el('select');select.setAttribute('aria-label','Vendedor que chegou');for(const c of d.candidatos.filter(c=>!d.participantes.some(p=>p.vendedor_codigo===c.vendedor_codigo&&p.estado!=='ausente'))){const o=el('option',c.nome);o.value=c.vendedor_codigo;select.append(o);}const add=queueButton('Registrar chegada',()=>queueAction({acao:'chegada',vendedor:select.value}),true);add.disabled=!select.options.length;if(select.options.length)actions.append(select,add);}actions.append(queueButton('Fechar jornada',()=>queueCloseDialog(d),true));head.append(actions);}
 const cards=el('div',null,'queue-cards');root.append(cards);const estados={disponivel:'Disponível',ocupado:'Ocupado',pausa:'Em pausa',ausente:'Ausente'};
 for(const p of [...d.participantes].sort((a,b)=>(a.estado==='disponivel'?0:1)-(b.estado==='disponivel'?0:1)||a.posicao-b.posicao)){
  const card=el('article',null,'panel queue-person');card.dataset.vendedor=p.vendedor_codigo;const vez=disponiveis.findIndex(v=>v.vendedor_codigo===p.vendedor_codigo);
  const a=d.atendimentos.find(a=>a.vendedor_codigo===p.vendedor_codigo),podeAtuar=d.operar&&(d.gerenciar||d.codigo_proprio===p.vendedor_codigo);
  card.append(el('small',p.estado==='disponivel'&&aberta?(vez+1)+'º na fila':a?(a.iniciado_em?'Em atendimento':'Em abordagem — aguardando início'):estados[p.estado]),el('h3',p.nome),el('p','Código '+p.vendedor_codigo));const actions=el('div',null,'queue-actions');card.append(actions);cards.append(card);
  if(a?.movimento_intenso)card.append(el('small','Abordagem em movimento intenso'));
  if(a){card.append(el('p',a.modalidade==='reservado'?'Atendimento reservado':'Atendimento da vez'),el('p',(a.iniciado_em?'Iniciado: ':'Abordagem: ')+when(a.iniciado_em||a.abordado_em)));}
  if(!aberta)continue;
  if(podeAtuar&&a){if(!a.iniciado_em){actions.append(queueButton('Iniciar atendimento',()=>queueAction({acao:'iniciar',atendimento:a.id})));actions.append(queueButton('Encerrar sem iniciar',()=>queueDialog({acao:'concluir',atendimento:a.id,resultado:'nao_iniciado'},'Encerrar abordagem sem iniciar','Esta abordagem ainda está aberta. Informe o motivo para encerrá-la sem contar como atendimento realizado. O vendedor mantém sua prioridade na fila.',true),true));}
   else actions.append(queueButton('Concluir com venda',()=>queueDialog({acao:'concluir',atendimento:a.id,resultado:'com_venda'},'Concluir com venda informada','O resultado será informado por você. A confirmação da venda no ERP será uma etapa posterior.',false)),queueButton('Concluir sem venda',()=>queueDialog({acao:'concluir',atendimento:a.id,resultado:'sem_venda'},'Concluir sem venda','Registre o motivo da não conversão. Na lista da vez, o vendedor retorna ao final.',true),true));}
  if(atual&&p.estado==='disponivel'){if(podeAtuar){if(d.jornada.movimento_intenso||proximo?.vendedor_codigo===p.vendedor_codigo)actions.append(queueButton('Abordar próximo cliente',()=>queueAction({acao:'abordar',vendedor:p.vendedor_codigo,modalidade:'vez'})));actions.append(queueButton('Cliente reservado',()=>queueDialog({acao:'abordar',vendedor:p.vendedor_codigo,modalidade:'reservado'},'Atendimento reservado','Registre o motivo da reserva, sem dados pessoais do cliente. A prioridade na fila será preservada.',true),true));}if(d.gerenciar)actions.append(queueButton('Pausar',()=>queueDialog({acao:'pausar',vendedor:p.vendedor_codigo},'Registrar pausa','Na volta, o vendedor entrará no final da fila.',true),true),queueButton('Marcar ausente',()=>queueDialog({acao:'ausente',vendedor:p.vendedor_codigo},'Registrar ausência','O vendedor sairá da distribuição. Se retornar, entrará no final.',true),true));}
  if(atual&&d.gerenciar&&p.estado==='pausa')actions.append(queueButton('Retornar da pausa',()=>queueAction({acao:'retornar',vendedor:p.vendedor_codigo}),true));
 }
}
function queueClosingText(d){
 const abordagem=d.atendimentos.filter(a=>!a.iniciado_em).length,iniciados=d.atendimentos.length-abordagem;
 if(!abordagem&&!iniciados)return 'Sem abordagens ou atendimentos pendentes. A jornada pode ser fechada.';
 const partes=[];if(abordagem)partes.push(`${abordagem} ${abordagem===1?'abordagem aguardando início':'abordagens aguardando início'}`);if(iniciados)partes.push(`${iniciados} ${iniciados===1?'atendimento em andamento':'atendimentos em andamento'}`);
 return 'Pendências para fechar: '+partes.join(' e ')+'.';
}
function queueCloseDialog(d){
 if(!d.atendimentos.length){queueDialog({acao:'fechar'},'Fechar jornada','Todos os registros foram encerrados. O histórico será preservado.',false);return;}
 const orientacoes=[];if(d.atendimentos.some(a=>!a.iniciado_em))orientacoes.push('Nas abordagens que não viraram atendimento, clique em “Encerrar sem iniciar” e informe o motivo. Se o atendimento aconteceu, registre o início e a conclusão.');
 if(d.atendimentos.some(a=>a.iniciado_em))orientacoes.push('Nos atendimentos em andamento, use “Concluir com venda” ou “Concluir sem venda”.');
 queueDialog(null,'Há pendências antes de fechar',queueClosingText(d)+' '+orientacoes.join(' '),false);
}
function queueDialog(action,title,description,reason){queuePending=action?{...action}:null;$('queue-action-form').querySelector('button[type=submit]').hidden=!action;$('queue-action-cancel').textContent=action?'Cancelar':'Voltar à fila';$('queue-action-title').textContent=title;$('queue-action-description').textContent=description;$('queue-action-error').textContent='';$('queue-reason').value='';$('queue-reason').required=reason;$('queue-reason-label').hidden=!reason;$('queue-action-dialog').showModal();}
$('queue-action-cancel').addEventListener('click',()=>$('queue-action-dialog').close());
$('queue-action-form').addEventListener('submit',async e=>{e.preventDefault();if(queueBusy||!queuePending)return;const action={...queuePending};if($('queue-reason').required)action.motivo=$('queue-reason').value;await queueAction(action);});
async function queueAction(action){
 if(queueBusy||!queueData)return;queueBusy=true;const body={...action,filial:queueData.filial,dia:queueData.dia,versao:queueVersion,requisicao:crypto.randomUUID()};
 for(const b of $('queue-panel').querySelectorAll('button'))b.disabled=true;for(const b of $('queue-action-form').querySelectorAll('button'))b.disabled=true;
 try{await api('/fila',{method:'POST',body:JSON.stringify(body)});$('queue-action-dialog').close();showToast('Fila atualizada.');}
 catch(e){$('queue-action-dialog').close();displayError(e);}
 finally{queueBusy=false;for(const b of $('queue-filters').querySelectorAll('button'))b.disabled=false;for(const b of $('queue-action-form').querySelectorAll('button'))b.disabled=false;await loadQueue(true);if(queueData)renderQueue(queueData);}
}
$('queue-filters').addEventListener('submit',e=>{e.preventDefault();if(!queueBusy){queueData=null;loadQueue();}});

let queueReportGeneration=0,queueReportAbort=null,queueReportFilters=null,queueReportPage=1;
Object.assign(errorText,{FILA_PERIODO_RELATORIO_INVALIDO:'Escolha um período de 1 a 31 dias para o relatório.',FILA_MODO_INVALIDO:'Modo de atendimento inválido.'});
const queueDuration=seconds=>seconds===null||seconds===undefined?'Sem dados':`${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}min ${Math.floor(seconds%60)}s`;
const queueRate=value=>value===null?'Sem dados':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value)+'%';
function queueReportTable(title,headers,rows){
 const section=el('section');section.append(el('h3',title));
 const scroll=el('div',null,'table-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label',title);const table=el('table'),head=el('thead'),tr=el('tr');
 for(const h of headers){const cell=el('th',h);cell.scope='col';tr.append(cell);}head.append(tr);table.append(head);const body=el('tbody');
 for(const row of rows){const tr=el('tr');for(const value of row)tr.append(el('td',String(value??'—')));body.append(tr);}
 table.append(body);scroll.append(table);section.append(rows.length?scroll:el('p','Nenhum registro neste período.'));return section;
}
async function loadQueueReport(){
 if(!token||!queueReportFilters)return;
 const version=++queueReportGeneration;queueReportAbort?.abort();queueReportAbort=new AbortController();
 const filter={...queueReportFilters,pagina:String(queueReportPage)},root=$('queue-report-content');root.replaceChildren();$('queue-report-pagination').hidden=true;$('queue-report-message').textContent='Carregando relatório…';
 try{
  const d=await api('/fila/relatorio?'+new URLSearchParams(filter),{signal:queueReportAbort.signal});if(version!==queueReportGeneration||!token)return;
  const branch=[...$('queue-report-branch').options].find(o=>o.value===d.filial)?.textContent||d.filial;
  $('queue-report-message').textContent=`${branch} · ${dateBR(d.inicio)} a ${dateBR(d.fim)} · ${d.somente_proprios?'Somente seus atendimentos':'Escopo autorizado'} · Consultado: ${when(d.consultado_em)}`;
  if(!filter.vendedor){const select=$('queue-report-seller');select.replaceChildren(new Option(d.somente_proprios?'Meu atendimento':'Todos os autorizados',''));for(const v of d.por_vendedor)select.append(new Option(v.nome+' · '+v.vendedor_codigo,v.vendedor_codigo));}
  const metrics=el('div',null,'queue-report-metrics');
  for(const [label,value] of [['Abordagens registradas',number(d.totais.abordagens)],['Atendimentos concluídos',number(d.totais.concluidos)],['Com venda informada',number(d.totais.com_venda)],['Conversão informada',queueRate(d.totais.conversao_informada)],['Tempo médio dos concluídos',queueDuration(d.totais.tempo_medio_segundos)],['Pendências',number(d.totais.em_abordagem+d.totais.em_atendimento)]]){
   const card=el('div');card.append(el('small',label),el('strong',value));metrics.append(card);
  }root.append(metrics,el('p','Conversão = com venda informada ÷ concluídos com/sem venda. Abordagens não iniciadas e registros abertos ficam fora desse cálculo. Sem concluídos, não há taxa nem tempo médio.'),el('p','Disponibilidade soma somente os intervalos em que o vendedor podia receber clientes, até o fechamento ou o instante da consulta. Exclui abordagem, atendimento, pausa e ausência. Não é tempo de espera do cliente. Os dias seguem a data da jornada, inclusive nos registros que terminam após meia-noite.'));
  root.append(el('p','Deslize as tabelas para ver todas as colunas.'));
  const headers=['Vendedor','Abordagens','Iniciados','Sem início encerrados','Em abordagem','Em atendimento','Com venda informada','Sem venda','Conversão','Tempo médio','Tempo disponível','Mov. intenso'];
  const values=row=>[row.abordagens,row.iniciados,row.nao_iniciados,row.em_abordagem,row.em_atendimento,row.com_venda,row.sem_venda,queueRate(row.conversao_informada),queueDuration(row.tempo_medio_segundos),queueDuration(row.tempo_disponivel_segundos),row.em_movimento_intenso];
  root.append(queueReportTable('Resultados por vendedor',headers,d.por_vendedor.map(r=>[r.nome+' · '+r.vendedor_codigo,...values(r)])));
  root.append(queueReportTable('Resultados por dia',['Dia',...headers.slice(1)],d.por_dia.map(r=>[dateBR(r.dia),...values(r)])));
  root.append(queueReportTable('Motivos registrados',['Resultado','Motivo','Quantidade'],d.motivos.map(r=>[r.resultado==='nao_iniciado'?'Abordagem encerrada sem iniciar':'Atendimento sem venda',r.motivo||'Não informado',r.quantidade])));
  const resultados={nao_iniciado:'Encerrado sem iniciar',sem_venda:'Sem venda',com_venda:'Com venda informada'};
  root.append(queueReportTable('Histórico dos atendimentos',['Vendedor / dia','Modalidade','Abordagem','Início','Fim','Resultado','Duração','Motivo'],d.registros.map(r=>[r.nome+' · '+r.vendedor_codigo+' / '+dateBR(r.dia),(r.modalidade==='reservado'?'Reservado':'Da vez')+(r.movimento_intenso?' · Movimento intenso':''),when(r.abordado_em),r.iniciado_em?when(r.iniciado_em):'Não iniciado',r.finalizado_em?when(r.finalizado_em):'Em aberto',resultados[r.resultado]||(r.iniciado_em?'Em atendimento':'Em abordagem'),queueDuration(r.duracao_segundos),r.motivo||'—'])));
  if(d.gerenciar){const details=el('details');details.append(el('summary','Histórico de movimento intenso (até 100 alterações mais recentes)'));details.append(queueReportTable('Ativações e encerramentos',['Dia','Horário','Ação','Motivo','Responsável'],d.movimentos.map(m=>[dateBR(m.dia),when(m.criado_em),m.ativo?'Ativado':'Ordem restaurada',m.motivo,m.responsavel||'Não informado'])));root.append(details);}
  const pages=Math.max(1,Math.ceil(d.total_registros/d.limite));$('queue-report-pagination').hidden=false;$('queue-report-page').textContent=`Histórico: página ${d.pagina} de ${pages} · ${number(d.total_registros)} registros`;$('queue-report-prev').disabled=d.pagina<=1;$('queue-report-next').disabled=d.pagina>=pages;
 }catch(e){if(e.name!=='AbortError'&&version===queueReportGeneration){$('queue-report-message').textContent='Não foi possível consultar o relatório.';displayError(e);}}
}
$('queue-report-filters').addEventListener('submit',e=>{e.preventDefault();queueReportPage=1;queueReportFilters={filial:$('queue-report-branch').value,inicio:$('queue-report-start').value,fim:$('queue-report-end').value,vendedor:$('queue-report-seller').value};loadQueueReport();});
$('queue-report-branch').addEventListener('change',()=>{$('queue-report-seller').replaceChildren(new Option('Todos os autorizados',''));});
$('queue-report-prev').addEventListener('click',()=>{queueReportPage--;loadQueueReport();});
$('queue-report-next').addEventListener('click',()=>{queueReportPage++;loadQueueReport();});

let productPage=1;
async function loadProducts(){
 if(!filters)return;
 const version=++generation;abort?.abort();clearOverviewMedia();abort=new AbortController();resetError();busy(true);$('data-notice').hidden=true;$('products-panel').hidden=false;$('products-list').replaceChildren();$('products-status').textContent='Consultando produtos…';
 const vendas=$('products-mode').value==='vendas';
 for(const id of ['period','start-date','end-date'])$(id).parentElement.hidden=!vendas;
 $('products-mode').querySelector('[value="vendas"]').hidden=!pode('vendas:ler');$('products-balance-label').hidden=vendas||!pode('estoque:ler');
 $('products-prev').disabled=true;$('products-next').disabled=true;
 const params=new URLSearchParams({filial:filters.filial,busca:$('products-query').value,pagina:productPage,...(vendas?{inicio:filters.inicio,fim:filters.fim}:{saldo:pode('estoque:ler')?$('products-balance').value:'todos'})});
 try{
  const d=await api('/produtos'+(vendas?'/indicadores':'')+'?'+params,{signal:abort.signal});if(version!==generation||page!=='products')return;
  $('products-rule').textContent=d.regra;
  $('scope-label').textContent=`${$('branch').selectedOptions[0]?.textContent} · ${vendas?dateBR(filters.inicio)+' a '+dateBR(filters.fim):'Estoque atual'}`;
  if(vendas){
   $('products-status').textContent=`${number(d.total)} produtos/SKUs · ${number(d.pecas)} peças · Subtotal dos itens: ${money(d.subtotal_centavos)}. Desconto informado em ${number(d.pecas_com_desconto)} de ${number(d.pecas)} peças.`;
   if(!d.checkpoints_cobrem_fim||d.sincronizacao.some(s=>s.ultimo_erro_codigo))$('products-status').append(' Atenção: sincronização do período pendente.');
   $('last-sync').textContent='Vendas atualizadas: '+when(d.sincronizacao.find(s=>s.recurso==='vendas')?.ultimo_sucesso);
  }else{
   const sync=d.sincronizacao;
   $('products-status').textContent=`${number(d.total)} SKUs cadastrados. `+(!sync?.ultimo_sucesso?'Carga inicial de estoque pendente.':sync.ultimo_erro_codigo?'Atualização pendente; exibindo a última posição recebida.':sync.desatualizado?'A última posição tem mais de 30 minutos. Consulte a data de atualização.':'Posição salva na última sincronização.');
   $('last-sync').textContent='Estoque atualizado: '+when(sync?.ultimo_sucesso);
  }
  const jobs=[];overviewPhotoAbort=new AbortController();const photoSignal=overviewPhotoAbort.signal;
  for(const p of d.produtos){
   const row=el('article',null,'stock-product-row'),copy=el('div',null,'top-product-copy'),metrics=el('div',null,'stock-product-metrics');row.setAttribute('role','listitem');
   const photo=smallProductPhoto(p,version,jobs,photoSignal);copy.append(el('h3',p.descricao||'Produto sem descrição'),el('p','Código: '+(p.cod_produto||'Não informado'),'muted'),el('p','SKU: '+(p.sku||'Não informado'),'muted'));
   if(!vendas)copy.append(el('p',`Cor: ${p.cor||'—'} · Tamanho: ${p.tamanho||'—'}`,'muted'));
   const values=vendas?[['Peças / vendas',number(p.pecas)+' / '+number(p.vendas)],['Valor vendido',money(p.subtotal_centavos)],['Desconto médio informado',p.desconto_medio_percentual==null?'Não informado':decimal(p.desconto_medio_percentual)+'%'],['Cobertura do desconto',number(p.pecas_com_desconto)+' de '+number(p.pecas)+' peças']]:d.estoque_permitido?[['Saldo disponível',p.saldo===null?'Não informado':decimal(p.saldo)]]:[['Cadastro','Saldo sem permissão']];
   for(const [label,value] of values){const cell=el('div');cell.append(el('small',label),el('strong',value));if(!vendas&&Number(p.saldo)<0){cell.classList.add('warn');cell.append(el('small','Saldo negativo informado pelo ERP.'));}metrics.append(cell);}
   const details=el('button','Ver detalhes','button stock-product-details');details.type='button';details.setAttribute('aria-label','Ver detalhes de '+(p.descricao||p.cod_produto)+' · '+(p.sku||'sem SKU'));
   details.addEventListener('click',()=>vendas?openProductDetails({...p,chave:p.cod_produto?'produto:'+p.cod_produto:p.chave}):openCatalogDetails(p,d.estoque_permitido,d.sincronizacao));
   row.append(photo,copy,metrics,details);$('products-list').append(row);
  }
  runPhotoJobs(jobs,version,photoSignal);
  if(!d.produtos.length)$('products-list').append(el('p','Nenhum produto encontrado para estes filtros.'));
  const pages=Math.max(1,Math.ceil(d.total/d.limite));$('products-pagination').textContent=`Página ${d.pagina} de ${pages}`;$('products-prev').disabled=d.pagina<=1;$('products-next').disabled=d.pagina>=pages;
 }catch(e){if(e.name!=='AbortError'&&version===generation){$('products-status').textContent='Consulta não concluída.';displayError(e);}}
 finally{if(version===generation)busy(false);}
}
$('products-search').addEventListener('submit',e=>{e.preventDefault();productPage=1;loadData();});
$('products-mode').addEventListener('change',()=>{productPage=1;loadData();});
$('products-prev').addEventListener('click',()=>{productPage--;loadData();});
$('products-next').addEventListener('click',()=>{productPage++;loadData();});

let overviewPhotoAbort=null;const overviewPhotoUrls=new Set();
function clearOverviewMedia(){closeProductDetails();overviewPhotoAbort?.abort();for(const url of overviewPhotoUrls)URL.revokeObjectURL(url);overviewPhotoUrls.clear();$('photo-dialog').close();}
function renderOverviewSummaries(d){
 const months=new Map();for(const day of d.serie_diaria){const key=day.data.slice(0,7);const m=months.get(key)||{pecas:0n,vendas:0n,valor:0n};m.pecas+=BigInt(day.pecas_cabecalho);m.vendas+=BigInt(day.vendas);m.valor+=BigInt(day.valor_vendas_centavos);months.set(key,m);}
 $('monthly-body').replaceChildren();for(const [month,m] of months){const r=el('tr');r.append(el('td',new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'))),el('td',number(m.pecas)),el('td',number(m.vendas)),el('td',money(m.valor)));$('monthly-body').append(r);}
 if(!months.size)emptyTable($('monthly-body'),4,'Sem vendas no período','Consulte a cobertura da sincronização acima.');
 const total=el('tr');total.append(el('th','Total do período'),el('td',number(d.pecas_cabecalho)),el('td',number(d.vendas)),el('td',money(d.valor_vendas_centavos)));$('monthly-total').replaceChildren(total);
 $('payment-summary-body').replaceChildren();for(const c of d.condicoes_pagamento){const row=el('tr'),label=el('td');label.append(el('strong',c.nome));if(c.codigo!=='nao_informada')label.append(el('small','Código '+c.codigo));row.append(label,el('td',number(c.vendas)),el('td',money(c.valor_centavos)),el('td',c.participacao_percentual==null?'—':decimal(c.participacao_percentual)+'%'));$('payment-summary-body').append(row);}
 const missing=d.condicoes_pagamento.find(c=>c.codigo==='nao_informada');$('payment-coverage').textContent=missing?`${number(missing.vendas)} ${missing.vendas===1?'venda sem condição identificada':'vendas sem condição identificada'} (${money(missing.valor_centavos)}), incluídas em “Não informada”.`:'Condições identificadas nas vendas do período. Cada venda é contada uma vez; este quadro não soma parcelas nem recebimentos.';
 if(!d.condicoes_pagamento.length)emptyTable($('payment-summary-body'),4,'Sem vendas no período','Nenhuma condição a apresentar.');
 const pay=el('tr');pay.append(el('th','Total do período'),el('td',number(d.vendas)),el('td',money(d.valor_vendas_centavos)),el('td',BigInt(d.valor_vendas_centavos)===0n?'—':'100%'));$('payment-summary-total').replaceChildren(pay);
 for(const row of [...$('payment-summary-body').rows,...$('payment-summary-total').rows])Array.from(row.cells).forEach((cell,i)=>{cell.dataset.label=['Condição','Vendas','Valor','Participação'][i];});
}
$('top-products-sort').addEventListener('change',()=>loadData());
function renderTopProducts(data,version){
 $('top-products-panel').hidden=!data;$('top-products-list').replaceChildren();if(!data)return;
 if(data.erro){$('top-products-status').textContent=data.erro;return;}
 $('top-products-status').textContent=`${number(data.top.length)} de ${number(data.total.produtos)} produtos · participação calculada sobre ${data.criterio==='valor'?money(data.total.subtotal_centavos):number(data.total.pecas)+' peças'} dos itens de todas as vendas autorizadas. Subtotal dos itens; não inclui ajustes da venda.`+(pode('imagens:ler')?'':' Fotos não liberadas para este cargo.');
 if(!data.top.length){$('top-products-list').append(el('p','Nenhum produto vendido no período.'));return;}
 const jobs=[];overviewPhotoAbort=new AbortController();const photoSignal=overviewPhotoAbort.signal;
 data.top.forEach((p,i)=>{
  const card=el('article',null,'top-product-row'),photo=smallProductPhoto(p,version,jobs,photoSignal);card.setAttribute('role','listitem');
  const copy=el('div',null,'top-product-copy');copy.append(el('h3',p.descricao||'Produto sem descrição'),el('p','Código '+(p.cod_produto||'não informado'),'muted'));
  const metrics=el('div',null,'top-product-metrics');for(const [label,value] of [['Peças',number(p.pecas)],['Vendas',number(p.vendas)],['Valor vendido',money(p.subtotal_centavos)],['Participação',p.participacao_percentual==null?'—':decimal(p.participacao_percentual)+'%']]){const cell=el('div');cell.append(el('small',label),el('strong',value));metrics.append(cell);}
  const details=el('button','Ver detalhes','button top-product-details');details.type='button';details.setAttribute('aria-label','Ver detalhes de '+(p.descricao||p.cod_produto||'produto'));details.addEventListener('click',()=>openProductDetails(p));
  card.append(el('span',String(i+1).padStart(2,'0'),'rank-number'),photo,copy,metrics,details);$('top-products-list').append(card);
 });
 runPhotoJobs(jobs,version,photoSignal);
}
function renderStockSummary(data){
 $('stock-summary-panel').hidden=!data;for(const id of ['stock-brand-body','stock-brand-total','stock-category-body','stock-category-total'])$(id).replaceChildren();if(!data)return;
 if(data.erro){$('stock-summary-status').textContent=data.erro;return;}
 const sync=data.sincronizacao;
 $('stock-summary-status').textContent='Atualizado: '+when(sync?.ultimo_sucesso)+'. Saldo já desconta reservas. Não representa estoque físico inicial/final do período. '+(!sync?.ultimo_sucesso?'Carga inicial pendente. ':sync.ultimo_erro_codigo||sync.desatualizado?'Atualização pendente ou com mais de 30 minutos. ':'')+'“Sem classificação” mantém os produtos cujo cadastro ainda não foi completado.';
 const units=v=>{if(v==null)return '—';const [a,b='']=String(v).replace('-','').split('.');const fraction=b.replace(/0+$/,'');return (String(v).startsWith('-')?'− ':'')+number(a)+(fraction?','+fraction:'');};
 for(const [campo,id] of [['marca','stock-brand'],['categoria','stock-category']]){
  let skus=0,unknown=0,total=0n,hasBalance=false;
  for(const g of data.grupos[campo]){const row=el('tr'),name=el('td',g.nome);if(g.negativos)name.append(el('small',`${number(g.negativos)} SKUs com saldo negativo`,'warn'));row.append(name,el('td',number(g.skus)),el('td',units(g.saldo_disponivel)+(g.sem_saldo?' (parcial)':'')),el('td',number(g.sem_saldo)));$(id+'-body').append(row);skus+=g.skus;unknown+=g.sem_saldo;if(g.saldo_disponivel!=null){const [a,b='']=g.saldo_disponivel.replace('-','').split('.');total+=(g.saldo_disponivel.startsWith('-')?-1n:1n)*BigInt(a+b.padEnd(6,'0'));hasBalance=true;}}
  if(!data.grupos[campo].length)emptyTable($(id+'-body'),4,'Estoque não carregado','Consulte a data da sincronização.');
  const row=el('tr');row.append(el('th','Total atual'),el('td',number(skus)),el('td',hasBalance?units((total<0n?'-':'')+String((total<0n?-total:total)/1000000n)+'.'+String((total<0n?-total:total)%1000000n).padStart(6,'0'))+(unknown?' (parcial)':''):'—'),el('td',number(unknown)));$(id+'-total').append(row);
 }
}

let rankingRequest=0;
async function loadRankingPage(){
 if(!token||page!=='overview'||!filters)return;
 const version=generation,request=++rankingRequest;$('rank-prev').disabled=true;$('rank-next').disabled=true;$('ranking-sort').disabled=true;
 try{const data=await api('/ranking?'+query({pagina:rankPage,limite:5,ordenar:$('ranking-sort').value}),{signal:abort?.signal});if(version!==generation||request!==rankingRequest)return;renderRanking(data);}
 catch(e){if(e.name!=='AbortError'&&version===generation&&request===rankingRequest){$('ranking-body').replaceChildren();displayError(e);}}
 finally{if(request===rankingRequest)$('ranking-sort').disabled=false;}
}

let productDetailAbort=null,productDetailVersion=0;
function closeProductDetails(){productDetailVersion++;productDetailAbort?.abort();$('product-dialog').close();$('product-detail-content').replaceChildren();}
$('product-detail-close').addEventListener('click',closeProductDetails);
$('product-dialog').addEventListener('close',()=>{productDetailVersion++;productDetailAbort?.abort();$('product-detail-content').replaceChildren();document.body.classList.remove('modal-open');});
async function openProductDetails(product,pagina=1){
 productDetailAbort?.abort();productDetailAbort=new AbortController();const version=++productDetailVersion;
 $('product-detail-title').textContent=product.descricao||product.cod_produto||'Produto';$('product-detail-content').replaceChildren(el('p','Carregando detalhes…','empty'));
 if(!$('product-dialog').open)$('product-dialog').showModal();document.body.classList.add('modal-open');
 try{
  const d=await api('/produtos/detalhe?'+query({chave:product.chave,pagina}),{signal:productDetailAbort.signal});if(version!==productDetailVersion)return;
  const content=$('product-detail-content');content.replaceChildren();
  const summary=el('div',null,'detail-summary');for(const [label,value] of [['Código',d.produto.cod_produto||'Não informado'],['Período',dateBR(d.filtros.inicio)+' a '+dateBR(d.filtros.fim)],['Peças vendidas',number(d.produto.pecas)],['Vendas distintas',number(d.produto.vendas)],['Valor vendido',money(d.produto.subtotal_centavos)],['Variações vendidas',number(d.total)]]){const cell=el('div');cell.append(el('small',label),el('strong',value));summary.append(cell);}content.append(summary);
  content.append(el('p','Valor vendido = subtotal dos itens no período, sem ajustes da venda. O último preço é o recebido na venda mais recente de cada variação. Uma venda pode conter mais de uma variação.'+(d.estoque_permitido?' Saldo disponível é atual, já desconta reservas; “—” indica saldo não conhecido.':''),'detail-notice'));
  const wrap=el('div',null,'detail-table'),scroll=el('div',null,'table-scroll'),table=el('table'),head=el('thead'),headers=el('tr');wrap.append(el('h3','Variações vendidas no período'));
  for(const label of ['SKU / classificação','Cor / tamanho','Peças','Vendas','Valor vendido','Último preço','Última venda',...(d.estoque_permitido?['Saldo atual']:[])])headers.append(el('th',label));head.append(headers);table.append(head);const body=el('tbody');
  for(const v of d.variacoes){const row=el('tr'),name=el('td');name.append(el('strong',v.sku||'SKU não informado'));for(const campo of ['marca','categoria'])if(v.classificacao?.[campo])name.append(el('small',(campo==='marca'?'Marca: ':'Categoria: ')+(v.classificacao[campo].descricao||v.classificacao[campo].codigo)));
   row.append(name,el('td',[v.cor,v.tamanho].filter(Boolean).join(' / ')||'Não informado'),el('td',number(v.pecas)),el('td',number(v.vendas)),el('td',money(v.subtotal_centavos)),el('td',money(v.ultimo_preco_centavos)),el('td',dateBR(v.ultima_venda)));if(d.estoque_permitido)row.append(el('td',v.saldo_disponivel==null?'—':decimal(v.saldo_disponivel)));body.append(row);
  }table.append(body);scroll.append(table);wrap.append(scroll);content.append(wrap);
  const footer=el('div',null,'table-footer'),actions=el('div',null,'pagination');footer.append(el('span',`${number(d.total)} variações · página ${d.pagina} de ${Math.max(1,Math.ceil(d.total/d.limite))}`));for(const [label,delta,disabled] of [['Anterior',-1,d.pagina===1],['Próxima',1,d.pagina*d.limite>=d.total]]){const button=el('button',label,'button');button.type='button';button.disabled=disabled;button.addEventListener('click',()=>openProductDetails(product,d.pagina+delta));actions.append(button);}footer.append(actions);content.append(footer);
 }catch(e){if(version===productDetailVersion&&e.name!=='AbortError')$('product-detail-content').replaceChildren(el('p',e.message,'empty'));}
}

function smallProductPhoto(p,version,jobs,photoSignal){
 const photo=el('button',null,'product-photo top-product-photo');photo.type='button';photo.disabled=true;photo.setAttribute('aria-label','Foto não disponível');photo.title=p.imagem?'Carregando foto':pode('imagens:ler')?'Sem foto disponível':'Fotos sem permissão';photo.append(el('span',p.imagem?'…':'—'));
 if(p.imagem&&pode('imagens:ler'))jobs.push(async()=>{
   try{const r=await fetch('/api/v1'+operationPath(p.imagem)+`/itens/${p.imagem.ordem}/imagem`,{headers:{Authorization:`Bearer ${token}`},signal:photoSignal});
    if(version!==generation)return;if(r.status===401){exitSession(errorText.NAO_AUTENTICADO);return;}if(!r.ok)throw Error('FOTO_INDISPONIVEL');
    const blob=await r.blob();if(version!==generation||photoSignal.aborted)return;
    const url=URL.createObjectURL(blob);overviewPhotoUrls.add(url);const img=el('img');img.alt=p.descricao||'Foto do produto';img.src=url;photo.replaceChildren(img);photo.disabled=false;photo.title='Ampliar foto';photo.setAttribute('aria-label','Ampliar foto de '+(p.descricao||p.cod_produto));
    img.addEventListener('error',()=>{photo.replaceChildren(el('span','—'));photo.disabled=true;photo.title='Foto indisponível';photo.setAttribute('aria-label','Foto indisponível');});
    photo.addEventListener('click',()=>{$('photo-error').hidden=true;$('photo-large').hidden=false;$('photo-large').src=url;$('photo-large').alt=p.descricao||'Produto';$('photo-dialog').showModal();});
   }catch(e){if(version!==generation||photoSignal.aborted)return;photo.replaceChildren(el('span','—'));photo.disabled=true;photo.title='Foto indisponível';photo.setAttribute('aria-label','Foto indisponível');}
  });
 return photo;
}
function runPhotoJobs(jobs,version,photoSignal){
 async function worker(){while(jobs.length&&version===generation&&!photoSignal.aborted)await jobs.shift()();}
 for(let i=0;i<4;i++)worker();
}
function openCatalogDetails(p,estoque,sync){
 productDetailAbort?.abort();productDetailVersion++;
 $('product-detail-title').textContent=p.descricao||p.cod_produto||'Produto';const content=$('product-detail-content');content.replaceChildren();
 const summary=el('div',null,'detail-summary'),values=[['Código',p.cod_produto],['SKU',p.sku],['Cor',p.cor],['Tamanho',p.tamanho],['Código de barras',p.barra]];
 if(estoque)values.push(['Saldo disponível',p.saldo===null?'Não informado':decimal(p.saldo)],['Movimentação no ERP',when(p.data_atualizacao_erp)]);
 for(const [label,value] of values){const cell=el('div');cell.append(el('small',label),el('strong',value||'Não informado'));summary.append(cell);}content.append(summary);
 if(estoque)content.append(el('p','Saldo atual, já descontadas as reservas. Sincronizado em '+when(sync?.ultimo_sucesso)+'.'+(sync?.ultimo_erro_codigo||sync?.desatualizado?' Atualização pendente; consulte a data da posição.':''),'detail-notice'));
 const classification=el('section',null,'catalog-detail-classification');classification.append(el('h3','Dados do cadastro'));
 const names={colecao:'Coleção',departamento:'Departamento',grupo:'Grupo',categoria:'Categoria',grade:'Grade',marca:'Marca'};
 for(const [key,value] of Object.entries(p.classificacao||{}))if(value.descricao||value.codigo)classification.append(el('p',`${names[key]||key}: ${value.descricao||value.codigo}`));
 classification.append(el('p',p.enriquecido_em?'Cadastro atualizado: '+when(p.enriquecido_em):'Classificação do produto aguardando atualização.'));content.append(classification);
 if(!$('product-dialog').open)$('product-dialog').showModal();document.body.classList.add('modal-open');
}
