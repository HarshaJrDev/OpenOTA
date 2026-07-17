import { isPlatform } from "../types/platform.js";
import type { Manifest } from "../api/manifest.js";
import { CURRENT_MANIFEST_SCHEMA_VERSION } from "../constants/runtime.js";

const SUPPORTED_MANIFEST_VERSIONS = new Set([1]);

/**
 * Thrown by `parseManifest`/`serializeManifest`. Deliberately a plain class with no framework
 * dependency (no Express, no RN) — every consumer catches this and rewraps it into its own error
 * type (`AppError` on the server, `OTAError` in the SDK) rather than the shared package importing
 * either.
 */
export class ManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ManifestValidationError(`Manifest is missing required string field "${key}"`);
  }
  return value;
}

function requireNumber(raw: Record<string, unknown>, key: string): number {
  const value = raw[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ManifestValidationError(`Manifest is missing required numeric field "${key}"`);
  }
  return value;
}

/**
 * Parses a raw manifest JSON object (or already-parsed JSON string) into the canonical `Manifest`
 * shape, dispatching on `manifestVersion`. Only `v1` exists today; a `v2` would get its own
 * `parseV2` branch below without touching this one, so older manifests already on disk or already
 * served by an older CLI/server never stop parsing.
 */
export function parseManifest(input: unknown): Manifest {
  const raw = (typeof input === "string" ? JSON.parse(input) : input) as Record<string, unknown>;

  if (typeof raw !== "object" || raw === null) {
    throw new ManifestValidationError("Manifest is not a JSON object");
  }

  const manifestVersion =
    typeof raw.manifestVersion === "number" ? raw.manifestVersion : CURRENT_MANIFEST_SCHEMA_VERSION;

  if (!SUPPORTED_MANIFEST_VERSIONS.has(manifestVersion)) {
    throw new ManifestValidationError(
      `Unsupported manifestVersion ${manifestVersion} (supported: ${[...SUPPORTED_MANIFEST_VERSIONS].join(", ")})`,
    );
  }

  switch (manifestVersion) {
    case 1:
      return parseV1(raw);
    default:
      throw new ManifestValidationError(`Unsupported manifestVersion ${manifestVersion}`);
  }
}

function parseV1(raw: Record<string, unknown>): Manifest {
  const platform = raw.platform;
  if (!isPlatform(platform)) {
    throw new ManifestValidationError(`Manifest has an invalid platform "${String(platform)}"`);
  }

  const downloadUrl = raw.downloadUrl;
  const assets = raw.assets;

  return {
    manifestVersion: 1,
    // Wire key is `version` for backward compatibility with existing CLI/server output and the
    // native Kotlin parser; the TS field is `bundleVersion`. See doc comment on `Manifest`.
    bundleVersion: requireString(raw, "version"),
    platform,
    runtimeVersion: requireString(raw, "runtimeVersion"),
    sha256: requireString(raw, "sha256"),
    size: requireNumber(raw, "size"),
    createdAt: requireString(raw, "createdAt"),
    bundleName: requireString(raw, "bundleName"),
    downloadUrl: typeof downloadUrl === "string" ? downloadUrl : undefined,
    assets: Array.isArray(assets) ? assets.filter((a): a is string => typeof a === "string") : undefined,
  };
}

/** Serializes to the same wire shape `parseManifest` reads — `bundleVersion` becomes JSON key `version`. */
export function serializeManifest(manifest: Manifest): Record<string, unknown> {
  return {
    manifestVersion: manifest.manifestVersion,
    version: manifest.bundleVersion,
    platform: manifest.platform,
    runtimeVersion: manifest.runtimeVersion,
    sha256: manifest.sha256,
    size: manifest.size,
    createdAt: manifest.createdAt,
    bundleName: manifest.bundleName,
    ...(manifest.downloadUrl !== undefined ? { downloadUrl: manifest.downloadUrl } : {}),
    ...(manifest.assets !== undefined ? { assets: manifest.assets } : {}),
  };
}
