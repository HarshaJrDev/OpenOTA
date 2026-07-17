import RNFS from "react-native-fs";

import { getConfig } from "../config.js";
import { DownloadError } from "../errors.js";
import type { DownloadResult, Manifest } from "../types.js";
import { ensureOtaDirectories, getDownloadZipPath } from "../utils/paths.js";

function resolveDownloadUrl(downloadUrl: string, serverUrl: string): string {
  if (/^https?:\/\//.test(downloadUrl)) {
    return downloadUrl;
  }

  const origin = new URL(serverUrl).origin;
  return new URL(downloadUrl, origin).toString();
}

export async function downloadPackage(
  manifest: Manifest,
  onProgress?: (percent: number) => void,
): Promise<DownloadResult> {
  if (!manifest.downloadUrl) {
    throw new DownloadError(`Manifest for ${manifest.platform}@${manifest.bundleVersion} has no downloadUrl`);
  }

  await ensureOtaDirectories();

  const config = getConfig();
  const url = resolveDownloadUrl(manifest.downloadUrl, config.serverUrl);
  const zipPath = getDownloadZipPath(manifest.platform, manifest.bundleVersion);

  if (await RNFS.exists(zipPath)) {
    await RNFS.unlink(zipPath);
  }

  try {
    const { promise } = RNFS.downloadFile({
      fromUrl: url,
      toFile: zipPath,
      headers: config.headers,
      progressDivider: 5,
      begin: () => undefined,
      progress: (res) => {
        if (onProgress && res.contentLength > 0) {
          onProgress(Math.round((res.bytesWritten / res.contentLength) * 100));
        }
      },
    });

    const result = await promise;

    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new DownloadError(`Download failed with status ${result.statusCode}`);
    }
  } catch (error) {
    await RNFS.unlink(zipPath).catch(() => undefined);

    if (error instanceof DownloadError) {
      throw error;
    }

    throw new DownloadError(`Failed to download package from ${url}`, error);
  }

  return { manifest, zipPath };
}
