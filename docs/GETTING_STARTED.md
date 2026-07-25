# Getting started with OpenOTA

This is the end-to-end path from "nothing installed" to "a real user's device picks up a JS
change with no App Store review." Every command here is real and has been run against the live
production stack (`https://openota.onrender.com` + a private Supabase bucket) while writing this.

If you just want the command list without the walkthrough, see [COMMANDS.md](./COMMANDS.md).

## 0. Decide: use the hosted backend, or self-host?

| | Hosted (this repo's deployment) | Self-hosted |
|---|---|---|
| Server URL | `https://openota.onrender.com/api/v1` | your own, e.g. `http://localhost:3001/api/v1` |
| Storage | Supabase (already configured) | `LocalStorageProvider` (disk) by default |
| Setup needed | none — just point your app at it | run `apps/server` yourself, see `apps/server/README.md` |

The rest of this guide works identically either way — only the `--server-url` / `OPENOTA_SERVER_URL` value changes.

## 1. Add OpenOTA to your React Native app

```sh
npm install @openota/sdk @openota/native-android @openota/cli --save-dev
```

### 1a. Wire the native Android runtime

`@openota/native-android` autolinks, but **one manual step is mandatory**: your
`MainApplication.kt` must build its `reactHost` with `OpenOTAReactHost.create()` (not RN's own
`getDefaultReactHost()`), passing an explicit `runtimeVersion`. `getDefaultReactHost()`'s
`jsBundleFilePath` is only ever resolved once, at process start — so `ReactHost.reload()` after an
OTA activation would keep replaying whatever bundle was active at cold start instead of the newly
activated one. `OpenOTAReactHost.create()` re-resolves the active bundle on every reload instead.
`runtimeVersion` itself gates whether an OTA bundle is even allowed to run against this native
binary — it is never inferred automatically, on purpose (see
`packages/native-android/README.md` for the full reasoning).

```kotlin
import com.openota.runtime.OpenOTAReactHost

private const val OPENOTA_RUNTIME_VERSION = "1.0.0"

class MainApplication : Application(), ReactApplication {
  override val reactHost: ReactHost by lazy {
    OpenOTAReactHost.create(
      context = applicationContext,
      packageList = PackageList(this).packages,
      runtimeVersion = OPENOTA_RUNTIME_VERSION,
    )
  }
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
```

### 1b. Initialize the SDK once, at app startup

```ts
import { OTA } from "@openota/sdk";

OTA.configure({
  serverUrl: "https://openota.onrender.com/api/v1", // or your self-hosted URL
  channel: "production",
  autoRestart: false,   // if true, OTA.sync() restarts the app automatically after installing
  requestTimeout: 15_000,
});
```

## 2. Initialize the CLI in your project

```sh
cd your-react-native-app
npx openota init --server-url https://openota.onrender.com/api/v1 --runtime-version 1.0.0
```

This writes `openota.config.json`:

```json
{
  "serverUrl": "https://openota.onrender.com/api/v1",
  "deployment": "production",
  "platforms": ["android", "ios"],
  "bundleOutput": "./openota",
  "runtimeVersion": "1.0.0"
}
```

`runtimeVersion` here **must exactly match** `OPENOTA_RUNTIME_VERSION` in `MainApplication.kt`
above. If Android's `versionName` in `android/app/build.gradle` is already valid semver,
`init` suggests it automatically; otherwise pass `--runtime-version` explicitly.

Run `npx openota doctor` any time to sanity-check your environment (Node, RN project detection,
Android/iOS folders, Metro, config presence, and server reachability).

## 3. Ship a change

Make a real JS change to your app, then:

```sh
npx openota release --version 1.0.1 --platform android
```

This does three things in one command:
1. Runs Metro to produce a real production JS bundle, hashes it (SHA-256), writes a manifest.
2. Zips bundle + manifest + metadata.
3. Uploads the zip to your OpenOTA server, which stores it (Supabase or local disk) and moves
   the platform's "active version" pointer forward to `1.0.1`.

You'll see:
```
✔ Bundle created
✔ Assets copied (N files)
✔ Manifest generated
✔ Package archived
✔ android uploaded: https://<bucket>.supabase.co/storage/v1/object/sign/...?token=...
```

That URL is a short-lived signed download URL — it's generated fresh per request and is never
stored anywhere; don't rely on it staying valid beyond a few minutes.

Point a different environment at this without touching `openota.config.json`:
```sh
OPENOTA_SERVER_URL=http://localhost:3001/api/v1 npx openota release --version 1.0.1-staging --platform android
```

## 4. Verify the release landed

```sh
curl -s "https://openota.onrender.com/api/v1/packages/check?platform=android&currentVersion=1.0.0" | jq
```
```json
{
  "success": true,
  "data": {
    "available": true,
    "latestVersion": "1.0.1",
    "downloadUrl": "https://.../storage/v1/object/sign/...",
    "manifest": { "bundleVersion": "1.0.1", "runtimeVersion": "1.0.0", "sha256": "...", "size": 123456 }
  }
}
```

## 5. What happens on a real device

A device already running your app (on `1.0.0`) eventually calls `OTA.sync()` — either you wire
this to an app-launch hook, a timer, or a pull-to-refresh; OpenOTA doesn't decide this for you.

```
OTA.sync()
  → check()      asks the server: "is there anything newer than 1.0.0 for runtimeVersion 1.0.0?"
  → download()   streams the zip from the signed URL, with progress callbacks
  → verify       SHA-256 of the *extracted bundle* must match the manifest's sha256
  → extract      unzips into a private app directory
  → install()    the native runtime stages it as the "next" bundle
  → (restart)    on next cold start (or immediately if autoRestart / OTA.restart()), the new
                 bundle loads instead of the embedded one
```

If verification fails at any step, the device silently keeps running its current bundle — a bad
network transfer or a tampered package never gets a chance to run.

### Crash-loop safety net

If the *new* bundle itself crashes on boot (a real bug you shipped), the native runtime's own
boot-attempt counter trips and it automatically falls back to the last known-good bundle on the
next launch — no server round-trip needed, no user intervention.

## 6. Roll back

Two independent rollback mechanisms exist, and it's important to know which one you need:

**Server-side rollback** — stops the bug from spreading to devices that haven't updated yet:
```sh
npx openota rollback --platform android --version 1.0.0
```
This moves the "active version" pointer back. `1.0.1`'s package is **not deleted** — a device
can be rolled forward to it again later. Devices already on `1.0.1` are unaffected (`check()`
only offers forward updates — `compareSemver(active, current) > 0` — so this alone won't
downgrade a device that already installed the bad version).

**Device-side rollback** — reverts a device that already installed the bad version:
```ts
await OTA.rollback(); // restores the previously-installed bundle from the native rollback slot
```
This is what the crash-loop safety net calls automatically; you can also trigger it manually
(e.g. from a support/debug menu) if a bug isn't crash-detectable but is otherwise bad enough to
back out of immediately.

In practice: ship a fix as a *new* version (`1.0.2`) rather than relying on rollback as your
primary fix mechanism — rollback is for stopping the bleeding, not for shipping fixes.

## 7. Negative paths (what happens when something's wrong)

| Situation | What happens |
|---|---|
| Corrupt/truncated zip | Extraction fails; device stays on current bundle |
| SHA-256 mismatch | `verify` step throws `VERIFICATION_FAILED`; bundle is discarded |
| `runtimeVersion` mismatch | Server won't even offer it as "available" for that device |
| Package exceeds size limit | Upload rejected server-side with `PACKAGE_TOO_LARGE` (see below) |
| New bundle crashes on boot | Native crash-loop detector reverts to last good bundle automatically |

Package size is a **deployment** setting, not a protocol limit — the hosted backend currently
caps uploads at 50MB (`OPENOTA_MAX_PACKAGE_SIZE_MB=50`, matching Supabase's Free plan per-file
cap). A rejected upload looks like:
```json
{ "error": { "code": "PACKAGE_TOO_LARGE", "message": "...", "details": { "maxBytes": 52428800, "actualBytes": 61234000 } } }
```

## 8. Full command and endpoint reference

See [COMMANDS.md](./COMMANDS.md).
