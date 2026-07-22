import {
  assertSafePathSegment,
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

export function createPackageStorageService(storage: StorageProvider) {
  function packageDir(platform: Platform, version: string): string {
    assertSafePathSegment(platform);
    assertSafePathSegment(version);
    return `${platform}/${version}`;
  }

  function activePointerKey(platform: Platform): string {
    assertSafePathSegment(platform);
    return `${platform}/${ACTIVE_POINTER_FILENAME}`;
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
      const entries = await storage.list(platform);
      return entries.filter((entry) => entry.isDirectory).map((entry) => entry.name);
    },

    // The "active" pointer is what `check` actually serves — distinct from "the highest semver
    // ever uploaded". Every upload moves it forward automatically; `rollback` is the only other
    // way it changes, and it can only ever point at a version that has actually been uploaded.
    async writeActiveVersion(platform: Platform, version: string): Promise<void> {
      await storage.writeJson(activePointerKey(platform), { version });
    },

    async readActiveVersion(platform: Platform): Promise<string | null> {
      if (!(await storage.exists(activePointerKey(platform)))) {
        return null;
      }

      const raw = await storage.readJson<{ version: string }>(activePointerKey(platform));
      return raw.version;
    },

    async listPlatforms(): Promise<Platform[]> {
      const entries = await storage.list("");
      return entries
        .filter((entry) => entry.isDirectory)
        .map((entry) => entry.name)
        .filter((name): name is Platform => name === "android" || name === "ios");
    },
  };
}

export type PackageStorageService = ReturnType<typeof createPackageStorageService>;
