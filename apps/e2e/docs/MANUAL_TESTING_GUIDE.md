# Manual Testing Guide — Real Device/Emulator Validation

The automated suites (`test:server` and `:e2e:connectedDebugAndroidTest`) certify every mechanical
piece of the pipeline. They cannot prove the one thing that ultimately matters to a user: that a
real running app, after `openota release`, actually shows new UI **without reinstalling the APK**.
This guide is that proof, and matches the "OTA Release Validation" workflow described in the
Developer Playground's About tab.

Estimated time: 10-15 minutes. Requires: an Android emulator or device, adb, and a built
Developer Playground (`apps/example`).

## 0. One-time setup

```bash
cd /path/to/OpenOTA
pnpm install

# Start an emulator (or connect a real device) — confirm it's visible:
adb devices
```

## 1. Start the real server

```bash
cd apps/server
STORAGE_ROOT=/tmp/openota-manual-storage PORT=3001 pnpm start
# leave this running in its own terminal
```

## 2. Install and launch the Developer Playground

```bash
cd apps/example
# Android emulator must already be running / device connected
pnpm android
```

Confirm the app launches and the **Dashboard** tab shows:
- `Current Bundle Version`: `embedded`
- `Current Runtime State`: `EMBEDDED`

If the emulator can't reach `localhost:3001` from inside, check `src/services/playgroundConfig.ts`
— it defaults to `10.0.2.2:3001` for the Android emulator, which routes to the host machine.

## 3. Create a throwaway RN project to release from

You do not need a real RN app to validate the pipeline mechanically — the CLI only needs a
`package.json` with a `version` and something that behaves like `react-native bundle`. For a real
device demo, use any actual RN app; for the fastest repeatable check, reuse the harness this suite
itself uses:

```bash
cd apps/e2e
pnpm fixtures:generate   # also leaves a throwaway project at ../../.e2e-work/fake-rn-app
```

Or, to see your own edited RN app's UI actually change, point `openota release` at a real project
and edit its `index.js`/root component before releasing.

## 4. Run `openota release`

```bash
cd ../../.e2e-work/fake-rn-app   # or your own RN project
node ../../node_modules/tsx/dist/cli.mjs ../../packages/cli/src/cli.ts release --version 2.0.0 --platform android
```

Expected terminal output:

```
Building android package v2.0.0
✔ Bundle created
✔ Assets copied (1 files)
✔ Manifest generated
✔ Package archived
✔ android uploaded: /api/v1/packages/android/2.0.0/download

Release complete
```

## 5. Press Sync in the Playground

In the app: **Updates tab → Press Sync**.

Watch, in order:
1. A progress bar appears with stage labels (`Downloading package…`, `Extracting package…`,
   `Verifying checksum…`, `Installing & activating…`).
2. The **Logs** tab (filter: `all`) shows, in order: a `server` line (`Update available: v2.0.0`),
   an `sdk` line (`Downloaded, extracted and verified v2.0.0`), a `native` line
   (`Installed v2.0.0`), an `sdk` line (`Sync complete: updated`).
3. The **Runtime Inspector** tab's diagram highlights `ACTIVATED`.

## 6. Observe restart

Auto-restart is **off by default** in the Playground (see Settings tab — deliberately, so you can
observe each step first). Go to **Developer Tools → Force Restart**.

```bash
adb logcat -s ReactNativeJS:* OpenOTA:*
```

You should see the JS context tear down and reinitialize (no process kill, no Activity recreate —
just a JS bundle reload) within roughly 1-3 seconds.

## 7. Confirm UI changes — the actual proof

After the restart:

- **Dashboard tab → Current Bundle Version** must now read `2.0.0` (was `embedded`).
- **Runtime Inspector** must show `ACTIVATED` with `Bundle Version: 2.0.0`.
- **Bundle Explorer** must show the manifest for `2.0.0` — `SHA256`, `Bundle Size`, `Runtime
  Version`, `Manifest Version` all populated from the real upload.

If your throwaway RN project's `index.js` printed something different for v2.0.0 (edit it before
step 4), you'd see that different behavior reflected too — the fixture harness's fake bundle is a
static placeholder, so for a true "new UI is loaded" visual check, use a real RN entry point that
renders something visibly different, bundle+release that, and repeat steps 4-7.

## 8. Validate rollback

**Developer Tools → Force Rollback.**

Expected: `Dashboard → Current Bundle Version` returns to `embedded` (there's only one prior
generation — the embedded one — since this was the first OTA install). Release a v3.0.0 first (repeat
steps 3-5 with `--version 3.0.0`) if you want to roll back to `2.0.0` instead of all the way to
embedded.

## 9. Validate reset

**Developer Tools → Reset Runtime**, confirm the dialog. Expected: back to `EMBEDDED`, matching
step 2's initial state exactly — this is the same assertion `LifecycleIntegrationTest.a7` makes
automatically.

## Sign-off checklist

- [ ] Step 2: fresh install serves the embedded bundle
- [ ] Step 5: Sync transitions through every stage, in order, with no skipped step
- [ ] Step 6: restart happens via JS reload, not a process kill or activity recreate
- [ ] Step 7: Dashboard/Runtime Inspector/Bundle Explorer all reflect the new version post-restart
- [ ] Step 8: rollback restores the previous generation
- [ ] Step 9: reset returns to the exact initial (embedded) state
