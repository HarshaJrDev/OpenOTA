import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

import { BUNDLE_DIR_NAME } from "@openota/shared";
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
  // adm-zip throws a raw (non-OpenOTA) Error when the file isn't a valid zip at all — e.g. a
  // truncated/corrupted upload, or random bytes claiming to be a package. Uncaught, that error
  // isn't recognized by the global error handler and surfaces as a generic 500 INTERNAL_ERROR
  // instead of a clean, actionable 400 — confirmed via a real corrupted-upload test.
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipFilePath);
  } catch (error) {
    throw new UploadError(
      `Uploaded file is not a valid zip archive: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  // The CLI's archive.service.ts packs the bundle under a `bundle/` directory (matching what the
  // SDK's own extract.service.ts expects on-device: `${extractedDir}/${BUNDLE_DIR_NAME}/${bundleName}`)
  // — `bundleName` alone is just the filename, never the in-zip path. Looking it up at the zip
  // root was a real bug: every real CLI-built upload failed with "not found in the uploaded zip"
  // even though the zip was entirely valid.
  const entryPath = `${BUNDLE_DIR_NAME}/${bundleName}`;
  const entry = zip.getEntry(entryPath);

  if (!entry) {
    throw new UploadError(`Bundle entry "${entryPath}" not found in the uploaded zip.`);
  }

  // A zip whose central directory parses but whose entry data is itself truncated/corrupted
  // (e.g. an interrupted upload) throws here too — same treatment as an unparseable zip above.
  let entryData: Buffer;
  try {
    entryData = entry.getData();
  } catch (error) {
    throw new UploadError(
      `Could not read bundle entry "${entryPath}" from the uploaded zip: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const actual = createHash("sha256").update(entryData).digest("hex");
  if (actual !== claimedSha256) {
    throw new ChecksumMismatchError(claimedSha256, actual);
  }
}
