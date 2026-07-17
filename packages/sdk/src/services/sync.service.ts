import { getConfig } from "../config.js";
import { otaStorage } from "../storage.js";
import type { Platform, SyncProgressListener, SyncResult } from "../types.js";
import { checkForUpdate } from "./check.service.js";
import { downloadPackage } from "./download.service.js";
import { extractPackage } from "./extract.service.js";
import { installPackage } from "./install.service.js";
import { verifyPackage } from "./verify.service.js";

export async function syncPackage(
  platform: Platform,
  onProgress?: SyncProgressListener,
): Promise<SyncResult> {
  const currentVersion = otaStorage.getCurrentVersion() ?? "0.0.0";

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
