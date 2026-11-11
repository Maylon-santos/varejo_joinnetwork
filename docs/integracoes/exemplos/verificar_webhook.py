"""Verificação de referência. Não substitui a inbox transacional do consumidor."""
import base64
import hashlib
import hmac
import json
import re
import time

def verificar_webhook(body, headers, secret, filiais=(), agora=None):
    agora=int(time.time() if agora is None else agora)
    if not isinstance(body,bytes) or len(body)>65536:
        raise ValueError('CORPO_INVALIDO')
    event_id=headers.get('webhook-id','')
    timestamp=headers.get('webhook-timestamp','')
    if not re.fullmatch(r'[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}',event_id):
        raise ValueError('ID_INVALIDO')
    if not re.fullmatch(r'\d{1,12}',timestamp) or abs(agora-int(timestamp))>300:
        raise ValueError('TIMESTAMP_INVALIDO')
    if not re.fullmatch(r'whsec_[A-Za-z0-9+/]{43}=',secret):
        raise ValueError('CHAVE_INVALIDA')
    key=base64.b64decode(secret[6:],validate=True)
    if len(key)!=32 or base64.b64encode(key).decode()!=secret[6:]:
        raise ValueError('CHAVE_INVALIDA')
    message=(event_id+'.'+timestamp+'.').encode()+body
    expected=hmac.new(key,message,hashlib.sha256).digest()
    signatures=headers.get('webhook-signature','')
    if not isinstance(signatures,str) or len(signatures)>1024:
        raise ValueError('ASSINATURA_INVALIDA')
    valid=False
    for entry in signatures.split():
        if re.fullmatch(r'v1,[A-Za-z0-9+/]{43}=',entry):
            received=base64.b64decode(entry[3:],validate=True)
            valid |= len(received)==len(expected) and hmac.compare_digest(received,expected)
    if not valid:
        raise ValueError('ASSINATURA_INVALIDA')
    event=json.loads(body)
    if not isinstance(event,dict) or event.get('id')!=event_id or event.get('schema_version')!='1.0':
        raise ValueError('EVENTO_INVALIDO')
    if event.get('tipo') not in ['venda.importada','venda.atualizada','venda.cancelada','webhook.teste']:
        raise ValueError('EVENTO_INVALIDO')
    if event['tipo']!='webhook.teste' and (event.get('data',{}).get('filial_id') not in filiais or event.get('data',{}).get('tipo_operacao')!='S'):
        raise ValueError('FILIAL_OU_TIPO_INVALIDO')
    return event
