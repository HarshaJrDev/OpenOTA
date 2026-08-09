#!/bin/sh
# Real gap found via a true fresh-clone `docker compose up -d` test: NODE_ENV=production (the
# compose file's own default) makes config/env.ts refuse to boot without SESSION_SECRET — correct
# posture (a production deployment shouldn't run on a secret nobody chose), but it broke the
# "zero external accounts, zero manual config" promise docker-compose.yml's own comment makes.
#
# Fix: generate a random secret ONCE and persist it in the same durable volume STORAGE_ROOT
# already uses (/data/storage), so it survives container recreation but is never regenerated on
# every restart (which would invalidate every session on every restart — a self-inflicted "why am
# I logged out constantly" bug). An operator who wants their OWN secret still can — SESSION_SECRET
# in their .env always takes priority over the persisted file below.
set -e

SECRET_FILE="/data/storage/.session_secret"

if [ -z "$SESSION_SECRET" ]; then
  mkdir -p "$(dirname "$SECRET_FILE")"
  if [ ! -f "$SECRET_FILE" ]; then
    node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))" > "$SECRET_FILE"
  fi
  export SESSION_SECRET
  SESSION_SECRET="$(cat "$SECRET_FILE")"
fi

exec node dist/server.js
