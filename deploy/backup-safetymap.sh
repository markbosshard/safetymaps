#!/usr/bin/env bash
# Daily SQLite backup using the online .backup API (safe on a live WAL database — no downtime).
# Usage:   ./backup-safetymap.sh
# Tunable via env: DB_PATH, BACKUP_DIR, KEEP (number of dated copies to retain).
# Requires: sqlite3  (sudo apt install -y sqlite3)

set -euo pipefail

DB="${DB_PATH:-/var/lib/safetymap/safetymap.db}"
DEST="${BACKUP_DIR:-/var/backups/safetymap}"
KEEP="${KEEP:-14}"

mkdir -p "$DEST"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DEST/safetymap-$STAMP.db"

sqlite3 "$DB" ".backup '$OUT'"

# Prune: keep the newest $KEEP backups, delete the rest.
ls -1t "$DEST"/safetymap-*.db 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

echo "$(date -Is)  backed up -> $OUT"
