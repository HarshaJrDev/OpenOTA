#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  OpenOTA — rsync deploy, Mac -> VPS, no Git on the server, no GitHub Actions
# ─────────────────────────────────────────────────────────────────────────────
#
# Run this FROM YOUR MAC, from the repo root. It:
#   1. rsyncs the working tree (source only — no node_modules/.next/dist/.git) to a new,
#      timestamped release directory on the VPS.
#   2. SSHes in and, INSIDE that new release directory only: symlinks in the persistent env
#      files, installs dependencies, and builds with Turbo.
#   3. Atomically swaps the `current` symlink to point at the new release.
#   4. Reloads PM2 (zero-downtime for the cluster-mode dashboard/docs; a brief gap for the
#      single-instance API — see ecosystem.config.js's comment on why that's single-instance).
#   5. Health-checks all three apps. On ANY failure, automatically swaps `current` back to the
#      previous release and reloads PM2 again — the bad release is never left live.
#   6. Prunes old releases beyond RELEASES_TO_KEEP. Every kept release IS a complete, instantly
#      restorable backup — this is what satisfies "automatic backup before deployment" without a
#      separate backup step: the previous release is never touched or deleted until the new one
#      is confirmed healthy.
#
# Usage:
#   ./deploy.sh              # deploy all three apps
#   ./deploy.sh server       # deploy + reload only openota-server
#   ./deploy.sh dashboard
#   ./deploy.sh docs

set -euo pipefail

# ── Configuration — edit these for your VPS ──────────────────────────────────
VPS_HOST="13.140.130.207"
# root, not a dedicated deploy user — this VPS is already shared with NearDeals/knkgroups.in,
# both administered as root. See README §9 for why a non-root user is still the better default on
# a fresh box; not worth migrating an already-shared, already-root-administered VPS for this alone.
VPS_USER="root"
VPS_SSH_PORT="22"
APP_ROOT="/var/www/openota"             # everything lives under here on the VPS
RELEASES_TO_KEEP=5                      # older releases beyond this are pruned after a successful deploy

TARGET="${1:-all}"
case "$TARGET" in
  all|server|dashboard|docs) ;;
  *) echo "Usage: $0 [all|server|dashboard|docs]"; exit 1 ;;
esac

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

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"  # repo root, wherever this is invoked from

step "Step 1 — Verifying SSH access"
$SSH "echo 'SSH OK'" || fail "Cannot reach ${VPS_USER}@${VPS_HOST}:${VPS_SSH_PORT}. Check your SSH key/config."
log "SSH connection verified."

step "Step 2 — Preparing release directory on the VPS"
$SSH "mkdir -p '${RELEASE_DIR}' '${APP_ROOT}/shared/logs' '${APP_ROOT}/shared/env'"
log "Created ${RELEASE_DIR}"

step "Step 3 — Syncing source (rsync, Mac -> VPS)"
# --delete makes the release dir an exact mirror of what rsync sent (no stale files left behind
# from a previous, unrelated sync into the same path) — safe here because RELEASE_DIR is always
# freshly created and never reused between deploys.
# -a: archive mode (recursive, preserves permissions/timestamps/symlinks)
# -z: compress over the wire — worth it even on a fast link, this is a lot of small JS/TS files
# --info=progress2: one live overall progress line instead of a scrolling per-file list
rsync -az --delete --progress \
  --exclude-from="$(dirname "$0")/rsync-exclude.txt" \
  -e "ssh -p ${VPS_SSH_PORT}" \
  ./ "${VPS_USER}@${VPS_HOST}:${RELEASE_DIR}/"
log "Source synced to ${RELEASE_DIR}"

step "Step 4 — Linking persistent environment files"
# Env files live OUTSIDE every release, in shared/env/, and are symlinked into the fresh release
# on every deploy — so secrets are never re-uploaded, never diffed by rsync, and never duplicated
# per release. First-time setup: create these three files once (see README "Environment variable
# handling"); every deploy after that just re-links them.
$SSH "
  set -e
  ln -sfn '${APP_ROOT}/shared/env/server.env'        '${RELEASE_DIR}/apps/server/.env'
  ln -sfn '${APP_ROOT}/shared/env/dashboard.env'      '${RELEASE_DIR}/apps/dashboard/.env.local'
  ln -sfn '${APP_ROOT}/shared/env/docs.env'           '${RELEASE_DIR}/apps/docs/.env.local'
"
log "Environment files linked."

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

step "Step 6 — Building (Turbo — dependency graph, e.g. @openota/shared, is resolved automatically)"
BUILD_FILTERS="--filter=@openota/server --filter=@openota/dashboard --filter=docs"
case "$TARGET" in
  server)    BUILD_FILTERS="--filter=@openota/server" ;;
  dashboard) BUILD_FILTERS="--filter=@openota/dashboard" ;;
  docs)      BUILD_FILTERS="--filter=docs" ;;
esac
$SSH "
  set -e
  cd '${RELEASE_DIR}'
  export PNPM_HOME=\"\$HOME/.local/share/pnpm\"
  export PATH=\"\$PNPM_HOME:\$PATH\"
  pnpm turbo run build ${BUILD_FILTERS}
"
log "Build complete."

step "Step 7 — Recording the currently-live release (for rollback if this deploy fails)"
# GNU `readlink -f` resolves as far as it can even when the target doesn't exist yet (first-ever
# deploy) — it does NOT fail or print nothing in that case, so `-n "$PREVIOUS_RELEASE"` alone would
# wrongly treat that nonexistent path as a real previous release. Check the symlink actually exists
# first.
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

rollback_and_exit() {
  warn "Deploy failed — rolling back."
  if [[ -n "$PREVIOUS_RELEASE" ]]; then
    $SSH "ln -sfn '${PREVIOUS_RELEASE}' '${APP_ROOT}/current'"
    reload_pm2
    warn "Rolled back to $(basename "$PREVIOUS_RELEASE")."
  else
    warn "No previous release to roll back to — ${RELEASE_DIR} is left in place for you to inspect."
  fi
  fail "Deployment did not complete successfully."
}

reload_pm2() {
  # `startOrReload` (not plain `reload`) matters on the very first-ever deploy: at that point no
  # PM2 process exists yet, and `pm2 reload <name>` errors with nothing to reload. startOrReload
  # starts whatever isn't running yet and gracefully reloads whatever already is — one command
  # that's correct for both the first deploy and every deploy after it.
  case "$TARGET" in
    all)       $SSH "pm2 startOrReload '${APP_ROOT}/shared/ecosystem.config.js'" ;;
    server)    $SSH "pm2 startOrReload '${APP_ROOT}/shared/ecosystem.config.js' --only openota-server" ;;
    dashboard) $SSH "pm2 startOrReload '${APP_ROOT}/shared/ecosystem.config.js' --only openota-dashboard" ;;
    docs)      $SSH "pm2 startOrReload '${APP_ROOT}/shared/ecosystem.config.js' --only openota-docs" ;;
  esac
}

step "Step 8 — Atomically switching 'current' to the new release"
$SSH "ln -sfn '${RELEASE_DIR}' '${APP_ROOT}/current'"
log "current -> ${RELEASE_ID}"

step "Step 9 — Reloading PM2 (zero-downtime for cluster-mode apps)"
if ! reload_pm2; then
  rollback_and_exit
fi
log "PM2 reloaded."

step "Step 10 — Health checks"
sleep 8
HEALTH_FAILED=0
check_health() {
  local name="$1" url="$2"
  local status
  status=$($SSH "curl -s -o /dev/null -w '%{http_code}' --max-time 15 '${url}'" || echo "000")
  if [[ "$status" == "200" ]]; then
    log "${name}: healthy (HTTP ${status})"
  else
    warn "${name}: HTTP ${status} — unhealthy"
    HEALTH_FAILED=1
  fi
}
# Explicit `if` blocks, not `[[ cond ]] && check_health ...` — under `set -e`, a short-circuited
# `&&` chain where the left side is false returns exit 1 for the *whole line*, which would abort
# the entire script on any single-app deploy (e.g. `./deploy.sh server` skipping the dashboard/docs
# checks) even though skipping an inapplicable check is completely expected, not a failure.
if [[ "$TARGET" == "all" || "$TARGET" == "server" ]]; then
  check_health "openota-server" "http://127.0.0.1:3001/health"
fi
if [[ "$TARGET" == "all" || "$TARGET" == "dashboard" ]]; then
  check_health "openota-dashboard" "http://127.0.0.1:3002/"
fi
if [[ "$TARGET" == "all" || "$TARGET" == "docs" ]]; then
  check_health "openota-docs" "http://127.0.0.1:3003/"
fi

if [[ "$HEALTH_FAILED" == "1" ]]; then
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
echo -e "${GREEN}  Rollback any time with: ./rollback.sh${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
