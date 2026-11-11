// Adaptador de referência para o CONTRATO PROPOSTO. Não executa chamadas ao importar.
// persistirPagina deve salvar dados/revisões e cursor atomicamente no seu banco.
export async function consumirAlteracoes({baseUrl,obterToken,filial,recurso,cursor,
 persistirPagina,fetchImpl=fetch,esperar=ms=>new Promise(r=>setTimeout(r,ms)),maxPaginas=100}){
 if(!cursor||typeof persistirPagina!=='function'||typeof obterToken!=='function')throw Error('ADAPTADORES_OBRIGATORIOS');
 const base=new URL(baseUrl);if(base.protocol!=='https:')throw Error('HTTPS_OBRIGATORIO');
 let checkpoint=cursor;
 for(let pagina=0;pagina<maxPaginas;pagina++){
  let body,renovar=false,renovou=false;
  for(let tentativa=0;tentativa<5;tentativa++){
   const token=await obterToken({renovar});renovar=false;
   const url=new URL('/v1/alteracoes',base);
   url.search=new URLSearchParams({filial_id:filial,recurso,cursor:checkpoint,limite:'100'});
   const r=await fetchImpl(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
   if(r.ok){body=await r.json();break;}
   if(r.status===401&&!renovou){renovou=true;renovar=true;continue;}
   if(r.status===410)throw Error('REFAZER_BOOTSTRAP');
   if(r.status!==429&&r.status!==503)throw Error('HTTP_'+r.status);
   const after=r.headers.get('retry-after');
   const seconds=/^\d+$/.test(after??'')?Number(after):Math.min(60,2**tentativa);
   // Se a espera exigida for muito longa, devolva controle ao agendador.
   if(seconds>300)throw Error('REAGENDAR_APOS_RETRY_AFTER');
   await esperar(seconds*1000+Math.floor(Math.random()*500));
  }
  if(!body?.paginacao?.cursor_proximo||!Array.isArray(body.data))throw Error('RESPOSTA_OU_RETENTATIVA_INVALIDA');
  const proximo=body.paginacao.cursor_proximo;
  await persistirPagina({eventos:body.data,cursor:proximo});
  checkpoint=proximo;
  if(!body.paginacao.tem_mais)return {cursor:checkpoint,aguardarSegundos:60};
  // No máximo ~1 página/s por este exemplo; outras chamadas usam a mesma cota.
  await esperar(1100);
 }
 return {cursor:checkpoint,continuar:true};
}
