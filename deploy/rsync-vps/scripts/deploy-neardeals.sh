#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  NearDeals dedicated OpenOTA server — rsync deploy (same VPS, separate app root)
# ─────────────────────────────────────────────────────────────────────────────
#
# This server (ota.neardeals.knkgroups.in, pm2 process "neardeals-ota") was originally set up
# by hand, outside deploy.sh's scope (that script only manages /var/www/openota). It only ever
# runs apps/server, so this is deploy.sh trimmed to a single app, with the same safety rules:
#
#   1. rsyncs the working tree (source only) to a new, timestamped release directory.
#   2. Symlinks in the persistent env file, installs deps, builds @openota/server (+ its
#      @openota/shared dependency) with Turbo.
#   3. Atomically swaps the `current` symlink.
#   4. Restarts PM2 — `pm2 restart`, never `reload`/`startOrReload`. This app is fork-mode,
#      1 instance; even though it's backed by real Postgres (not the on-disk PGlite that
#      corrupted once on the OTHER server), there's no reason to risk the same old+new-process
#      overlap `reload` does — restart is simpler and has zero corruption surface either way.
#   5. Health-checks. On failure, automatically rolls back `current` and restarts again.
#   6. Prunes old releases beyond RELEASES_TO_KEEP.
#
# Run this FROM YOUR MAC, from the repo root:
#   ./deploy/rsync-vps/scripts/deploy-neardeals.sh

set -euo pipefail

VPS_HOST="13.140.130.207"
VPS_USER="root"
VPS_SSH_PORT="22"
APP_ROOT="/var/www/neardeals-ota"
PM2_APP="neardeals-ota"
HEALTH_PORT="4001"
RELEASES_TO_KEEP=5

SSH="ssh -p ${VPS_SSH_PORT} ${VPS_USER}@${VPS_HOST}"
RELEASE_ID="$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="${APP_ROOT}/releases/${RELEASE_ID}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'
log()  { echo -e "${GREEN}[✔]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✘]${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}──────────────────────────────────────${NC}\n${BLUE}  $1${NC}\n${BLUE}──────────────────────────────────────${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

step "Step 1 — Verifying SSH access"
$SSH "echo 'SSH OK'" || fail "Cannot reach ${VPS_USER}@${VPS_HOST}:${VPS_SSH_PORT}. Check your SSH key/config."
log "SSH connection verified."

step "Step 2 — Preparing release directory on the VPS"
$SSH "mkdir -p '${RELEASE_DIR}' '${APP_ROOT}/shared/logs' '${APP_ROOT}/shared/env'"
log "Created ${RELEASE_DIR}"

step "Step 3 — Syncing source (rsync, Mac -> VPS)"
rsync -az --delete --progress \
  --exclude-from="${SCRIPT_DIR}/rsync-exclude.txt" \
  -e "ssh -p ${VPS_SSH_PORT}" \
  ./ "${VPS_USER}@${VPS_HOST}:${RELEASE_DIR}/"
log "Source synced to ${RELEASE_DIR}"

step "Step 4 — Linking persistent environment file"
$SSH "ln -sfn '${APP_ROOT}/shared/env/server.env' '${RELEASE_DIR}/apps/server/.env'"
log "Environment file linked."

step "Step 5 — Installing dependencies (pnpm, frozen lockfile)"
$SSH "
  set -e
  cd '${RELEASE_DIR}'
  export PNPM_HOME=\"\$HOME/.local/share/pnpm\"
  export PATH=\"\$PNPM_HOME:\$PATH\"
  corepack enable
  pnpm install --frozen-lockfile
"
log "Dependencies installed."

step "Step 6 — Building @openota/server (+ @openota/shared)"
$SSH "
  set -e
  cd '${RELEASE_DIR}'
  export PNPM_HOME=\"\$HOME/.local/share/pnpm\"
  export PATH=\"\$PNPM_HOME:\$PATH\"
  pnpm turbo run build --filter=@openota/server
"
log "Build complete."

step "Step 7 — Recording the currently-live release (for rollback if this deploy fails)"
if $SSH "[[ -L '${APP_ROOT}/current' ]]"; then
  PREVIOUS_RELEASE=$($SSH "readlink -f '${APP_ROOT}/current'")
else
  PREVIOUS_RELEASE=""
fi
if [[ -n "$PREVIOUS_RELEASE" ]]; then
  log "Previous release: $(basename "$PREVIOUS_RELEASE")"
else
  warn "No previous release found — this looks like the first-ever deploy."
fi

restart_or_start() {
  if $SSH "pm2 describe ${PM2_APP} >/dev/null 2>&1"; then
    $SSH "pm2 restart ${PM2_APP}"
  else
    $SSH "cd '${RELEASE_DIR}/apps/server' && pm2 start dist/server.js --name '${PM2_APP}' --time"
  fi
}

rollback_and_exit() {
  warn "Deploy failed — rolling back."
  if [[ -n "$PREVIOUS_RELEASE" ]]; then
    $SSH "ln -sfn '${PREVIOUS_RELEASE}' '${APP_ROOT}/current'"
    restart_or_start
    warn "Rolled back to $(basename "$PREVIOUS_RELEASE")."
  else
    warn "No previous release to roll back to — ${RELEASE_DIR} is left in place for you to inspect."
  fi
  fail "Deployment did not complete successfully."
}

step "Step 8 — Atomically switching 'current' to the new release"
$SSH "ln -sfn '${RELEASE_DIR}' '${APP_ROOT}/current'"
log "current -> ${RELEASE_ID}"

step "Step 9 — Restarting PM2 (restart, not reload — see header comment)"
if ! restart_or_start; then
  rollback_and_exit
fi
log "PM2 restarted."

step "Step 10 — Health check"
sleep 8
status=$($SSH "curl -s -o /dev/null -w '%{http_code}' --max-time 15 'http://127.0.0.1:${HEALTH_PORT}/health'" || echo "000")
if [[ "$status" == "200" ]]; then
  log "${PM2_APP}: healthy (HTTP ${status})"
else
  warn "${PM2_APP}: HTTP ${status} — unhealthy"
  rollback_and_exit
fi

step "Step 11 — Pruning old releases (keeping last ${RELEASES_TO_KEEP})"
$SSH "
  cd '${APP_ROOT}/releases' && \
  ls -1t | tail -n +\$(( ${RELEASES_TO_KEEP} + 1 )) | xargs -r rm -rf
"
log "Old releases pruned."

echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy complete: ${RELEASE_ID}${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
