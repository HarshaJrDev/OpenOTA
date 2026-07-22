# @openota/cli

Official CLI for [OpenOTA](https://github.com/HarshaJrDev/OpenOTA) — build, upload, and release OTA (over-the-air) packages for React Native apps.

## Install

```sh
npm install -g @openota/cli
# or run without installing:
npx @openota/cli --help
```

## Commands

```sh
openota init       # scaffold OpenOTA config in a React Native project
openota doctor      # verify your project is set up correctly
openota build        # build a release JS bundle + assets
openota upload      # upload a built package to an OpenOTA server
openota release       # build, upload and activate a release in one step
openota rollback     # roll a platform back to a previously uploaded version
openota login          # authenticate against an OpenOTA server
openota logout          # clear stored credentials
```

Run `openota <command> --help` for command-specific options.

## Configuration (`openota.config.json`)

```json
{
  "serverUrl": "https://your-openota-server.example.com/api/v1",
  "deployment": "production",
  "platforms": ["android"],
  "bundleOutput": "./openota",
  "runtimeVersion": "1.0.0"
}
```

- **`serverUrl`** can be overridden at runtime with the `OPENOTA_SERVER_URL` environment variable, without editing this file — useful for pointing CI, a staging backend, or a different deployment (Railway, Render, local) at a different server without committing a config change. Example: `OPENOTA_SERVER_URL=https://openota.onrender.com/api/v1 openota release --version 1.0.4`.
- **`version`** (passed as `openota release --version 1.0.4`) identifies *which* OTA release this is. Changes on every release.
- **`runtimeVersion`** identifies native binary compatibility. An OTA bundle is only installed on devices whose native runtime reports this exact value — it must match the value your Android host app passes to `BundleLoader.getJSBundleFile(context, runtimeVersion)` (see `@openota/native-android`'s README for the required `MainApplication.kt` integration).

`runtimeVersion` is **required** and is never derived from `package.json`'s own `version` field, from the release `--version`, or from Android's `versionName` — those are four independent concepts. If it's missing, every CLI command that builds a manifest fails immediately with:

```
OpenOTA configuration error:
"runtimeVersion" is required.

Add it to openota.config.json:

{
  "runtimeVersion": "1.0.0"
}
```

`openota init` will suggest a `runtimeVersion` detected from `android/app/build.gradle`'s `versionName` if present *and* already valid semver, but always writes it explicitly into the generated config — pass `--runtime-version <value>` to set it yourself.

Example: an APK whose native runtime is `runtimeVersion = "1.0.0"` accepts every OTA release built against that same `runtimeVersion`, regardless of their own `version`:

```
1.0.1 → runtimeVersion 1.0.0   ✓ compatible
1.0.2 → runtimeVersion 1.0.0   ✓ compatible
1.0.3 → runtimeVersion 1.0.0   ✓ compatible
1.0.4 → runtimeVersion 1.0.0   ✓ compatible
```

If a native dependency or native API changes in a way that makes older JS bundles unsafe to run, release a new APK with `runtimeVersion = "2.0.0"` — bundles built for `1.0.0` are then rejected by that app (`INVALID_RUNTIME`), and vice versa.

## Authentication (`login` / `logout`)

Self-hosted OpenOTA has no account/org system — `login`/`logout` manage a single shared secret,
not a per-user credential. It only does anything if the server you're pointing at was started
with `OPENOTA_API_KEY` set (see `docs/SELF_HOSTING.md` "Authentication"); if the server has no key
configured, it accepts requests with or without one.

```sh
openota login --api-key <the value your server admin gave you>   # writes it into openota.config.json
openota logout                                                     # removes it
```

Once logged in, `upload`/`release`/`rollback` automatically send it as `Authorization: Bearer <key>`.
`check`/download requests from devices never need this — only the release/rollback/delete
operations a server admin performs are gated.

## License

MIT
