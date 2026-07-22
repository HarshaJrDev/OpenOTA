import { createWriteStream } from "node:fs";
import path from "node:path";

import archiver from "archiver";

import {
  ASSETS_DIR_NAME,
  BUNDLE_DIR_NAME,
  MANIFEST_FILENAME,
  METADATA_FILENAME,
  PACKAGE_ZIP_FILENAME,
} from "../constants/index.js";

export async function createOtaPackage(outputDir: string): Promise<string> {
  const zipPath = path.join(outputDir, PACKAGE_ZIP_FILENAME);
  const assetsDir = path.join(outputDir, ASSETS_DIR_NAME);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (error) => reject(error));

    archive.pipe(output);
    archive.directory(path.join(outputDir, BUNDLE_DIR_NAME), BUNDLE_DIR_NAME);
    archive.directory(assetsDir, ASSETS_DIR_NAME);

    // `archive.directory()` on a source with zero files emits no zip entry at all — a genuinely
    // empty (but valid) asset set would then produce a package with no `assets/` folder on
    // extraction, and the native runtime's BundleVerifier correctly treats a missing directory as
    // a corrupt package. An explicit empty-directory entry survives the zip round trip regardless
    // of whether the source had any files.
    archive.append(Buffer.alloc(0), { name: `${ASSETS_DIR_NAME}/` });

    archive.file(path.join(outputDir, MANIFEST_FILENAME), { name: MANIFEST_FILENAME });
    archive.file(path.join(outputDir, METADATA_FILENAME), { name: METADATA_FILENAME });

    void archive.finalize();
  });

  return zipPath;
}
