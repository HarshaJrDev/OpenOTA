import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configure, resetConfig } from "../../config.js";
import { OTAError } from "../../errors.js";
import { checkForUpdate } from "../check.service.js";

const validManifest = {
  manifestVersion: 1,
  bundleVersion: "1.2.0",
  platform: "android" as const,
  runtimeVersion: "1.0.0",
  sha256: "a".repeat(64),
  size: 12345,
  createdAt: "2026-01-01T00:00:00.000Z",
  bundleName: "index.android.bundle",
  downloadUrl: "/api/v1/packages/android/1.2.0/download",
};

beforeEach(() => {
  configure({ serverUrl: "https://api.example.com/api/v1" });
});

afterEach(() => {
  resetConfig();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("checkForUpdate", () => {
  it("returns an available update with a valid manifest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              available: true,
              latestVersion: "1.2.0",
              downloadUrl: validManifest.downloadUrl,
              manifest: validManifest,
            },
          }),
      }),
    );

    const result = await checkForUpdate("android", "1.0.0");
    expect(result.available).toBe(true);
    expect(result.manifest).toEqual(validManifest);
  });

  it("rejects a malformed manifest from the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              available: true,
              latestVersion: "1.2.0",
              downloadUrl: "/download",
              manifest: { bundleVersion: "1.2.0" },
            },
          }),
      }),
    );

    await expect(checkForUpdate("android", "1.0.0")).rejects.toBeInstanceOf(OTAError);
  });

  it("handles no update available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { available: false, latestVersion: "1.0.0", downloadUrl: null, manifest: null },
          }),
      }),
    );

    const result = await checkForUpdate("android", "1.0.0");
    expect(result.available).toBe(false);
    expect(result.manifest).toBeNull();
  });
});
