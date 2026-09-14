import importlib.util
import hashlib
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('verificar-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

class IntegridadeBackup(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for file in ['control.dump', 'tenant.dump']:
            (self.root / file).write_bytes(file.encode())
        (self.root / 'COMPLETE').touch()
        self.manifest = ''.join(hashlib.sha256(name.encode()).hexdigest() + '  ' + name + '\n' for name in ['control.dump', 'tenant.dump'])
        (self.root / 'SHA256SUMS').write_text(self.manifest)
    def tearDown(self):
        self.temp.cleanup()
    def test_valido(self):
        self.assertEqual(set(backup.verificar_arquivos(self.root)), {'control.dump', 'tenant.dump'})
    def test_corrupcao(self):
        (self.root / 'tenant.dump').write_bytes(b'corrompido')
        with self.assertRaises(ValueError): backup.verificar_arquivos(self.root)
    def test_incompleto(self):
        (self.root / 'COMPLETE').unlink()
        with self.assertRaises(ValueError): backup.verificar_arquivos(self.root)
    def test_manifesto_externo(self):
        (self.root / 'SHA256SUMS').write_text(self.manifest.replace('tenant.dump', '../tenant.dump'))
        with self.assertRaises(ValueError): backup.verificar_arquivos(self.root)
    def test_link(self):
        (self.root / 'control.dump').unlink()
        (self.root / 'control.dump').symlink_to(self.root / 'tenant.dump')
        with self.assertRaises(ValueError): backup.verificar_arquivos(self.root)

if __name__ == '__main__': unittest.main()
