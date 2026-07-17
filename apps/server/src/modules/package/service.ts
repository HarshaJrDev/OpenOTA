import { createReadStream } from "node:fs";
import fse from "fs-extra";

import type { Logger } from "pino";

import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@openota/shared";

import {
  PackageAlreadyExistsError,
  PackageNotFoundError,
  UploadError,
} from "../../shared/errors.js";
import { compareSemver } from "../../shared/utils.js";
import { buildManifest, buildMetadata } from "./manifest.service.js";
import type { PackageRepository } from "./repository.js";
import type { CheckUpdateResult, Manifest, PackageMetadata, Platform, UploadPackageInput } from "./types.js";

export function createPackageService(repository: PackageRepository, logger: Logger) {
  async function uploadPackage(input: UploadPackageInput): Promise<Manifest> {
    const { platform, version, runtimeVersion, bundleName, sha256, size, assets, tempFilePath, mimeType } = input;
    const startedAt = Date.now();

    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number])) {
      await fse.remove(tempFilePath).catch(() => undefined);
      throw new UploadError(`Unsupported file type: "${mimeType}"`);
    }

    const stat = await fse.stat(tempFilePath);

    if (stat.size > MAX_UPLOAD_SIZE_BYTES) {
      await fse.remove(tempFilePath).catch(() => undefined);
      throw new UploadError(
        `File size ${stat.size} exceeds maximum allowed size of ${MAX_UPLOAD_SIZE_BYTES} bytes`,
      );
    }

    if (await repository.exists(platform, version)) {
      await fse.remove(tempFilePath).catch(() => undefined);
      throw new PackageAlreadyExistsError(platform, version);
    }

    try {
      // `sha256`/`size` describe the JS bundle *inside* the zip (as computed by `openota build`),
      // not the zip itself — the SDK's verify.service.ts checks the extracted bundle's hash
      // against manifest.sha256, so the zip's own hash/size must never be substituted here.
      const metadata = buildMetadata({ platform, version, runtimeVersion, bundleName, sha256, size, assets });
      const manifest = buildManifest(metadata);

      await repository.saveZip(platform, version, createReadStream(tempFilePath));
      await repository.saveMetadata(platform, version, metadata);
      await repository.saveManifest(platform, version, manifest);
      await repository.setActiveVersion(platform, version);

      logger.info(
        { platform, version, size: stat.size, durationMs: Date.now() - startedAt },
        "package upload completed",
      );

      return manifest;
    } finally {
      await fse.remove(tempFilePath).catch(() => undefined);
    }
  }

  async function listPackages(): Promise<PackageMetadata[]> {
    return repository.listAll();
  }

  async function getPackage(platform: Platform, version: string): Promise<PackageMetadata> {
    if (!(await repository.exists(platform, version))) {
      throw new PackageNotFoundError(platform, version);
    }

    return repository.findMetadata(platform, version);
  }

  async function downloadPackage(platform: Platform, version: string) {
    const startedAt = Date.now();

    if (!(await repository.exists(platform, version))) {
      throw new PackageNotFoundError(platform, version);
    }

    const size = await repository.zipSize(platform, version);
    const stream = await repository.downloadZip(platform, version);

    logger.info({ platform, version, durationMs: Date.now() - startedAt }, "package download started");

    return { stream, size };
  }

  async function deletePackage(platform: Platform, version: string): Promise<void> {
    if (!(await repository.exists(platform, version))) {
      throw new PackageNotFoundError(platform, version);
    }

    await repository.remove(platform, version);
    logger.info({ platform, version }, "package deleted");
  }

  /**
   * The version returned here is the "active" one — an explicit pointer maintained by
   * `uploadPackage` (moves it forward) and `rollbackToVersion` (moves it to an already-uploaded
   * version), NOT simply "the highest semver ever uploaded". That distinction is what makes
   * rollback meaningful: a device can be told to prefer an older version without deleting the
   * newer one.
   */
  async function checkForUpdate(platform: Platform, currentVersion: string): Promise<CheckUpdateResult> {
    let activeVersion = await repository.getActiveVersion(platform);

    if (!activeVersion) {
      const versions = await repository.listVersions(platform);
      if (versions.length === 0) {
        return { available: false, latestVersion: null, downloadUrl: null, manifest: null };
      }

      // Back-compat safety net for packages uploaded before the active pointer existed.
      activeVersion = versions.reduce((max, current) =>
        compareSemver(current.bundleVersion, max.bundleVersion) > 0 ? current : max,
      ).bundleVersion;
    }

    const available = compareSemver(activeVersion, currentVersion) > 0;

    if (!available) {
      return { available: false, latestVersion: activeVersion, downloadUrl: null, manifest: null };
    }

    const manifest = await repository.findManifest(platform, activeVersion);

    return {
      available: true,
      latestVersion: activeVersion,
      downloadUrl: manifest.downloadUrl ?? null,
      manifest,
    };
  }

  /** Points the platform's active version at an already-uploaded package — never re-uploads or deletes anything. */
  async function rollbackToVersion(platform: Platform, version: string): Promise<Manifest> {
    if (!(await repository.exists(platform, version))) {
      throw new PackageNotFoundError(platform, version);
    }

    await repository.setActiveVersion(platform, version);
    logger.info({ platform, version }, "release rolled back");

    return repository.findManifest(platform, version);
  }

  return {
    uploadPackage,
    listPackages,
    getPackage,
    downloadPackage,
    deletePackage,
    checkForUpdate,
    rollbackToVersion,
  };
}

export type PackageService = ReturnType<typeof createPackageService>;
