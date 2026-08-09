# @openota/sdk

## 0.4.0

### Minor Changes

- Add FCM push notifications for killed-app OTA delivery, complementary to the existing WebSocket
  live path (`OTA.connectLive()`), which only reaches an app that's open or backgrounded-but-alive.

  `@openota/native-android`: new `getFcmToken()`/`registerForPushNotifications()` native methods, a
  `FirebaseMessagingService` that shows a real (operator-customizable) notification even when the
  app is fully closed, and tapping it opens the app. Requires the consuming app to add its own
  Firebase project (`google-services.json` + the Google Services Gradle plugin) — fully opt-in,
  nothing hardcoded to a shared Firebase project. See docs/CLOUD.md for setup.

  `@openota/sdk`: new `OTA.registerPush()` — idempotent, requests the Android 13+ notification
  permission, registers the device's FCM token with the server, and keeps it current across
  rotations.

## 0.3.2

### Patch Changes

- Updated dependencies
  - @openota/shared@0.2.0

## 0.3.1

### Patch Changes

- Fix `0.3.0` being published with the literal `"@openota/shared": "workspace:*"` as a dependency
  instead of a resolved version — made the package uninstallable by any consumer outside this
  monorepo (`npm install @openota/sdk` failed with `EUNSUPPORTEDPROTOCOL`). Root cause: `changeset
publish` shells out to plain `npm publish`, which doesn't rewrite pnpm's `workspace:*` protocol
  the way `pnpm publish` does — confirmed via `pnpm pack`, which resolves it correctly. Publishing
  this fix via `pnpm publish` directly, not `changeset publish`.

## 0.3.0

### Minor Changes

- 19463f8: Publish `OTA.connectLive()` / `OTA.disconnectLive()` — real-time release/rollback notifications over
  a WebSocket connection, added in b82f76d but never previously released. A device that calls
  `connectLive()` is notified the instant a release, rollback, or rollout-percentage change happens
  on its channel, instead of only finding out on the next `check()`/`sync()` call or app resume.

  This was source-complete in the monorepo but missing from every published `0.2.x` release —
  confirmed by inspecting the published tarball directly, not just local build output.

## 0.2.1

### Patch Changes

- Fix 0.2.0: `npm publish` was used instead of `pnpm publish` to work around an OTP prompt, which skipped pnpm's `workspace:*` → real-version rewrite. That left `@openota/shared: workspace:*` in the published package.json, which breaks `npm install`/`yarn add` for anyone consuming these packages. 0.2.0 is deprecated in favor of this version.

## 0.2.0

### Minor Changes

- Sync the published packages with OpenOTA Cloud, which has moved well past what 0.1.0 knew about:
  - `@openota/cli`: `login`/`init`/`doctor` for Cloud project auth, `--release-notes` on `release`/`upload`, `--reason` on `rollback`, credentials stored outside `openota.config.json`.
  - `@openota/sdk`: `OTA.configure()` accepts `projectId` and `channel` to route through the project-scoped Cloud endpoints; sends an anonymous device ID so check-ins are attributable; reports install/failure/rollback outcomes back to the server for Analytics.
  - `@openota/shared`: type/schema updates backing the above (channels, install-result status, project-scoped response shapes).

### Patch Changes

- Updated dependencies
  - @openota/shared@0.1.1
