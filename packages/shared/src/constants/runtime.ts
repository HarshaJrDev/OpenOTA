export const CURRENT_MANIFEST_SCHEMA_VERSION = 1;

export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const DEFAULT_AUTO_RESTART = true;

export const MAX_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
] as const;

/** Maximum unconfirmed cold boots of the same activated bundle before the runtime auto-rolls-back. */
export const MAX_UNCONFIRMED_BOOTS = 2;

export const MMKV_INSTANCE_ID = "openota";

export const MMKV_KEYS = {
  currentVersion: "openota.current.version",
  currentBundlePath: "openota.current.bundlePath",
  currentManifest: "openota.current.manifest",
  deviceId: "openota.device.id",
} as const;
