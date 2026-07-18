import { MMKV_INSTANCE_ID, MMKV_KEYS, type Manifest } from "@openota/shared";
import * as MMKVModule from "react-native-mmkv";

interface MmkvLike {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete?(key: string): void;
  remove?(key: string): void;
}

/**
 * react-native-mmkv's public API changed across major versions in ways that aren't
 * feature-flaggable via a single import: v2/v3 export a constructible `MMKV` class with
 * `.delete()`; v4 (Nitro-based) replaces it with a `createMMKV()` factory and renames
 * `.delete()` to `.remove()`. Both shapes are duck-typed here at runtime — rather than pinning
 * to one — so the SDK keeps working across the peer range declared in package.json.
 */
function createMmkvInstance(): MmkvLike {
  const mod = MMKVModule as typeof MMKVModule & {
    createMMKV?: (config: { id: string }) => MmkvLike;
    MMKV?: new (config: { id: string }) => MmkvLike;
  };

  if (typeof mod.createMMKV === "function") {
    return mod.createMMKV({ id: MMKV_INSTANCE_ID });
  }

  if (typeof mod.MMKV === "function") {
    return new mod.MMKV({ id: MMKV_INSTANCE_ID });
  }

  throw new Error(
    "@openota/sdk: react-native-mmkv has neither a `createMMKV` factory nor an `MMKV` class export — is a compatible version installed?",
  );
}

function deleteKey(instance: MmkvLike, key: string): void {
  if (instance.remove) {
    instance.remove(key);
    return;
  }

  if (instance.delete) {
    instance.delete(key);
    return;
  }

  throw new Error("@openota/sdk: the installed react-native-mmkv instance exposes neither `remove` nor `delete`.");
}

const mmkv = createMmkvInstance();

function getJson<T>(key: string): T | null {
  const raw = mmkv.getString(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function setJson<T>(key: string, value: T): void {
  mmkv.set(key, JSON.stringify(value));
}

/**
 * A read-through JS-side cache of what the native runtime engine already persists durably in its
 * own root manifest (see the Android `RuntimeManifest`). Native is the source of truth — this
 * cache exists only so `OTA.getCurrentVersion()` can answer synchronously without a bridge round
 * trip; every write here happens immediately after a native call returns its own `RuntimeInfo`.
 * Rollback bookkeeping is intentionally not duplicated here: the native `rollback/` directory and
 * root manifest are authoritative, and `OTA.rollback()` simply asks native to restore it.
 */
export const otaStorage = {
  getCurrentVersion(): string | null {
    return mmkv.getString(MMKV_KEYS.currentVersion) ?? null;
  },

  setCurrentVersion(version: string): void {
    mmkv.set(MMKV_KEYS.currentVersion, version);
  },

  getCurrentBundlePath(): string | null {
    return mmkv.getString(MMKV_KEYS.currentBundlePath) ?? null;
  },

  setCurrentBundlePath(path: string): void {
    mmkv.set(MMKV_KEYS.currentBundlePath, path);
  },

  getCurrentManifest(): Manifest | null {
    return getJson<Manifest>(MMKV_KEYS.currentManifest);
  },

  setCurrentManifest(manifest: Manifest | null): void {
    if (manifest === null) {
      deleteKey(mmkv, MMKV_KEYS.currentManifest);
      return;
    }

    setJson(MMKV_KEYS.currentManifest, manifest);
  },

  clear(): void {
    deleteKey(mmkv, MMKV_KEYS.currentVersion);
    deleteKey(mmkv, MMKV_KEYS.currentBundlePath);
    deleteKey(mmkv, MMKV_KEYS.currentManifest);
  },
};
