# @openota/native-android

Android native runtime module for [OpenOTA](https://github.com/HarshaJrDev/OpenOTA) — bundle staging, verification, activation, and rollback, exposed to JS as the `OpenOTA` TurboModule.

This package contains **no JS API of its own** — it's a native-only companion to [`@openota/sdk`](https://www.npmjs.com/package/@openota/sdk), which provides the TypeScript API and the TurboModule spec that this module's Kotlin implementation satisfies. Install both together; React Native's autolinking picks up this package's native Android sources automatically.

## Install

```sh
npm install @openota/sdk @openota/native-android
```

No further setup is required beyond a standard React Native New Architecture (TurboModules) build — the module is autolinked via its `codegenConfig` in `package.json`.

## License

MIT
