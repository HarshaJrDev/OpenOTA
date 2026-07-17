import {
  BUNDLES_DIR,
  CACHE_DIR,
  DOWNLOADS_DIR,
  OPENOTA_ROOT_DIR,
  PACKAGE_ZIP_FILENAME,
} from "@openota/shared";
import RNFS from "react-native-fs";

import { OTAError } from "../errors.js";

export function getRootDir(): string {
  return `${RNFS.DocumentDirectoryPath}/${OPENOTA_ROOT_DIR}`;
}

export function getDownloadsDir(): string {
  return `${getRootDir()}/${DOWNLOADS_DIR}`;
}

export function getBundlesDir(): string {
  return `${getRootDir()}/${BUNDLES_DIR}`;
}

export function getCacheDir(): string {
  return `${getRootDir()}/${CACHE_DIR}`;
}

export function getDownloadZipPath(platform: string, version: string): string {
  return `${getDownloadsDir()}/${platform}-${version}-${PACKAGE_ZIP_FILENAME}`;
}

export function getBundleVersionDir(platform: string, version: string): string {
  return `${getBundlesDir()}/${platform}/${version}`;
}

export async function ensureOtaDirectories(): Promise<void> {
  for (const dir of [getRootDir(), getDownloadsDir(), getBundlesDir(), getCacheDir()]) {
    if (!(await RNFS.exists(dir))) {
      await RNFS.mkdir(dir);
    }
  }
}

export function assertWithinRoot(targetPath: string): string {
  const root = getRootDir();
  const normalizedTarget = targetPath.replace(/\\/g, "/");
  const normalizedRoot = root.replace(/\\/g, "/");

  if (normalizedTarget !== normalizedRoot && !normalizedTarget.startsWith(`${normalizedRoot}/`)) {
    throw new OTAError("PATH_SECURITY_ERROR", `Path "${targetPath}" escapes the OpenOTA root directory`);
  }

  if (normalizedTarget.includes("..")) {
    throw new OTAError("PATH_SECURITY_ERROR", `Path "${targetPath}" contains illegal traversal segments`);
  }

  return targetPath;
}
