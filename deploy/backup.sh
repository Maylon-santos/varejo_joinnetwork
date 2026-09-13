#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
backup_root=${BACKUP_ROOT:-./backups}
mkdir -p "$backup_root"
backup_path=$(mktemp -d "$backup_root/backup-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
docker compose exec -T postgres pg_dump -U postgres -Fc --exclude-table-data=public.admin_sessions varejo_control > "$backup_path/control.dump"
docker compose exec -T postgres pg_dump -U postgres -Fc varejo_aeropostale > "$backup_path/tenant.dump"
docker compose exec -T postgres pg_restore --list < "$backup_path/control.dump" > /dev/null
docker compose exec -T postgres pg_restore --list < "$backup_path/tenant.dump" > /dev/null
(cd "$backup_path" && shasum -a 256 control.dump tenant.dump > SHA256SUMS)
touch "$backup_path/COMPLETE"
printf 'Backup concluído: %s\n' "$backup_path"
