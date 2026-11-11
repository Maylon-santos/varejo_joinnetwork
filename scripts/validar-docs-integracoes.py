#!/usr/bin/env python3
"""Validação documental e dos exemplos; sem tocar banco, credenciais ou rede."""
from pathlib import Path
from html.parser import HTMLParser
import base64
import datetime
import hashlib
import hmac
import importlib.util
import json
import re
import subprocess
import time
from openapi_spec_validator import validate
from jsonschema import Draft202012Validator,FormatChecker
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

ROOT=Path(__file__).resolve().parents[1]
DOC=ROOT/'docs/integracoes'
spec=json.loads((ROOT/'apis/integracoes.openapi.json').read_text())
validate(spec)
manifest=json.loads((DOC/'exemplos/manifesto.json').read_text())
for filename,name in manifest.items():
    schema={'$ref':'#/components/schemas/'+name,'components':spec['components']}
    Draft202012Validator(schema,format_checker=FormatChecker()).validate(json.loads((DOC/'exemplos'/filename).read_text()))

class Portal(HTMLParser):
    def __init__(self):super().__init__();self.ids=set();self.links=[];self.duplicate=[];self.external_assets=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:
            if a['id'] in self.ids:self.duplicate.append(a['id'])
            self.ids.add(a['id'])
        if tag=='a' and 'href' in a:self.links.append(a['href'])
        if tag in ['script','img','link']:
            url=a.get('src',a.get('href',''))
            if url.startswith(('http:','https:','//')):self.external_assets.append(url)

portal=Portal();portal.feed((DOC/'index.html').read_text())
assert not portal.duplicate,portal.duplicate
assert not portal.external_assets
for href in portal.links:
    if href.startswith('#'):assert href[1:] in portal.ids,href
    elif not re.match(r'^[a-z]+:',href):assert (DOC/href.split('#')[0]).exists(),href
for path in DOC.glob('*.md'):
    assert path.read_text().count('```')%2==0,path.name
    for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)',path.read_text()):
        if not target.startswith(('#','https:','http:')):assert (path.parent/target.split('#')[0]).exists(),(path.name,target)

def load(name,path):
    module_spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(module_spec);module_spec.loader.exec_module(module);return module

verify=load('webhook_example',DOC/'exemplos/verificar_webhook.py').verificar_webhook
body=(DOC/'exemplos/webhook-venda.json').read_bytes();event=json.loads(body);now=1794398400
key=bytes(32);secret='whsec_'+base64.b64encode(key).decode()
signature='v1,'+base64.b64encode(hmac.new(key,(event['id']+'.'+str(now)+'.').encode()+body,hashlib.sha256).digest()).decode()
headers={'webhook-id':event['id'],'webhook-timestamp':str(now),'webhook-signature':signature}
assert verify(body,headers,secret,['1001'],agora=now)==event
assert verify(body,{**headers,'webhook-signature':'v1,'+base64.b64encode(bytes([1])*32).decode()+' '+signature},secret,['1001'],agora=now)==event
for invalid_body,invalid_headers,branches,clock in [
    (body+b'\n',headers,['1001'],now),(body,headers,['1002'],now),
    (body,headers,['1001'],now-301),(body,headers,['1001'],now+301),
    (bytes(65537),headers,['1001'],now)]:
    try:verify(invalid_body,invalid_headers,secret,branches,agora=clock)
    except ValueError:pass
    else:raise AssertionError('Exemplo Python aceitou webhook inválido')

private=rsa.generate_private_key(public_exponent=65537,key_size=2048)
pem=private.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption())
generate=load('assertion_example',DOC/'exemplos/gerar_assertion.py').gerar_assertion
clock=int(time.time());client='cliente-demonstrativo-documentacao';kid='chave-sintetica'
proof=generate(client,kid,pem,agora=clock)
claims=jwt.decode(proof,private.public_key(),algorithms=['RS256'],audience='https://api-varejo.aeropostale.joinnetwork.com.br/oauth/token',issuer=client,options={'require':['iss','sub','aud','iat','exp','jti']})
assert claims['sub']==client and claims['exp']-claims['iat']==60
assert jwt.get_unverified_header(proof)['kid']==kid
assert jwt.decode(generate(client,kid,pem,agora=clock),private.public_key(),algorithms=['RS256'],audience=claims['aud'])['jti']!=claims['jti']

node=json.loads(subprocess.check_output(['node','scripts/validar-exemplos-integracoes.mjs'],cwd=ROOT,text=True))
assert all(node.values())
# Vetor gerado em Python e verificado no exemplo Node: interoperabilidade dos bytes.
js="""import {verificarWebhook} from './docs/integracoes/exemplos/verificar-webhook.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;
const v=JSON.parse(input);verificarWebhook({body:Buffer.from(v.body,'base64'),headers:v.headers,secret:v.secret,agora:v.now,filiais:['1001']});"""
subprocess.run(['node','--input-type=module','-e',js],cwd=ROOT,input=json.dumps({'body':base64.b64encode(body).decode(),'headers':headers,'secret':secret,'now':now}),text=True,check=True)

report={'verificadoEm':datetime.datetime.now(datetime.timezone.utc).isoformat(),'escopo':'documentação e exemplos sintéticos, sem implementar serviço',
 'openapiValido':True,'schemas':len(spec['components']['schemas']),'camposDocumentados':sum(len(x.get('properties',{})) for x in spec['components']['schemas'].values()),
 'operacoes':sum(len(x) for x in spec['paths'].values()),'exemplosJSONValidados':len(manifest),'linksLocaisEAncorasValidos':True,'portalSemDependenciasRemotas':True,
 'assinaturaPython':True,'provaJWTAssinadaEVerificada':True,'jtiUnico':True,'interoperabilidadePythonNode':True,'node':node,'apiExternaImplementada':False,'webhookAtivado':False,'producaoAlterada':False}
(ROOT/'docs/validacao-documentacao-integracoes.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
