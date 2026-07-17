# OpenOTA v0.1.0 Android — Acceptance Criteria

Certification is granted only if every scenario below passes. A scenario "passing" means the
**automated assertion**, not just "no crash" — see the hard-fail rules at the bottom.

## S — Server pipeline (`src/__tests__/server-pipeline.test.ts`, Node, no device)

| ID | Scenario | Pass condition |
|---|---|---|
| S1 | No update available | `GET /packages/check?currentVersion=<latest>` → `available: false`, `latestVersion` = uploaded version |
| S2 | Update available | `GET /packages/check?currentVersion=<older>` → `available: true`; manifest has `manifestVersion`, `bundleVersion`, `platform`, `runtimeVersion`, valid `sha256` (64 hex chars), `bundleName`, `downloadUrl` |
| S3 | Download | `GET /packages/:platform/:version/download` streams bytes whose SHA-256 equals `manifest.sha256` |
| S4 | Duplicate upload rejected | Re-uploading the same platform+version → `409 PACKAGE_ALREADY_EXISTS` |
| S5 | Missing package | `GET` of a never-uploaded version → `404 PACKAGE_NOT_FOUND` |
| S6 | Invalid manifest rejected at upload | Upload missing `runtimeVersion`, or a non-semver `version` → `400 VALIDATION_ERROR` |
| S7 | Listing | `GET /packages` returns every uploaded package |
| S8 | Deletion | `DELETE` removes a package; subsequent `GET` → `404` |
| S9 | Rollback | `POST /packages/rollback` moves the active-version pointer to an already-uploaded release; `check` reflects it immediately; the newer package is **not** deleted; rolling back to a never-uploaded version → `404 PACKAGE_NOT_FOUND` |

## A — Lifecycle (`android/…/LifecycleIntegrationTest.kt`, instrumented, real fixtures)

| ID | Scenario | Pass condition | Expected `RuntimeState` |
|---|---|---|---|
| A1 | Initial install / embedded fallback | Fresh install, nothing activated → `getJSBundleFile()` returns `null` (serves embedded APK bundle) | `EMBEDDED` |
| A2 | Download → verify → extract → install → activate | A real CLI-built package activates; `bundlePath` exists on disk and is what `getJSBundleFile()` now returns | `ACTIVATED` |
| A3 | SHA-256 verification | Independently recomputing SHA-256 of the activated bundle file equals the manifest's `sha256` | `ACTIVATED` |
| A4 | Bundle switching | A second real generation (v3.0.0) replaces the first (v2.0.0); previous generation snapshotted to the rollback slot | `ACTIVATED` |
| A5 | Rollback | `rollbackBundle()` restores the prior generation; rollback slot is then empty (single-use) | `ACTIVATED` (post-rollback) |
| A5b | Rollback with nothing to roll back to | Throws `NoRollbackAvailableException` | `EMBEDDED`/unchanged |
| A6 | Crash-safety auto-rollback | Two unconfirmed cold starts (`recordBootAttempt()`) of the same activation with a rollback slot available → automatic rollback | `ACTIVATED` (rolled back) |
| A6b | Confirmed boot is never rolled back | `confirmBoot()` then 5 more boot attempts → still on the confirmed version | `ACTIVATED` (unchanged) |
| A7 | Reset runtime / delete bundle | `clearBundle()` wipes current/rollback/downloads/cache; `getJSBundleFile()` returns `null` again | `EMBEDDED` |
| A8 | Failed activation doesn't disturb a good bundle | Activating a bad package after a good one is running throws, but the good bundle is still what's served | `ACTIVATED` (the prior good one, unchanged) |

## N — Negative paths (`android/…/NegativePathIntegrationTest.kt`, instrumented, real fixtures)

Every fixture here is the SAME real CLI-built package with exactly one field tampered — see
`scripts/generate-fixtures.ts`. Pass condition for all of N1-N8: `activateBundle()` (or
`setBundlePath()` for N8) throws the **specific** exception listed, AND the runtime is left in
`EMBEDDED` with `getActiveVersion() == null` — a generic "it threw something" is not sufficient.

| ID | Scenario | Fixture | Required exception |
|---|---|---|---|
| N1 | Invalid SHA-256 | `invalid-sha` | `BundleVerificationException` |
| N2 | Corrupt bundle bytes | `corrupt-bundle` | `BundleVerificationException` |
| N3 | Incompatible runtime version | `wrong-runtime-version` | `UnsupportedRuntimeVersionException` |
| N4 | Platform mismatch | `wrong-platform` | `BundleVerificationException` |
| N5 | Invalid manifest (missing fields) | `invalid-manifest` | `BundleManifestParseException` |
| N5b | Missing manifest entirely | `missing-manifest` | `BundleVerificationException` |
| N6 | Missing bundle file | `missing-bundle` | `BundleVerificationException` |
| N7 | Missing assets directory | `missing-assets` | `BundleVerificationException` |
| N8 | Candidate path is not a directory | synthetic (not extracted) | `BundleVerificationException` |

## Hard-fail rules (from the task brief — enforced by the assertions above, not by inspection)

The suite (and therefore certification) **must fail** if any of the following is true:

- The application still loads the embedded bundle after a successful `activateBundle()` — enforced
  by A2's assertion that `getJSBundleFile()` returns the new `bundlePath`, not `null`.
- The bundle path is incorrect — enforced by A2/A3 asserting the reported path exists on disk and
  ends with the manifest's `bundleName`, and A3 independently rehashing that exact file.
- Verification is skipped — enforced by N1/N2 using a **real** package with only the checksum
  broken; if verification were skipped, activation would wrongly succeed.
- Rollback does not occur — enforced by A5 (explicit) and A6 (automatic crash-loop) both asserting
  the restored version, not just "no exception."
- Manifest version is wrong — enforced by N5 requiring `BundleManifestParseException` specifically
  for a structurally invalid manifest, and A2 asserting the exact `manifestVersion` value.
- Runtime version is incompatible — enforced by N3 requiring `UnsupportedRuntimeVersionException`
  specifically (not just "some error").

## Known Issues found during certification

1. ~~`openota rollback` CLI command targets a server endpoint that doesn't exist.~~ **Fixed.**
   `@openota/server` now implements `POST /packages/rollback` via an active-version pointer per
   platform — see S9 above and `apps/e2e/README.md` §Fixed since certification.
2. **`Force Verify` in the Developer Playground re-runs the same download+verify pipeline as
   `Force Download`** — the SDK's public API doesn't expose a verify-only step (verification is
   folded into `OTA.download()`). Documented, not a defect: matches the SDK's actual granularity.
