# OpenOTA

Self-hosted over-the-air update infrastructure for React Native: build a signed JS bundle, push
it to your own server, and let devices sync, verify, and roll back on their own — no App Store
review, no vendor lock-in.

**Live deployment**: `https://openota.onrender.com` (`/health`, API base `/api/v1`)

## Quick start

```sh
npm install @openota/sdk @openota/native-android @openota/cli --save-dev
npx openota init --server-url https://openota.onrender.com/api/v1 --runtime-version 1.0.0
npx openota release --version 1.0.1 --platform android
```

Full walkthrough (native wiring, SDK integration, verifying a release, rollback, negative
paths): **[docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)**
Flat command/API reference: **[docs/COMMANDS.md](./docs/COMMANDS.md)**

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
| `packages/shared` | Shared TypeScript contracts (Manifest, error codes, API envelopes) used by every package above. |
| `apps/dashboard` | Web dashboard for browsing releases (packages, rollback, analytics). |
| `apps/example` | A real React Native app used as the OTA integration playground/demo. |
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
