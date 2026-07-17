# Expected Logs & Runtime State Transitions

Use this to diff a real device run against a known-good one. All native log lines are tagged
`OpenOTA` (see `OpenOTALogger.kt`) and visible via:

```bash
adb logcat -s OpenOTA:* ReactNativeJS:*
```

## State transition table (happy path: fresh install → sync → restart)

| Step | Trigger | `RuntimeState` before | `RuntimeState` after | Persisted? |
|---|---|---|---|---|
| 1 | App installed, never synced | — | `EMBEDDED` | yes (default) |
| 2 | `OTA.check()` finds an update | `EMBEDDED` | `EMBEDDED` (check doesn't mutate runtime state — it's a server call) | n/a |
| 3 | `setBundlePath()` (candidate registered) | `EMBEDDED` | `DOWNLOADED` | no (in-memory only until activation) |
| 4 | `activateBundle()` — manifest/hash/runtimeVersion verified | `DOWNLOADED` | `VERIFIED` → `EXTRACTED` → `INSTALLED` → `ACTIVATED` | yes, at `ACTIVATED` |
| 5 | App restarts (`OTA.restart()` or manual relaunch) | `ACTIVATED` | `ACTIVATED` (unchanged; `BundleLoader` now serves the new path) | yes |
| 6 | Next cold start, boot never confirmed twice in a row | `ACTIVATED` | `ROLLBACK` → `ACTIVATED` (previous generation) | yes |

Illegal transitions (e.g. `EMBEDDED` → `VERIFIED` directly, or `ACTIVATED` → `INSTALLED`) throw
`IllegalStateTransitionException` and must never be observed in a real run — if one appears in
logcat, that is itself a certification failure.

## Expected logcat lines, in order, for a successful sync + activation

```
I OpenOTA: [activate.verify] ok in <N>ms
I OpenOTA: Activated <version> (runtime <runtimeVersion>)
```

For a failed verification (e.g. bad checksum):

```
E OpenOTA: Activation failed: Checksum mismatch for android@<version>: expected <sha>, got <sha>
```

For an automatic crash-loop rollback:

```
W OpenOTA: Detected 2 unconfirmed boots of <version>; rolling back
I OpenOTA: Rolled back to <previousVersion>
```

## Expected JS-side log sources (Developer Playground → Logs tab)

The Playground tags every event by source; a healthy sync produces, in order:

| Source | Level | Message (paraphrased) |
|---|---|---|
| `server` | info | `Update available: v<version>` |
| `sdk` | info | `Downloaded, extracted and verified v<version>` |
| `native` | info | `Installed v<version>` |
| `sdk` | info | `Sync complete: updated` |
| `native` | debug | `Fetched runtime info` (from the post-sync refresh) |

A run that jumps straight from `server` to `native: Installed` with **no** `sdk: Downloaded,
extracted and verified` line is a certification failure — it means verification was bypassed.

## Expected timings (informational — no fixed SLA, but investigate order-of-magnitude regressions)

| Stage | Typical range (emulator, small fixture bundle) |
|---|---|
| Download | 10-200ms (network-bound; depends on package size) |
| Extract + Verify | 5-50ms (SHA-256 over the JS bundle only, not the whole zip) |
| Install + Activate | 5-30ms (filesystem rename, not a copy) |

If any stage regresses by an order of magnitude on the same fixture, treat it as a performance
regression worth investigating even though it isn't a hard-fail criterion above.
