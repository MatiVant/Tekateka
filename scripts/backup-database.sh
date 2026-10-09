#!/usr/bin/env bash
set -Eeuo pipefail

# Backup completo de PostgreSQL sin imprimir la URL ni las credenciales.
# Uso:
#   POSTGRES_URL_NON_POOLING='postgresql://...' ./scripts/backup-database.sh
# O con las variables del proyecto:
#   source /vercel/share/.env.project
#   ./scripts/backup-database.sh

if [[ -z "${POSTGRES_URL_NON_POOLING:-}" ]]; then
  echo "Falta POSTGRES_URL_NON_POOLING." >&2
  echo "Definila en el entorno antes de ejecutar este script." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "No se encontró pg_dump. Instalá PostgreSQL client tools antes de ejecutar el backup." >&2
  exit 1
fi

backup_dir="${BACKUP_DIR:-./backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="${backup_dir}/tekateka-${timestamp}.dump"
checksum_file="${backup_file}.sha256"

mkdir -p "$backup_dir"
umask 077

echo "Creando backup en ${backup_file}..."
pg_dump \
  --dbname="$POSTGRES_URL_NON_POOLING" \
  --format=custom \
  --file="$backup_file" \
  --no-owner \
  --no-privileges \
  --verbose

sha256sum "$backup_file" > "$checksum_file"

echo "Backup creado: ${backup_file}"
echo "Checksum creado: ${checksum_file}"
echo "Guardá ambos archivos fuera del repositorio y probá restaurarlos antes de depender de este backup."
