#!/bin/bash
# ─────────────────────────────────────────────
#  OpenOTA — Local package publish (bypasses the GitHub Actions PR gate)
# ─────────────────────────────────────────────
#
# Normal path: `pnpm changeset` -> push -> CI opens a "Version Packages" PR -> merge -> CI
# publishes (.github/workflows/package-release.yml). This script does the same underlying steps
# (changeset version -> build -> test -> changeset publish) locally in one shot, for when you
# don't want to go through a PR. It deliberately reuses the SAME Changesets mechanism as CI, not a
# separate `npm version` bump — running two different versioning systems against the same
# packages would drift out of sync (stale changeset files, mismatched CHANGELOGs).
#
# Requires: `npm login` already done in this shell, a clean git tree, and at least one pending
# changeset (run `pnpm changeset` first if there isn't one — this script does not write one for
# you, since only a human can accurately describe what changed and how it should version).
#
# Usage: ./scripts/publish-packages.sh [--yes]
#   --yes   skip the confirmation prompt before versioning/publishing (for CI-adjacent use only —
#           interactive use should leave this off and actually read the diff).

set -e

cd "$(dirname "$0")/.."  # repo root, regardless of where this is invoked from

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'
log()  { echo -e "${GREEN}[✔]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✘]${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}──────────────────────────────────────${NC}\n${BLUE}  $1${NC}\n${BLUE}──────────────────────────────────────${NC}"; }

AUTO_YES=false
[[ "$1" == "--yes" ]] && AUTO_YES=true

step "Step 1 — Preflight checks"

npm whoami &>/dev/null || fail "Not logged in to npm. Run 'npm login' first."
log "npm authenticated as $(npm whoami)"

if [[ -n "$(git status --porcelain)" ]]; then
  fail "Working tree is not clean. Commit or stash your changes first — a version bump commit needs a clean base."
fi
log "Git tree is clean."

CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  warn "You're on '$CURRENT_BRANCH', not 'main'. Publishing from a branch other than main is unusual — make sure that's intentional."
fi

PENDING=$(find .changeset -maxdepth 1 -name "*.md" ! -name "README.md" 2>/dev/null)
if [[ -z "$PENDING" ]]; then
  fail "No pending changesets found in .changeset/. Run 'pnpm changeset' first to describe what changed and how it should version."
fi
log "Pending changeset(s): $(echo "$PENDING" | wc -l | tr -d ' ')"

step "Step 2 — Preview what will be versioned"
pnpm changeset status --verbose

if [[ "$AUTO_YES" != "true" ]]; then
  read -r -p "Proceed with version bump + build + test + publish? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { warn "Aborted — nothing was changed."; exit 0; }
fi

step "Step 3 — Version packages"
# Consumes the pending changeset(s): bumps package.json + writes CHANGELOG.md for every affected
# package, and deletes the consumed changeset file(s). This is the exact same command CI runs.
pnpm version-packages
log "Versions bumped. Review the diff below before this gets committed:"
git diff --stat

step "Step 4 — Commit the version bump"
git add -A
git commit -m "chore: version packages"
log "Committed."

step "Step 5 — Build + test the public packages"
pnpm turbo run build --filter=@openota/shared --filter=@openota/sdk --filter=@openota/cli
pnpm turbo run test --filter=@openota/shared --filter=@openota/sdk --filter=@openota/cli
log "Build and tests passed."

step "Step 6 — Publish to npm"
# `pnpm release` = build + ./scripts/publish-changed.sh (see root package.json) — publishes via
# `pnpm publish` per package, NOT `changeset publish` (which doesn't resolve pnpm's workspace:*
# protocol — see publish-changed.sh's doc comment for exactly what that broke once already).
pnpm release
log "Published."

step "Step 7 — Push"
git push origin "$CURRENT_BRANCH"
git push origin "$CURRENT_BRANCH" --tags 2>/dev/null || true
log "Pushed commit and tags."

echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Publish complete.${NC}"
echo -e "${GREEN}  Verify: npm pack @openota/sdk@latest (or whichever package changed)${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
