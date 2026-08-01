import { createReadStream } from "node:fs";
import fse from "fs-extra";

import type { Logger } from "pino";

import { ALLOWED_UPLOAD_MIME_TYPES, DEFAULT_CHANNEL } from "@openota/shared";

import { env } from "../../config/env.js";
import { releasesRepo } from "../../db/repositories.js";
import {
  PackageAlreadyExistsError,
  PackageNotFoundError,
  PackageTooLargeError,
  UploadError,
} from "../../shared/errors.js";
import { compareSemver } from "../../shared/utils.js";
import { TtlCache } from "../../shared/ttlCache.js";
import { buildManifest, buildMetadata } from "./manifest.service.js";
import type { PackageRepository } from "./repository.js";
import type { CheckUpdateResult, Manifest, PackageMetadata, Platform, UploadPackageInput } from "./types.js";

interface ReleaseHistoryContext {
  projectId: string;
  apiKeyId?: string;
}

// Keyed by platform only — one cache per service instance, and each service instance is already
// scoped to exactly one project (or the single flat/self-hosted namespace) via its repository, so
// there's no cross-tenant leak risk here. 30s balances "device polling shouldn't hammer storage
// on every check" against "a fresh release should show up without a long delay" — upload/rollback
// also explicitly invalidate below, so a real release is never actually delayed by this TTL; it
// only bounds the staleness window for *concurrent* checks racing an in-flight release.
const ACTIVE_RELEASE_CACHE_TTL_MS = 30_000;

interface ActiveRelease {
  version: string;
  manifest: Manifest;
}

export function createPackageService(repository: PackageRepository, logger: Logger, projectId?: string) {
  const activeReleaseCache = new TtlCache<ActiveRelease | null>(ACTIVE_RELEASE_CACHE_TTL_MS);

  function cacheKey(platform: Platform, channel: string): string {
    return `${platform}:${channel}`;
  }

  async function getActiveRelease(platform: Platform, channel: string): Promise<ActiveRelease | null> {
    const key = cacheKey(platform, channel);
    const cached = activeReleaseCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    let activeVersion = await repository.getActiveVersion(platform, channel);

    if (!activeVersion) {
      // Back-compat safety net only applies to the default channel — it predates channels
      // existing at all, so "highest semver ever uploaded" is only a meaningful fallback for
      // "production". A named channel with no releases yet should just report unavailable, not
      // silently borrow production's history.
      if (channel !== DEFAULT_CHANNEL) {
        activeReleaseCache.set(key, null);
        return null;
      }

      const versions = await repository.listVersions(platform);
      if (versions.length === 0) {
        activeReleaseCache.set(key, null);
        return null;
      }

      activeVersion = versions.reduce((max, current) =>
        compareSemver(current.bundleVersion, max.bundleVersion) > 0 ? current : max,
      ).bundleVersion;
    }

    const manifest = await repository.findManifest(platform, activeVersion);
    const result: ActiveRelease = { version: activeVersion, manifest };
    activeReleaseCache.set(key, result);
    return result;
  }

  async function uploadPackage(input: UploadPackageInput, createdBy?: string): Promise<Manifest> {
    const { platform, version, runtimeVersion, bundleName, sha256, size, assets, tempFilePath, mimeType } = input;
    const channel = input.channel ?? DEFAULT_CHANNEL;
    const startedAt = Date.now();

    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number])) {
      await fse.remove(tempFilePath).catch(() => undefined);
      throw new UploadError(`Unsupported file type: "${mimeType}"`);
    }

    const stat = await fse.stat(tempFilePath);

    if (stat.size > env.maxPackageSizeBytes) {
      await fse.remove(tempFilePath).catch(() => undefined);
      throw new PackageTooLargeError(env.maxPackageSizeBytes, stat.size);
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
      await repository.setActiveVersion(platform, version, channel);
      activeReleaseCache.invalidatePrefix(cacheKey(platform, channel));

      if (projectId) {
        await releasesRepo.recordActivation({
          projectId,
          platform,
          channel,
          version,
          runtimeVersion,
          storageKey: repository.zipKey(platform, version),
          checksum: sha256,
          sizeBytes: size,
          createdBy: createdBy ?? null,
          releaseNotes: input.releaseNotes,
          previousStatus: "inactive",
        });
      }

      logger.info(
        { platform, version, channel, size: stat.size, durationMs: Date.now() - startedAt },
        "package upload completed",
      );

      const downloadUrl = await repository.getZipDownloadUrl(platform, version);
      return { ...manifest, downloadUrl };
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
  async function checkForUpdate(
    platform: Platform,
    currentVersion: string,
    channel: string = DEFAULT_CHANNEL,
  ): Promise<CheckUpdateResult> {
    const active = await getActiveRelease(platform, channel);

    if (!active) {
      return { available: false, latestVersion: null, downloadUrl: null, manifest: null };
    }

    const available = compareSemver(active.version, currentVersion) > 0;

    if (!available) {
      return { available: false, latestVersion: active.version, downloadUrl: null, manifest: null };
    }

    // Never serve a stored downloadUrl — Supabase signed URLs expire, so it must be minted fresh
    // on every check, not cached alongside the rest of the active-release lookup above.
    const downloadUrl = await repository.getZipDownloadUrl(platform, active.version);

    return {
      available: true,
      latestVersion: active.version,
      downloadUrl,
      manifest: { ...active.manifest, downloadUrl },
    };
  }

  /** Points the platform's active version at an already-uploaded package — never re-uploads or deletes anything. */
  async function rollbackToVersion(
    platform: Platform,
    version: string,
    channel: string = DEFAULT_CHANNEL,
    createdBy?: string,
    reason?: string,
  ): Promise<Manifest> {
    if (!(await repository.exists(platform, version))) {
      throw new PackageNotFoundError(platform, version);
    }

    await repository.setActiveVersion(platform, version, channel);
    activeReleaseCache.invalidatePrefix(cacheKey(platform, channel));
    logger.info({ platform, version, channel }, "release rolled back");

    const manifest = await repository.findManifest(platform, version);

    if (projectId) {
      await releasesRepo.recordActivation({
        projectId,
        platform,
        channel,
        version,
        runtimeVersion: manifest.runtimeVersion,
        storageKey: repository.zipKey(platform, version),
        checksum: manifest.sha256,
        sizeBytes: manifest.size,
        createdBy: createdBy ?? null,
        rollbackReason: reason,
        previousStatus: "rolled_back",
      });
    }

    const downloadUrl = await repository.getZipDownloadUrl(platform, version);
    return { ...manifest, downloadUrl };
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
