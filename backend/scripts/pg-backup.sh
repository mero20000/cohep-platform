#!/usr/bin/env bash
#
# PostgreSQL backup script for COHEP Platform.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/db" ./pg-backup.sh [backup_dir]
#
# Reads DATABASE_URL from the environment or backend/.env. Writes a timestamped,
# gzip-compressed SQL dump to ./backups (override with $1) and prunes dumps
# older than the newest $BACKUPS_RETAIN (default 14).
#
# Scheduling (Render): create a Cron Job on the Render dashboard that runs
#   bash scripts/pg-backup.sh /var/data/backups
# with the DATABASE_URL env var, e.g. daily at 02:00. Store /var/data/backups
# on a persistent disk and sync it off-platform (e.g. object storage) for DR.

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
RETAIN="${BACKUPS_RETAIN:-14}"

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  else
    echo "ERROR: DATABASE_URL is not set and no .env file found." >&2
    exit 1
  fi
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/cohep-${STAMP}.sql.gz"

if ! pg_dump --no-owner --no-privileges --dbname="$DATABASE_URL" | gzip -9 > "$OUT"; then
  rm -f "$OUT"
  echo "ERROR: pg_dump failed." >&2
  exit 1
fi

echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1))"

# Rotation: keep the newest $RETAIN dumps.
ls -1t "$BACKUP_DIR"/cohep-*.sql.gz 2>/dev/null | tail -n +$((RETAIN + 1)) | while read -r old; do
  rm -f "$old"
  echo "Removed old backup: $old"
done
