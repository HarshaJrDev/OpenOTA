import { getConfig } from "../config.js";
import { nativeBridge } from "../native/index.js";
import { otaStorage } from "../storage.js";
import type { Platform, SyncProgressListener, SyncResult } from "../types.js";
import { checkForUpdate } from "./check.service.js";
import { downloadPackage } from "./download.service.js";
import { extractPackage } from "./extract.service.js";
import { installPackage } from "./install.service.js";
import { verifyPackage } from "./verify.service.js";

/**
 * Touches the native `OpenOTA` TurboModule so React Native constructs it and its
 * `initialize()` runs, which is native-android's only path to `BundleManager.confirmBoot()`
 * (see `OpenOTAModule.kt`). Every other JS entry point that runs on a normal "no update
 * available" boot — `checkForUpdate()`, `otaStorage.getCurrentVersion()` — is pure JS/MMKV
 * and never reaches the bridge, so without this, a boot that lands on the early "up to
 * date" return below never confirms it booted. After `MAX_UNCONFIRMED_BOOTS` (2) such boots,
 * native-android's crash-loop heuristic in `BundleManager.recordBootAttempt()` treats the
 * still-unconfirmed bundle as broken and silently rolls back to the previous one — visible
 * to users as "the update reverted to the old bundle on its own" even though nothing ever
 * crashed. `getRuntimeInfo()` is used only because it's the cheapest already-exposed native
 * call on both platform bridges; its return value is discarded, this call exists purely for
 * its `initialize()` side effect. Failures are swallowed — this must never block sync().
 */
async function confirmNativeBoot(): Promise<void> {
  try {
    await nativeBridge.getRuntimeInfo();
  } catch {
    // Non-fatal: a failed confirm just means the crash-loop heuristic gets one more data
    // point against this boot. It must never surface as a sync() failure.
  }
}

export async function syncPackage(
  platform: Platform,
  onProgress?: SyncProgressListener,
): Promise<SyncResult> {
  const currentVersion = otaStorage.getCurrentVersion() ?? "0.0.0";

  void confirmNativeBoot();

  onProgress?.({ stage: "checking" });
  const check = await checkForUpdate(platform, currentVersion);

  if (!check.available || !check.manifest) {
    onProgress?.({ stage: "done" });
    return { status: "up-to-date", manifest: null };
  }

  onProgress?.({ stage: "downloading", percent: 0 });
  const downloaded = await downloadPackage(check.manifest, (percent) => {
    onProgress?.({ stage: "downloading", percent });
  });

  onProgress?.({ stage: "extracting" });
  const extracted = await extractPackage(downloaded);

  onProgress?.({ stage: "verifying" });
  await verifyPackage(extracted);

  onProgress?.({ stage: "installing" });
  const installed = await installPackage(extracted);

  onProgress?.({ stage: "done" });

  const status = getConfig().autoRestart ? "updated" : "restart-required";
  return { status, manifest: installed.manifest };
}
