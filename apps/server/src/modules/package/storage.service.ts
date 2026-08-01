import {
  assertSafePathSegment,
  DEFAULT_CHANNEL,
  MANIFEST_FILENAME,
  METADATA_FILENAME,
  PACKAGE_ZIP_FILENAME,
  parseManifest,
  serializeManifest,
  type Manifest,
  type PackageMetadata,
  type Platform,
} from "@openota/shared";

import type { StorageProvider } from "../../providers/storage/provider.js";

const ACTIVE_POINTER_FILENAME = "active.json";

/**
 * `keyPrefix` (e.g. `projects/{projectId}`) isolates one tenant's storage keys from every other
 * tenant's and from the legacy flat/global namespace — this is the ONLY thing that changes
 * between a project-scoped `PackageStorageService` instance and the legacy one; every method
 * below is otherwise identical, so upload/check/rollback logic never needs to know which mode
 * it's running in. Server-constructed only — never derived from anything client-supplied.
 */
export function createPackageStorageService(storage: StorageProvider, keyPrefix = "") {
  const prefix = keyPrefix ? `${keyPrefix}/` : "";

  function packageDir(platform: Platform, version: string): string {
    assertSafePathSegment(platform);
    assertSafePathSegment(version);
    return `${prefix}${platform}/${version}`;
  }

  // The pre-channels pointer key (`{platform}/active.json`) is treated as the "production"
  // channel's pointer — every release ever made before channels existed already lives there, so
  // reading/writing "production" through this same key needs zero migration: existing deployments
  // keep working unchanged, and every *other* channel gets its own key from day one.
  function activePointerKey(platform: Platform, channel: string): string {
    assertSafePathSegment(platform);
    assertSafePathSegment(channel);
    if (channel === DEFAULT_CHANNEL) {
      return `${prefix}${platform}/${ACTIVE_POINTER_FILENAME}`;
    }
    return `${prefix}${platform}/active.${channel}.json`;
  }

  return {
    packageDir,

    zipKey(platform: Platform, version: string): string {
      return `${packageDir(platform, version)}/${PACKAGE_ZIP_FILENAME}`;
    },

    manifestKey(platform: Platform, version: string): string {
      return `${packageDir(platform, version)}/${MANIFEST_FILENAME}`;
    },

    metadataKey(platform: Platform, version: string): string {
      return `${packageDir(platform, version)}/${METADATA_FILENAME}`;
    },

    async packageExists(platform: Platform, version: string): Promise<boolean> {
      return storage.exists(`${packageDir(platform, version)}/${METADATA_FILENAME}`);
    },

    async uploadZip(platform: Platform, version: string, stream: NodeJS.ReadableStream) {
      await storage.upload(`${packageDir(platform, version)}/${PACKAGE_ZIP_FILENAME}`, stream);
    },

    async downloadZip(platform: Platform, version: string) {
      return storage.download(`${packageDir(platform, version)}/${PACKAGE_ZIP_FILENAME}`);
    },

    async zipSize(platform: Platform, version: string): Promise<number> {
      return storage.size(`${packageDir(platform, version)}/${PACKAGE_ZIP_FILENAME}`);
    },

    // Generated fresh on every call, never persisted — see the doc comment on
    // `StorageProvider.getDownloadUrl`. For local storage this is a stable API route; for
    // Supabase it is a short-lived signed URL.
    async getZipDownloadUrl(platform: Platform, version: string): Promise<string> {
      return storage.getDownloadUrl(`${packageDir(platform, version)}/${PACKAGE_ZIP_FILENAME}`);
    },

    async deletePackage(platform: Platform, version: string): Promise<void> {
      await storage.delete(packageDir(platform, version));
    },

    // Manifest/metadata are persisted through serializeManifest/parseManifest rather than raw
    // JSON so the on-disk wire key stays `version` (native Kotlin-compatible) even though the TS
    // field is `bundleVersion` — see the doc comment on `Manifest` in @openota/shared.
    async writeManifest(platform: Platform, version: string, manifest: Manifest): Promise<void> {
      await storage.writeJson(`${packageDir(platform, version)}/${MANIFEST_FILENAME}`, serializeManifest(manifest));
    },

    async readManifest(platform: Platform, version: string): Promise<Manifest> {
      const raw = await storage.readJson<unknown>(`${packageDir(platform, version)}/${MANIFEST_FILENAME}`);
      return parseManifest(raw);
    },

    async writeMetadata(
      platform: Platform,
      version: string,
      metadata: PackageMetadata,
    ): Promise<void> {
      await storage.writeJson(
        `${packageDir(platform, version)}/${METADATA_FILENAME}`,
        serializeManifest({ ...metadata, downloadUrl: undefined }),
      );
    },

    async readMetadata(platform: Platform, version: string): Promise<PackageMetadata> {
      const raw = await storage.readJson<unknown>(`${packageDir(platform, version)}/${METADATA_FILENAME}`);
      const { downloadUrl: _downloadUrl, ...metadata } = parseManifest(raw);
      return metadata;
    },

    async listVersions(platform: Platform): Promise<string[]> {
      assertSafePathSegment(platform);
      const entries = await storage.list(`${prefix}${platform}`);
      return entries.filter((entry) => entry.isDirectory).map((entry) => entry.name);
    },

    // The "active" pointer is what `check` actually serves — distinct from "the highest semver
    // ever uploaded". Every upload moves it forward automatically; `rollback` is the only other
    // way it changes, and it can only ever point at a version that has actually been uploaded.
    async writeActiveVersion(platform: Platform, version: string, channel: string = DEFAULT_CHANNEL): Promise<void> {
      await storage.writeJson(activePointerKey(platform, channel), { version });
    },

    async readActiveVersion(platform: Platform, channel: string = DEFAULT_CHANNEL): Promise<string | null> {
      const key = activePointerKey(platform, channel);
      if (!(await storage.exists(key))) {
        return null;
      }

      const raw = await storage.readJson<{ version: string }>(key);
      return raw.version;
    },

    async listPlatforms(): Promise<Platform[]> {
      const entries = await storage.list(keyPrefix);
      return entries
        .filter((entry) => entry.isDirectory)
        .map((entry) => entry.name)
        .filter((name): name is Platform => name === "android" || name === "ios");
    },
  };
}

export type PackageStorageService = ReturnType<typeof createPackageStorageService>;
