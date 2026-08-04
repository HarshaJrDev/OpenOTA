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

// react-native-quick-base64 and react-native-nitro-modules are transitive *peer* dependencies of
// react-native-quick-crypto/react-native-mmkv (Nitro-based versions) — npm/yarn happily hoists
// them into node_modules without them ever landing in the app's own package.json, and RN's
// autolinking only considers packages the app's package.json actually declares. Left undeclared,
// autolinking silently skips them, producing a runtime "TurboModuleRegistry.getEnforcing(...):
// 'QuickBase64' could not be found" crash that looks nothing like a missing-dependency problem.
export const SDK_NATIVE_DEPS = [
  "react-native-mmkv",
  "react-native-fs",
  "react-native-zip-archive",
  "react-native-quick-crypto",
  "react-native-quick-base64",
  "react-native-nitro-modules",
] as const;
