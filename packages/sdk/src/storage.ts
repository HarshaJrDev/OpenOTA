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

  /**
   * A random, anonymous, per-install identifier — not a hardware/advertising ID. Generated once
   * on first use and persisted in the same MMKV instance as everything else, so it survives app
   * restarts but resets on reinstall or app-data clear (matching what "device_id" needs to mean
   * for a "last seen" registry: one row per install, not a way to track a physical device across
   * reinstalls). Deliberately not gated behind deviceId being present in OtaConfig — every SDK
   * instance has one, and whether it's sent to the server is decided by the caller.
   */
  getOrCreateDeviceId(): string {
    const existing = mmkv.getString(MMKV_KEYS.deviceId);
    if (existing) {
      return existing;
    }

    const generated = generateDeviceId();
    mmkv.set(MMKV_KEYS.deviceId, generated);
    return generated;
  },

  clear(): void {
    deleteKey(mmkv, MMKV_KEYS.currentVersion);
    deleteKey(mmkv, MMKV_KEYS.currentBundlePath);
    deleteKey(mmkv, MMKV_KEYS.currentManifest);
  },
};

function generateDeviceId(): string {
  // crypto.randomUUID() isn't guaranteed available in the Hermes/JSC environment this SDK runs
  // in (and isn't in this package's TS lib target), so this falls back to Math.random — fine
  // here since the ID only needs to be unique enough to distinguish devices in an analytics
  // table, not cryptographically unguessable.
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
