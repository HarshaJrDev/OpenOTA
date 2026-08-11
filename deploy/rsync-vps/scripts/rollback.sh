#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  OpenOTA — manual rollback to a previous release
# ─────────────────────────────────────────────────────────────────────────────
#
# deploy.sh already rolls back automatically when a deploy's own health check fails. This script
# is for the other case: a release passed its health check (server responds, pages load) but you
# discover a real problem later (a bad release, a data issue, whatever) and want back on the
# previous version immediately.
#
# Usage:
#   ./rollback.sh              # roll back to the release immediately before the current one
#   ./rollback.sh 20260807-041530   # roll back to a specific release by its timestamp ID
#   ./rollback.sh --list       # show available releases to roll back to

set -euo pipefail

VPS_HOST="13.140.130.207"
VPS_USER="root"
VPS_SSH_PORT="22"
APP_ROOT="/var/www/openota"

SSH="ssh -p ${VPS_SSH_PORT} ${VPS_USER}@${VPS_HOST}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
log()  { echo -e "${GREEN}[✔]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✘]${NC} $1"; exit 1; }

if [[ "${1:-}" == "--list" ]]; then
  echo "Available releases (newest first):"
  $SSH "cd '${APP_ROOT}/releases' && ls -1t"
  CURRENT=$($SSH "basename \$(readlink -f '${APP_ROOT}/current')")
  echo ""
  echo "Currently live: ${CURRENT}"
  exit 0
fi

CURRENT_TARGET=$($SSH "readlink -f '${APP_ROOT}/current'")
CURRENT_ID=$(basename "$CURRENT_TARGET")

if [[ -n "${1:-}" ]]; then
  TARGET_ID="$1"
else
  # Default: the release immediately before the current one, by directory-name sort (timestamps
  # sort correctly as strings since deploy.sh always uses YYYYMMDD-HHMMSS).
  TARGET_ID=$($SSH "cd '${APP_ROOT}/releases' && ls -1t | grep -A1 '^${CURRENT_ID}$' | tail -n1")
  if [[ -z "$TARGET_ID" || "$TARGET_ID" == "$CURRENT_ID" ]]; then
    fail "Could not determine a previous release automatically. Run '$0 --list' and pass a release ID explicitly."
  fi
fi

TARGET_DIR="${APP_ROOT}/releases/${TARGET_ID}"
if ! $SSH "[[ -d '${TARGET_DIR}' ]]"; then
  fail "Release '${TARGET_ID}' does not exist on the VPS. Run '$0 --list' to see what's available."
fi

if [[ "$TARGET_ID" == "$CURRENT_ID" ]]; then
  fail "Release '${TARGET_ID}' is already the one currently live — nothing to do."
fi

warn "Rolling back: ${CURRENT_ID} -> ${TARGET_ID}"
read -r -p "Proceed? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { warn "Aborted."; exit 0; }

$SSH "ln -sfn '${TARGET_DIR}' '${APP_ROOT}/current'"
log "current -> ${TARGET_ID}"

# openota-server is fork-mode/single-instance over an on-disk PGlite database — `startOrReload`
# briefly runs old+new concurrently even here, which corrupted this exact database once already.
# Restart it sequentially instead; cluster-mode dashboard/docs keep the zero-downtime reload.
if $SSH "pm2 describe openota-server >/dev/null 2>&1"; then
  $SSH "pm2 restart openota-server"
else
  $SSH "pm2 startOrReload '${APP_ROOT}/shared/ecosystem.config.js' --only openota-server"
fi
$SSH "pm2 startOrReload '${APP_ROOT}/shared/ecosystem.config.js' --only openota-dashboard"
$SSH "pm2 startOrReload '${APP_ROOT}/shared/ecosystem.config.js' --only openota-docs"
log "PM2 reloaded."

sleep 3
for port_name in "3001:openota-server:/health" "3002:openota-dashboard:/" "3003:openota-docs:/"; do
  IFS=':' read -r port name path <<< "$port_name"
  status=$($SSH "curl -s -o /dev/null -w '%{http_code}' --max-time 15 'http://127.0.0.1:${port}${path}'" || echo "000")
  if [[ "$status" == "200" ]]; then
    log "${name}: healthy (HTTP ${status})"
  else
    warn "${name}: HTTP ${status} — check 'pm2 logs ${name}' on the VPS"
  fi
done

echo ""
log "Rolled back to ${TARGET_ID}."
