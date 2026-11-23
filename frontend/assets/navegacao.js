// O mesmo nav é usado na barra lateral e no diálogo móvel: permissões e página
// ativa continuam controladas pelo painel, sem duplicar links ou identificadores.
export function criarNavegacaoMovel({app,nav,dialogo,conteudo,abrir,fechar,voltar,main}){
 const mobile=matchMedia('(max-width: 760px)');
 const origem=document.createComment('Posição da navegação no computador');
 nav.after(origem);
 let focarConteudo=false;
 function encerrar({conteudo=false}={}){
  focarConteudo=conteudo;
  if(dialogo.open)dialogo.close();
 }
 abrir.addEventListener('click',()=>{
  if(!mobile.matches||app.hidden||dialogo.open)return;
  conteudo.append(nav);
  dialogo.showModal();
  abrir.setAttribute('aria-expanded','true');
  document.body.classList.add('mobile-menu-open');
  nav.querySelector('[aria-current="page"]')?.scrollIntoView({block:'nearest'});
 });
 fechar.addEventListener('click',()=>encerrar());
 voltar.addEventListener('click',()=>encerrar());
 dialogo.addEventListener('cancel',()=>{focarConteudo=false;});
 dialogo.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controles=[...dialogo.querySelectorAll('button:not([disabled]),a[href]')].filter(n=>n.getClientRects().length);
  const primeiro=controles[0],ultimo=controles.at(-1);
  if((event.shiftKey&&document.activeElement===primeiro)||(!event.shiftKey&&document.activeElement===ultimo)){
   event.preventDefault();(event.shiftKey?ultimo:primeiro)?.focus();
  }
 });
 dialogo.addEventListener('click',event=>{
  if(event.target!==dialogo)return;
  const r=dialogo.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)encerrar();
 });
 nav.addEventListener('click',event=>{
  const alvo=event.target.closest('[data-page],a');
  if(alvo&&dialogo.open)encerrar({conteudo:alvo.hasAttribute('data-page')});
 });
 dialogo.addEventListener('close',()=>{
  origem.before(nav);
  abrir.setAttribute('aria-expanded','false');
  document.body.classList.remove('mobile-menu-open');
  if(!app.hidden&&mobile.matches){
   if(focarConteudo)window.scrollTo({top:0,behavior:'instant'});
   (focarConteudo?main:abrir).focus({preventScroll:true});
  }
  focarConteudo=false;
 });
 mobile.addEventListener('change',()=>{if(!mobile.matches)encerrar();});
 return {fechar:encerrar};
}
