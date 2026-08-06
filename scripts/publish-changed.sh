#!/bin/bash
# ─────────────────────────────────────────────
#  OpenOTA — publish every changesets-versioned package whose current version isn't on npm yet
# ─────────────────────────────────────────────
#
# Replaces `changeset publish` as the actual npm-publish step. `changeset publish` shells out to
# plain `npm publish`, which does NOT rewrite pnpm's `workspace:*` protocol in dependencies before
# publishing — confirmed the hard way: @openota/sdk@0.3.0 was published with the literal string
# "@openota/shared": "workspace:*" as a dependency, making it uninstallable by anyone outside this
# monorepo. `pnpm publish` resolves workspace: ranges to real versions correctly (verified via
# `pnpm pack`), so this script uses that instead, while still relying on `changeset version` (run
# separately, BEFORE this) for the actual version-bumping/changelog logic — only the publish
# mechanism changes, not the versioning one.
#
# Usage: ./scripts/publish-changed.sh
# Run AFTER `pnpm version-packages` (or the CI equivalent) has already bumped versions.

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log()  { echo -e "${GREEN}[✔]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

# Only these are actually published to npm — mirrors .changeset/config.json's ignore list (every
# other workspace package there is either private or Cloud/dashboard-only).
PUBLIC_PACKAGES=(
  "packages/shared"
  "packages/sdk"
  "packages/cli"
  "packages/native-android"
)

for pkg_dir in "${PUBLIC_PACKAGES[@]}"; do
  name=$(node -p "require('./${pkg_dir}/package.json').name")
  local_version=$(node -p "require('./${pkg_dir}/package.json').version")
  published_version=$(npm view "$name" version 2>/dev/null || echo "")

  if [[ "$local_version" == "$published_version" ]]; then
    warn "$name@$local_version already published — skipping."
    continue
  fi

  log "Publishing $name@$local_version (npm currently has ${published_version:-nothing})..."
  (cd "$pkg_dir" && pnpm publish --access public --no-git-checks)
  log "$name@$local_version published."
done
