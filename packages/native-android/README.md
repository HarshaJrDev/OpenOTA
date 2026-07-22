# @openota/native-android

Android native runtime module for [OpenOTA](https://github.com/HarshaJrDev/OpenOTA) — bundle staging, verification, activation, and rollback, exposed to JS as the `OpenOTA` TurboModule.

This package contains **no JS API of its own** — it's a native-only companion to [`@openota/sdk`](https://www.npmjs.com/package/@openota/sdk), which provides the TypeScript API and the TurboModule spec that this module's Kotlin implementation satisfies. Install both together; React Native's autolinking picks up this package's native Android sources automatically.

## Install

```sh
npm install @openota/sdk @openota/native-android
```

No further setup is required beyond a standard React Native New Architecture (TurboModules) build — the module is autolinked via its `codegenConfig` in `package.json`.

## Required integration: `runtimeVersion`

Your `MainApplication.kt` (or `MainApplication.java`) **must** pass an explicit `runtimeVersion` to `BundleLoader.getJSBundleFile()`. This is not optional — without it, OTA updates will fail native verification with `INVALID_RUNTIME` (see below).

```kotlin
import com.openota.runtime.BundleLoader

// Must exactly match "runtimeVersion" in this app's openota.config.json.
private const val OPENOTA_RUNTIME_VERSION = "1.0.0"

class MainApplication : Application(), ReactApplication {
  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages,
      jsBundleFilePath = BundleLoader.getJSBundleFile(applicationContext, OPENOTA_RUNTIME_VERSION),
    )
  }
  // ...
}
```

### `runtimeVersion` vs. `version` vs. `package.json`'s `version` vs. Android `versionName`

These are four different, independent concepts. None of them controls any of the others:

| Concept | Example | Meaning |
|---|---|---|
| **OTA release `version`** | `1.0.4` | Identifies *which* OTA bundle this is (`openota release --version 1.0.4`). Changes on every release. |
| **`runtimeVersion`** | `1.0.0` | Native binary compatibility generation. An OTA bundle is only served to devices whose native runtime reports this exact value. Must be valid semver (`^\d+\.\d+\.\d+$`) — the OpenOTA server rejects anything else. Stays the same across many OTA releases; only bump it when a native dependency or native API changes in a way that makes older JS bundles unsafe to run against the new binary. |
| **`package.json` `version`** | `0.0.1` | npm package metadata. Has no relationship to either of the above and must never be used to derive `runtimeVersion` — that was the root cause of a real production bug (see the CLI's `manifest.service.ts` history). |
| **Android `versionName`** | `1.0` | The APK's own display version. Not required to be valid semver (Android accepts any string), so it may not even be usable as a `runtimeVersion` suggestion as-is — `openota init` only auto-suggests it when it already happens to match `X.Y.Z`. |

Example compatibility matrix for an app whose native binary is `runtimeVersion = "1.0.0"`:

```
1.0.1 → runtimeVersion 1.0.0   ✓ compatible
1.0.2 → runtimeVersion 1.0.0   ✓ compatible
1.0.3 → runtimeVersion 1.0.0   ✓ compatible
1.0.4 → runtimeVersion 1.0.0   ✓ compatible
2.0.0 → runtimeVersion 2.0.0   ✗ rejected by this app (and 1.0.0-generation bundles are rejected by a 2.0.0 app)
```

If you ship a new APK with a breaking native change, bump `OPENOTA_RUNTIME_VERSION` (and the corresponding `openota.config.json`) to `"2.0.0"`. `BundleVerifier` will then correctly refuse to activate `1.0.0`-generation bundles on `2.0.0` devices, and vice versa — this is enforced natively, independent of the JS SDK.

### Why this can't be automatic

`openota.config.json` is a JavaScript/CLI-side file — there is no reliable, safe way for Kotlin code to read it directly from a developer's machine or from inside a release APK. The native runtime has no way to *derive* the correct `runtimeVersion` on its own (Android's `versionName` is a plausible-looking but incorrect proxy — they're different concepts that happen to look similar). The one correct mechanism is the explicit parameter `BundleLoader.getJSBundleFile(context, runtimeVersion)` already supports; pick one value, put it in both places, and keep them in sync deliberately.

## License

MIT
