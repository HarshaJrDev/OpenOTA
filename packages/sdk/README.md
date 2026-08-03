# @openota/sdk

Official React Native SDK for [OpenOTA](https://github.com/HarshaJrDev/OpenOTA) — check, download, verify, and install OTA (over-the-air) JS bundle updates.

The SDK is the JS-side API. On Android, it talks to the native runtime module shipped in [`@openota/native-android`](https://www.npmjs.com/package/@openota/native-android), which must also be installed for autolinking to register the native `OpenOTA` TurboModule.

## Install

```sh
npm install @openota/sdk @openota/native-android
```

`@openota/sdk` declares its native dependencies (`react-native-fs`, `react-native-mmkv`, `react-native-quick-crypto`, `react-native-zip-archive`) as peer dependencies — install them alongside the SDK if they aren't already in your app.

## Usage

```ts
import { OTA } from "@openota/sdk";

// One-shot check + download + install, with progress reporting:
const result = await OTA.sync((progress) => console.log(progress));

// Or drive each step yourself:
const check = await OTA.check();
if (check.available && check.manifest) {
  const extracted = await OTA.download(check.manifest);
  await OTA.install(extracted);
  await OTA.restart();
}
```

See the exported types (`RuntimeInfo`, `OTAError` and its subclasses, `LogHandler`) for the full public API surface.

## Real-time updates (optional)

By default a device only learns about a new release the next time your app calls `OTA.sync()`.
To have the server nudge an already-open app instantly instead:

```ts
OTA.connectLive(); // e.g. right after OTA.configure()
// ...
OTA.disconnectLive(); // e.g. on unmount
```

Pass your own callback to react to it yourself instead of the default silent `OTA.sync()`:

```ts
OTA.connectLive(() => {
  // a release, rollback, or rollout-percentage change just happened on this channel
  OTA.sync();
});
```

Pure JS (React Native's built-in `WebSocket`), no native setup required. Reconnects automatically
with backoff. Only reaches the app while it's open or backgrounded-but-alive — a fully closed app
isn't woken up.

## License

MIT
