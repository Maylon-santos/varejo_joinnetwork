"""Integridade e retenção limitada aos diretórios de backup do piloto."""
from datetime import datetime, timedelta, timezone
import hashlib
from pathlib import Path
import re

FILES = {'control.dump', 'tenant.dump', 'SHA256SUMS', 'COMPLETE'}
PATTERN = re.compile(r'backup-(\d{8}T\d{6}Z)-[A-Za-z0-9]+')

def data_backup(name):
    match = PATTERN.fullmatch(name)
    if not match:
        return None
    try:
        return datetime.strptime(match[1], '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
    except ValueError:
        return None

def validar(path):
    if path.is_symlink() or not path.is_dir() or any((path / f).is_symlink() or not (path / f).is_file() for f in FILES):
        raise ValueError('Backup incompleto ou com links')
    hashes = {}
    for line in (path / 'SHA256SUMS').read_text().splitlines():
        parts = line.split()
        if len(parts) != 2 or parts[1] not in {'control.dump', 'tenant.dump'} or parts[1] in hashes:
            raise ValueError('Manifesto inválido')
        hashes[parts[1]] = parts[0]
    if set(hashes) != {'control.dump', 'tenant.dump'}:
        raise ValueError('Manifesto incompleto')
    for name, digest in hashes.items():
        h = hashlib.sha256()
        with (path / name).open('rb') as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                h.update(chunk)
        if h.hexdigest() != digest:
            raise ValueError('Checksum divergente')
    return hashes

def completos(root):
    return sorted(p for p in root.iterdir() if data_backup(p.name) and p.is_dir() and not p.is_symlink() and (p / 'COMPLETE').is_file())

def reter(root, dias, confirmados=None, agora=None):
    if dias < 1:
        raise ValueError('Retenção inválida')
    paths = completos(root)
    verified = {path: validar(path) for path in paths}
    cutoff = (agora or datetime.now(timezone.utc)) - timedelta(days=dias)
    planned = []
    # Nunca remover a última cópia completa, mesmo quando ela é antiga.
    for path in paths[:-1]:
        if data_backup(path.name) >= cutoff or {p.name for p in path.iterdir()} != FILES:
            continue
        hashes = verified[path]
        if confirmados is not None and confirmados.get(path.name) != hashes:
            continue
        planned.append(path)
    # Somente quatro arquivos conhecidos; nenhum rmtree, glob de exclusão ou link.
    for path in planned:
        validar(path)
        for name in sorted(FILES):
            (path / name).unlink()
        path.rmdir()
    return len(planned)
