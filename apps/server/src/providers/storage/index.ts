import { env } from "../../config/env.js";
import { createLocalStorageProvider } from "./local.provider.js";
import { createSupabaseStorageProvider } from "./supabase.provider.js";
import type { StorageProvider } from "./provider.js";

export type { StorageProvider, StorageEntry } from "./provider.js";

/**
 * Selects the storage backend for this process. `env.ts` already refuses to boot if
 * STORAGE_PROVIDER=supabase is missing its credentials, so by the time this runs the
 * configuration is known-good — this only has to pick which provider to construct.
 */
export function createStorageProvider(): StorageProvider {
  if (env.storageProvider === "supabase") {
    // env.ts's superRefine guarantees these are set whenever storageProvider is "supabase".
    return createSupabaseStorageProvider({
      url: env.supabaseUrl!,
      serviceRoleKey: env.supabaseServiceRoleKey!,
      bucket: env.supabaseStorageBucket,
    });
  }

  return createLocalStorageProvider(env.storageRoot);
}
