import hashlib
import importlib.util
from pathlib import Path
import io
import json
import tarfile
import tempfile
import unittest
spec = importlib.util.spec_from_file_location('receiver', Path(__file__).with_name('receber-backups-mac.py'))
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)

class Recebimento(unittest.TestCase):
    def test_origem_anterior_preservada_sem_configuracao(self):
        with tempfile.TemporaryDirectory() as temp:
            origem = receiver.origem_ssh(Path(temp))
            self.assertEqual((origem['host'], origem['port'], origem['known_hosts']), ('root@191.252.1.241', 22, 'locaweb-known-hosts'))
    def test_origem_hostgator_com_porta_e_identidade_proprias(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            config = {'host': 'root@143.95.219.212', 'port': 22022, 'known_hosts': 'hostgator-known-hosts', 'nome': 'hostgator'}
            (root / 'origem.json').write_text(json.dumps(config))
            self.assertEqual(receiver.origem_ssh(root), config)
    def test_origem_rejeita_opcoes_caminhos_e_porta_invalidos(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for config in [{'host': '-oProxyCommand=malicioso'}, {'known_hosts': '../outro'}, {'port': True}, {'port': 0}, {'port': 65536}, {'StrictHostKeyChecking': 'no'}]:
                with self.subTest(config=config):
                    (root / 'origem.json').write_text(json.dumps(config))
                    with self.assertRaises(ValueError): receiver.origem_ssh(root)
    def test_lote_validado_e_reexecucao(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); staging = root / 'staging'; staging.mkdir()
            archive = root / 'entrada.tar.gz'; name = 'backup-20260914T115644Z-TESTE'
            files = {'control.dump': b'control', 'tenant.dump': b'tenant', 'COMPLETE': b''}
            files['SHA256SUMS'] = ''.join(hashlib.sha256(files[f]).hexdigest() + '  ' + f + '\n' for f in ['control.dump','tenant.dump']).encode()
            with tarfile.open(archive, 'w:gz') as output:
                for f, data in files.items():
                    info = tarfile.TarInfo(name + '/' + f); info.size = len(data); output.addfile(info, io.BytesIO(data))
            self.assertEqual(receiver.importar(archive, root, staging)['copiasNovas'], 1)
            self.assertEqual(receiver.importar(archive, root, staging)['copiasNovas'], 0)
    def test_caminho_fora_da_pasta_rejeitado(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); staging = root / 'staging'; staging.mkdir(); archive = root / 'entrada.tar.gz'
            with tarfile.open(archive, 'w:gz') as output:
                info = tarfile.TarInfo('../fora'); info.size = 1; output.addfile(info, io.BytesIO(b'x'))
            with self.assertRaises(ValueError): receiver.importar(archive, root, staging)
    def test_incompleto_nao_publicado(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); staging = root / 'staging'; staging.mkdir(); archive = root / 'entrada.tar.gz'; name = 'backup-20260914T115644Z-TESTE'
            with tarfile.open(archive, 'w:gz') as output:
                info = tarfile.TarInfo(name + '/control.dump'); info.size = 1; output.addfile(info, io.BytesIO(b'x'))
            with self.assertRaises(ValueError): receiver.importar(archive, root, staging)
            self.assertFalse((root / name).exists())

if __name__ == '__main__': unittest.main()
