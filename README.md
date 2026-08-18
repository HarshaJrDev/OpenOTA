<p align="center">
  <img src="apps/docs/public/icon.png" alt="OpenOTA logo" width="72" height="72" />
</p>

<h1 align="center">OpenOTA</h1>

<p align="center">
  Open-source, self-hostable over-the-air update infrastructure for React Native.
</p>

<p align="center">
  <a href="https://github.com/HarshaJrDev/OpenOTA/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://github.com/HarshaJrDev/OpenOTA/actions/workflows/server-ci.yml"><img alt="Server CI" src="https://github.com/HarshaJrDev/OpenOTA/actions/workflows/server-ci.yml/badge.svg"></a>
  <a href="https://github.com/HarshaJrDev/OpenOTA/actions/workflows/package-ci.yml"><img alt="Package CI" src="https://github.com/HarshaJrDev/OpenOTA/actions/workflows/package-ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/@openota/sdk"><img alt="npm" src="https://img.shields.io/npm/v/@openota/sdk.svg?label=%40openota%2Fsdk"></a>
  <a href="https://github.com/HarshaJrDev/OpenOTA/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/HarshaJrDev/OpenOTA?style=social"></a>
</p>

<p align="center">
  <a href="https://openota.xyz">Website</a> ·
  <a href="https://openota.xyz/docs">Docs</a> ·
  <a href="https://dashboard.openota.xyz">Dashboard</a> ·
  <a href="https://openota.xyz/pricing">Pricing</a>
</p>

---

Self-hosted over-the-air update infrastructure for React Native: build a signed JS bundle, push
it to your own server, and let devices sync, verify, and roll back on their own — no App Store
review, no vendor lock-in.

OpenOTA supports two independent paths — pick one, they don't mix:

### Path A — Self-hosted (primary, recommended)

You run the server and own the data, storage, and credentials. The official hosted service is
never required.

```sh
git clone https://github.com/HarshaJrDev/OpenOTA.git && cd OpenOTA
cp .env.example .env && docker compose up -d      # server on http://localhost:3900
curl http://localhost:3900/health

npm install @openota/sdk @openota/native-android @openota/cli --save-dev
npx openota init --server-url http://localhost:3900/api/v1 --runtime-version 1.0.0
npx openota release --version 1.0.1 --platform android
```
Full guide: **[docs/SELF_HOSTING.md](./docs/SELF_HOSTING.md)** · Storage options (local disk vs.
your own Supabase project): **[docs/STORAGE.md](./docs/STORAGE.md)**

### Path B — OpenOTA Cloud (optional)

Skip running a server entirely and point at the hosted deployment:
```sh
npm install @openota/sdk @openota/native-android @openota/cli --save-dev
npx openota init --server-url https://api.openota.xyz/api/v1 --runtime-version 1.0.0
npx openota release --version 1.0.1 --platform android
```
`https://api.openota.xyz` (`/health`, API base `/api/v1`) — this is just another `serverUrl`
value; nothing about the CLI/SDK/native runtime depends on it specifically. Manage projects,
releases, and API keys from the [dashboard](https://dashboard.openota.xyz).

---

Full end-to-end walkthrough (native wiring, SDK integration, verifying a release, sync, rollback,
negative paths): **[docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)**
Flat command/API reference: **[docs/COMMANDS.md](./docs/COMMANDS.md)**
Multi-tenant Cloud mode — accounts, projects, per-project API keys, email verification, password
reset, device tracking, install-result analytics, dashboard, full Cloud API reference:
**[docs/CLOUD.md](./docs/CLOUD.md)**

## Architecture

```
React Native App
      | OTA.sync()
      v
OpenOTA API (apps/server)
      |
      +-- release metadata (manifest.json / active-version pointer)
      |
      +-- StorageProvider (pluggable)
              |
              +-- LocalStorageProvider   — disk, for local dev / self-hosting
              +-- SupabaseStorageProvider — private Supabase bucket, for production
```

The server is the sole authority — the CLI and the RN app never talk to Supabase (or any
storage backend) directly, only to the OpenOTA API.

## What's in this repo

| Path | What it is |
|---|---|
| `apps/server` | The OpenOTA API — upload, list, check, download, rollback, delete. See its own [README](./apps/server/README.md) for storage configuration. |
| `packages/cli` | `openota` CLI — `init`, `doctor`, `build`, `upload`, `release`, `rollback`. |
| `packages/sdk` | `@openota/sdk` — the on-device `OTA.*` API (check/download/verify/install/sync/rollback). |
| `packages/native-android` | Android TurboModule — bundle staging, SHA-256 verification, activation, crash-loop-safe rollback. See its own [README](./packages/native-android/README.md). |
| `packages/native-ios` | iOS native module — bundle staging, SHA-256 verification, activation, rollback. See its own [README](./packages/native-ios/README.md). |
| `packages/shared` | Shared TypeScript contracts (Manifest, error codes, API envelopes) used by every package above. |
| `apps/dashboard` | Cloud web dashboard — auth (signup/login/email verification/password reset), projects, API keys, releases + rollback, real device tracking, install-result analytics. |
| `apps/docs` | Marketing/docs landing page for OpenOTA Cloud. |
| `apps/openota-site` | The self-hosted-focused marketing site. |
| `OpenOTA_Example` (repo root) | The primary reference React Native app — real SDK/native integration, used throughout the docs and dashboard's "Reference app" links. |
| `apps/example` | An earlier internal integration playground; `OpenOTA_Example` above is the one referenced by current docs. |
| `apps/e2e` | End-to-end certification suite (real CLI → real server → real Android instrumented tests). |

## Local development

This is a pnpm workspace (see `pnpm-workspace.yaml`) built with [Turborepo](https://turborepo.dev).

```sh
pnpm install
pnpm --filter @openota/shared build   # build shared contracts first — apps/server imports its compiled output
pnpm --filter @openota/server dev     # run the API locally (defaults to LocalStorageProvider)
```

Run tests for a specific package: `pnpm --filter @openota/server test` (same pattern for `@openota/cli`, etc).

To build/dev everything: `pnpm build` / `pnpm dev` (Turborepo runs each package's script, cached
and parallelized — see `turbo.json`).
