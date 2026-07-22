import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { StorageError } from "../../shared/errors.js";
import type { StorageEntry, StorageProvider } from "./provider.js";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

export interface SupabaseStorageConfig {
  url: string;
  serviceRoleKey: string;
  bucket: string;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Wraps Supabase Storage behind the same `StorageProvider` contract `LocalStorageProvider`
 * implements, so the rest of the server (package service, routes) never branches on which
 * provider is active. The service-role key passed in here never leaves this module — it is not
 * logged, returned, or forwarded to any client.
 */
export function createSupabaseStorageProvider(config: SupabaseStorageConfig): StorageProvider {
  const client: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false },
  });
  const bucket = client.storage.from(config.bucket);

  function wrap(message: string, error: unknown): never {
    // Supabase error objects may embed request details; surface only a message, never raw
    // provider internals (which could hint at bucket/project configuration) to API clients.
    const detail = error instanceof Error ? error.message : String(error);
    throw new StorageError(message, detail);
  }

  return {
    async upload(key, stream) {
      const buffer = await streamToBuffer(stream);
      const { error } = await bucket.upload(key, buffer, { upsert: true });
      if (error) {
        wrap(`Failed to upload to "${key}"`, error);
      }
    },

    async download(key) {
      const { data, error } = await bucket.download(key);
      if (error || !data) {
        wrap(`File not found at "${key}"`, error);
      }

      const arrayBuffer = await data.arrayBuffer();
      const { Readable } = await import("node:stream");
      return Readable.from(Buffer.from(arrayBuffer));
    },

    async delete(key) {
      const { error } = await bucket.remove([key]);
      if (error) {
        wrap(`Failed to delete "${key}"`, error);
      }
    },

    async exists(key) {
      const dir = key.split("/").slice(0, -1).join("/");
      const filename = key.split("/").pop() ?? "";
      const { data, error } = await bucket.list(dir, { search: filename });
      if (error) {
        wrap(`Failed to check existence of "${key}"`, error);
      }
      return (data ?? []).some((entry) => entry.name === filename);
    },

    async list(prefix) {
      const { data, error } = await bucket.list(prefix);
      if (error) {
        wrap(`Failed to list "${prefix}"`, error);
      }

      const result: StorageEntry[] = [];
      for (const entry of data ?? []) {
        // Supabase Storage has no real directories: an object entry has `metadata` (a real file);
        // a "folder" placeholder does not. This is the only way to tell them apart via the API.
        result.push({ name: entry.name, isDirectory: entry.metadata === null || entry.metadata === undefined });
      }
      return result;
    },

    async readJson<T>(key: string): Promise<T> {
      const { data, error } = await bucket.download(key);
      if (error || !data) {
        wrap(`JSON file not found at "${key}"`, error);
      }

      try {
        const text = await data.text();
        return JSON.parse(text) as T;
      } catch (error) {
        wrap(`Failed to read JSON from "${key}"`, error);
      }
    },

    async writeJson<T>(key: string, data: T): Promise<void> {
      const body = Buffer.from(JSON.stringify(data, null, 2), "utf-8");
      const { error } = await bucket.upload(key, body, {
        upsert: true,
        contentType: "application/json",
      });
      if (error) {
        wrap(`Failed to write JSON to "${key}"`, error);
      }
    },

    async size(key) {
      const dir = key.split("/").slice(0, -1).join("/");
      const filename = key.split("/").pop() ?? "";
      const { data, error } = await bucket.list(dir, { search: filename });
      if (error) {
        wrap(`Failed to stat "${key}"`, error);
      }

      const entry = (data ?? []).find((item) => item.name === filename);
      if (!entry) {
        wrap(`Failed to stat "${key}"`, new Error("object not found"));
      }
      return (entry.metadata as { size?: number } | null)?.size ?? 0;
    },

    async getDownloadUrl(key, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS) {
      const { data, error } = await bucket.createSignedUrl(key, expiresInSeconds);
      if (error || !data) {
        wrap(`Failed to create a signed URL for "${key}"`, error);
      }
      return data.signedUrl;
    },
  };
}
