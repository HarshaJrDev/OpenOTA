# Self-hosting OpenOTA

OpenOTA is designed to run entirely on infrastructure you control. This is the primary,
first-class path — the hosted service at `https://api.openota.xyz` is one optional
`serverUrl` among many, not a dependency.

```
Your React Native App
        | @openota/sdk
        v
Your OpenOTA Server  (this guide)
        |
        v
Your Storage (local disk or your own Supabase project)
```

## 1. Run the server

### Option A — Docker (recommended)

```sh
git clone https://github.com/HarshaJrDev/OpenOTA.git
cd OpenOTA
cp .env.example .env
docker compose up -d
curl http://localhost:3900/health
```

`docker compose up` builds `apps/server` from source (see `apps/server/Dockerfile`) and starts it
with `STORAGE_PROVIDER=local` by default — no external account needed. Releases are written to a
named Docker volume (`openota_storage`), so they survive `docker compose down` and container
recreation; they do **not** survive `docker compose down -v` (which deletes volumes) or a fresh
`git clone` on a different machine.

To use your own Supabase project instead, either edit `.env` by hand (see
[STORAGE.md](./STORAGE.md)):
```
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service_role key>
SUPABASE_STORAGE_BUCKET=openota-releases
```
or let the CLI validate the credentials for you before writing anything — connects, checks the
bucket exists, and does a real upload/delete test, only touching `.env`'s storage keys:
```sh
npx openota storage setup --provider supabase \
  --supabase-url https://<your-project-ref>.supabase.co \
  --supabase-key <your service_role key> \
  --supabase-bucket openota-releases
```
Run this from the same directory as the `.env` you want written to (the `apps/server` checkout,
or wherever you keep your self-hosted server's `.env`). `npx openota storage validate` runs the
same checks without writing anything — useful after rotating a key or just to confirm the current
setup still works.

### Option B — run it directly (no Docker)

```sh
git clone https://github.com/HarshaJrDev/OpenOTA.git
cd OpenOTA
pnpm install
pnpm --filter @openota/shared build   # apps/server imports its compiled output
cp apps/server/.env.example apps/server/.env
pnpm --filter @openota/server start   # or: pnpm --filter @openota/server dev
```

### Option C — your own hosting provider (Render, Railway, Fly, a VPS, ...)

Any Node 18+ host works. Build command: `pnpm install --frozen-lockfile && pnpm --filter @openota/shared build && pnpm --filter @openota/server build`.
Start command: `pnpm --filter @openota/server start:prod` (runs `node dist/server.js`).
Set the same environment variables as the Docker/`.env` path above. If your host's filesystem is
ephemeral (most PaaS providers), use `STORAGE_PROVIDER=supabase` — local storage will lose
releases on every redeploy otherwise.

## 2. Point your app at it

```sh
npx openota init --server-url https://ota.yourcompany.com/api/v1 --runtime-version 1.0.0
```

See [GETTING_STARTED.md](./GETTING_STARTED.md) for the full release/sync/rollback walkthrough —
it's identical whether you're self-hosting or using the official hosted server, only `serverUrl`
changes.

## 3. Authentication

Self-hosted OpenOTA intentionally has **no account/organization system** — building one is out
of scope for this project (see the dashboard's own scope notes). What exists instead is a single
shared secret:

```
OPENOTA_API_KEY=<any secret string you generate>
```

- **Unset (default)**: the server accepts all requests. Fine for local development, or a
  deployment already sitting behind your own VPN/private network/firewall.
- **Set**: `upload`, `rollback`, and `delete` all require `Authorization: Bearer <that value>`.
  `check`, `list`, and `download` stay open — devices consuming updates are never expected to
  carry a server-admin secret, only your team's release process is.

Give the value to anyone on your team who needs to release or roll back:
```sh
openota login --api-key <the value you set OPENOTA_API_KEY to>
```
This writes it into `openota.config.json`, and every subsequent `release`/`rollback` call sends
it automatically. `openota logout` removes it.

This is deliberately simple — a shared secret, not per-user accounts, tokens with expiry, or
RBAC. If you need those, put a proper auth proxy in front of your OpenOTA server; the project
doesn't build that itself.

## 4. Verify it's working

```sh
curl http://localhost:3900/health
# {"success":true,"data":{"status":"ok","version":"1.0.0","database":"connected","storage":"connected","storageProvider":"local"}}

npx openota doctor   # from inside your React Native project, after `openota init`
```

`/health` runs a real check, not just "the process is up" — `database` and `storage` reflect an
actual connectivity probe each time you call it. If either shows `"unreachable"`, `status` flips
to `"degraded"` even though the HTTP response itself is still `200`.

Then follow [GETTING_STARTED.md](./GETTING_STARTED.md) sections 3 onward for a real release.

## 5. Back up your data

Two things to back up periodically: the database (Cloud-mode metadata) and storage (release
bundles) — see [BACKUPS.md](./BACKUPS.md) for exact commands, restore steps, and how to migrate
between storage providers.

## 6. What this repo does NOT include for self-hosting

Out of scope, on purpose (see the codebase's own scope notes on the dashboard):
billing/subscriptions, multi-tenant organizations, per-user accounts/RBAC, advanced analytics. If
your team needs those, they're not blocked by anything here — the server's REST API and
`StorageProvider` abstraction are the same regardless — but building them isn't part of this
project's current scope.
