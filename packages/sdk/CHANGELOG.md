# @openota/sdk

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
