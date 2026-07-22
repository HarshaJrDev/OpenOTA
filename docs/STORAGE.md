# Storage

OpenOTA's server depends on a `StorageProvider` interface
(`apps/server/src/providers/storage/provider.ts`) — `upload`, `download`, `delete`, `exists`,
`list`, `readJson`/`writeJson`, `getDownloadUrl`. Nothing else in the server imports Supabase (or
any storage backend) directly; which implementation runs is chosen once, at startup, from
`STORAGE_PROVIDER`.

```
StorageProvider
    |
    +-- LocalStorageProvider    (disk)
    |
    +-- SupabaseStorageProvider (private Supabase bucket)
```

## Local storage

```
STORAGE_PROVIDER=local
STORAGE_ROOT=./storage    # or any path you want
```

No external account needed. Good for:
- local development
- a self-hosted deployment on a persistent VPS or machine
- Docker, **as long as `STORAGE_ROOT` is a mounted volume** (the provided `docker-compose.yml`
  already does this via the `openota_storage` named volume)

**Warning**: on ephemeral filesystems (most PaaS/serverless hosts redeploy onto a fresh
filesystem), local storage loses every release on the next deploy or restart. If you're not
certain your host's disk persists across deploys, use Supabase storage instead.

## Supabase storage

```
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service_role key>
SUPABASE_STORAGE_BUCKET=openota-releases
```

Use your **own** Supabase project — OpenOTA never talks to a shared/official Supabase account.
Your React Native app never sees these credentials; only your OpenOTA server does:

```
React Native  →  Your OpenOTA Server  →  Your Supabase project
      (never)  ✗ direct connection ✗
```

### Where to get these values

1. Open your project at [supabase.com/dashboard](https://supabase.com/dashboard) (create one if
   you don't have one — the free tier is enough to start).
2. **Settings → API**: `Project URL` → `SUPABASE_URL`. `service_role` key (under "Project API
   keys", **not** `anon`) → `SUPABASE_SERVICE_ROLE_KEY`.
3. **Storage → New bucket**: name it `openota-releases` (or whatever you set
   `SUPABASE_STORAGE_BUCKET` to). **Leave "Public bucket" unchecked.** OpenOTA never needs a
   public bucket — the server generates short-lived signed URLs itself.

### ⚠️ Never expose `SUPABASE_SERVICE_ROLE_KEY`

This key has full read/write access to your entire Supabase project, not just this bucket.

- Never put it in a React Native app, `openota.config.json`, the CLI, the dashboard, source
  control, or logs.
- It is read in exactly one place in this codebase:
  `apps/server/src/providers/storage/supabase.provider.ts` (plus validated at startup in
  `apps/server/src/config/env.ts`).
- The server never returns it in an API response — only short-lived signed download URLs, which
  are generated fresh per request and are safe to hand to a device.

### Object layout

```
{deployment}/{platform}/{version}/ota-package.zip
```
e.g. `production/android/1.0.4/ota-package.zip`. There's no per-project prefix yet (OpenOTA has
no multi-project/org system), but the key builder
(`apps/server/src/modules/package/storage.service.ts`) is centralized, so
`{projectId}/{deployment}/{platform}/{version}/...` can be introduced later without touching
call sites.

### Signed download URLs

`check`/`getPackage`/`rollback` responses include a `downloadUrl` generated **fresh on every
request** — never persisted alongside release metadata, since Supabase signed URLs expire
(default 60–300s in this codebase, see `getDownloadUrl` call sites). Only the canonical storage
key is ever stored. If a URL expires before a device downloads it, the next `check()` mints a new
one.

### A caching gotcha we hit and fixed

Reading a Supabase Storage object through the SDK's authenticated `download()` call served stale
bytes for an object that had just been overwritten (specifically hit this on the
frequently-rewritten "active version" pointer during rollback testing). Neither disabling
`cacheControl` on the write nor forcing a delete-then-recreate fixed it. The fix:
`apps/server/src/providers/storage/supabase.provider.ts` reads through a **freshly-signed URL**
instead of `bucket.download()` — the query string (`iat`/`exp`) is unique per call, so it can
never hit a cached response keyed to a previous call's URL. If you're extending this provider,
keep reading through `getDownloadUrl` rather than `bucket.download()` directly.

## Package size limits

```
OPENOTA_MAX_PACKAGE_SIZE_MB=50
```

Deployment configuration, **not** an OpenOTA protocol limit. `50` matches the Supabase Free
plan's per-file cap for the hosted deployment — raise it freely on local storage or a paid
Supabase plan. Enforced both at the multer upload-middleware level (rejects oversized request
bodies before they're fully received) and again server-side with a structured error:
```json
{ "error": { "code": "PACKAGE_TOO_LARGE", "details": { "maxBytes": 52428800, "actualBytes": 61234000 } } }
```

## Adding another provider later

The interface is intentionally small (8 methods). S3/R2/MinIO/GCS could each get their own
`createXStorageProvider()` following the same pattern as
`apps/server/src/providers/storage/{local,supabase}.provider.ts`, selected via
`STORAGE_PROVIDER` in `apps/server/src/providers/storage/index.ts`. Nothing else in the server
would need to change.
