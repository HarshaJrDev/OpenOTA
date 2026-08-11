import { createReadStream } from "node:fs";
import fse from "fs-extra";

import type { Logger } from "pino";

import { ALLOWED_UPLOAD_MIME_TYPES, DEFAULT_CHANNEL } from "@openota/shared";

import { env } from "../../config/env.js";
import { environmentsRepo, releasesRepo } from "../../db/repositories.js";
import { notifyReleaseChange } from "../live/registry.js";
import {
  PackageAlreadyExistsError,
  PackageInUseError,
  PackageNotFoundError,
  PackageTooLargeError,
  UploadError,
} from "../../shared/errors.js";
import { compareSemver, rolloutBucket } from "../../shared/utils.js";
import { TtlCache } from "../../shared/ttlCache.js";
import { verifyBundleChecksum } from "./hash.service.js";
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

    // Re-derive the hash from the actual uploaded bytes rather than trusting the claimed value —
    // see verifyBundleChecksum's doc comment. Deliberately before anything is persisted, so a
    // mismatch never gets as far as being written to storage/manifest/active-pointer.
    try {
      verifyBundleChecksum(tempFilePath, bundleName, sha256);
    } catch (error) {
      await fse.remove(tempFilePath).catch(() => undefined);
      throw error;
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

      // Publishing is meant to move a channel forward — uploading a version that isn't
      // semver-newer than what's already active (a stale CI re-run, a fat-fingered `--version`,
      // an old branch accidentally released) must not silently regress every device that checks
      // in next, the same protection devices already get client-side via checkForUpdate's own
      // compareSemver guard. The package is still stored (so it's a valid rollback target and
      // `openota upload` without `--force` isn't a hard failure), it just doesn't go live. An
      // operator who genuinely wants an old/equal version live sets `force: true` explicitly —
      // the same explicit-intent bar the separate `rollbackToVersion` action already requires.
      //
      // Deliberately `repository.getActiveVersion()`, NOT the memoized `getActiveRelease()` above
      // — that helper's DEFAULT_CHANNEL fallback ("no explicit active version yet? use the
      // highest semver ever uploaded") exists to give devices on legacy/self-hosted flat setups a
      // sensible answer, not to decide whether a fresh upload should activate. Using it here was a
      // real bug: on a channel with no active version yet, it would go looking through
      // `listVersions()` for a highest-ever-uploaded fallback that has nothing to do with whether
      // *this* upload should go live, doing real work for no reason on the single most common case
      // (a project's very first release).
      const currentActiveVersion = await repository.getActiveVersion(platform, channel);
      const becomesActive = !currentActiveVersion || input.force || compareSemver(version, currentActiveVersion) > 0;

      if (becomesActive) {
        await repository.setActiveVersion(platform, version, channel);
        activeReleaseCache.invalidatePrefix(cacheKey(platform, channel));
        void notifyReleaseChange(projectId, platform, channel);
      } else {
        logger.warn(
          { platform, version, channel, currentActive: currentActiveVersion },
          "uploaded package is not newer than the active release — stored but not activated (pass force:true to override)",
        );
      }

      // Activation history is specifically a log of active-pointer changes — a package that was
      // uploaded but never activated (see becomesActive above) didn't produce one, so it has no
      // event to record here. It's still fully retrievable via listPackages/getPackage and usable
      // as a rollback target; it just never appears in the "release" timeline.
      if (projectId && becomesActive) {
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

    // Deleting the version a channel currently points to left checkForUpdate broken for every
    // device on that channel (repository.findManifest() throws once the underlying zip/manifest
    // files are gone) — found via a real negative-test pass. Roll back first, then delete; the
    // same explicit-intent bar every other active-pointer change already requires.
    const channelsToCheck = projectId
      ? (await environmentsRepo.listByProject(projectId)).map((e) => e.channel)
      : // Self-hosted/flat has no channel registry to enumerate (channels there are free-form
        // strings passed per-upload, not tracked anywhere) — DEFAULT_CHANNEL covers the
        // overwhelmingly common case; a custom flat-mode channel isn't caught here.
        [DEFAULT_CHANNEL];

    const activeOn: string[] = [];
    for (const channel of channelsToCheck) {
      const active = await repository.getActiveVersion(platform, channel);
      if (active === version) {
        activeOn.push(channel);
      }
    }

    if (activeOn.length > 0) {
      throw new PackageInUseError(platform, version, activeOn);
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
    deviceId?: string,
    runtimeVersion?: string,
  ): Promise<CheckUpdateResult> {
    const active = await getActiveRelease(platform, channel);

    if (!active) {
      return { available: false, latestVersion: null, downloadUrl: null, manifest: null };
    }

    const available = compareSemver(active.version, currentVersion) > 0;

    if (!available) {
      return { available: false, latestVersion: active.version, downloadUrl: null, manifest: null };
    }

    // The active release was built against a specific native runtime — serving its JS bundle to a
    // device on a different runtimeVersion is exactly the "incompatible bundle on incompatible
    // native code" case OTA is supposed to prevent, not cause. A device that doesn't send
    // runtimeVersion at all (older SDK) is let through unfiltered, same posture as the
    // deviceId-less rollout-bucketing branch below.
    if (runtimeVersion && runtimeVersion !== active.manifest.runtimeVersion) {
      return { available: false, latestVersion: active.version, downloadUrl: null, manifest: null };
    }

    // Staged rollout only applies to Cloud projects with a releases-table row for the active
    // version (self-hosted's flat mode never writes one, so it's always treated as 100%). A
    // device with no id can't be bucketed deterministically, so it's let through rather than
    // silently starved of updates forever.
    if (projectId && deviceId) {
      const activeRelease = await releasesRepo.findActive(projectId, platform, channel);
      if (activeRelease && activeRelease.rollout_percentage < 100) {
        const bucket = rolloutBucket(deviceId, activeRelease.id);
        if (bucket >= activeRelease.rollout_percentage) {
          return { available: false, latestVersion: active.version, downloadUrl: null, manifest: null };
        }
      }
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
    void notifyReleaseChange(projectId, platform, channel);
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
