# @openota/server

The OpenOTA release server: stores uploaded OTA packages and serves `check`/`download`/`rollback`
requests to devices. Storage is pluggable behind a single `StorageProvider` interface
(`src/providers/storage/provider.ts`); which implementation is active is a deployment choice, not
a code choice.

## Storage providers

| `STORAGE_PROVIDER` | Backend | When to use it |
| --- | --- | --- |
| `local` (default) | Disk, under `STORAGE_ROOT` | Local development, self-hosting on a machine/VM with a persistent filesystem |
| `supabase` | A private Supabase Storage bucket | Deployments on ephemeral filesystems (e.g. Railway) |

Both implement the same `StorageProvider` contract (`upload`, `download`, `delete`, `exists`,
`list`, `readJson`/`writeJson`, `size`, `getDownloadUrl`), so the rest of the server — the package
service, the CLI, the SDK — never branches on which one is active. Switching providers is an
environment-variable change, not a code change.

### Local storage

```
STORAGE_PROVIDER=local
STORAGE_ROOT=./storage
```

No external account needed. This is what runs by default — required for the project to stay usable
by self-hosters and contributors without a Supabase account.

### Supabase Storage

Used for the production Railway deployment, since Railway's filesystem doesn't persist across
deploys.

```
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-side secret — see below>
SUPABASE_STORAGE_BUCKET=openota-releases
```

If `STORAGE_PROVIDER=supabase` is set but `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is
missing, the server refuses to start and prints exactly which variable is missing — it does not
silently fall back to local storage.

#### Where to get these values

1. Open your project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Settings → API**: `Project URL` is `SUPABASE_URL`; `service_role` (under "Project API keys")
   is `SUPABASE_SERVICE_ROLE_KEY`.
3. **Storage → New bucket**: name it `openota-releases` (or whatever you set
   `SUPABASE_STORAGE_BUCKET` to) and leave **Public bucket** unchecked. It must stay private —
   OpenOTA reaches it only through short-lived signed URLs it generates itself.

#### Security

`SUPABASE_SERVICE_ROLE_KEY` is a server-only secret with full bucket access.

- It is read only in `src/providers/storage/supabase.provider.ts` and `src/config/env.ts`.
- It is never returned in an API response, written to a manifest, logged, or passed to the CLI,
  SDK, or dashboard — those talk only to the OpenOTA API, never to Supabase directly.
- Never commit a `.env` file. Copy `.env.example` to `.env` and fill in real values locally; on
  Railway, set these as project environment variables instead.

#### Object layout

```
{deployment}/{platform}/{version}/ota-package.zip
```

e.g. `production/android/1.0.4/ota-package.zip`. There's no per-project prefix yet — OpenOTA
doesn't have a projects/orgs system — but the key builder (`src/modules/package/storage.service.ts`)
is centralized so `{projectId}/{deployment}/{platform}/{version}/...` can be introduced later
without touching call sites.

#### Signed download URLs

`check`, `getPackage`, and `rollback` responses include a `downloadUrl` that is generated fresh on
every request (`StorageProvider.getDownloadUrl`) — for Supabase this is a signed URL with a short
expiry (default 5 minutes). **Signed URLs are never persisted** alongside the manifest; only the
canonical `storageKey` is stored. Re-request `check` if a URL expires before the device downloads it.

## Package size limit

```
OPENOTA_MAX_PACKAGE_SIZE_MB=50
```

This is **deployment configuration, not an OpenOTA protocol limit**. The value here (50MB) matches
the Supabase Free plan's per-file upload cap for the current production deployment — it is not a
constraint OpenOTA itself imposes. Self-hosters on local storage, or on a paid Supabase plan, can
set this higher.

The limit is enforced twice:
1. `multer`'s upload middleware rejects oversized request bodies before they're fully received
   (`src/modules/package/routes.ts`).
2. The package service re-checks the received file's size before calling into storage
   (`src/modules/package/service.ts`), for defense in depth and a structured error either way:

```json
{
  "error": {
    "code": "PACKAGE_TOO_LARGE",
    "message": "OTA package exceeds the configured 50 MB limit.",
    "details": { "maxBytes": 52428800, "actualBytes": 61234000 }
  }
}
```

## Rollback and storage

Rollback only moves the platform's "active version" pointer — it never copies, re-uploads, or
deletes a zip. Every previously-uploaded version's package remains in storage (local or Supabase)
so rolling back to it requires no data movement. See `src/modules/package/service.ts`'s
`rollbackToVersion`.

## Authentication

```
OPENOTA_API_KEY=<a secret you generate>
```

Optional. Unset (default) runs the server open — fine for local dev or a deployment already
behind your own private network. Set it to require `Authorization: Bearer <key>` on
`upload`/`rollback`/`delete` (never `check`/`list`/`download`, which devices need without a
server-admin secret). See the root repo's `docs/SELF_HOSTING.md` "Authentication" for the full
model — this is a single shared secret, not a per-user account system.

## Docker

See the root repo's `docker-compose.yml` and `Dockerfile` (this directory) —
`docker compose up -d` from the repo root builds and runs this server with a persistent storage
volume. Full guide: `docs/SELF_HOSTING.md`.
