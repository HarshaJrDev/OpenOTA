export {
  ASSETS_DIR_NAME,
  BUNDLE_DIR_NAME,
  BUNDLE_FILENAME_BY_PLATFORM,
  MANIFEST_FILENAME,
  METADATA_FILENAME,
  PACKAGE_ZIP_FILENAME,
  PACKAGES_ENDPOINT,
  ROLLBACK_ENDPOINT,
  SUPPORTED_PLATFORMS,
} from "@openota/shared";

export const CONFIG_FILENAME = "openota.config.json";

export const DEFAULT_BUNDLE_OUTPUT = "./openota";

export const DEFAULT_DEPLOYMENT = "production";

export const ENTRY_FILE_CANDIDATES = ["index.js", "index.ts", "index.tsx"] as const;
