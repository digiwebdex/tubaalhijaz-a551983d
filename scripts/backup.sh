#!/usr/bin/env bash
# =====================================================================
# PostgreSQL + uploads backup script
# Usage:  ./scripts/backup.sh
# Cron:   0 2 * * * /var/www/tubaalhijaz/scripts/backup.sh >> /var/log/tubaalhijaz-backup.log 2>&1
# =====================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/tubaalhijaz}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
APP_DIR="${APP_DIR:-/var/www/tubaalhijaz}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

# Source .env so DATABASE_URL is available
if [ -f "$APP_DIR/server/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$APP_DIR/server/.env"; set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] DATABASE_URL not set — aborting." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/uploads"

DB_FILE="$BACKUP_DIR/db/db-$TIMESTAMP.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/uploads/uploads-$TIMESTAMP.tar.gz"

echo "[backup] $TIMESTAMP — dumping database…"
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$DB_FILE"
gzip -t "$DB_FILE" && echo "[backup] DB archive verified: $(du -h "$DB_FILE" | cut -f1)"

if [ -d "$APP_DIR/server/uploads" ]; then
  echo "[backup] archiving uploads…"
  tar -czf "$UPLOADS_FILE" -C "$APP_DIR/server" uploads
  echo "[backup] uploads archived: $(du -h "$UPLOADS_FILE" | cut -f1)"
fi

# Retention
echo "[backup] pruning archives older than $RETENTION_DAYS days…"
find "$BACKUP_DIR/db"      -type f -name 'db-*.sql.gz'      -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/uploads" -type f -name 'uploads-*.tar.gz' -mtime +$RETENTION_DAYS -delete

echo "[backup] done."
