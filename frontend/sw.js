// Sem cache offline, interceptação de API, tokens ou dados pessoais.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
function destino(value){
 try{const u=new URL(value,self.location.origin);if(u.origin===self.location.origin&&u.pathname==='/')return u.href;}catch{}
 return self.location.origin+'/?origem=notificacoes';
}
self.addEventListener('push',event=>{
 let p={};try{p=event.data?.json()||{};}catch{}
 const title=typeof p.title==='string'?p.title.slice(0,180):'Aéropostale',body=typeof p.body==='string'?p.body.slice(0,700):'Você tem uma nova notificação. Abra o painel para consultar.';
 const tag=typeof p.tag==='string'&&/^[a-f0-9]{32}$/.test(p.tag)?'aero-'+p.tag:undefined;
 event.waitUntil(self.registration.showNotification(title,{body,icon:'/assets/app-icon-192.png',badge:'/assets/app-icon-192.png',tag,renotify:false,data:{url:destino(p.url)}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=destino(event.notification.data?.url);
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const app=windows.find(c=>{const u=new URL(c.url);return u.origin===self.location.origin&&u.pathname==='/';});
  if(app){app.postMessage({tipo:'abrir-notificacao',url});await app.focus();}else await self.clients.openWindow(url);
 })());
});
