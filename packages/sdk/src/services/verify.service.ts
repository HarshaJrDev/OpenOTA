import RNFS from "react-native-fs";

import { VerificationError } from "../errors.js";
import type { ExtractResult } from "../types.js";
import { computeSha256 } from "../utils/hash.js";

/**
 * `manifest.sha256` is the hash of the JS bundle FILE (that's what the CLI computes and what the
 * native runtime re-verifies) — not of the downloaded zip. Verification therefore has to run
 * after extraction, against `bundlePath`, not against the zip `download.service.ts` fetched.
 */
export async function verifyPackage(extracted: ExtractResult): Promise<ExtractResult> {
  const { manifest, bundlePath, extractedDir } = extracted;

  const sha256 = await computeSha256(bundlePath);

  if (sha256.toLowerCase() !== manifest.sha256.toLowerCase()) {
    await RNFS.unlink(extractedDir).catch(() => undefined);
    throw new VerificationError(
      `Checksum mismatch for ${manifest.platform}@${manifest.bundleVersion}: expected ${manifest.sha256}, got ${sha256}`,
    );
  }

  return extracted;
}
