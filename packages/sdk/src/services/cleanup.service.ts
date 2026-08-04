import RNFS from "react-native-fs";

import type { Platform } from "../types.js";
import { getBundlesDir } from "../utils/paths.js";

/**
 * Deletes every extracted bundle version under `bundles/<platform>/` except `keepVersion` — the
 * one that just successfully activated. Safe to delete the rest unconditionally: native's own
 * rollback mechanism (`BundleRollback.kt`) keeps its own independent snapshot of the previous
 * generation and never reads from this directory, so nothing on the native side depends on old
 * JS-extracted bundle directories surviving. Without this, every version ever installed stayed
 * fully extracted on disk forever — a device updated 50 times would accumulate 50 full bundle+
 * asset trees. Best-effort: a failure to delete one stale directory should never fail the install
 * that already succeeded, so individual unlink failures are swallowed, not thrown.
 */
export async function pruneOldBundleVersions(platform: Platform, keepVersion: string): Promise<void> {
  const platformDir = `${getBundlesDir()}/${platform}`;

  if (!(await RNFS.exists(platformDir))) {
    return;
  }

  const entries = await RNFS.readDir(platformDir);
  const stale = entries.filter((entry) => entry.isDirectory() && entry.name !== keepVersion);

  await Promise.all(stale.map((entry) => RNFS.unlink(entry.path).catch(() => undefined)));
}
