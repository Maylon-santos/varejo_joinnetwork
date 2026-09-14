from datetime import datetime, timezone
import hashlib
from pathlib import Path
import tempfile
import unittest
from backup_retencao import reter, validar

class Retencao(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        self.old = self.criar('backup-20260901T000000Z-OLD')
        self.new = self.criar('backup-20260914T000000Z-NEW')
        self.now = datetime(2026, 9, 14, tzinfo=timezone.utc)
    def tearDown(self): self.temp.cleanup()
    def criar(self, name):
        path = self.root / name; path.mkdir()
        for f in ['control.dump','tenant.dump']: (path / f).write_bytes(f.encode())
        (path / 'COMPLETE').touch()
        (path / 'SHA256SUMS').write_text(''.join(hashlib.sha256(f.encode()).hexdigest()+'  '+f+'\n' for f in ['control.dump','tenant.dump']))
        return path
    def test_servidor_so_remove_confirmado_mais_antigo_5_dias(self):
        self.assertEqual(reter(self.root,5,{},self.now),0)
        self.assertEqual(reter(self.root,5,{self.old.name:validar(self.old)},self.now),1)
        self.assertTrue(self.new.exists())
    def test_mac_90_dias(self): self.assertEqual(reter(self.root,90,agora=self.now),0)
    def test_preserva_ultima_mesmo_antiga(self):
        later = datetime(2027,1,1,tzinfo=timezone.utc)
        self.assertEqual(reter(self.root,90,agora=later),1)
        self.assertEqual(reter(self.root,90,agora=later),0)
        self.assertTrue(self.new.exists())
    def test_hash_divergente_nao_autoriza(self):
        self.assertEqual(reter(self.root,5,{self.old.name:{}},self.now),0)
    def test_corrupcao_interrompe_antes_de_excluir(self):
        (self.new / 'tenant.dump').write_bytes(b'corrompido')
        with self.assertRaises(ValueError): reter(self.root,5,agora=self.now)
        self.assertTrue(self.old.exists())
    def test_arquivos_extras_e_links_preservados(self):
        (self.old / 'nota.txt').write_text('preservar')
        (self.root / 'backup-20260801T000000Z-LINK').symlink_to(self.old)
        self.assertEqual(reter(self.root,5,agora=self.now),0)
        self.assertTrue((self.old / 'nota.txt').exists())

if __name__ == '__main__': unittest.main()
