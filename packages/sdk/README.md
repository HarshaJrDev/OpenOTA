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

## License

MIT
