import type { PackageStorageService } from "./storage.service.js";
import type { Manifest, PackageMetadata, Platform } from "./types.js";

export function createPackageRepository(packageStorage: PackageStorageService) {
  return {
    async exists(platform: Platform, version: string): Promise<boolean> {
      return packageStorage.packageExists(platform, version);
    },

    async saveZip(platform: Platform, version: string, stream: NodeJS.ReadableStream): Promise<void> {
      await packageStorage.uploadZip(platform, version, stream);
    },

    async saveManifest(platform: Platform, version: string, manifest: Manifest): Promise<void> {
      await packageStorage.writeManifest(platform, version, manifest);
    },

    async saveMetadata(platform: Platform, version: string, metadata: PackageMetadata): Promise<void> {
      await packageStorage.writeMetadata(platform, version, metadata);
    },

    async findMetadata(platform: Platform, version: string): Promise<PackageMetadata> {
      return packageStorage.readMetadata(platform, version);
    },

    async findManifest(platform: Platform, version: string): Promise<Manifest> {
      return packageStorage.readManifest(platform, version);
    },

    async getZipDownloadUrl(platform: Platform, version: string): Promise<string> {
      return packageStorage.getZipDownloadUrl(platform, version);
    },

    async remove(platform: Platform, version: string): Promise<void> {
      await packageStorage.deletePackage(platform, version);
    },

    async zipSize(platform: Platform, version: string): Promise<number> {
      return packageStorage.zipSize(platform, version);
    },

    async downloadZip(platform: Platform, version: string) {
      return packageStorage.downloadZip(platform, version);
    },

    async listAll(): Promise<PackageMetadata[]> {
      const platforms = await packageStorage.listPlatforms();
      const result: PackageMetadata[] = [];

      for (const platform of platforms) {
        const versions = await packageStorage.listVersions(platform);

        for (const version of versions) {
          if (await packageStorage.packageExists(platform, version)) {
            result.push(await packageStorage.readMetadata(platform, version));
          }
        }
      }

      return result;
    },

    async listVersions(platform: Platform): Promise<PackageMetadata[]> {
      const versions = await packageStorage.listVersions(platform);
      const result: PackageMetadata[] = [];

      for (const version of versions) {
        if (await packageStorage.packageExists(platform, version)) {
          result.push(await packageStorage.readMetadata(platform, version));
        }
      }

      return result;
    },

    async getActiveVersion(platform: Platform, channel?: string): Promise<string | null> {
      return packageStorage.readActiveVersion(platform, channel);
    },

    /** The storage key a package's zip lives at — server-constructed, never client-supplied. Used only to record it in the release-history log (see releasesRepo). */
    zipKey(platform: Platform, version: string): string {
      return packageStorage.zipKey(platform, version);
    },

    async setActiveVersion(platform: Platform, version: string, channel?: string): Promise<void> {
      await packageStorage.writeActiveVersion(platform, version, channel);
    },
  };
}

export type PackageRepository = ReturnType<typeof createPackageRepository>;
