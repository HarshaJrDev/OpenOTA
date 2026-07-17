# @openota/e2e — OpenOTA v0.1.0 Android Certification Suite

This package proves the complete OTA pipeline works, end to end, on Android:

```
Developer edits RN code → CLI builds package → Server stores package →
Playground detects update → Downloads → Verifies → Installs → Activates →
Restarts → New UI loads — without reinstalling the APK.
```

It is **not** a feature. It is the certification gate for OpenOTA v0.1.0 Android. See
`docs/ACCEPTANCE_CRITERIA.md` for the pass/fail bar.

## What's here

| Path | What it proves |
|---|---|
| `scripts/generate-fixtures.ts` | Runs the **real** `openota` CLI against the **real** `@openota/server` and captures the output — every fixture the Android suite reads is real CLI/server output, not hand-typed JSON. |
| `src/__tests__/server-pipeline.test.ts` | CLI → Server half of the pipeline (upload, check, download, manifest fields, negative paths). Runs on Node, no device needed. |
| `android/` | Server → SDK → Native Runtime half. Instrumented tests that drive `@openota/native-android`'s real `BundleManager` through the full lifecycle using the fixtures above. Runs on a device/emulator. |
| `docs/MANUAL_TESTING_GUIDE.md` | The one part no automation in this repo can reach: confirming a real Metro-bundled restart actually swaps the visible UI, using the Developer Playground (`apps/example`). |
| `docs/ACCEPTANCE_CRITERIA.md` | The full scenario matrix (S1-S8 server, A1-A8 lifecycle, N1-N8 negative) with expected outcomes. |
| `docs/EXPECTED_LOGS_AND_STATES.md` | The exact state transitions and logcat lines a healthy run produces, for diffing against a broken one. |

## Running everything

```bash
# 1. Install workspace deps (from repo root)
pnpm install

# 2. Generate fixtures from a REAL CLI + server run
cd apps/e2e
pnpm fixtures:generate

# 3. Server-side pipeline tests (Node, no device)
pnpm test:server

# 4. Android instrumented certification suite (needs a running emulator/device)
cd ../example/android
./gradlew :e2e:connectedDebugAndroidTest
```

Test report: `apps/e2e/android/build/reports/androidTests/connected/index.html`

## Fixed since certification: server-side rollback

Certification found that `openota rollback` POSTed to `/api/v1/packages/rollback`, which
`@openota/server` didn't implement. This has been fixed: the server now maintains an explicit
**active version pointer** per platform (`storage/<platform>/active.json`) — `check` serves that
pointer, uploads move it forward automatically, and `POST /packages/rollback` moves it back to
any already-uploaded version without deleting anything. This is distinct from (and complements)
the native runtime's own device-side rollback (`OTA.rollback()`), which restores a single device's
local rollback slot. Server-side rollback changes what *every new/updating* device is offered;
device-side rollback changes what *one already-updated* device is currently running.

Regression coverage: `apps/server/src/modules/package/__tests__/package.test.ts` and
`src/__tests__/server-pipeline.test.ts` §S9.
