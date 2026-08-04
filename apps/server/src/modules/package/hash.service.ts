import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

import AdmZip from "adm-zip";

import { ChecksumMismatchError, UploadError } from "../../shared/errors.js";

export async function computeSha256FromFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }

  return hash.digest("hex");
}

/**
 * `sha256` in an upload request describes the JS bundle *inside* the zip (as `openota build`
 * computed it pre-zip), not the zip itself — see `service.ts`'s doc comment on why the zip's own
 * hash must never be substituted here. Without this check, an uploader-supplied `sha256` was
 * stored and trusted verbatim: a bundle whose real bytes don't match the claimed hash would still
 * pass every device's on-device checksum verification, since that verification compares against
 * this same attacker/uploader-controlled number, not against reality. This re-computes the hash
 * from the actual zip entry and throws if it disagrees.
 */
export function verifyBundleChecksum(zipFilePath: string, bundleName: string, claimedSha256: string): void {
  const zip = new AdmZip(zipFilePath);
  const entry = zip.getEntry(bundleName);

  if (!entry) {
    throw new UploadError(`Bundle entry "${bundleName}" not found in the uploaded zip.`);
  }

  const actual = createHash("sha256").update(entry.getData()).digest("hex");
  if (actual !== claimedSha256) {
    throw new ChecksumMismatchError(claimedSha256, actual);
  }
}
