# OpenOTA Cloud (Multi-Tenant Mode)

OpenOTA runs in two modes from the **same** server binary:

| | Self-hosted (single-tenant) | Cloud (multi-tenant) |
|---|---|---|
| Who it's for | One team running its own server | A hosted service with many independent users/projects |
| Auth | One optional shared secret (`OPENOTA_API_KEY`) | Per-user accounts + per-project API keys |
| Namespace | One flat `{platform}/{version}` store | Isolated per project (`projects/{projectId}/...`) |
| UI | None (CLI only) | Dashboard (login, projects, API keys, releases) |
| Routes | `/api/v1/packages/*` | `/api/v1/auth/*`, `/api/v1/projects/*` |

The two coexist — turning on Cloud does **not** change or break the flat self-hosted routes. This document covers Cloud only; for self-hosted see [SELF_HOSTING.md](./SELF_HOSTING.md).

> **Accuracy note.** This documents what the code actually does today. Where a feature people commonly expect does **not** exist, it says so explicitly rather than implying it.

---

## 1. Architecture

```
Browser (Dashboard, *.vercel.app)          React Native app / CI
        │  session cookie                          │  ota_live_ API key
        ▼                                           ▼
┌─────────────────────────────────────────────────────────────┐
│  OpenOTA Server (apps/server, Express)                       │
│                                                              │
│   Auth (users, sessions)  ─┐                                 │
│   Projects                 ├─► Postgres (DATABASE_URL)       │
│   API keys                 │   metadata only                 │
│   Releases (metadata)     ─┘                                 │
│                                                              │
│   Package bytes / manifests ──► StorageProvider              │
│                                 (local disk | Supabase | …)  │
└─────────────────────────────────────────────────────────────┘
```

- **Postgres** holds only tenancy metadata: `users`, `projects`, `app_configs`, `api_keys`, `releases`. It never holds bundle bytes. Locally / self-hosted this is an embedded **PGlite** database (in-process, zero external infra, persisted to `./data/pgdata`); in Cloud it's a managed Postgres (e.g. Supabase) via `DATABASE_URL`.
- **StorageProvider** holds the actual OTA package zips + manifests, isolated per project. The storage backend is never exposed to end users — see [STORAGE.md](./STORAGE.md).

---

## 2. Two credential types (important)

Cloud uses **two different, non-interchangeable** credentials:

1. **Session cookie** (`openota_session`) — issued by `POST /auth/login`, used by the **dashboard** (browser). HttpOnly, signed with `SESSION_SECRET`. Never leaves the browser; the CLI never uses it.
2. **Project API key** (`ota_live_…`) — created in the dashboard, used by the **CLI/CI/devices**. Shown in full exactly once at creation, stored server-side only as a SHA-256 hash. Verified in constant time; revocable.

A logged-in dashboard user may also manage their **own** project's releases with just the session cookie (no API key needed) — the server checks project ownership. A project API key can only ever act on **its own** project (cross-project access → `401`).

---

## 3. End-to-end user flow

```
Sign up ─► Create Project ─► Generate API Key ─► openota login ─► openota init
   ─► openota release ─► release appears in dashboard ─► device syncs ─► rollback
```

### 3.1 Dashboard user guide

| Step | Where | Notes |
|---|---|---|
| **Sign up / Log in** | `/login` | Email + password (min 8 chars). Session persists 30 days. |
| **Create Project** | `/projects` | Enter a name → get a Project ID (`proj`-style UUID) + URL slug. |
| **Rename / Delete Project** | `/projects` (⋮ menu per card) | Rename edits the display name (slug stays stable). Delete is permanent — removes the project + all its API keys and releases (confirmation required). |
| **Generate API Key** | `/api-keys` (select project first) | Full key shown **once** in a copy-to-clipboard modal. Copy it now — it is never retrievable again. |
| **View Releases** | `/packages`, `/releases` | Per-project. Rollback + delete available with confirmation dialogs. |
| **Settings** | `/settings` | Override the server URL this browser talks to. |

**Not implemented today (do not expect these):**
- **"Create App" as a separate entity** — an "app" is simply a project's platform (`android`/`ios`). There is no distinct App resource or App-settings screen. `runtimeVersion` is configured in the React Native project's `openota.config.json` + `MainApplication.kt`, **not** in the dashboard.
- **Devices / Analytics / Logs pages** — placeholders; they require device check-in/reporting the server does not implement yet, and the pages say so.

### 3.2 CLI (from a clean machine)

```sh
npm install @openota/sdk @openota/native-android
npm install -D @openota/cli

npx openota init --server-url https://YOUR-SERVER/api/v1 --runtime-version 1.0.0
npx openota login --api-key ota_live_xxxxxxxxxxxxx    # stored in ~/.openota/credentials.json (0600)
npx openota doctor                                     # verifies config + auth + server reachability
npx openota release --version 1.0.1 --platform android
```

- `openota login` writes the API key to **`~/.openota/credentials.json`** (user-level, `chmod 600`), keyed by server URL — **never** into the project's `openota.config.json` (which is safe to commit). `openota logout` removes it.
- `release`/`upload`/`rollback` read the key from that credentials file for the config's `serverUrl`; if missing they fail with "run `openota login`".

---

## 4. API reference (Cloud)

Base URL: `https://YOUR-SERVER/api/v1`. All responses use the envelope `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message" } }`.

### Auth — `/auth`

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/auth/signup` | none | `{ email, password }` (password ≥ 8) | `201` `{ userId, token }` + `Set-Cookie` |
| POST | `/auth/login` | none | `{ email, password }` | `200` `{ userId, token }` + `Set-Cookie` |
| POST | `/auth/logout` | none | — | `200` `{ loggedOut: true }` (clears cookie) |
| GET | `/auth/me` | session | — | `200` `{ userId, email }`; `401` if not logged in |

### Projects — `/projects` (session cookie only)

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/projects` | `{ name }` (1–100 chars) | `201` project object |
| GET | `/projects` | — | `200` array of the caller's projects |
| GET | `/projects/:projectId` | — | `200` project; `404` if not owned |
| PATCH | `/projects/:projectId` | `{ name }` | `200` updated project (renames display name; slug stays stable) |
| DELETE | `/projects/:projectId` | — | `200` `{ deleted: true }` — cascades API keys + releases; best-effort storage cleanup |

### API keys — `/projects/:projectId/api-keys` (session cookie, owner only)

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `…/api-keys` | `{ name }` | `201` `{ id, prefix, …, fullKey }` — **`fullKey` returned once** |
| GET | `…/api-keys` | — | `200` array (never includes the hash or full key) |
| DELETE | `…/api-keys/:keyId` | — | `200` `{ revoked: true }` |

### Releases (project-scoped) — `/projects/:projectId/packages`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `…/packages` | API key **or** owner session | multipart upload (`file` + fields) |
| POST | `…/packages/rollback` | API key **or** owner session | `{ platform, version }` |
| GET | `…/packages` | API key **or** owner session | list |
| DELETE | `…/packages/:platform/:version` | API key **or** owner session | |
| GET | `…/packages/check` | **public** (device) | `?platform=&currentVersion=` |
| GET | `…/packages/:platform/:version/download` | **public** (device) | streams / signed URL |
| GET | `…/packages/:platform/:version` | **public** | manifest/metadata |

`check`/`download` are intentionally public (devices carry no secret); isolation there comes from the `:projectId` in the path scoping the storage prefix. Mutations require a key/session **and** that it match `:projectId` (else `401`).

### Example

```sh
# create a key (as a logged-in dashboard user via curl)
curl -b cookies.txt -X POST https://YOUR-SERVER/api/v1/projects/$PID/api-keys \
  -H 'Content-Type: application/json' -d '{"name":"ci"}'
# → { "success": true, "data": { "prefix": "ota_live_ab12cd34", "fullKey": "ota_live_…", … } }

# device checks for an update (no auth)
curl "https://YOUR-SERVER/api/v1/projects/$PID/packages/check?platform=android&currentVersion=1.0.0"
```

---

## 5. Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `3001` | HTTP port |
| `NODE_ENV` | no | `development` | `production` enables `Secure` cookies + cross-site cookie mode + requires `SESSION_SECRET` |
| `DATABASE_URL` | no | embedded PGlite at `./data/pgdata` (test: in-memory) | `postgres://…` for managed Postgres (Supabase in Cloud). Unset = embedded PGlite. Use a real Postgres URL on ephemeral hosts so data survives restarts. |
| `SESSION_SECRET` | **yes in prod** | random per-boot in dev | Signs session cookies. Must be stable (≥16 chars); the server refuses to boot in production without it. |
| `SESSION_COOKIE_CROSS_SITE` | no | derived from `NODE_ENV` | `true` → `SameSite=None; Secure` (dashboard and API on different sites); `false` → `SameSite=Lax`. |
| `CORS_ALLOWED_ORIGINS` | **yes for cross-site dashboard** | reflects request origin | Comma-separated allowlist. Required for the dashboard's credentialed cookie to work cross-origin (browsers reject `*` with credentials). |
| `STORAGE_PROVIDER` | no | `local` | `local` or `supabase` |
| `STORAGE_ROOT` | no | `./storage` | Local storage root (needs persistent disk) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | if `supabase` | — | Server-only; never sent to clients |
| `SUPABASE_STORAGE_BUCKET` | no | `openota-releases` | |
| `OPENOTA_MAX_PACKAGE_SIZE_MB` | no | `200` | Upload size cap |
| `OPENOTA_API_KEY` | no | — | Legacy single-tenant shared secret (flat routes only); leave unset for Cloud |

---

## 6. Deployment (Render + Vercel)

**Server → Render** (see `render.yaml`): set `DATABASE_URL` to your Supabase Postgres connection string so accounts/projects survive restarts (this removes the need for a persistent disk for the database). If you instead use embedded PGlite, you still need a persistent disk at `/data`. In the Render dashboard set:
- `CORS_ALLOWED_ORIGINS` = your dashboard origin, e.g. `https://open-ota-dashboard.vercel.app`
- (`SESSION_SECRET` auto-generates; `NODE_ENV=production` is set by the blueprint)

**Dashboard → Vercel** (see `apps/dashboard/vercel.json`): set
- `NEXT_PUBLIC_OPENOTA_SERVER_URL` = `https://YOUR-RENDER-SERVER/api/v1` (**must include `/api/v1`**)

**Do not deploy the server to Vercel** — serverless has no persistent filesystem. With a managed Postgres `DATABASE_URL` the metadata survives, but local package storage still needs a real disk, so use Render/Railway/a container host for the server.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Login returns 200 but session never persists (every protected call 401s) | Cross-site `SameSite=Lax` cookie is dropped by the browser | Set `NODE_ENV=production` (or `SESSION_COOKIE_CROSS_SITE=true`) so the cookie is `SameSite=None; Secure`; ensure `CORS_ALLOWED_ORIGINS` lists the dashboard origin |
| Dashboard calls all fail / CORS errors | `NEXT_PUBLIC_OPENOTA_SERVER_URL` wrong (missing `/api/v1`, or points at localhost) | Set it to the real server URL incl. `/api/v1`; clear any stale override in dashboard Settings |
| Server won't boot in prod | `SESSION_SECRET` unset | Set a stable ≥16-char secret |
| Users/projects vanish after redeploy | No persistent disk | Use a plan with a mounted disk (Render Starter+) |
| `401` on a project route with a valid key | Key belongs to a different project | Use the key issued for that exact project |
| `openota release` says not logged in | No credential for this server URL | `openota login --api-key …` |

---

## 8. Security notes

- **API keys**: 192-bit random, `ota_live_` prefix, only a SHA-256 hash stored, constant-time verified, revocable, `last_used_at` tracked. Full key returned once; never logged.
- **Passwords**: `scrypt` with a per-password random salt (Node built-in, no external dep).
- **Sessions**: stateless HMAC-signed token in an HttpOnly cookie; `SameSite=None; Secure` cross-site in prod.
- **Tenant isolation**: enforced by `requireProjectMatch` + owner checks; covered by 10 dedicated regression tests.
- **Storage**: server constructs every storage key (`projects/{id}/…`) — clients never supply paths. Supabase service-role key is server-only.
- **Package integrity**: SHA-256 verified by the native runtime before activation; zip-bomb cap in the SDK before extraction; path-traversal guards on every storage key.

**Known production gaps** (not yet addressed): no email verification / password reset. (Auth endpoints are rate-limited; the metadata store is Postgres — embedded PGlite locally, managed Postgres/Supabase in Cloud.)
