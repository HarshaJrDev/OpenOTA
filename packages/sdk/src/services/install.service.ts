import { getConfig } from "../config.js";
import { InstallError } from "../errors.js";
import { nativeBridge } from "../native/index.js";
import { otaStorage } from "../storage.js";
import type { ExtractResult, InstallResult } from "../types.js";
import { pruneOldBundleVersions } from "./cleanup.service.js";
import { reportInstallResult } from "./report.service.js";

/**
 * Hands the extracted package directory to the native runtime and asks it to activate. Native
 * re-verifies the manifest/checksum/runtimeVersion independently (the JS SDK is not treated as a
 * trust boundary) and only then atomically stages it into `current/`, snapshotting the previous
 * generation into `rollback/` itself — so this function does not maintain its own rollback
 * bookkeeping; native's root manifest is the durable source of truth.
 */
export async function installPackage(extracted: ExtractResult): Promise<InstallResult> {
  const { manifest, extractedDir } = extracted;

  try {
    await nativeBridge.setBundlePath(extractedDir);
    const runtimeInfo = await nativeBridge.activateBundle();

    const bundlePath = runtimeInfo.bundlePath ?? extracted.bundlePath;
    otaStorage.setCurrentVersion(manifest.bundleVersion);
    otaStorage.setCurrentBundlePath(bundlePath);
    otaStorage.setCurrentManifest(manifest);

    // Best-effort — a cleanup failure must never fail an install that already succeeded.
    pruneOldBundleVersions(manifest.platform, manifest.bundleVersion).catch(() => undefined);

    const config = getConfig();

    if (config.autoRestart) {
      await nativeBridge.restart();
    }

    reportInstallResult(
      runtimeInfo.state === "FAILED" ? "failure" : "success",
      manifest.platform,
      manifest.bundleVersion,
      manifest.runtimeVersion,
    );

    return { manifest, version: manifest.bundleVersion, bundlePath };
  } catch (error) {
    reportInstallResult("failure", manifest.platform, manifest.bundleVersion, manifest.runtimeVersion);
    throw error instanceof InstallError
      ? error
      : new InstallError(`Failed to activate bundle for ${manifest.platform}@${manifest.bundleVersion}`, error);
  }
}
