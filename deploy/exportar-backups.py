#!/usr/bin/env python3
"""SSH restrito: exporta backups e confirma cópias antes da retenção aprovada."""
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import sys
import tarfile
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from backup_retencao import completos, validar, reter, FILES

root = Path('/opt/aeropostale-varejo/backups')
command = os.environ.get('SSH_ORIGINAL_COMMAND')
if command not in {'exportar-backups', 'confirmar-copias'}:
    sys.exit('Comando não permitido')
os.umask(0o077)
lock = (root / '.exportacao.lock').open('w')
fcntl.flock(lock, fcntl.LOCK_EX)
paths = completos(root)
if not paths:
    sys.exit('Nenhum backup completo disponível')
verified = {p.name: validar(p) for p in paths}
if command == 'exportar-backups':
    with tarfile.open(fileobj=sys.stdout.buffer, mode='w|gz') as archive:
        for path in paths:
            for name in sorted(FILES):
                archive.add(path / name, arcname=path.name + '/' + name, recursive=False)
else:
    # JSON limitado e sem caminhos arbitrários ou comandos fornecidos pelo cliente.
    raw = sys.stdin.buffer.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024:
        sys.exit('Confirmação excede o limite')
    ack = json.loads(raw)
    if not isinstance(ack, dict) or not ack or any(name not in verified or hashes != verified[name] for name, hashes in ack.items()):
        sys.exit('Confirmação inválida')
    removed = reter(root, 5, confirmados=ack)
    report = {'confirmadoEm': datetime.now(timezone.utc).isoformat(), 'destino': 'mabookhome', 'copiasConfirmadas': len(ack), 'retencaoDias': 5, 'exclusoes': removed}
    temp = root / '.confirmacao-mabookhome.tmp'
    temp.write_text(json.dumps(report, indent=2) + '\n')
    temp.replace(root / '.confirmacao-mabookhome.json')
    print(json.dumps(report))
