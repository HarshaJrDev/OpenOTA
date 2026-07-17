import path from "node:path";

import { execa } from "execa";
import fse from "fs-extra";

import { ASSETS_DIR_NAME, BUNDLE_DIR_NAME, BUNDLE_FILENAME_BY_PLATFORM } from "../constants/index.js";
import type { BundleResult, Platform } from "../types/index.js";

export async function runMetroBundle(
  root: string,
  outputDir: string,
  platform: Platform,
  dev = false,
): Promise<BundleResult> {
  const bundleDir = path.join(outputDir, BUNDLE_DIR_NAME);
  const assetsDir = path.join(outputDir, ASSETS_DIR_NAME);
  await fse.ensureDir(bundleDir);
  await fse.ensureDir(assetsDir);

  const bundleFilename = BUNDLE_FILENAME_BY_PLATFORM[platform];
  const bundlePath = path.join(bundleDir, bundleFilename);

  await execa(
    "npx",
    [
      "react-native",
      "bundle",
      "--platform",
      platform,
      "--dev",
      String(dev),
      "--entry-file",
      "index.js",
      "--bundle-output",
      bundlePath,
      "--assets-dest",
      assetsDir,
    ],
    { cwd: root },
  );

  return { platform, bundlePath, bundleFilename, assetsDir };
}
