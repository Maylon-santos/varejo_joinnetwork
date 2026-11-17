import qrcode from './qrcode.mjs';
const $=s=>document.querySelector(s),scopes=['vendas:ler','vendas:pessoas:ler','filiais:ler','produtos:ler','estoques:ler','webhooks:ler','webhooks:gerenciar'];
let cadastroTimer=null,cadastro=null,bearer=null,stepup=null,tab='clientes',clientes=[],selecionado=null,cursor=null,janela=null,revogacao=null,filiaisDetalhes=new Map(),editorAberto=false,mfaAte=0,sessaoTimer=null,rascunho=null;
const mensagens={ENROLLMENT_NOT_AUTHORIZED:'O convite de acesso não está disponível ou expirou. Solicite a renovação ao responsável.',ENROLLMENT_INVALID:'A configuração expirou. Saia e entre novamente para configurar o autenticador.',LOGIN_INVALID:'E-mail ou senha incorretos.',ADMIN_NOT_ENROLLED:'Este usuário ainda não foi habilitado como operador de integrações.',MFA_INVALID:'Código inválido, expirado ou já utilizado.',STEP_UP_REQUIRED:'Valide novamente o código do autenticador.',RESOURCE_CHANGED:'A configuração mudou. Atualize a lista antes de salvar.',INVALID_SCOPE:'Revise os escopos. Pessoas e webhooks também exigem vendas:ler.',CLIENT_REVOKED:'Uma integração revogada não pode ser reativada.',INVALID_BRANCH:'Selecione pelo menos uma filial autorizada, sem duplicidades.',REASON_REQUIRED:'Informe um motivo com pelo menos cinco caracteres.',KEY_REVOKED:'Esta chave já foi revogada. Cadastre uma nova chave com outro identificador.',INVALID_KEY:'Confira o formato da chave pública PEM.',INVALID_EXPIRY:'Informe uma validade futura para a chave.'};
function aviso(text,erro=false){$('#mensagem').textContent=text;$('#mensagem').className=erro?'erro':'';}
async function api(path,method='GET',body,extra={}){
 const response=await fetch('/admin/integracoes'+path,{method,headers:{...(bearer?{Authorization:'Bearer '+bearer}:{}),...(stepup?{'X-Integration-Admin':stepup}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
 const value=await response.json();if(!response.ok){if(value.code==='STEP_UP_REQUIRED'){solicitarMfa();}throw Error(mensagens[value.code]??value.code??value.error??'Serviço indisponível');}return value;
}
const nomesEscopos={
 'vendas:ler':['Vendas','Consultar vendas e seus detalhes'],
 'vendas:pessoas:ler':['Pessoas nas vendas','Consultar dados pessoais; requer leitura de vendas'],
 'filiais:ler':['Filiais','Consultar o cadastro das unidades'],
 'produtos:ler':['Produtos','Consultar catálogo e variações'],
 'estoques:ler':['Estoques','Consultar saldos por unidade'],
 'webhooks:ler':['Consultar webhooks','Consultar inscrições e entregas; requer vendas'],
 'webhooks:gerenciar':['Gerenciar webhooks','Cadastrar e alterar destinos; requer vendas']
};
const normalizar=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function elemento(tag,text,classe){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(classe)el.className=classe;return el;}
function dataExibida(value){return value?new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Sem acesso registrado';}
function checkbox(root,values,name,marcados=[]){
 root.replaceChildren();for(const v of values){
  const label=elemento('label',undefined,'opcao'),input=document.createElement('input');input.type='checkbox';input.name=name;input.value=v;input.checked=marcados.includes(v);
  const text=elemento('span'),filial=filiaisDetalhes.get(v),nome=name==='escopos'?nomesEscopos[v]?.[0]:(filial?.nome??filial?.codigo),descricao=name==='escopos'?nomesEscopos[v]?.[1]:(filial?.codigo&&filial.codigo!==nome?filial.codigo+' · ID '+v:'ID '+v);
  text.append(elemento('strong',nome??'Filial '+v),elemento('small',name==='escopos'?descricao+' · '+v:descricao));label.append(input,text);label.dataset.busca=normalizar([v,nome,descricao].join(' '));root.append(label);
 }
 atualizarSelecaoFiliais();
}
function atualizarSelecaoFiliais(){const n=$('#filiais').querySelectorAll('input:checked').length;$('#filiais-selecionadas').textContent=n===0?'Nenhuma selecionada':n+' selecionada'+(n===1?'':'s');}
function filtrarFiliais(){const busca=normalizar($('#buscar-filial').value);let n=0;for(const label of $('#filiais').children){label.hidden=!label.dataset.busca.includes(busca);if(!label.hidden)n++;}$('#filiais-vazias').hidden=n>0;}
function renderizarClientes(){
 const root=$('#resultado');root.className='resultado lista-clientes';root.replaceChildren();const busca=normalizar($('#buscar-cliente').value),estado=$('#estado-clientes').value;
 const data=clientes.filter(c=>(estado==='todos'||estado==='em_uso'&&c.estado!=='revogado'||c.estado===estado)&&normalizar(c.nome+' '+c.client_id).includes(busca));
 $('#quantidade-clientes').textContent=data.length+' de '+clientes.length+' aplicaç'+(clientes.length===1?'ão':'ões');
 const resumo=$('#resumo-integracoes');resumo.replaceChildren();for(const [nome,total,ajuda] of [['Aplicações ativas',clientes.filter(c=>c.estado==='ativo').length,'Concessões em vigor'],['Chaves válidas',clientes.filter(c=>c.estado==='ativo').flatMap(c=>c.chaves).filter(k=>k.ativa&&Date.parse(k.valida_ate)>Date.now()).length,'Ativas e dentro da validade'],['Aplicações revogadas',clientes.filter(c=>c.estado==='revogado').length,'Mantidas no histórico']]){const item=elemento('div',undefined,'resumo-item');item.append(elemento('span',nome),elemento('strong',String(total)),elemento('small',ajuda));resumo.append(item);}
 if(!data.length){const empty=elemento('div',undefined,'estado-vazio');empty.append(elemento('strong',clientes.length?'Nenhuma aplicação encontrada':'Cadastre sua primeira integração'),elemento('p',clientes.length?'Ajuste a busca ou o filtro de status para consultar outras aplicações.':'Comece em Nova integração para definir as permissões de acesso.'));root.append(empty);return;}
 const head=elemento('div',undefined,'lista-cabecalho');for(const text of ['Aplicação','Status','Acesso autorizado','Último acesso','Ações'])head.append(elemento('span',text));root.append(head);
 for(const c of data){
  const row=elemento('article',undefined,'integracao-item'),info=elemento('div');info.append(elemento('h3',c.nome,'integracao-nome'),elemento('p',c.finalidade,'integracao-finalidade'),elemento('code',c.client_id,'integracao-id'));
  const status=elemento('div');status.append(elemento('span','Status','rotulo-mobile'),elemento('span',{ativo:'Ativa',suspenso:'Suspensa',revogado:'Revogada'}[c.estado]??c.estado,'badge '+c.estado),elemento('span',c.ambiente==='producao'?'Produção':'Homologação','ambiente'));
  const validas=c.chaves.filter(k=>k.ativa&&Date.parse(k.valida_ate)>Date.now()).length,grant=elemento('div',undefined,'integracao-detalhe');grant.append(elemento('span','Acesso autorizado','rotulo-mobile'),elemento('span',c.filiais.length+' filia'+(c.filiais.length===1?'l':'is')),elemento('small',c.escopos.length+' permiss'+(c.escopos.length===1?'ão':'ões')+' · '+validas+(validas===1?' chave válida':' chaves válidas')));
  const ultimo=elemento('div',dataExibida(c.ultimo_acesso_em),'integracao-detalhe ultimo-acesso'),actions=elemento('div',undefined,'acoes'),button=elemento('button','Editar / chaves','secundario');button.type='button';button.onclick=()=>editarCliente(c);actions.append(button);row.append(info,status,grant,ultimo,actions);root.append(row);
 }
}
function atualizarSessao(){const segundos=Math.max(0,Math.ceil((mfaAte-Date.now())/1000));$('#sessao-prazo').hidden=!mfaAte;$('#renovar-mfa').hidden=!mfaAte;$('#sessao-prazo').textContent=segundos?'Autenticação válida por '+Math.floor(segundos/60)+':'+String(segundos%60).padStart(2,'0'):'Autenticação expirada';$('#sessao-prazo').classList.toggle('expirando',segundos<60);}
function guardarRascunho(){if(!editorAberto)return;rascunho={id:selecionado?.id,versao:$('#cliente [name=versao]').value,cliente:[...new FormData($('#cliente'))],chave:[...new FormData($('#chave'))],chaveAberta:!$('#form-chave').hidden,revogacao:revogacao?{...revogacao,motivo:$('#revogar-chave [name=motivo]').value}:null};}
function solicitarMfa(){guardarRascunho();limparRevogacao();$('#acesso').hidden=false;$('#login').hidden=true;$('#mfa').hidden=false;$('#console').hidden=true;stepup=null;$('#mfa [name=codigo]').focus();}
function restaurarRascunho(){
 if(!rascunho)return;const r=rascunho;rascunho=null;const atual=r.id?clientes.find(c=>c.id===r.id):null;
 if(r.id&&(!atual||String(atual.versao)!==String(r.versao))){novo();renderizarClientes();aviso('A aplicação foi alterada durante a autenticação. Abra o cadastro atualizado e revise os dados antes de continuar.',true);return;}
 if(atual)editarCliente(atual);else novo(true);
 for(const [name,value] of r.cliente){if(['escopos','filiais'].includes(name))continue;const input=$('#cliente').elements[name];if(input)input.value=value;}
 for(const name of ['escopos','filiais']){const values=r.cliente.filter(([k])=>k===name).map(([,v])=>v);for(const input of $('#cliente').querySelectorAll('[name='+name+']'))input.checked=values.includes(input.value);}
 for(const [name,value] of r.chave){const input=$('#chave').elements[name];if(input)input.value=value;}mostrarFormChave(r.chaveAberta);atualizarSelecaoFiliais();
 if(r.revogacao&&atual?.chaves.some(k=>k.kid===r.revogacao.kid&&k.ativa)){abrirRevogacao(atual,r.revogacao.kid);$('#revogar-chave [name=motivo]').value=r.revogacao.motivo;}
 aviso('Autenticação renovada. Seus campos foram preservados; revise e confirme a operação.');
}
function mostrarFormChave(mostrar){$('#form-chave').hidden=!mostrar;$('#adicionar-chave').setAttribute('aria-expanded',String(mostrar));if(mostrar)$('#chave [name=kid]').focus();}
function tabela(data,editar=false){
 const root=$('#resultado');root.className='resultado';root.replaceChildren();if(!data.length){root.textContent='Nenhum registro nesta consulta.';return;}
 const cols=[...new Set(data.flatMap(r=>Object.keys(r)))].filter(k=>!['chaves','hosts','tenant_key'].includes(k)),table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');
 const acoes=editar||tab==='webhooks'||tab==='entregas';table.className=acoes?'com-acoes':'';for(const c of [...cols,...(acoes?['Ações']:[])]){const th=document.createElement('th');th.textContent=c;tr.append(th);}head.append(tr);table.append(head);const tbody=document.createElement('tbody');
 for(const row of data){const r=document.createElement('tr');for(const c of cols){const td=document.createElement('td'),v=row[c];td.textContent=v===null||v===undefined?'—':Array.isArray(v)?v.join(', '):typeof v==='object'?JSON.stringify(v):String(v);r.append(td);}if(acoes){const td=document.createElement('td');if(editar){const button=document.createElement('button');button.textContent='Editar / chaves';button.onclick=()=>editarCliente(row);td.append(button);}else{for(const acao of tab==='webhooks'?['Testar',row.ativo?'Pausar':'Ativar']:['Reenviar']){const button=document.createElement('button');button.textContent=acao;button.onclick=operar(async()=>{const motivo=prompt('Motivo da ação (mínimo de cinco caracteres):');if(!motivo)return;const base='/clientes/'+row.cliente_id+'/webhooks/'+(row.webhook_id??row.id),headers={'Idempotency-Key':crypto.randomUUID()};if(acao==='Testar'||acao==='Reenviar')await api(base+(acao==='Testar'?'/testes':'/entregas/'+row.entrega_id+'/reenviar'),'POST',{motivo},headers);else{const current=(await api(base)).data;await api(base,'PUT',{nome:current.nome,url:current.url,eventos:current.eventos,filiais:current.filiais,ativo:acao==='Ativar',motivo},{...headers,'If-Match':'"'+current.id+':'+current.versao+'"'});}aviso('Ação registrada e auditada.');await carregar();});td.append(button);}}r.append(td);}tbody.append(r);}table.append(tbody);root.append(table);
}
function limparRevogacao(){revogacao=null;$('#revogar-dialog').close();$('#revogar-chave').reset();$('#revogar-alvo').textContent='';$('#revogar-erro').textContent='';}
function novo(mostrar=false){limparRevogacao();$('#chaves-cadastradas').replaceChildren();selecionado=null;editorAberto=mostrar;$('#cliente').reset();$('#cliente [name=id]').value='';$('#cliente [name=versao]').value='';$('#cliente [name=ambiente]').disabled=false;$('#chaves').hidden=true;$('#editor').hidden=!mostrar;$('#consulta').hidden=mostrar;$('#identidade-cliente').hidden=true;$('#editor-titulo').textContent='Cadastrar integração';$('#buscar-filial').value='';for(const i of $('#cliente').querySelectorAll('[type=checkbox]'))i.checked=false;filtrarFiliais();atualizarSelecaoFiliais();mostrarFormChave(false);if(mostrar){$('#editor').scrollIntoView({behavior:'smooth'});$('#cliente [name=nome]').focus();}}
function editarCliente(c){selecionado=c;editorAberto=true;const f=$('#cliente');for(const k of ['id','versao','nome','ambiente','estado','finalidade'])f.elements[k].value=c[k];f.elements.ambiente.disabled=true;f.elements.hosts.value=c.hosts.join('\n');f.elements.motivo.value='';for(const i of f.querySelectorAll('[type=checkbox]'))i.checked=(i.name==='escopos'?c.escopos:c.filiais).includes(i.value);$('#editor').hidden=false;$('#consulta').hidden=true;$('#editor-titulo').textContent='Editar '+c.nome;$('#identidade-cliente').hidden=false;$('#cliente-identificador').textContent=c.client_id;$('#chaves').hidden=false;$('#chave').reset();mostrarFormChave(false);$('#buscar-filial').value='';filtrarFiliais();atualizarSelecaoFiliais();renderizarChaves(c);aviso('');$('#editor').scrollIntoView({behavior:'smooth'});$('#editor-titulo').focus({preventScroll:true});}
function abrirRevogacao(c,kid){$('#revogar-erro').textContent='';revogacao={id:c.id,nome:c.nome,kid,versao:c.versao};$('#revogar-chave').reset();$('#revogar-alvo').textContent='Aplicação: '+c.nome+' · Chave: '+kid;$('#revogar-dialog').showModal();}
function renderizarChaves(c){
 const root=$('#chaves-cadastradas');root.replaceChildren();
 if(!c.chaves.length){const empty=elemento('div',undefined,'estado-vazio');empty.append(elemento('strong','Nenhuma chave cadastrada'),elemento('p','Adicione a chave pública para permitir a autenticação desta aplicação.'));root.append(empty);return;}
 for(const k of c.chaves){
  const item=elemento('div',undefined,'chave-cadastrada'),info=elemento('div',undefined,'chave-info'),expirada=Date.parse(k.valida_ate)<=Date.now(),status=!k.ativa?'Revogada':expirada?'Expirada':'Ativa';
  info.append(elemento('strong',k.kid),elemento('span',status,'badge '+(!k.ativa?'revogado':expirada?'expirada':'ativo')),elemento('small','Validade: '+dataExibida(k.valida_ate)));item.append(info);
  if(k.ativa){const button=elemento('button','Revogar','secundario');button.type='button';button.setAttribute('aria-label','Revogar chave '+k.kid);button.onclick=()=>abrirRevogacao(c,k.kid);item.append(button);}root.append(item);
 }
}
$('#cancelar-revogacao').onclick=limparRevogacao;
$('#revogar-dialog').addEventListener('cancel',()=>{revogacao=null;$('#revogar-chave').reset();});
$('#revogar-chave').onsubmit=operar(async()=>{
 if(!revogacao)return;const alvo=revogacao,motivo=new FormData($('#revogar-chave')).get('motivo');
 await api('/clientes/'+alvo.id+'/chaves/'+encodeURIComponent(alvo.kid)+'/revogar','POST',{motivo},{'If-Match':'"'+alvo.id+':'+alvo.versao+'"'});
 novo();await carregar();aviso('Chave '+alvo.kid+' revogada e ação auditada.');
});
function renderizarManual(manual){
 const root=$('#manual');root.replaceChildren();
 const texto=(tag,text,parent)=>{const node=document.createElement(tag);node.textContent=text;parent.append(node);return node;};
 texto('h2',manual.titulo,root);texto('p',manual.descricao,root);
 const indice=document.createElement('nav');indice.setAttribute('aria-label','Etapas do manual');indice.className='manual-indice';root.append(indice);
 for(const secao of manual.secoes){
  const link=texto('a',secao.titulo,indice);link.href='#manual-'+secao.id;
  const article=document.createElement('section');article.className='manual-etapa';article.id='manual-'+secao.id;root.append(article);texto('h3',secao.titulo,article);
  for(const p of secao.paragrafos??[])texto('p',p,article);
  if(secao.passos){const lista=document.createElement('ol');article.append(lista);for(const passo of secao.passos)texto('li',passo,lista);}
  if(secao.campos){
   const wrap=document.createElement('div');wrap.className='manual-tabela';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',secao.titulo);
   const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');texto('th','Campo ou situação',tr).scope='col';texto('th','Orientação',tr).scope='col';head.append(tr);table.append(head);
   const body=document.createElement('tbody');for(const campo of secao.campos){const row=document.createElement('tr');texto('th',campo.campo,row).scope='row';texto('td',campo.orientacao,row);body.append(row);}table.append(body);wrap.append(table);article.append(wrap);
  }
  if(secao.codigo){
   const box=document.createElement('div');box.className='manual-exemplo';const header=document.createElement('div');header.className='linha';texto('span','Exemplo · '+secao.codigo.linguagem,header);
   const button=texto('button','Copiar exemplo',header);button.type='button';button.className='secundario';button.onclick=operar(async()=>{await navigator.clipboard.writeText(secao.codigo.texto);aviso('Exemplo copiado. Substitua os valores demonstrativos antes de usar.');});
   box.append(header);const pre=document.createElement('pre');texto('code',secao.codigo.texto,pre);box.append(pre);article.append(box);
  }
  if(secao.nota)texto('aside',secao.nota,article).className='manual-nota';
  for(const item of secao.links??[]){const url=new URL(item.url);if(url.protocol!=='https:')continue;const a=texto('a',item.rotulo,article);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';}
 }
}
const titles={clientes:'Integrações',acessos:'Acessos da API',entregas:'Tentativas de entrega',webhooks:'Destinos de webhook',metricas:'Desempenho da API',auditoria:'Auditoria administrativa'};
function dataLocal(date){const d=new Date(date.getTime()-date.getTimezoneOffset()*60000);return d.toISOString().slice(0,16);}
async function carregar(proxima=false){
 const manual=tab==='manual';$('#consulta').hidden=manual||tab==='clientes'&&editorAberto;$('#manual').hidden=!manual;for(const id of ['resumo-integracoes','busca-integracoes','criar-integracao'])$('#'+id).hidden=tab!=='clientes';
 if(manual){$('#editor').hidden=true;$('#chaves').hidden=true;$('#mais').hidden=true;for(const b of document.querySelectorAll('[data-tab]'))b.toggleAttribute('aria-current',b.dataset.tab===tab);renderizarManual(await api('/manual'));return;}
 $('#titulo').textContent=titles[tab];$('#editor').hidden=tab!=='clientes'||!editorAberto;$('#chaves').hidden=tab!=='clientes'||!selecionado||!editorAberto;$('#filtros').hidden=tab==='clientes'||tab==='webhooks';$('#descricao').textContent=tab==='clientes'?'Acompanhe as aplicações autorizadas e gerencie suas permissões de acesso.':'Medições da aplicação. Payloads comerciais, tokens e segredos não aparecem nesta consulta.';
 for(const b of document.querySelectorAll('[data-tab]'))b.toggleAttribute('aria-current',b.dataset.tab===tab);
 let query='';if(tab!=='clientes'&&tab!=='webhooks'){
  if(!proxima){const f=new FormData($('#filtros'));janela={inicio:new Date(f.get('inicio')).toISOString(),fim:new Date(f.get('fim')).toISOString(),cliente_id:f.get('cliente_id')};cursor=null;}
  const p=new URLSearchParams({inicio:janela.inicio,fim:janela.fim,limite:'100'});if(janela.cliente_id)p.set('cliente_id',janela.cliente_id);if(proxima&&cursor)p.set('antes',cursor);query='?'+p;
 }
 const result=await api('/'+tab+query);cursor=result.cursor_proximo??null;$('#mais').hidden=!cursor;
 if(tab==='clientes'){clientes=result.data;$('#contexto').textContent='Organização: '+result.tenant_id;filiaisDetalhes=new Map((result.filiais_detalhes??[]).map(f=>[String(f.id),f]));if(!editorAberto)checkbox($('#filiais'),result.filiais,'filiais');const select=$('#filtros [name=cliente_id]');select.replaceChildren(new Option('Todas',''),...clientes.map(c=>new Option(c.nome,c.id)));renderizarClientes();}
 else if(tab==='metricas'){$('#resultado').replaceChildren();for(const k of ['amostras','falhas','limitadas','p50_ms','p95_ms','p99_ms']){const div=document.createElement('div');div.className='metrica';div.append(document.createTextNode(k));const value=document.createElement('strong');value.textContent=result[k]===null?'Sem dados':String(typeof result[k]==='number'?Math.round(result[k]*100)/100:result[k]);div.append(value);$('#resultado').append(div);}}
 else tabela(result.data);
}
function operar(fn){return async e=>{e?.preventDefault();const button=e?.submitter;if(button)button.disabled=true;try{await fn(e);}catch(err){if($('#revogar-dialog').open)$('#revogar-erro').textContent=err.message;aviso(err.message,true);}finally{if(button)button.disabled=false;}};}
function limparCadastro(){clearTimeout(cadastroTimer);cadastroTimer=null;cadastro=null;$('#cadastro-chave').value='';$('#cadastro-chave').type='password';$('#mostrar-chave').textContent='Mostrar chave';$('#cadastro-app').removeAttribute('href');$('#cadastro-confirmar').reset();const canvas=$('#cadastro-qr');canvas.width=0;canvas.height=0;}
function desenharQr(uri){const qr=qrcode(0,'M');qr.addData(uri,'Byte');qr.make();const n=qr.getModuleCount(),canvas=$('#cadastro-qr'),escala=4,margem=4;canvas.width=canvas.height=(n+margem*2)*escala;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))ctx.fillRect((c+margem)*escala,(r+margem)*escala,escala,escala);}
$('#login').onsubmit=operar(async()=>{limparCadastro();const f=new FormData($('#login')),result=await api('/login','POST',Object.fromEntries(f));bearer=result.token;$('#login [name=senha]').value='';$('#login').hidden=true;$('#sair').hidden=false;if(result.cadastro){cadastro=result.cadastro.desafio;$('#cadastro-chave').value=result.cadastro.chave;$('#cadastro-app').href=result.cadastro.otpauth_uri;desenharQr(result.cadastro.otpauth_uri);$('#cadastro').hidden=false;cadastroTimer=setTimeout(async()=>{limparCadastro();$('#cadastro').hidden=true;$('#login').hidden=false;await api('/logout','POST',{}).catch(()=>{});bearer=null;aviso('O prazo da configuração terminou. Entre novamente para continuar.',true);},result.cadastro.expires_in*1000);aviso('Escaneie o QR code no autenticador e confirme o código de seis dígitos.');}else{$('#mfa').hidden=false;aviso('Informe o código do autenticador.');}});
async function entrarConsole(result){limparCadastro();stepup=result.token;mfaAte=Date.now()+result.expires_in*1000;clearInterval(sessaoTimer);sessaoTimer=setInterval(atualizarSessao,1000);atualizarSessao();$('#mfa').reset();$('#cadastro').hidden=true;$('#acesso').hidden=true;$('#console').hidden=false;$('#sair').hidden=false;aviso('Autenticação forte validada.');tab='clientes';await carregar();if(rascunho){restaurarRascunho();}else if(location.hash==='#manual'){tab='manual';await carregar();}}
$('#mfa').onsubmit=operar(async()=>entrarConsole(await api('/step-up','POST',{codigo:$('#mfa [name=codigo]').value})));
$('#cadastro-confirmar').onsubmit=operar(async()=>entrarConsole(await api('/cadastro-confirmar','POST',{codigo:$('#cadastro-confirmar [name=codigo]').value},{'X-Integration-Enrollment':cadastro})));
$('#mostrar-chave').onclick=()=>{const key=$('#cadastro-chave');key.type=key.type==='password'?'text':'password';$('#mostrar-chave').textContent=key.type==='password'?'Mostrar chave':'Ocultar chave';};
$('#cliente').onsubmit=operar(async()=>{const f=$('#cliente'),form=new FormData(f),id=form.get('id'),body={nome:form.get('nome'),ambiente:f.elements.ambiente.value,estado:form.get('estado'),finalidade:form.get('finalidade'),escopos:form.getAll('escopos'),filiais:form.getAll('filiais'),hosts:String(form.get('hosts')).split('\n').map(s=>s.trim().toLowerCase()).filter(Boolean),motivo:form.get('motivo')};await api('/clientes'+(id?'/'+id:''),id?'PUT':'POST',body,id?{'If-Match':'"'+id+':'+form.get('versao')+'"'}:{});novo();await carregar();aviso('Concessão salva e auditada.');});
$('#chave').onsubmit=operar(async()=>{if(!selecionado)return;const form=new FormData($('#chave'));await api('/clientes/'+selecionado.id+'/chaves/'+encodeURIComponent(form.get('kid')),'PUT',{public_key:form.get('public_key'),ativa:form.get('ativa')==='true',valida_ate:new Date(form.get('valida_ate')).toISOString(),motivo:form.get('motivo')},{'If-Match':'"'+selecionado.id+':'+selecionado.versao+'"'});novo();await carregar();aviso('Chave pública salva e auditada.');});
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=operar(async()=>{aviso('');tab=b.dataset.tab;cursor=null;await carregar();});
$('#atualizar').onclick=operar(()=>{aviso('');return carregar();});$('#filtros').onsubmit=operar(()=>carregar());$('#mais').onclick=operar(()=>carregar(true));$('#novo').onclick=()=>novo(true);$('#sair').onclick=operar(async()=>{clearInterval(sessaoTimer);rascunho=null;limparRevogacao();limparCadastro();await api('/logout','POST',{});bearer=null;stepup=null;location.reload();});
checkbox($('#escopos'),scopes,'escopos');$('#filtros [name=inicio]').value=dataLocal(new Date(Date.now()-3600000));$('#filtros [name=fim]').value=dataLocal(new Date());

$('#criar-integracao').onclick=()=>novo(true);
$('#fechar-editor').onclick=()=>{novo();renderizarClientes();$('#consulta').scrollIntoView({behavior:'smooth'});$('#criar-integracao').focus({preventScroll:true});};
$('#buscar-cliente').oninput=renderizarClientes;$('#estado-clientes').onchange=renderizarClientes;
$('#buscar-filial').oninput=filtrarFiliais;$('#filiais').onchange=atualizarSelecaoFiliais;
$('#adicionar-chave').onclick=()=>mostrarFormChave($('#form-chave').hidden);
$('#cancelar-chave').onclick=()=>{mostrarFormChave(false);$('#chave').reset();$('#adicionar-chave').focus();};
$('#copiar-client-id').onclick=operar(async()=>{if(selecionado){await navigator.clipboard.writeText(selecionado.client_id);aviso('Identificador da aplicação copiado.');}});
$('#renovar-mfa').onclick=()=>{solicitarMfa();aviso('Informe um código atual do autenticador. Seus campos serão preservados.');};
