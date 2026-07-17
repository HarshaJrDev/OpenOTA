import { BUNDLE_DIR_NAME } from "@openota/shared";
import RNFS from "react-native-fs";
import { unzip } from "react-native-zip-archive";

import { ExtractionError } from "../errors.js";
import type { DownloadResult, ExtractResult } from "../types.js";
import { assertWithinRoot, getBundleVersionDir } from "../utils/paths.js";

export async function extractPackage(downloaded: DownloadResult): Promise<ExtractResult> {
  const { manifest, zipPath } = downloaded;

  const extractedDir = assertWithinRoot(getBundleVersionDir(manifest.platform, manifest.bundleVersion));

  if (await RNFS.exists(extractedDir)) {
    await RNFS.unlink(extractedDir);
  }

  try {
    await unzip(zipPath, extractedDir);
  } catch (error) {
    await RNFS.unlink(extractedDir).catch(() => undefined);
    throw new ExtractionError(
      `Failed to extract package for ${manifest.platform}@${manifest.bundleVersion}`,
      error,
    );
  }

  // The manifest's own `bundleName` (the JS bundle's actual filename) is authoritative — it's
  // what the native runtime uses to locate the bundle too, so the SDK must not guess from a
  // platform lookup table that could drift from what was actually packaged.
  const bundlePath = assertWithinRoot(`${extractedDir}/${BUNDLE_DIR_NAME}/${manifest.bundleName}`);

  if (!(await RNFS.exists(bundlePath))) {
    await RNFS.unlink(extractedDir).catch(() => undefined);
    throw new ExtractionError(`Extracted package is missing expected bundle file "${manifest.bundleName}"`);
  }

  await RNFS.unlink(zipPath).catch(() => undefined);

  return { manifest, extractedDir, bundlePath };
}
