import { BUNDLE_DIR_NAME } from "@openota/shared";
import RNFS from "react-native-fs";
import { getUncompressedSize, unzip } from "react-native-zip-archive";

import { ExtractionError } from "../errors.js";
import type { DownloadResult, ExtractResult } from "../types.js";
import { assertWithinRoot, getBundleVersionDir } from "../utils/paths.js";

// A hard ceiling against zip-bomb-style packages (small compressed download, pathological
// decompressed size) — react-native-zip-archive's own Android implementation guards Zip Slip
// (canonical-path check) but not decompressed size. This is checked before extraction even
// starts, since the OTA package hasn't been SHA-verified yet at this point (verification only
// runs against the extracted bundle file) and manifest.size is otherwise-unverified metadata.
const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500 MB — generous for a JS bundle + assets

export async function extractPackage(downloaded: DownloadResult): Promise<ExtractResult> {
  const { manifest, zipPath } = downloaded;

  const uncompressedBytes = await getUncompressedSize(zipPath);
  if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
    await RNFS.unlink(zipPath).catch(() => undefined);
    throw new ExtractionError(
      `Package for ${manifest.platform}@${manifest.bundleVersion} decompresses to ${uncompressedBytes} bytes, exceeding the ${MAX_UNCOMPRESSED_BYTES}-byte safety limit`,
    );
  }

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
