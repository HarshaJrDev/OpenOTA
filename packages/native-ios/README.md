# @openota/native-ios

iOS native runtime module for [OpenOTA](https://github.com/HarshaJrDev/OpenOTA) — bundle staging, verification, activation, and rollback, exposed to JS as the `OpenOTA` module.

This package contains **no JS API of its own** — it's a native-only companion to [`@openota/sdk`](https://www.npmjs.com/package/@openota/sdk), which provides the TypeScript API that this module's Swift implementation satisfies. Install both together; CocoaPods autolinking picks up this package's `OpenOTA.podspec` automatically.

## Install

```sh
npm install @openota/sdk @openota/native-ios
cd ios && pod install
```

No further Xcode setup is required beyond overriding `bundleURL()` in `AppDelegate.swift` (see below) — the module itself is autolinked.

## Required integration: `bundleURL()` + `runtimeVersion`

Your `AppDelegate.swift` **must** resolve the release-mode JS bundle through `OpenOTABundleResolver`, not React Native's default `main.jsbundle` lookup, and set an explicit `runtimeVersion`. Both are non-optional:

- Skipping the explicit `runtimeVersion` makes OTA updates fail native verification with `INVALID_RUNTIME` (see below).
- Skipping `OpenOTABundleResolver` means the app always boots the bundle it shipped with — an activated or rolled-back OTA bundle is never picked up, even though the server and JS side both think the update succeeded.

```swift
import OpenOTA // exposes RuntimeVersionSource, OpenOTABundleResolver

// Must exactly match "runtimeVersion" in this app's openota.config.json.
private let openOTARuntimeVersion = "1.0.0"

class AppDelegate: RCTAppDelegate {
  override func bundleURL() -> URL? {
    #if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
    RuntimeVersionSource.runtimeVersion = openOTARuntimeVersion
    return OpenOTABundleResolver.bundleURL(
      runtimeVersion: openOTARuntimeVersion,
      embeddedBundleURL: Bundle.main.url(forResource: "main", withExtension: "jsbundle"),
      storageRoot: nil
    )
    #endif
  }
}
```

The `#if DEBUG` branch is deliberate: `OpenOTABundleResolver` only ever resolves a *release*-mode bundle. In Debug builds the app should keep loading from Metro exactly as React Native does by default — an OTA bundle is never relevant while developing against a live packager.

### `runtimeVersion` vs. OTA release `version` vs. `package.json`'s `version`

Same three independent concepts as on Android — see [`@openota/native-android`'s README](https://github.com/HarshaJrDev/OpenOTA/tree/main/packages/native-android#runtimeversion-vs-version-vs-packagejsons-version-vs-android-versionname) for the full comparison table. In short: `runtimeVersion` is a native binary compatibility generation, set once per build and bumped only when a native change makes older JS bundles unsafe to run; it has no relationship to the OTA release version or to the npm package version.

## Push notifications (not yet implemented on iOS)

`getFcmToken()` and `registerForPushNotifications()` exist on this module only so JS call sites that call them unconditionally (the SDK doesn't branch by platform) never crash — they resolve to `null`/void instead of throwing. APNs/push wiring for iOS is out of scope for this phase; the existing real-time delivery path (`OTA.connectLive()`, WebSocket-based) works identically on iOS today and doesn't depend on push.

## Platform requirement

iOS 15.1+ (matches `s.platforms = { ios: "15.1" }` in `OpenOTA.podspec`). If your app also depends on a pod with a higher minimum (e.g. `react-native-zip-archive` requires 15.5), set your app's own `Podfile` platform to the higher of the two — CocoaPods does not do this automatically:

```ruby
platform :ios, [min_ios_version_supported, '15.5'].max
```

## License

MIT
