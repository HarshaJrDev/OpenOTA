# @openota/native-android

## 0.1.2

### Patch Changes

- 1e721e8: Fix two related bugs in the runtime state machine's `ROLLBACK` handling, both found via real
  on-device testing (a rollback attempt during NearDeals Mobile's OpenOTA integration):
  1. **A device could get permanently stuck after any rollback.** `stateHolder` is constructed
     directly from the _persisted_ root manifest state on every `BundleManager` construction — a
     process kill/crash between `rollbackBundle()` writing `ROLLBACK` and it reaching `ACTIVATED`
     durably stranded a device at `ROLLBACK`, and `ROLLBACK` had no legal transition back into the
     install pipeline (`DOWNLOADED`). Every future app launch reconstructed `BundleManager` reading
     `ROLLBACK` off disk, and every subsequent OTA install attempt failed with
     `IllegalStateTransitionException: ROLLBACK -> DOWNLOADED` — permanently, until the app was
     reinstalled. Confirmed live: a real device hit exactly this after a rollback, and the next
     release upload failed to install.
  2. **A failed rollback masked its own real error.** `rollbackBundle()`'s catch block (for e.g.
     `NoRollbackAvailableException` — nothing to restore) transitions to `FAILED` before rethrowing —
     but `ROLLBACK -> FAILED` was never a legal edge either, so that recovery transition itself threw
     `IllegalStateTransitionException`, replacing the real, actionable exception the caller was
     supposed to see. A pre-existing test for exactly this case was already failing on `main`,
     independent of bug #1.

  Both fixed by adding `DOWNLOADED` and `FAILED` to `ROLLBACK`'s allowed transitions in
  `RuntimeState.kt`. New regression tests cover both.
