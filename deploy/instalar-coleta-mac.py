#!/usr/bin/env python3
"""Agenda a coleta no crontab do usuário, preservando as outras tarefas."""
import argparse
import os
from pathlib import Path
import shlex
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--teste', action='store_true', help='Agenda temporariamente a cada minuto para verificar a execução; reinstalar sem esta opção após o teste.')
args = parser.parse_args()
os.umask(0o077)
root = Path.home() / 'Backups/JoinNetwork/Aeropostale/automacao'
script = root / 'receber-backups-mac.py'
if not script.is_file() or not (root / 'locaweb-known-hosts').is_file():
    raise SystemExit('Instale o coletor e o known_hosts antes do agendamento')
result = subprocess.run(['/usr/bin/crontab', '-l'], capture_output=True, text=True)
if result.returncode and 'no crontab for' not in result.stderr:
    raise SystemExit('Não foi possível ler o agendamento existente; nenhuma alteração aplicada')
start, end = '# BEGIN JOINNETWORK AEROPOSTALE BACKUP', '# END JOINNETWORK AEROPOSTALE BACKUP'
lines = result.stdout.splitlines()
if lines.count(start) != lines.count(end) or lines.count(start) > 1:
    raise SystemExit('Bloco de agendamento inválido; revisar antes de alterar')
kept = []; inside = False
for line in lines:
    if line == start:
        inside = True
    elif line == end:
        if not inside:
            raise SystemExit('Bloco de agendamento fora de ordem')
        inside = False
    elif not inside:
        kept.append(line)
if inside:
    raise SystemExit('Bloco de agendamento incompleto')
schedule = '* * * * *' if args.teste else '17 * * * *'
command = '/usr/bin/python3 ' + shlex.quote(str(script)) + ' >> ' + shlex.quote(str(root / 'coleta.log')) + ' 2>&1'
content = '\n'.join(kept).rstrip() + '\n' + start + '\n' + schedule + ' ' + command + '\n' + end + '\n'
with tempfile.NamedTemporaryFile(mode='w', dir=root, prefix='.cron-', delete=False) as temp:
    temp.write(content)
    path = Path(temp.name)
try:
    subprocess.run(['/usr/bin/crontab', str(path)], check=True, timeout=20)
finally:
    path.unlink()
print('Coleta agendada: ' + ('a cada minuto, em teste.' if args.teste else 'a cada hora, no minuto 17.'))
