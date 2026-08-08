#!/bin/bash
# OpenOTA — nightly backup of the embedded PGlite database + local package storage.
#
# Real, filesystem-level snapshot, not a transactional pg_dump/PITR setup — PGlite doesn't expose
# a network port to pg_dump against from outside its own process. Acceptable for this deployment's
# actual scale (single-writer, low-traffic demo/small-production server): the risk is a backup
# taken mid-write could be a few seconds inconsistent, not corrupted-per-se, and this app's own
# releases/rollback events are the real source of truth for OTA state either way. If this server's
# write volume ever grows enough for that risk to matter, switch DATABASE_URL to a real managed
# Postgres (Supabase) and back that up with its own point-in-time recovery instead — this script's
# job is "don't have zero backups", not "enterprise PITR".
set -euo pipefail

APP_ROOT="/var/www/openota"
BACKUP_ROOT="/var/backups/openota"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_ROOT}/${TIMESTAMP}"
RETENTION_DAYS=14

mkdir -p "${DEST}"

# Database: only back up if the embedded PGlite data dir actually exists (a deployment pointed at
# a real Postgres via DATABASE_URL has nothing here — that's expected, not a failure).
if [ -d "${APP_ROOT}/shared/data/pgdata" ]; then
  tar -czf "${DEST}/pgdata.tar.gz" -C "${APP_ROOT}/shared/data" pgdata
fi

# Package storage: only relevant when STORAGE_PROVIDER=local (Supabase-mode deployments store
# nothing here) — same "only back up what's actually local" logic as above.
if [ -d "${APP_ROOT}/shared/storage" ]; then
  tar -czf "${DEST}/storage.tar.gz" -C "${APP_ROOT}/shared" storage
fi

# Prune backups older than RETENTION_DAYS — keeps this from growing unbounded on a small VPS disk.
find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "20*" -mtime "+${RETENTION_DAYS}" -exec rm -rf {} \;

echo "[$(date -Iseconds)] Backup complete: ${DEST}"
