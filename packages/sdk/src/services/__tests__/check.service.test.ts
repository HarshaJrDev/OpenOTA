import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native-mmkv", () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => void store.set(key, value),
      remove: (key: string) => void store.delete(key),
    }),
  };
});

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

  it("hits the flat /packages/check route when no projectId is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { available: false, latestVersion: "1.0.0", downloadUrl: null, manifest: null } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await checkForUpdate("android", "1.0.0");

    const requestedUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(requestedUrl).toContain("/packages/check");
    expect(requestedUrl).not.toContain("/projects/");
  });

  it("hits the project-scoped route when projectId IS configured — this is the Cloud multi-tenant isolation boundary", async () => {
    configure({ serverUrl: "https://api.example.com/api/v1", projectId: "proj_abc123" });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { available: false, latestVersion: "1.0.0", downloadUrl: null, manifest: null } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await checkForUpdate("android", "1.0.0");

    const requestedUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(requestedUrl).toContain("/projects/proj_abc123/packages/check");
  });

  it("sends a stable, auto-generated deviceId on every check — this is what device_checkins on the server keys off", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { available: false, latestVersion: "1.0.0", downloadUrl: null, manifest: null } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await checkForUpdate("android", "1.0.0");
    await checkForUpdate("android", "1.0.0");

    const firstUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    const secondUrl = new URL(fetchMock.mock.calls[1]?.[0] as string);
    const deviceId = firstUrl.searchParams.get("deviceId");

    expect(deviceId).toBeTruthy();
    expect(secondUrl.searchParams.get("deviceId")).toBe(deviceId);
  });
});
