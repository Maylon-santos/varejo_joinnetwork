"""Entrega SMTP de um lote já validado, para um único destinatário configurado."""
import json
import os
import re
import smtplib
import ssl
import sys
from email.message import EmailMessage
from pathlib import Path
import hashlib

def enviar(pasta):
    raiz=Path('artifacts/exportacoes-csv').resolve()
    pasta=Path(pasta).resolve()
    if raiz not in pasta.parents:
        raise ValueError('PASTA_FORA_DO_ESCOPO')
    destino=os.environ.get('RELATORIOS_EMAIL_DESTINO','')
    remetente=os.environ.get('RELATORIOS_EMAIL_REMETENTE','')
    for email in [destino,remetente]:
        if not re.fullmatch(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',email):
            raise ValueError('EMAIL_UNICO_NAO_CONFIGURADO')
    host=os.environ.get('RELATORIOS_SMTP_HOST')
    usuario=os.environ.get('RELATORIOS_SMTP_USUARIO')
    senha=os.environ.get('RELATORIOS_SMTP_SENHA')
    if not host or not usuario or not senha:
        raise ValueError('REMETENTE_SMTP_NAO_CONFIGURADO')
    manifesto=json.loads((pasta/'manifesto.json').read_text())
    if (pasta/'ENVIADO.json').exists():
        raise ValueError('LOTE_JA_ENVIADO')
    msg=EmailMessage()
    msg['From']=remetente;msg['To']=destino
    msg['Subject']=f"Aeropostale — CSV {manifesto['inicio']} a {manifesto['fim']}"
    msg.set_content('Relatórios em CSV UTF-8, separador ;, datas AAAA-MM-DD e valores em BRL com ponto decimal.\n\n'+'\n\n'.join(manifesto['avisos']))
    for item in manifesto['arquivos']:
        nome=item['arquivo']
        if Path(nome).name!=nome or not nome.endswith('.csv'):
            raise ValueError('ARQUIVO_INVALIDO')
        raw=(pasta/nome).read_bytes()
        if hashlib.sha256(raw).hexdigest()!=item['sha256']:
            raise ValueError('CHECKSUM_INVALIDO')
        msg.add_attachment(raw,maintype='text',subtype='csv',filename=nome,params={'charset':'utf-8'})
    # TLS obrigatório; destinatários do envelope contêm exclusivamente o endereço configurado.
    with smtplib.SMTP(host,int(os.environ.get('RELATORIOS_SMTP_PORTA','587')),timeout=60) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        smtp.login(usuario,senha)
        recusados=smtp.send_message(msg,from_addr=remetente,to_addrs=[destino])
        if recusados:
            raise ValueError('DESTINATARIO_RECUSADO')
    with (pasta/'ENVIADO.json').open('x') as f:
        json.dump({'inicio':manifesto['inicio'],'fim':manifesto['fim'],'aceito_smtp':True},f)

if __name__=='__main__':
    os.umask(0o077)
    try:
        if len(sys.argv)!=2:raise ValueError('INFORME_PASTA_DO_LOTE')
        enviar(sys.argv[1])
        print('RELATORIOS_ACEITOS_SMTP')
    except Exception as exc:
        codigo=str(exc) if isinstance(exc,ValueError) else 'FALHA_ENVIO_SMTP'
        print(codigo if re.fullmatch(r'[A-Z_]+',codigo) else 'FALHA_ENVIO_SMTP',file=sys.stderr)
        sys.exit(1)
