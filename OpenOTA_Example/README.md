# OpenOTA Example

A real OTA client for the [OpenOTA](https://openota.xyz) platform — not a mock, not a local demo.
Every screen in this app talks to the live, production OpenOTA Cloud API
(`https://api.openota.xyz`) through the real, published
[`@openota/sdk`](https://www.npmjs.com/package/@openota/sdk) and
[`@openota/native-android`](https://www.npmjs.com/package/@openota/native-android) packages.

## What this app is (and isn't)

This app demonstrates **only** the OTA client lifecycle: checking for an update, downloading and
installing it, rolling back, and inspecting the device's own runtime/version state. It does
**not** reimplement release, channel, or device management — that's the OpenOTA Dashboard's job
(`dashboard.openota.xyz`), which talks to the same server. See **Settings → OpenOTA platform** in
the app for direct links to the website, docs, dashboard, and GitHub repo.

## Screens

| Tab | What it shows |
|---|---|
| **Updates** | Installed version + runtime state, live update-availability check, download/install progress, rollback |
| **Device** | Platform/OS, build info (runtime version, bundle version, install time, bundle path), current environment (channel/project/server) |
| **History** | A real, on-device log of check/download/install/rollback events this device actually experienced (see `src/lib/otaHistory.ts` for why this is local rather than server-fetched — device-facing OTA routes are intentionally anonymous, with no session to list history against) |
| **Settings** | Switch release channel (production/staging/development), links to the OpenOTA platform |

## Configuration

`openota.config.json` at the repo root pins this build to a real project on the live server:

```json
{
  "serverUrl": "https://api.openota.xyz/api/v1",
  "projectId": "7353a847-e740-4378-8366-62cb93633754",
  "runtimeVersion": "1.0.0"
}
```

`src/context/OtaContext.tsx` calls `OTA.configure()` once at startup with these values — the same
mechanism any real OpenOTA-integrated app uses.

## Native integration

`android/app/src/main/java/com/openota_example/MainApplication.kt` builds its `ReactHost` with
`OpenOTAReactHost.create(...)`, not React Native's default — required so that activating or
rolling back a bundle actually takes effect on restart. See `@openota/native-android`'s README for
why this can't be automatic, and the `OPENOTA_RUNTIME_VERSION` constant, which must always match
`openota.config.json`'s `runtimeVersion`.

iOS has no native OpenOTA runtime module yet — the SDK's core (`OTA.check()`, live updates) still
works, but install/rollback are Android-only until a native-iOS port exists.

## Publishing a real release to try this against

From this directory (`OpenOTA_Example/`), with an OpenOTA API key configured
(`openota login`, or `OPENOTA_API_KEY`) — the CLI reads `openota.config.json`, builds the bundle
itself, and uploads it in one step:

```sh
npx openota release --version 1.0.1 --channel production --release-notes "First OTA update"
```

Then reopen the app and pull-to-refresh (or tap **Check for update**) on the Updates tab — the
update, its size, and its progress will all come from the real server response.

## Running locally

```sh
npm install
npm run android   # requires an Android emulator/device — this is where OTA install/rollback actually run
```

`npm run ios` starts the JS side, but install/rollback are no-ops there (see above).
