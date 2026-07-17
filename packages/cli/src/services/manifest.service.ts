import path from "node:path";

import fse from "fs-extra";
import { CURRENT_MANIFEST_SCHEMA_VERSION, serializeManifest, type Manifest } from "@openota/shared";

import { MANIFEST_FILENAME, METADATA_FILENAME } from "../constants/index.js";
import { listAssetPaths } from "./assets.service.js";
import type { BuildMetadata, BundleResult } from "../types/index.js";
import { computeSha256 } from "../utils/hash.js";
import { getAppVersion, getCliVersion, getNodeVersion, getReactNativeVersion } from "../utils/version.js";

export async function buildManifest(
  outputDir: string,
  bundleResult: BundleResult,
  version: string,
  root: string,
): Promise<Manifest> {
  const sha256 = await computeSha256(bundleResult.bundlePath);
  const stat = await fse.stat(bundleResult.bundlePath);
  const assets = await listAssetPaths(bundleResult.assetsDir);

  const manifest: Manifest = {
    manifestVersion: CURRENT_MANIFEST_SCHEMA_VERSION,
    bundleVersion: version,
    platform: bundleResult.platform,
    // The app's own version doubles as the compatibility generation of the JS bundle format —
    // the native runtime refuses to activate a package whose runtimeVersion doesn't match the
    // app binary's, so this must be a real, meaningful version the app owner controls.
    runtimeVersion: getAppVersion(root),
    sha256,
    size: stat.size,
    createdAt: new Date().toISOString(),
    // Just the filename (e.g. "index.android.bundle"), not a path — the native runtime always
    // looks it up under its own `bundle/` directory, matching the CLI's own zip layout below.
    bundleName: bundleResult.bundleFilename,
    assets,
  };

  // Written through serializeManifest so the on-disk wire key is `version` (what the native
  // Kotlin BundleManifest parser reads), even though the TS field is `bundleVersion`.
  await fse.writeJson(path.join(outputDir, MANIFEST_FILENAME), serializeManifest(manifest), { spaces: 2 });
  return manifest;
}

export async function buildMetadata(outputDir: string, root: string): Promise<BuildMetadata> {
  const metadata: BuildMetadata = {
    appVersion: getAppVersion(root),
    reactNativeVersion: getReactNativeVersion(root) ?? "unknown",
    nodeVersion: getNodeVersion(),
    cliVersion: getCliVersion(),
  };

  await fse.writeJson(path.join(outputDir, METADATA_FILENAME), metadata, { spaces: 2 });
  return metadata;
}
