export function validarDestinoTalk({url,token,numero}){
 if(url!=='https://apitalk.joinnetwork.com.br/api/messages/send'||!token||!/^[1-9][0-9]{9,14}$/.test(numero??''))throw Error('TALK_CONFIGURACAO_INVALIDA');
}
export async function enviarArquivoTalk({url,token,numero,nome,bytes,legenda,fetchImpl=fetch}){
 validarDestinoTalk({url,token,numero});
 if(!/^[a-z0-9_-]+\.csv$/.test(nome)||!bytes?.byteLength||bytes.byteLength>16*1024*1024)throw Error('TALK_ARQUIVO_INVALIDO');
 const form=new FormData();form.set('number',numero);form.set('body',legenda);
 form.set('medias',new Blob([bytes],{type:'text/csv;charset=utf-8'}),nome);
 const r=await fetchImpl(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},body:form,redirect:'error',signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Error('TALK_HTTP_'+r.status);
 if(r.headers.get('content-type')?.includes('application/json')){
  let resposta;try{resposta=await r.json();}catch{throw Error('TALK_RESPOSTA_INDETERMINADA');}
  if(resposta?.success===false||resposta?.error)throw Error('TALK_ENVIO_RECUSADO');
 }
 return {aceito_api:true,http_status:r.status};
}
