#!/usr/bin/env python3
"""Restaura dumps em container descartável sem rede; nunca conecta à produção."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import uuid
from datetime import datetime, timezone


def verificar_arquivos(root):
    expected = {'control.dump', 'tenant.dump'}
    if not root.is_dir() or root.is_symlink():
        raise ValueError('Diretório de backup inválido')
    for name in expected | {'COMPLETE', 'SHA256SUMS'}:
        if not (root / name).is_file() or (root / name).is_symlink():
            raise ValueError('Backup incompleto ou com link simbólico')
    hashes = {}
    for line in (root / 'SHA256SUMS').read_text().splitlines():
        parts = line.split()
        if len(parts) != 2 or parts[1] not in expected or parts[1] in hashes:
            raise ValueError('Manifesto de checksums inválido')
        hashes[parts[1]] = parts[0]
    if set(hashes) != expected:
        raise ValueError('Manifesto incompleto')
    for name, digest in hashes.items():
        h = hashlib.sha256()
        with (root / name).open('rb') as f:
            for block in iter(lambda: f.read(1024 * 1024), b''):
                h.update(block)
        if h.hexdigest() != digest:
            raise ValueError('Checksum divergente')
    return hashes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backup', type=Path)
    parser.add_argument('--relatorio', type=Path, default=Path('docs/validacao-backup.json'))
    args = parser.parse_args()
    os.umask(0o077)
    root = args.backup.absolute()
    verificar_arquivos(root)
    container = 'varejo-restore-test-' + uuid.uuid4().hex[:16]
    log_dir = Path('artifacts/deploy') / container
    log_dir.mkdir(parents=True)
    created = False
    def run(cmd, source=None):
        with (log_dir / 'restore.log').open('ab') as log:
            p = subprocess.run(cmd, stdin=source, stdout=subprocess.PIPE, stderr=log)
        if p.returncode:
            raise RuntimeError('Falha no teste; consulte o log privado em ' + str(log_dir))
        return p.stdout.decode().strip()
    def sql(db, query):
        return run(['docker', 'exec', container, 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db, '-c', query])
    try:
        run(['docker', 'run', '-d', '--name', container, '--network', 'none', '--cpus', '1', '--memory', '1g', '--tmpfs', '/var/lib/postgresql/data:rw,size=1g', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17'])
        created = True
        for _ in range(60):
            p = subprocess.run(['docker', 'exec', container, 'pg_isready', '-U', 'postgres'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if p.returncode == 0:
                break
            time.sleep(.5)
        else:
            raise RuntimeError('PostgreSQL isolado não ficou pronto')
        for db, file in [('varejo_control', 'control.dump'), ('varejo_aeropostale', 'tenant.dump')]:
            run(['docker', 'exec', container, 'createdb', '-U', 'postgres', db])
            with (root / file).open('rb') as dump:
                run(['docker', 'exec', '-i', container, 'pg_restore', '-U', 'postgres', '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction', '-d', db], dump)
        control = json.loads(sql('varejo_control', "SELECT json_build_object('usuarios',(SELECT count(*) FROM admin_users),'admins_ativos',(SELECT count(*) FROM admin_users WHERE active AND role='Admin'),'perfis',(SELECT count(*) FROM access_roles),'vinculos',(SELECT count(*) FROM user_branches),'sessoes',(SELECT count(*) FROM admin_sessions),'registro_ok',EXISTS(SELECT 1 FROM tenants WHERE tenant_key='aeropostale' AND database_name='varejo_aeropostale'))"))
        tenant = json.loads(sql('varejo_aeropostale', "SELECT json_build_object('operacoes',(SELECT count(*) FROM operacoes),'itens',(SELECT count(*) FROM operacao_itens),'cancelamentos',(SELECT count(*) FROM cancelamentos),'cadastros_filiais',(SELECT count(*) FROM cadastro_filiais),'checkpoints',(SELECT count(*) FROM sync_checkpoints),'clientes_importados',(SELECT count(*) FROM operacoes WHERE clientes_importados_em IS NOT NULL),'identidade_ok',EXISTS(SELECT 1 FROM tenant_identity WHERE tenant_key='aeropostale'))"))
        if control['sessoes'] != 0 or control['admins_ativos'] < 1 or not control['registro_ok'] or not tenant['identidade_ok'] or tenant['operacoes'] < 1:
            raise RuntimeError('Invariantes da recuperação não atendidas')
        report = {'verificadoEm': datetime.now(timezone.utc).isoformat(), 'backup': root.name, 'checksumsValidos': True, 'restauracaoPostgresql17': True, 'containerSemRede': True, 'producaoAlterada': False, 'control': control, 'tenant': tenant, 'limite': 'Valida recuperação do backup indicado; não compara com a produção em alteração nem comprova cópia externa recorrente.'}
    finally:
        if created:
            run(['docker', 'rm', '-f', '-v', container])
    report['containerDescartado'] = True
    args.relatorio.parent.mkdir(parents=True, exist_ok=True)
    args.relatorio.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))

if __name__ == '__main__':
    main()
