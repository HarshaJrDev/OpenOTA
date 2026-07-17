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

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (error) => reject(error));

    archive.pipe(output);
    archive.directory(path.join(outputDir, BUNDLE_DIR_NAME), BUNDLE_DIR_NAME);
    archive.directory(path.join(outputDir, ASSETS_DIR_NAME), ASSETS_DIR_NAME);
    archive.file(path.join(outputDir, MANIFEST_FILENAME), { name: MANIFEST_FILENAME });
    archive.file(path.join(outputDir, METADATA_FILENAME), { name: METADATA_FILENAME });

    void archive.finalize();
  });

  return zipPath;
}
