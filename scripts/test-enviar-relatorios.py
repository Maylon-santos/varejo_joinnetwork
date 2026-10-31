import importlib.util
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, MagicMock

spec=importlib.util.spec_from_file_location('envio',Path(__file__).with_name('enviar-relatorios.py'))
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class EnvioTest(unittest.TestCase):
    def setUp(self):
        Path('artifacts/exportacoes-csv').mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir='artifacts/exportacoes-csv')
        self.pasta=Path(self.temp.name)
        raw=b'data;valor\r\n2026-10-01;1.00\r\n'
        (self.pasta/'teste.csv').write_bytes(raw)
        (self.pasta/'manifesto.json').write_text(json.dumps({'inicio':'2026-10-01','fim':'2026-10-20','avisos':['Aviso de teste'],'arquivos':[{'arquivo':'teste.csv','sha256':hashlib.sha256(raw).hexdigest()}]}))
        self.env=patch.dict(os.environ,{'RELATORIOS_EMAIL_DESTINO':'destino@example.com','RELATORIOS_EMAIL_REMETENTE':'origem@example.com','RELATORIOS_SMTP_HOST':'smtp.example.com','RELATORIOS_SMTP_USUARIO':'usuario_teste','RELATORIOS_SMTP_SENHA':'senha_sintetica'})
        self.env.start()
    def tearDown(self):
        self.env.stop();self.temp.cleanup()
    def test_envia_apenas_ao_destinatario_e_marca_aceite(self):
        smtp=MagicMock();smtp.send_message.return_value={}
        with patch.object(mod.smtplib,'SMTP') as ctor:
            ctor.return_value.__enter__.return_value=smtp
            mod.enviar(self.pasta)
        msg=smtp.send_message.call_args.args[0]
        self.assertEqual(smtp.send_message.call_args.kwargs['to_addrs'],['destino@example.com'])
        self.assertIsNone(msg['Cc']);self.assertIsNone(msg['Bcc'])
        self.assertEqual(len(list(msg.iter_attachments())),1)
        smtp.starttls.assert_called_once()
        self.assertTrue((self.pasta/'ENVIADO.json').exists())
        with self.assertRaisesRegex(ValueError,'LOTE_JA_ENVIADO'):mod.enviar(self.pasta)
    def test_recusa_multiplos_destinatarios_e_arquivos_alterados(self):
        with patch.object(mod.smtplib,'SMTP') as smtp:
            with patch.dict(os.environ,{'RELATORIOS_EMAIL_DESTINO':'a@example.com,b@example.com'}):
                with self.assertRaisesRegex(ValueError,'EMAIL_UNICO'):mod.enviar(self.pasta)
            (self.pasta/'teste.csv').write_text('alterado')
            with self.assertRaisesRegex(ValueError,'CHECKSUM_INVALIDO'):mod.enviar(self.pasta)
            smtp.assert_not_called()
    def test_falha_smtp_nao_marca_como_enviado(self):
        with patch.object(mod.smtplib,'SMTP',side_effect=OSError('erro sintetico')):
            with self.assertRaises(OSError):mod.enviar(self.pasta)
        self.assertFalse((self.pasta/'ENVIADO.json').exists())

if __name__=='__main__':unittest.main()
