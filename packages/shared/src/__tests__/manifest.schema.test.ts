import { describe, expect, it } from "vitest";

import type { Manifest } from "../api/manifest.js";
import { ManifestValidationError, parseManifest, serializeManifest } from "../schemas/manifest.schema.js";

const manifest: Manifest = {
  manifestVersion: 1,
  bundleVersion: "1.2.0",
  platform: "android",
  runtimeVersion: "1.0.0",
  sha256: "a".repeat(64),
  size: 1024,
  createdAt: "2026-01-01T00:00:00.000Z",
  bundleName: "index.android.bundle",
  downloadUrl: "/api/v1/packages/android/1.2.0/download",
  assets: ["logo.png"],
};

describe("serializeManifest / parseManifest", () => {
  it("round-trips through the wire format", () => {
    const wire = serializeManifest(manifest);
    expect(wire.version).toBe("1.2.0");
    expect(wire).not.toHaveProperty("bundleVersion");

    const restored = parseManifest(wire);
    expect(restored).toEqual(manifest);
  });

  it("parses a JSON string, not just an object", () => {
    const restored = parseManifest(JSON.stringify(serializeManifest(manifest)));
    expect(restored.bundleVersion).toBe("1.2.0");
  });

  it("defaults manifestVersion to 1 when absent (older manifests)", () => {
    const { manifestVersion: _omit, ...rest } = serializeManifest(manifest);
    const restored = parseManifest(rest);
    expect(restored.manifestVersion).toBe(1);
  });

  it("treats downloadUrl and assets as optional", () => {
    const { downloadUrl: _d, assets: _a, ...rest } = serializeManifest(manifest);
    const restored = parseManifest(rest);
    expect(restored.downloadUrl).toBeUndefined();
    expect(restored.assets).toBeUndefined();
  });

  it("rejects an unsupported manifestVersion", () => {
    expect(() => parseManifest({ ...serializeManifest(manifest), manifestVersion: 99 })).toThrow(
      ManifestValidationError,
    );
  });

  it("rejects an invalid platform", () => {
    expect(() => parseManifest({ ...serializeManifest(manifest), platform: "windows" })).toThrow(
      ManifestValidationError,
    );
  });

  it("rejects a missing required field", () => {
    const { sha256: _omit, ...rest } = serializeManifest(manifest);
    expect(() => parseManifest(rest)).toThrow(ManifestValidationError);
  });
});
