const $=id=>document.getElementById(id);
function no(tag,text,classe){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(classe)n.className=classe;return n;}
const erros={NOTIFICACOES_NAO_LIBERADAS:'As notificações ainda não estão liberadas para sua conta.',NOTIFICACOES_PREFERENCIAS_INVALIDAS:'Confira as filiais selecionadas.',FILIAL_OBRIGATORIA:'Selecione pelo menos uma filial para receber o resumo.',PUSH_APARELHO_OUTRA_CONTA:'Este aparelho está vinculado a outra conta. Toque em Ativar neste aparelho para trocar o vínculo.',PUSH_LIMITE_APARELHOS:'Você já possui três aparelhos ativos. Desative um deles antes de cadastrar outro.',PUSH_TESTE_AGUARDE:'Aguarde um minuto antes de solicitar outro teste.',PUSH_APARELHO_INVALIDO:'Ative novamente as notificações neste aparelho.',PUSH_INSCRICAO_INVALIDA:'Não foi possível cadastrar este aparelho. Desative e tente novamente.'};
export function criarNotificacoesUI({api,ativo,abrirDestino}){
 let versao=0,estado=null,aparelho=null,registration=null,branches=[],timer=null,instalar=null,registroPromise=null;
 const suporta=()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const iphone=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 const instalado=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const nome=()=>iphone()?'iPhone / iPad':/Android/.test(navigator.userAgent)?'Celular Android':'Navegador do computador';
 const chaveIgual=sub=>!sub.options?.applicationServerKey||btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')===estado?.chave_publica;
 function mensagem(text,erro=false){$('notifications-status').textContent=text;$('notifications-status').className='notification-status'+(erro?' is-error':'');}
 function falha(e){const raw=e.codigo||e.message;mensagem(erros[raw]||e.message||'Não foi possível concluir. Tente novamente.',true);}
 function controles(ocupado=false){
  $('notifications-enable').disabled=ocupado||!registration||!estado?.disponivel||!suporta()||iphone()&&!instalado()||Notification.permission==='denied';
  $('notifications-test').disabled=ocupado||!aparelho;$('notifications-stop').disabled=ocupado||!aparelho;$('notifications-save').disabled=ocupado||!estado?.disponivel;
 }
 function mostrarAparelho(){
  $('notifications-device-state').textContent=aparelho?'Ativado neste aparelho':'Não ativado neste aparelho';
  $('notifications-device-state').className='notification-badge'+(aparelho?' is-on':'');
  $('notifications-enable').textContent=aparelho?'Reconectar aparelho':'Ativar neste aparelho';
  $('notifications-install-help').hidden=instalado();
  $('notifications-permission-help').textContent=!suporta()?'Este navegador não oferece notificações. No iPhone, use iOS 16.4 ou superior e abra pelo ícone da Tela de Início.':iphone()&&!instalado()?'No iPhone, instale primeiro na Tela de Início e abra pelo novo ícone.':Notification.permission==='denied'?'As notificações estão bloqueadas. Libere nas configurações do aparelho e abra o aplicativo novamente.':aparelho?'Avisos podem chegar mesmo com o painel fechado. Ao sair da conta, este aparelho é desativado.':'A ativação pede sua autorização no aparelho. Você escolhe abaixo se deseja o resumo diário.';
  controles();
 }
 function desenhar(){
  const p=estado.preferencias;$('notifications-daily').checked=p.resumo_diario;
  const escolhidas=p.filiais.length?p.filiais:[branches.find(b=>b.filial==='30098297')?.filial||branches[0]?.filial];
  $('notifications-branches').replaceChildren();for(const b of branches){const label=no('label',null,'notification-branch'),c=no('input');c.type='checkbox';c.name='filial';c.value=b.filial;c.checked=escolhidas.includes(b.filial);const copy=no('span');copy.append(no('strong',b.fantasia||b.cod_filial||'Filial '+b.filial),no('small',b.fantasia?b.cod_filial||b.filial:b.filial));label.append(c,copy);$('notifications-branches').append(label);}
  $('notifications-device-list').replaceChildren();for(const d of estado.dispositivos){const row=no('div',null,'notification-device-row'),copy=no('div');copy.append(no('strong',d.nome),no('small',d.id===aparelho?'Este aparelho':'Aparelho autorizado'));const button=no('button','Desativar','button subtle');button.type='button';button.addEventListener('click',()=>desativar(d.id));row.append(copy,button);$('notifications-device-list').append(row);}
  mostrarAparelho();
 }
 async function carregar({reconectar=false}={}){
  const v=versao;const d=await api('/notificacoes');if(v!==versao)return;estado=d;if(!d.disponivel){mensagem('As notificações ainda não estão liberadas para sua conta.');controles();return;}
  if(reconectar&&registration&&suporta()&&Notification.permission==='granted'){
   const sub=await registration.pushManager.getSubscription();if(v!==versao)return;
   if(sub&&chaveIgual(sub)){try{const r=await api('/notificacoes/dispositivos',{method:'POST',body:JSON.stringify({inscricao:sub.toJSON(),nome:nome()})});if(v!==versao)return;aparelho=r.id;estado=await api('/notificacoes');}catch(e){if(v!==versao)return;falha(e);}}
  }
  if(v!==versao)return;desenhar();await historico();
 }
 async function historico(){
  if(!estado?.disponivel)return;const v=versao,d=await api('/notificacoes/historico');if(v!==versao)return;
  const list=$('notifications-history');list.replaceChildren();
  if(!d.entregas.length){list.append(no('p','Seus testes e resumos aparecerão aqui.','muted'));return;}
  const status={pendente:'Na fila de envio',enviando:'Enviando',aceita:'Aceito pelo serviço de notificações',incerta:'Entrega sem confirmação',falha:'Não enviado',cancelada:'Cancelado',expirada:'Prazo de envio encerrado'};
  for(const r of d.entregas){const card=no('article',null,'notification-history-item');const top=no('div',null,'notification-history-heading');top.append(no('strong',r.titulo),no('span',status[r.estado]||r.estado,'notification-badge'));card.append(top,no('p',r.texto),no('small',new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(r.criado_em))));list.append(card);}
 }
 $('notifications-enable').addEventListener('click',async()=>{
  if(!registration||!estado?.disponivel)return;const v=versao;controles(true);mensagem('Aguardando a autorização deste aparelho…');
  try{
   // subscribe é chamado diretamente pelo toque, como exigido pelo Safari.
   const key=Uint8Array.from(atob(estado.chave_publica.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
   let sub;try{sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});}catch(e){if(e.name!=='InvalidStateError')throw e;const antiga=await registration.pushManager.getSubscription();await antiga?.unsubscribe();sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});}if(v!==versao){await sub.unsubscribe();return;}
   let r;try{r=await api('/notificacoes/dispositivos',{method:'POST',body:JSON.stringify({inscricao:sub.toJSON(),nome:nome()})});}catch(e){if(e.codigo!=='PUSH_APARELHO_OUTRA_CONTA')throw e;await sub.unsubscribe();sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});r=await api('/notificacoes/dispositivos',{method:'POST',body:JSON.stringify({inscricao:sub.toJSON(),nome:nome()})});}
   if(v!==versao){await sub.unsubscribe();return;}aparelho=r.id;await carregar();mensagem('Aparelho ativado. Envie um teste e escolha abaixo suas preferências.');
  }catch(e){if(v!==versao)return;if(e.name==='NotAllowedError')mensagem('A autorização não foi concedida. Você pode tentar novamente nas configurações do aparelho.',true);else falha(e);}
  finally{if(v===versao)mostrarAparelho();}
 });
 async function desativar(id){
  const v=versao;controles(true);try{await api('/notificacoes/dispositivos/'+id,{method:'DELETE'});if(v!==versao)return;if(id===aparelho){const sub=await registration?.pushManager.getSubscription();await sub?.unsubscribe();aparelho=null;for(const n of await registration?.getNotifications()||[])n.close();}await carregar();mensagem('Aparelho desativado. Nenhum novo aviso será enviado para ele.');}catch(e){if(v===versao)falha(e);}finally{if(v===versao)controles();}
 }
 $('notifications-stop').addEventListener('click',()=>{if(aparelho)desativar(aparelho);});
 $('notifications-test').addEventListener('click',async()=>{
  const v=versao;controles(true);try{await api('/notificacoes/teste',{method:'POST',body:JSON.stringify({dispositivo:aparelho,requisicao:crypto.randomUUID()})});if(v!==versao)return;mensagem('Teste solicitado. O aviso pode levar até um minuto. Confira também a tela bloqueada.');await historico();clearTimeout(timer);timer=setTimeout(()=>{if(ativo())historico().catch(falha);},15000);}catch(e){if(v===versao)falha(e);}finally{if(v===versao)controles();}
 });
 $('notifications-preferences').addEventListener('submit',async e=>{
  e.preventDefault();const v=versao;controles(true);const filiais=[...$('notifications-branches').querySelectorAll('input:checked')].map(c=>c.value);
  try{await api('/notificacoes/preferencias',{method:'PUT',body:JSON.stringify({resumo_diario:$('notifications-daily').checked,filiais})});if(v!==versao)return;await carregar();mensagem(estado.preferencias.resumo_diario?'Preferências salvas. Resumo diário a partir das 22h05, no horário de São Paulo.':'Resumo diário desativado. Você pode ativá-lo quando quiser.');}catch(e){if(v===versao)falha(e);}finally{if(v===versao)controles();}
 });
 $('notifications-refresh').addEventListener('click',()=>carregar().catch(falha));
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();instalar=e;$('notifications-install').hidden=false;});
 $('notifications-install').addEventListener('click',async()=>{if(instalar){await instalar.prompt();instalar=null;}else $('notifications-install-steps').hidden=!$('notifications-install-steps').hidden;});
 window.addEventListener('appinstalled',mostrarAparelho);
 if('serviceWorker' in navigator){registroPromise=navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(async r=>{registration=r;await navigator.serviceWorker.ready;mostrarAparelho();return r;}).catch(()=>{mensagem('Não foi possível preparar a instalação. Atualize a página e tente novamente.',true);});navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.tipo==='abrir-notificacao')abrirDestino(e.data.url);});}
 return {
  iniciar:async itens=>{const v=++versao;estado=null;aparelho=null;branches=itens;mensagem('');await registroPromise;if(v!==versao)return;await carregar({reconectar:true});},
  abrir:()=>carregar().catch(falha),
  limpar:()=>{versao++;clearTimeout(timer);estado=null;aparelho=null;branches=[];for(const id of ['notifications-branches','notifications-device-list','notifications-history'])$(id).replaceChildren();mensagem('');controles();},
  desconectar:async()=>{if(registration){const sub=await registration.pushManager.getSubscription();await sub?.unsubscribe();for(const n of await registration.getNotifications())n.close();}},
 };
}
