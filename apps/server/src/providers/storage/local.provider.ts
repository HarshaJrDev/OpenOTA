import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import fse from "fs-extra";

import { buildDownloadUrl, isPlatform, PACKAGE_ZIP_FILENAME } from "@openota/shared";

import { StorageError } from "../../shared/errors.js";
import { assertWithinRoot } from "../../shared/utils.js";
import type { StorageEntry, StorageProvider } from "./provider.js";

export function createLocalStorageProvider(root: string): StorageProvider {
  function resolveKey(key: string): string {
    const target = path.join(root, key);
    return assertWithinRoot(root, target);
  }

  return {
    async upload(key, stream) {
      const target = resolveKey(key);
      await fse.ensureDir(path.dirname(target));

      try {
        await pipeline(stream, createWriteStream(target));
      } catch (error) {
        await fse.remove(target).catch(() => undefined);
        throw new StorageError(`Failed to upload to "${key}"`, error);
      }
    },

    async download(key) {
      const target = resolveKey(key);

      if (!(await fse.pathExists(target))) {
        throw new StorageError(`File not found at "${key}"`);
      }

      return createReadStream(target);
    },

    async delete(key) {
      const target = resolveKey(key);
      try {
        await fse.remove(target);
      } catch (error) {
        throw new StorageError(`Failed to delete "${key}"`, error);
      }
    },

    async exists(key) {
      const target = resolveKey(key);
      return fse.pathExists(target);
    },

    async list(prefix) {
      const target = resolveKey(prefix);

      if (!(await fse.pathExists(target))) {
        return [];
      }

      const entries = await fse.readdir(target, { withFileTypes: true });
      const result: StorageEntry[] = [];

      for (const entry of entries) {
        result.push({ name: entry.name, isDirectory: entry.isDirectory() });
      }

      return result;
    },

    async readJson<T>(key: string): Promise<T> {
      const target = resolveKey(key);

      if (!(await fse.pathExists(target))) {
        throw new StorageError(`JSON file not found at "${key}"`);
      }

      try {
        return (await fse.readJson(target)) as T;
      } catch (error) {
        throw new StorageError(`Failed to read JSON from "${key}"`, error);
      }
    },

    async writeJson<T>(key: string, data: T): Promise<void> {
      const target = resolveKey(key);
      await fse.ensureDir(path.dirname(target));

      try {
        await fse.writeJson(target, data, { spaces: 2 });
      } catch (error) {
        throw new StorageError(`Failed to write JSON to "${key}"`, error);
      }
    },

    async size(key) {
      const target = resolveKey(key);

      try {
        const stat = await fse.stat(target);
        return stat.size;
      } catch (error) {
        throw new StorageError(`Failed to stat "${key}"`, error);
      }
    },

    // Local storage has no signed-URL concept — the zip is served by the API process itself, so
    // the "download URL" is just that route. Only zip keys (`{platform}/{version}/package.zip`)
    // are ever passed here; manifest/metadata/active-pointer keys never go through this path.
    async getDownloadUrl(key) {
      const segments = key.split("/");
      const [platform, version, filename] = segments;

      if (segments.length !== 3 || filename !== PACKAGE_ZIP_FILENAME || !isPlatform(platform) || !version) {
        throw new StorageError(`Cannot build a download URL for "${key}"`);
      }

      return buildDownloadUrl(platform, version);
    },
  };
}
