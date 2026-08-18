import { Platform } from "react-native";
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
  // The iOS native module (BundleStorage.swift, packages/native-ios) deliberately roots the
  // OpenOTA tree under Application Support (NSApplicationSupportDirectory), not Documents —
  // Documents is user-visible/iCloud-backed, and Apple's own guidance is that app-managed,
  // non-user-facing data like this belongs in Application Support instead. This resolver must
  // mirror that exactly: assertWithinRoot() here and native's own resolveWithinRoot() both do a
  // hard prefix check against "the OpenOTA root", so any mismatch between the two makes every
  // iOS bundle activation fail with PATH_SECURITY_ERROR ("escapes the OpenOTA root directory") —
  // which happened unconditionally on iOS before this branch existed, since
  // RNFS.DocumentDirectoryPath and Application Support are two different directories. Android's
  // own native module expects DocumentDirectoryPath, so that branch is unchanged.
  const base =
    Platform.OS === "ios"
      ? `${RNFS.LibraryDirectoryPath}/Application Support`
      : RNFS.DocumentDirectoryPath;

  return `${base}/${OPENOTA_ROOT_DIR}`;
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
