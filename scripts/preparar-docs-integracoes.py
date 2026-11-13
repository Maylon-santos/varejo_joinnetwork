#!/usr/bin/env python3
"""Prepara somente os arquivos autorizados para a documentação pública."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'config/documentacao-integracoes-publica.json').read_text())
files = manifest['arquivos']
assert len(files) == len(set(files)), 'Manifesto contém duplicatas'
output = ROOT / 'artifacts/documentacao-integracoes/publico'
output.mkdir(parents=True, exist_ok=True)
assert all(p.relative_to(output).as_posix() in files for p in output.rglob('*') if p.is_file()), 'Artefato público contém arquivo fora do manifesto'
locations = ['# Gerado por scripts/preparar-docs-integracoes.py; não editar.',
             'location = /docs/integracoes/ {',
             '    try_files /docs/integracoes/index.html =404;',
             '    add_header X-Content-Type-Options nosniff always;',
             '}']
hashes = {}
for name in files:
    relative = Path(name)
    assert not relative.is_absolute() and '..' not in relative.parts
    source = ROOT / relative
    assert source.is_file() and not source.is_symlink(), name
    data = source.read_bytes()
    destination = output / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    hashes[name] = hashlib.sha256(data).hexdigest()
    locations += ['location = /' + name + ' {',
                  '    try_files $uri =404;',
                  '    add_header X-Content-Type-Options nosniff always;',
                  '}']
(ROOT / 'deploy/nginx-integracoes-publico.conf').write_text('\n'.join(locations) + '\n')
(output.parent / 'manifesto-publico.json').write_text(json.dumps(hashes, indent=2) + '\n')
print(json.dumps({'arquivosPublicos': len(files), 'diretorio': str(output.relative_to(ROOT))}))
