"""Exemplo do contrato proposto. Requer PyJWT[crypto]; não é credencial de produção."""
import os
import sys
import time
import uuid
from pathlib import Path
import jwt

def gerar_assertion(client_id, kid, chave_privada_pem, agora=None):
    agora=int(time.time() if agora is None else agora)
    return jwt.encode({'iss':client_id,'sub':client_id,
        'aud':'https://api-varejo.aeropostale.joinnetwork.com.br/oauth/token',
        'iat':agora,'exp':agora+60,'jti':str(uuid.uuid4())},
        chave_privada_pem,algorithm='RS256',headers={'kid':kid,'typ':'JWT'})

if __name__=='__main__':
    try:
        # A privada deve permanecer num cofre/arquivo restrito do integrador.
        chave=Path(os.environ['PRIVATE_KEY_FILE']).read_bytes()
        print(gerar_assertion(os.environ['CLIENT_ID'],os.environ['KEY_ID'],chave))
    except Exception:
        print('Não foi possível gerar a prova; confira dependências e configuração local.',file=sys.stderr)
        sys.exit(1)
