# @openota/cli

## 0.2.5

### Patch Changes

- `openota login --api-key <key>` now validates the key against the target server before saving it,
  instead of saving unconditionally and printing "Logged in." regardless of whether the server
  actually accepts it. That silent-save behavior is exactly how a key ends up paired with the wrong
  server (a Cloud project's key saved against a self-hosted deployment, or vice versa) — the mismatch
  only ever surfaced later as a confusing 401 on `openota release`.

  `resolveProjectFromKey` now returns a four-way result based on the server's real `GET /projects/me`
  response — a genuinely valid project-scoped key, a valid self-hosted flat key, an explicit
  rejection, or "server unreachable" (a network blip, not a verdict on the key). `login` blocks and
  exits non-zero on an explicit rejection, but still saves on "unreachable" so a correct key isn't
  punished for a transient timeout. `doctor`'s project-access check was updated to the same four-way
  result.

  Verified against real infrastructure: a Cloud project's key against a dedicated self-hosted server
  is now rejected with a clear message instead of silently succeeding, and the same key against the
  Cloud server still logs in and links the project correctly.

## 0.2.4

### Patch Changes

- `@openota/cli`: bump `adm-zip` to 0.6.0, patching a high-severity DoS (GHSA-xcpc-8h2w-3j85) where a
  crafted zip's declared uncompressed size could trigger an oversized memory allocation before any
  real decompression happens.

  `@openota/shared`: add `PACKAGE_IN_USE` to `ERROR_CODES` — returned (409) when deleting a package
  version that's currently active on any channel, instead of silently breaking `checkForUpdate` for
  every device on that channel.

- Updated dependencies
  - @openota/shared@0.2.0

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
