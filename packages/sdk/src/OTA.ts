import RNFS from "react-native-fs";
import { Platform } from "react-native";

import { configure as configureInternal, getConfig } from "./config.js";
import { OTAError } from "./errors.js";
import { nativeBridge, type RuntimeInfo } from "./native/index.js";
import { checkForUpdate } from "./services/check.service.js";
import { downloadPackage } from "./services/download.service.js";
import { extractPackage } from "./services/extract.service.js";
import { installPackage } from "./services/install.service.js";
import { rollbackPackage } from "./services/rollback.service.js";
import { syncPackage } from "./services/sync.service.js";
import { verifyPackage } from "./services/verify.service.js";
import { otaStorage } from "./storage.js";
import type {
  CheckResult,
  CurrentVersionInfo,
  ExtractResult,
  InstallResult,
  Manifest,
  OtaConfig,
  OtaConfigInput,
  SyncProgressListener,
  SyncResult,
} from "./types.js";
import { getCacheDir, getDownloadsDir } from "./utils/paths.js";

function currentPlatform(): "android" | "ios" {
  return Platform.OS === "android" ? "android" : "ios";
}

// download/extract/verify/install all write to fixed, version-keyed paths (not per-call temp
// names), so two concurrent OTA.sync() calls for the same update race on the same files —
// whichever finishes extracting/cleaning up first can delete or move a file the other is still
// mid-read on, surfacing as a spurious ENOENT that has nothing to do with the actual update. This
// is easy to trigger from app code that isn't even doing anything wrong: e.g. an AppState listener
// firing once for the initial mount's own transition alongside a useEffect's own sync() call. One
// in-flight sync at a time, shared by every caller, removes the race entirely rather than asking
// every integrator to build their own dedup.
let inFlightSync: Promise<SyncResult> | null = null;

export const OTA = {
  configure(input: OtaConfigInput): OtaConfig {
    return configureInternal(input);
  },

  async check(): Promise<CheckResult> {
    const currentVersion = otaStorage.getCurrentVersion() ?? "0.0.0";
    return checkForUpdate(currentPlatform(), currentVersion);
  },

  async download(manifest?: Manifest, onProgress?: (percent: number) => void): Promise<ExtractResult> {
    let target = manifest;

    if (!target) {
      const currentVersion = otaStorage.getCurrentVersion() ?? "0.0.0";
      const check = await checkForUpdate(currentPlatform(), currentVersion);

      if (!check.available || !check.manifest) {
        throw new OTAError("NO_UPDATE_AVAILABLE", "No update is available to download");
      }

      target = check.manifest;
    }

    const downloaded = await downloadPackage(target, onProgress);
    const extracted = await extractPackage(downloaded);
    return verifyPackage(extracted);
  },

  async install(extracted: ExtractResult): Promise<InstallResult> {
    return installPackage(extracted);
  },

  async sync(onProgress?: SyncProgressListener): Promise<SyncResult> {
    if (inFlightSync) {
      return inFlightSync;
    }

    inFlightSync = syncPackage(currentPlatform(), onProgress).finally(() => {
      inFlightSync = null;
    });

    return inFlightSync;
  },

  async rollback(): Promise<InstallResult> {
    return rollbackPackage();
  },

  getCurrentVersion(): CurrentVersionInfo {
    return {
      version: otaStorage.getCurrentVersion(),
      bundlePath: otaStorage.getCurrentBundlePath(),
      manifest: otaStorage.getCurrentManifest(),
    };
  },

  async clearCache(): Promise<void> {
    getConfig();

    for (const dir of [getDownloadsDir(), getCacheDir()]) {
      if (await RNFS.exists(dir)) {
        await RNFS.unlink(dir);
        await RNFS.mkdir(dir);
      }
    }
  },

  /** Raw snapshot of the native runtime's own state — version/bundle path/manifest/runtime version, as native sees it. */
  async getRuntimeInfo(): Promise<RuntimeInfo> {
    return nativeBridge.getRuntimeInfo();
  },

  /** Wipes the native runtime back to serving the embedded bundle (current/rollback/downloads/cache) and clears the local cache. */
  async resetRuntime(): Promise<void> {
    await nativeBridge.clearBundle();
    otaStorage.clear();
  },

  /** Reloads the JS bundle through React Native's own supported reload path. Never kills the process. */
  async restart(): Promise<void> {
    await nativeBridge.restart();
  },
};
