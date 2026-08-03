# OpenOTA Cloud (Multi-Tenant Mode)

## What is OpenOTA?

OpenOTA lets you ship JavaScript changes to a React Native app instantly — no app store review. You
build a bundle, push it to a server (self-hosted or OpenOTA Cloud), and every installed app checks
in, downloads, verifies, and applies the update on its own. Rollback is instant and happens entirely
on-device.

**How it flows:** `openota release` → your server (Postgres for metadata, a storage backend for the
actual `.zip` bytes — kept deliberately separate) → device `OTA.check()`/download → the **native**
runtime re-verifies the checksum itself before ever running the new code. The server is never
blindly trusted.

**What you need to run it:** a server (self-hosted or Cloud), a storage backend for bundle bytes
(local disk or Supabase Storage), and — recommended, not strictly required — a real Postgres
database (unset falls back to an embedded file-based DB, fine for one instance, not for production).
Email sending is optional; unset just logs verification/reset links to the console instead.

This document covers **Cloud** (multi-tenant) specifically. OpenOTA runs in two modes from the
**same** server binary:

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
| **Sign up / Log in** | `/login` | Email + password (min 8 chars), or "Continue with Google". Session persists 30 days. |
| **Create Project** | `/projects` | Enter a name → get a Project ID (`proj`-style UUID) + URL slug. |
| **Rename / Delete Project** | `/projects` (⋮ menu per card) | Rename edits the display name (slug stays stable). Delete is permanent — removes the project + all its API keys and releases (confirmation required). |
| **Generate API Key** | `/api-keys` (select project first) | Full key shown **once** in a copy-to-clipboard modal. Copy it now — it is never retrievable again. |
| **View Releases** | `/packages`, `/releases` | Per-project. Rollback + delete available with confirmation dialogs. |
| **Settings** | `/settings` | Override the server URL this browser talks to. |

| **Verify email** | banner shown across the dashboard until verified | Signup sends a verification link (logged to the server console if `RESEND_API_KEY` isn't set — see §5). Resend from the banner; the link hits `/verify-email`. |
| **Forgot / reset password** | `/forgot-password`, `/reset-password` (linked from `/login`) | Never reveals whether an email is registered. Reset link is 1-hour, single-use. |
| **Devices** | `/devices` (select project first) | Real per-device "last seen" rows: device id, app version, runtime version, platform, download count, last seen. Populated automatically once the SDK's `deviceId` starts checking in — see §4. |
| **Analytics** | `/analytics` | Downloads (from device check-ins) and Success Rate / Failures / Rollbacks (from install-result reporting, see §4) are real. Installs still needs no separate reporting beyond what's already wired. |

**Not implemented today (do not expect these):**
- **"Create App" as a separate entity** — an "app" is simply a project's platform (`android`/`ios`). There is no distinct App resource or App-settings screen. `runtimeVersion` is configured in the React Native project's `openota.config.json` + `MainApplication.kt`, **not** in the dashboard.
- **Logs page** — still a placeholder; no request/audit log store exists yet.

### 3.1a Google sign-in

"Continue with Google" on `/login` is a second way into the same account system — not a separate
one. Clicking it does a real browser redirect to Google, then back to the dashboard already signed
in with the same session mechanism as email/password login.

- If the Google account's email matches an **existing** password account, Google sign-in links
  onto that account (and marks it email-verified) rather than creating a duplicate — one account,
  two ways in.
- If not, a brand-new account is created with no password set — you can still add one later via
  "Forgot password" if you ever want an email/password fallback for that account.
- Only enabled if the server operator has configured `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` /
  `GOOGLE_REDIRECT_URI` (see §5) — self-hosted deployments that don't set these just don't show a
  working button (it redirects back with a clear "not configured" message instead of erroring).

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
- `login` also calls `GET /projects/me` with the key to find out which project it belongs to, and **auto-fills `projectId`** into `openota.config.json` if it isn't already set. This is what makes `release`/`upload`/`rollback` target the correct project-scoped routes (`/projects/{id}/packages/...`) instead of the flat self-hosted namespace. If you'd rather set it explicitly, pass `openota init --project-id proj_xxx`.
- `release`/`upload`/`rollback` read the key from that credentials file for the config's `serverUrl`; if missing they fail with "run `openota login`". **A project API key used without a `projectId` in config falls back to the flat routes** — auth still succeeds (the key itself is valid), but the release lands in the wrong, unisolated namespace. Always run `login` (or set `projectId` in `init`) before releasing to Cloud.
- `openota doctor` includes a **Project Access** check once `projectId` is set — confirms the configured key still resolves to that exact project.

### 3.3 SDK (on-device) — what feeds Devices & Analytics

Set `projectId` in `OTA.configure(...)` (same value as `openota.config.json`'s `projectId`) and the SDK does the rest automatically — no extra API calls to wire up yourself:

- Generates a random, anonymous per-install `deviceId` once, persisted in the same MMKV instance as everything else (survives restarts; resets on reinstall/app-data clear — it identifies an install, not a physical device).
- Sends it on every `OTA.check()` and `OTA.download()` call → populates the **Devices** page and the **Downloads** stat.
- Calls the `/packages/report` endpoint automatically after every activation or rollback, reading the outcome straight from the native runtime's own state (`success` / `failure` / `rollback`) → populates **Analytics**' Success Rate / Failures / Rollbacks. This is fire-and-forget — a flaky network never fails or delays the actual install/rollback.

Self-hosted apps with no `projectId` configured skip all of this silently (nowhere to record it — the flat namespace has no project concept), same as everything else project-scoped.

---

## 4. API reference (Cloud)

Base URL: `https://YOUR-SERVER/api/v1`. All responses use the envelope `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message" } }`.

### Auth — `/auth`

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/auth/signup` | none | `{ email, password }` (password ≥ 8) | `201` `{ userId, token }` + `Set-Cookie`. Also sends a verification email (or logs the link — see §5). |
| POST | `/auth/login` | none | `{ email, password }` | `200` `{ userId, token }` + `Set-Cookie` |
| POST | `/auth/logout` | none | — | `200` `{ loggedOut: true }` (clears cookie) |
| GET | `/auth/me` | session | — | `200` `{ userId, email, emailVerified }`; `401` if not logged in |
| POST | `/auth/verify-email/resend` | session | — | `200` `{ sent: true }`. No-op if already verified. |
| POST | `/auth/verify-email/confirm` | none | `{ token }` | `200` `{ verified: true }`; `400` if invalid/expired/already used |
| POST | `/auth/forgot-password` | none | `{ email }` | `200` `{ sent: true }` always — never reveals whether the email is registered |
| POST | `/auth/reset-password` | none | `{ token, password }` (password ≥ 8) | `200` `{ reset: true }`; `400` if invalid/expired/already used |
| GET | `/auth/google` | none | — | `302` to Google's real sign-in page. Redirects to `{DASHBOARD_URL}/login?error=google_not_configured` instead if the server has no Google credentials configured. |
| GET | `/auth/google/callback` | none (Google redirects here) | — | `302` to `{DASHBOARD_URL}/auth/callback#token=…` on success (see §3.1a), or `{DASHBOARD_URL}/login?error=google_auth_failed` on any failure. Never returns JSON — this is a browser redirect target, not an API call your own code should hit directly. |

All `/auth/*` routes are rate-limited (10 requests / 15 min / IP).

### Projects — `/projects`

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| GET | `/projects/me` | **project API key only** | — | `200` the key's own project; `401` for a session token or a non-project key. Used by the CLI's `login` to auto-resolve `projectId`. |
| POST | `/projects` | session cookie | `{ name }` (1–100 chars) | `201` project object |
| GET | `/projects` | session cookie | — | `200` array of the caller's projects |
| GET | `/projects/:projectId` | session cookie | — | `200` project; `404` if not owned |
| PATCH | `/projects/:projectId` | session cookie | `{ name }` | `200` updated project (renames display name; slug stays stable) |
| DELETE | `/projects/:projectId` | session cookie | — | `200` `{ deleted: true }` — cascades API keys + releases; best-effort storage cleanup |

### API keys — `/projects/:projectId/api-keys` (session cookie, owner only)

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `…/api-keys` | `{ name }` | `201` `{ id, prefix, …, fullKey }` — **`fullKey` returned once** |
| GET | `…/api-keys` | — | `200` array (never includes the hash or full key) |
| DELETE | `…/api-keys/:keyId` | — | `200` `{ revoked: true }` |

### Releases (project-scoped) — `/projects/:projectId/packages`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `…/packages` | API key **or** owner session | multipart upload (`file` + fields), optional `channel` field |
| POST | `…/packages/rollback` | API key **or** owner session | `{ platform, version, channel? }` |
| GET | `…/packages` | API key **or** owner session | list |
| DELETE | `…/packages/:platform/:version` | API key **or** owner session | |
| GET | `…/packages/check` | **public** (device) | `?platform=&currentVersion=&deviceId=&runtimeVersion=&channel=`. `deviceId`/`runtimeVersion` drive the Devices page and the Downloads stat; `channel` selects which active-version pointer to check — see §4. Cached 30s server-side (invalidated immediately on upload/rollback). Rate-limited: 120 req/min/IP. |
| GET | `…/packages/:platform/:version/download` | **public** (device) | streams / signed URL. `?deviceId=` optional (same as check). Rate-limited: 120 req/min/IP. |
| GET | `…/packages/:platform/:version` | **public** | manifest/metadata |
| POST | `…/packages/report` | **public** (device) | `{ deviceId, platform, version, runtimeVersion, status }`, `status` ∈ `success \| failure \| rollback`. Feeds the Analytics install-result stats — see §4. Rate-limited: 120 req/min/IP. |

`check`/`download`/`report` are intentionally public (devices carry no secret); isolation there comes from the `:projectId` in the path scoping the storage prefix. Mutations require a key/session **and** that it match `:projectId` (else `401`).

**Channels**: every parameter above defaults to `"production"` if omitted, so nothing that predates channels needs to change. Each `(platform, channel)` pair has its own independent active-version pointer — uploading/rolling back on `channel=beta` never touches `production`'s pointer, and a channel with no releases yet correctly reports "no update available" rather than falling back to another channel's history. The CLI's `openota.config.json` accepts a `channel` field (overridable per-command with `--channel`); the SDK's `OTA.configure({ channel: "beta" })` does the same. This applies identically to the flat self-hosted routes, not just Cloud.

### Devices & Analytics (project-scoped, session cookie, owner only)

| Method | Path | Success |
|---|---|---|
| GET | `/projects/:projectId/devices` | `200` array of `{ id, device_id, platform, app_version, runtime_version, download_count, first_seen_at, last_seen_at }`, newest-seen first |
| GET | `/projects/:projectId/analytics/install-results` | `200` `{ success, failure, rollback }` counts |

Both are populated entirely by what the SDK reports (§4) — there's no way to fabricate this data from the dashboard.

### Apps & remote config — `/projects/:projectId/apps`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `…/apps` | owner session | list — one row per `(project, platform)` |
| PUT | `…/apps/:platform` | owner session | upsert `{ runtimeVersion?, packageName?, bundleIdentifier?, minSupportedVersion?, remoteConfig? }` |
| GET | `…/apps/:platform/config` | **public** (device) | returns `remoteConfig` as-is (`{}` if unset). `Cache-Control: no-store`. Rate-limited: 120 req/min/IP. |

`remoteConfig` is a freeform JSON object the dashboard can set at any time (Apps page → "Remote
config") and a device can read at runtime independent of which OTA bundle is active — no new
release needed to change it. OpenOTA doesn't interpret this value at all; what it means is
entirely up to your app (a UI variant flag, a feature toggle, anything). See
[GETTING_STARTED.md §7](./GETTING_STARTED.md#7-remote-config-optional) for the client-side pattern.

### Real-time updates — `/projects/:projectId/packages/live` (WebSocket) and `/environments/:channel/live-count`

Devices don't have to wait for their next `OTA.sync()` call — see
[GETTING_STARTED.md's "Real-time delivery"](./GETTING_STARTED.md#real-time-delivery-optional) for
the SDK side (`OTA.connectLive()`). Server side, this is:

| | Path | Auth | Notes |
|---|---|---|---|
| WS | `…/packages/live?platform=&channel=&deviceId=` | **public** (device) | Upgrades to a WebSocket. The server pushes a content-free `{"type":"release-changed"}` nudge whenever a release, rollback, or rollout-percentage change happens on that exact `(project, platform, channel)` — never manifest data, so the real `check` endpoint (with its staged-rollout gate) stays the single source of truth for what a device is actually eligible for. In-memory only, per server instance (see §8's single-instance note) — a connection only sees broadcasts from the instance it's connected to. |
| GET | `/projects/:projectId/environments/:channel/live-count?platform=` | owner session | `200` `{ count, android?, ios? }` — how many devices are currently connected live on this channel. Shown as a pulsing "N live" badge on the dashboard's Environments page. |

This only reaches a device while its app is open or backgrounded-but-still-alive — a fully closed
app isn't woken up (that would need push notifications, which OpenOTA doesn't do yet).

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
| `RESEND_API_KEY` | no | — | Sends verification/reset emails via [Resend](https://resend.com)'s HTTP API. **Unset is fully supported**: the email is skipped and the link is logged to the server console instead (`grep` your logs for `verify-email?token=` / `reset-password?token=`) — no email infra required to use these features. |
| `EMAIL_FROM` | no | `OpenOTA <onboarding@resend.dev>` | `From` address for verification/reset emails (only used when `RESEND_API_KEY` is set) |
| `DASHBOARD_URL` | no | `https://open-ota-dashboard.vercel.app` | Base URL used to build verification/reset links. Set this to your own dashboard's URL if you're not using the hosted one. |
| `SENTRY_DSN` | no | — | Sends unexpected errors (500s, crashes) to [Sentry](https://sentry.io). Unset = no-op, same graceful degradation as `RESEND_API_KEY` — structured pino logs still capture everything either way. |
| `REQUIRE_EMAIL_VERIFICATION` | no | `false` | **DEV MODE default is off.** Signup has always logged the user in immediately and login has never checked `email_verified` — that's unchanged. Set to `true` to make `login` reject unverified accounts (a verification email is always sent regardless of this flag; this only controls whether login enforces it). |
| `SEED_DEMO_ACCOUNT` | no | `false` | **DEV MODE ONLY** — hard-guarded to never run when `NODE_ENV=production`, regardless of this flag. Seeds `demo@openota.dev` (pre-verified) on boot if it doesn't exist yet; idempotent. Password is in source at `db/seed.ts` (deliberately not logged). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | no | — | Enables "Continue with Google" (see §3.1a). All three or none — set together from a Google Cloud OAuth 2.0 Client ID (Web application type). `GOOGLE_REDIRECT_URI` must exactly match a URI registered on that client, e.g. `https://YOUR-SERVER/api/v1/auth/google/callback`. |
| `ADMIN_EMAILS` | no | — | Comma-separated allowlist. Any account (password **or** Google) signed in under one of these emails gets admin access (currently: the runtime settings toggle at `/admin`). Not a roles/permissions system — just a trusted-humans list. |

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
| `column "..." does not exist` on an **existing** deployment after an update | Schema bootstrap uses `CREATE TABLE IF NOT EXISTS`, which is a no-op against a table that already has data — it does not retroactively add new columns | Redeploy the latest server code; new columns ship as an explicit `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` alongside the `CREATE TABLE`, so this self-heals on next boot. A brand-new deployment never hits this (fresh `CREATE TABLE` already has every column). |

---

## 8. Security notes

- **API keys**: 192-bit random, `ota_live_` prefix, only a SHA-256 hash stored, constant-time verified, revocable, `last_used_at` tracked. Full key returned once; never logged.
- **Passwords**: `scrypt` with a per-password random salt (Node built-in, no external dep).
- **Sessions**: stateless HMAC-signed token in an HttpOnly cookie; `SameSite=None; Secure` cross-site in prod.
- **Tenant isolation**: enforced by `requireProjectMatch` + owner checks; covered by 10 dedicated regression tests.
- **Storage**: server constructs every storage key (`projects/{id}/…`) — clients never supply paths. Supabase service-role key is server-only.
- **Package integrity**: SHA-256 verified by the native runtime before activation; zip-bomb cap in the SDK before extraction; path-traversal guards on every storage key.

**Known production gaps** (not yet addressed): no request/audit log store; no install-result reporting beyond success/failure/rollback (no error messages/stack traces captured). (All `/auth/*` and device-facing `check`/`download`/`report` endpoints are rate-limited; the hot `check` path is cached 30s server-side with immediate invalidation on release/rollback; the metadata store is Postgres — embedded PGlite locally, managed Postgres/Supabase in Cloud.)

**Single-instance today, by design.** The 30s check cache and the rate limiter are both in-process — correct and safe on more than one instance (never serves wrong data, just less effective), but not *shared* across instances. The one setting that's actually unsafe to scale horizontally is `STORAGE_PROVIDER=local` (package bytes on local disk, not visible to other instances) — the server logs a warning at boot if this is set alongside `NODE_ENV=production`, same for an unset `DATABASE_URL` (falls back to file-based PGlite, single-instance only). Use `STORAGE_PROVIDER=supabase` and a real `DATABASE_URL` before running more than one instance.
