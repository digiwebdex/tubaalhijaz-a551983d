#!/usr/bin/env bash
# =====================================================================
# Restore from a backup produced by scripts/backup.sh
# Usage:  ./scripts/restore.sh /var/backups/tubaalhijaz/db/db-YYYYMMDD-HHMMSS.sql.gz
# OPTIONAL second arg: uploads tar.gz (will replace server/uploads)
# =====================================================================
set -euo pipefail

DB_ARCHIVE="${1:-}"
UPLOADS_ARCHIVE="${2:-}"
APP_DIR="${APP_DIR:-/var/www/tubaalhijaz}"

if [ -z "$DB_ARCHIVE" ] || [ ! -f "$DB_ARCHIVE" ]; then
  echo "Usage: $0 <db-archive.sql.gz> [uploads-archive.tar.gz]" >&2
  exit 1
fi

if [ -f "$APP_DIR/server/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$APP_DIR/server/.env"; set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[restore] DATABASE_URL not set — aborting." >&2
  exit 1
fi

# Validate archive integrity first
gzip -t "$DB_ARCHIVE"

echo "[restore] !!! This will OVERWRITE the current database. Continue? (type yes)"
read -r CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 1; }

echo "[restore] restoring database from $DB_ARCHIVE …"
gunzip -c "$DB_ARCHIVE" | psql "$DATABASE_URL"
echo "[restore] database restored."

if [ -n "$UPLOADS_ARCHIVE" ] && [ -f "$UPLOADS_ARCHIVE" ]; then
  echo "[restore] restoring uploads from $UPLOADS_ARCHIVE …"
  rm -rf "$APP_DIR/server/uploads.bak" 2>/dev/null || true
  [ -d "$APP_DIR/server/uploads" ] && mv "$APP_DIR/server/uploads" "$APP_DIR/server/uploads.bak"
  tar -xzf "$UPLOADS_ARCHIVE" -C "$APP_DIR/server"
  echo "[restore] uploads restored (previous moved to uploads.bak)."
fi

echo "[restore] done. Reload PM2:  pm2 reload tubaalhijaz-api"
