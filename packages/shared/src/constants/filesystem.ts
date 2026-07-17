export const PACKAGE_ZIP_FILENAME = "ota-package.zip";
export const MANIFEST_FILENAME = "manifest.json";
export const METADATA_FILENAME = "metadata.json";

export const BUNDLE_DIR_NAME = "bundle";
export const ASSETS_DIR_NAME = "assets";

export const BUNDLE_FILENAME_BY_PLATFORM = {
  android: "index.android.bundle",
  ios: "index.ios.bundle",
} as const;

/** The on-device root directory name every runtime/SDK writes under — never write outside it. */
export const OPENOTA_ROOT_DIR = "OpenOTA";
export const CURRENT_DIR = "current";
export const ROLLBACK_DIR = "rollback";
export const DOWNLOADS_DIR = "downloads";
export const BUNDLES_DIR = "bundles";
export const CACHE_DIR = "cache";
export const TMP_DIR = "tmp";
export const LOGS_DIR = "logs";
