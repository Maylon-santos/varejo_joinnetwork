#!/usr/bin/env python3
"""Busca arquivos por chave SSH restrita, confere hashes e preserva cópias locais."""
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile


from backup_retencao import validar, reter


def importar(archive_path, root, staging):
    required = {'control.dump', 'tenant.dump', 'SHA256SUMS', 'COMPLETE'}
    names = set()
    members = set()
    with tarfile.open(archive_path, 'r:gz') as archive:
        for item in archive:
            parts = item.name.split('/')
            if len(parts) != 2 or not re.fullmatch(r'backup-\d{8}T\d{6}Z-[A-Za-z0-9]+', parts[0]) or parts[1] not in required or not item.isfile() or item.name in members:
                raise ValueError('Arquivo não permitido na transferência')
            members.add(item.name)
            names.add(parts[0])
            dest = staging / parts[0]
            dest.mkdir(exist_ok=True)
            with archive.extractfile(item) as source, (dest / parts[1]).open('xb') as output:
                shutil.copyfileobj(source, output)
    if not names:
        raise ValueError('Transferência vazia')
    # Valida o lote inteiro antes de publicar qualquer nova cópia.
    for name in names:
        incoming = validar(staging / name)
        if (root / name).exists() or (root / name).is_symlink():
            if validar(root / name) != incoming:
                raise ValueError('Cópia local diferente; preservada para análise')
    copied = 0
    for name in sorted(names):
        if not (root / name).exists():
            (staging / name).rename(root / name)
            copied += 1
    return {'copiasNovas': copied, 'copiasVerificadas': len(names), 'backupMaisRecente': max(names), 'confirmacoes': {name: validar(root / name) for name in names}}


def main():
    os.umask(0o077)
    root = Path.home() / 'Backups/JoinNetwork/Aeropostale'
    config = root / 'automacao'
    config.mkdir(parents=True, exist_ok=True)
    with (config / 'receber.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        try:
            with tempfile.TemporaryDirectory(prefix='.recebendo-', dir=root) as temp:
                staging = Path(temp)
                archive = staging / 'transferencia.tar.gz'
                command = ['/usr/bin/ssh', '-T', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-o', 'UserKnownHostsFile=' + str(config / 'locaweb-known-hosts'), '-i', str(Path.home() / '.ssh/aeropostale_backup_ed25519'), 'root@191.252.1.241', 'exportar-backups']
                with archive.open('wb') as output:
                    result = subprocess.run(command, stdout=output, stderr=subprocess.PIPE, timeout=600)
                if result.returncode:
                    raise RuntimeError('Falha na conexão ou exportação SSH; próxima tentativa em uma hora')
                report = importar(archive, root, staging)
                command[-1] = 'confirmar-copias'
                confirmation = subprocess.run(command, input=json.dumps(report.pop('confirmacoes')).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
                if confirmation.returncode:
                    raise RuntimeError('Cópias recebidas, mas confirmação remota falhou; retenção local não executada')
                report['locaweb'] = json.loads(confirmation.stdout)
                report['exclusoesLocais'] = reter(root, 90)
            report.update(verificadoEm=datetime.now(timezone.utc).isoformat(), status='ok', retencaoLocalDias=90)
            target = config / 'ultima-copia.json'
            temp_report = config / 'ultima-copia.tmp'
            temp_report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
            temp_report.replace(target)
            print(json.dumps(report, ensure_ascii=False), flush=True)
        except Exception as error:
            print(json.dumps({'status': 'falha', 'momento': datetime.now(timezone.utc).isoformat(), 'erro': str(error)}, ensure_ascii=False), flush=True)
            raise SystemExit(1)

if __name__ == '__main__':
    main()
