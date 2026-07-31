import { getConfig } from "../config.js";
import { nativeBridge } from "../native/index.js";
import { otaStorage } from "../storage.js";
import type { InstallResult, Platform } from "../types.js";
import { reportInstallResult } from "./report.service.js";

/**
 * Restores the previous generation. The actual restore (moving `rollback/` back into `current/`)
 * happens natively and atomically; this only mirrors the resulting `RuntimeInfo` into the JS-side
 * cache and, if configured, triggers a reload. There is no full `Manifest` to hand back here — the
 * JS SDK never re-downloads what native already had on disk — so `manifest` is `null` on this path;
 * see the doc on [InstallResult].  If no rollback snapshot exists, native rejects with
 * `NO_ROLLBACK_AVAILABLE`, which `../native/bridge.js` maps to an `OTAError`.
 */
export async function rollbackPackage(): Promise<InstallResult> {
  const runtimeInfo = await nativeBridge.rollback();

  otaStorage.setCurrentVersion(runtimeInfo.currentVersion ?? "");
  otaStorage.setCurrentBundlePath(runtimeInfo.bundlePath ?? "");
  otaStorage.setCurrentManifest(null);

  const config = getConfig();

  if (config.autoRestart) {
    await nativeBridge.restart();
  }

  if (runtimeInfo.currentVersion && runtimeInfo.runtimeVersion) {
    reportInstallResult("rollback", runtimeInfo.platform as Platform, runtimeInfo.currentVersion, runtimeInfo.runtimeVersion);
  }

  return { manifest: null, version: runtimeInfo.currentVersion, bundlePath: runtimeInfo.bundlePath };
}
