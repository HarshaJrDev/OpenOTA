import {
  buildDownloadUrl,
  CURRENT_MANIFEST_SCHEMA_VERSION,
  type Manifest,
  type PackageMetadata,
  type Platform,
} from "@openota/shared";

export { buildDownloadUrl };

export function buildManifest(metadata: PackageMetadata): Manifest {
  return {
    manifestVersion: metadata.manifestVersion,
    bundleVersion: metadata.bundleVersion,
    platform: metadata.platform,
    runtimeVersion: metadata.runtimeVersion,
    sha256: metadata.sha256,
    size: metadata.size,
    createdAt: metadata.createdAt,
    bundleName: metadata.bundleName,
    assets: metadata.assets,
    downloadUrl: buildDownloadUrl(metadata.platform, metadata.bundleVersion),
  };
}

export function buildMetadata(params: {
  platform: Platform;
  version: string;
  runtimeVersion: string;
  bundleName: string;
  sha256: string;
  size: number;
  assets?: string[];
}): PackageMetadata {
  return {
    manifestVersion: CURRENT_MANIFEST_SCHEMA_VERSION,
    platform: params.platform,
    bundleVersion: params.version,
    runtimeVersion: params.runtimeVersion,
    sha256: params.sha256,
    size: params.size,
    createdAt: new Date().toISOString(),
    bundleName: params.bundleName,
    assets: params.assets,
  };
}
