#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  OpenOTA — one-time VPS setup (run ON the VPS, as the deploy user or root)
# ─────────────────────────────────────────────────────────────────────────────
#
# You already have Node.js, pnpm, nginx, PM2, and SSL installed — this script only creates the
# directory layout deploy.sh expects and wires up PM2's boot-time startup. It does NOT touch
# nginx (copy the configs from ../nginx/ yourself — see README) and does NOT install any package
# manager or runtime.

set -euo pipefail

APP_ROOT="/var/www/openota"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log()  { echo -e "${GREEN}[✔]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

step() { echo -e "\n\033[0;34m── $1 ──\033[0m"; }

step "Directory layout"
mkdir -p "${APP_ROOT}/releases" "${APP_ROOT}/shared/env" "${APP_ROOT}/shared/logs"
log "${APP_ROOT}/{releases,shared/env,shared/logs} created."

step "Environment file placeholders"
for f in server.env dashboard.env docs.env; do
  path="${APP_ROOT}/shared/env/${f}"
  if [[ -f "$path" ]]; then
    warn "${f} already exists — leaving it untouched."
  else
    touch "$path"
    chmod 600 "$path"
    log "Created empty ${f} (chmod 600) — fill in real values before your first deploy. See README."
  fi
done

step "PM2 startup on reboot"
# `pm2 startup` prints a command that must be run once (usually with sudo) to actually register
# the systemd/init service — it can't be fully automated because it needs to know your OS/init
# system and the exact user PM2 is running as. Run whatever it prints, then `pm2 save`.
echo "Run this now if you haven't already:"
echo "  pm2 startup"
echo "Then, after PM2 is managing all three apps (first deploy):"
echo "  pm2 save"
echo "This makes PM2 restore all currently-running apps automatically after a VPS reboot."

step "Log rotation"
if command -v pm2 &>/dev/null; then
  if pm2 list | grep -q "pm2-logrotate"; then
    warn "pm2-logrotate already installed."
  else
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 20M
    pm2 set pm2-logrotate:retain 14
    pm2 set pm2-logrotate:compress true
    log "pm2-logrotate installed: 20MB per file, 14 rotations kept, compressed."
  fi
fi

echo ""
log "VPS setup complete."
echo "Next steps:"
echo "  1. Fill in ${APP_ROOT}/shared/env/{server,dashboard,docs}.env with real values (see README)."
echo "  2. Copy deploy/rsync-vps/pm2/ecosystem.config.js to ${APP_ROOT}/shared/ecosystem.config.js."
echo "  3. Copy deploy/rsync-vps/nginx/*.conf to /etc/nginx/sites-available/, symlink into sites-enabled/, nginx -t, reload."
echo "  4. From your Mac: ./deploy.sh   (first deploy creates 'current' and starts PM2 for the first time)."
