import { MMKV_INSTANCE_ID, MMKV_KEYS, type Manifest } from "@openota/shared";
import { MMKV } from "react-native-mmkv";

const mmkv = new MMKV({ id: MMKV_INSTANCE_ID });

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
      mmkv.delete(MMKV_KEYS.currentManifest);
      return;
    }

    setJson(MMKV_KEYS.currentManifest, manifest);
  },

  clear(): void {
    mmkv.delete(MMKV_KEYS.currentVersion);
    mmkv.delete(MMKV_KEYS.currentBundlePath);
    mmkv.delete(MMKV_KEYS.currentManifest);
  },
};
