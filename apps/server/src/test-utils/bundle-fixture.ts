import { createHash } from "node:crypto";

import { BUNDLE_DIR_NAME } from "@openota/shared";
import AdmZip from "adm-zip";

export interface TestBundleFixture {
  /** The zip file bytes to `.attach("file", ...)` in a supertest upload. */
  buffer: Buffer;
  /** The real sha256 of the bundle entry inside the zip — what `verifyBundleChecksum` expects in the `sha256` field. */
  sha256: string;
  /** The bundle entry's own byte size — matches the `size` field's meaning (the JS bundle's size, not the zip's — see service.ts's doc comment). `PACKAGE_TOO_LARGE` is checked against the uploaded zip's actual `stat.size`, independent of this. */
  size: number;
}

/**
 * Builds a real, minimal zip containing one entry at `bundle/<bundleName>` — required so uploads
 * pass `verifyBundleChecksum` (hash.service.ts), which now actually opens the zip and re-derives
 * the hash instead of trusting the claimed value. Nested under `BUNDLE_DIR_NAME`, not at the zip
 * root, to match what the real CLI (`archive.service.ts`) actually produces and what the SDK's
 * own `extract.service.ts` expects on-device — a flat-root fixture here previously let this whole
 * suite pass while the real CLI→server upload path was silently broken for every real release.
 */
export function createTestBundleZip(bundleName = "index.android.bundle", content = "console.log('test bundle');"): TestBundleFixture {
  const zip = new AdmZip();
  zip.addFile(`${BUNDLE_DIR_NAME}/${bundleName}`, Buffer.from(content));
  const buffer = zip.toBuffer();
  const sha256 = createHash("sha256").update(content).digest("hex");
  return { buffer, sha256, size: Buffer.byteLength(content) };
}
