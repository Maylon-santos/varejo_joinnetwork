// Exemplo independente, sem dependências. Não implementa inbox ou endpoint HTTP.
import {createHmac,timingSafeEqual} from 'node:crypto';
export function verificarWebhook({body,headers,secret,filiais=[],agora=Math.floor(Date.now()/1000)}){
 if(!Buffer.isBuffer(body)||body.length>65536)throw Error('CORPO_INVALIDO');
 const id=headers['webhook-id'],timestamp=headers['webhook-timestamp'],signatures=headers['webhook-signature'];
 if(typeof id!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))throw Error('ID_INVALIDO');
 if(typeof timestamp!=='string'||!/^\d{1,12}$/.test(timestamp)||Math.abs(agora-Number(timestamp))>300)throw Error('TIMESTAMP_INVALIDO');
 if(typeof secret!=='string'||!/^whsec_[A-Za-z0-9+/]{43}=$/.test(secret))throw Error('CHAVE_INVALIDA');
 const encoded=secret.slice(6),key=Buffer.from(encoded,'base64');
 if(key.length!==32||key.toString('base64')!==encoded)throw Error('CHAVE_INVALIDA');
 const expected=createHmac('sha256',key).update(`${id}.${timestamp}.`,'utf8').update(body).digest();
 if(typeof signatures!=='string'||signatures.length>1024)throw Error('ASSINATURA_INVALIDA');
 const valid=signatures.trim().split(/\s+/).some(s=>{
  if(!/^v1,[A-Za-z0-9+/]{43}=$/.test(s))return false;
  const received=Buffer.from(s.slice(3),'base64');
  return received.length===expected.length&&timingSafeEqual(expected,received);
 });
 if(!valid)throw Error('ASSINATURA_INVALIDA');
 const event=JSON.parse(body.toString('utf8'));
 if(!event||Array.isArray(event)||event.id!==id||event.schema_version!=='1.0')throw Error('EVENTO_INVALIDO');
 if(!['venda.importada','venda.atualizada','venda.cancelada','webhook.teste'].includes(event.tipo))throw Error('EVENTO_INVALIDO');
 if(event.tipo!=='webhook.teste'&&(!filiais.includes(event.data?.filial_id)||event.data?.tipo_operacao!=='S'))throw Error('FILIAL_OU_TIPO_INVALIDO');
 // Validar o schema completo e persistir inbox+trabalho durável antes do 2xx.
 return event;
}
