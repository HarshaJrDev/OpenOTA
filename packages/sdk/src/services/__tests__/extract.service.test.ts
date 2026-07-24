import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const existsMock = vi.fn();
const unlinkMock = vi.fn();
const unzipMock = vi.fn();
const getUncompressedSizeMock = vi.fn();

vi.mock("react-native-fs", () => ({
  default: {
    DocumentDirectoryPath: "/data/user/0/com.example.app/files",
    exists: (...args: unknown[]) => existsMock(...args),
    unlink: (...args: unknown[]) => unlinkMock(...args),
    mkdir: vi.fn(),
  },
}));

vi.mock("react-native-zip-archive", () => ({
  unzip: (...args: unknown[]) => unzipMock(...args),
  getUncompressedSize: (...args: unknown[]) => getUncompressedSizeMock(...args),
}));

const { extractPackage } = await import("../extract.service.js");
const { ExtractionError, OTAError } = await import("../../errors.js");

const manifest = {
  manifestVersion: 1,
  bundleVersion: "1.2.0",
  platform: "android" as const,
  runtimeVersion: "1.0.0",
  sha256: "a".repeat(64),
  size: 895873,
  createdAt: "2026-01-01T00:00:00.000Z",
  bundleName: "index.android.bundle",
};

const downloaded = { manifest, zipPath: "/data/user/0/com.example.app/files/openota/downloads/ota-package.zip" };

beforeEach(() => {
  existsMock.mockReset().mockResolvedValue(false);
  unlinkMock.mockReset().mockResolvedValue(undefined);
  unzipMock.mockReset().mockResolvedValue(undefined);
  getUncompressedSizeMock.mockReset().mockResolvedValue(1_000_000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extractPackage", () => {
  it("extracts successfully when the bundle file exists afterward", async () => {
    existsMock.mockImplementation(async (path: string) => path.endsWith(manifest.bundleName));

    const result = await extractPackage(downloaded);

    expect(unzipMock).toHaveBeenCalled();
    expect(result.bundlePath).toContain(manifest.bundleName);
    expect(result.manifest).toEqual(manifest);
  });

  it("rejects a package whose decompressed size exceeds the safety ceiling before ever extracting it", async () => {
    // Reproduces the real gap this guards: react-native-zip-archive's own Android implementation
    // protects against Zip Slip (verified directly in its source) but not decompressed size — a
    // small, cheap-to-download zip can still decompress to gigabytes. This check must run before
    // unzip() is ever called, since SHA verification only happens after extraction.
    getUncompressedSizeMock.mockResolvedValue(10 * 1024 * 1024 * 1024); // 10 GB

    await expect(extractPackage(downloaded)).rejects.toBeInstanceOf(ExtractionError);
    expect(unzipMock).not.toHaveBeenCalled();
    expect(unlinkMock).toHaveBeenCalledWith(downloaded.zipPath);
  });

  it("cleans up and throws when the expected bundle file is missing after extraction", async () => {
    existsMock.mockResolvedValue(false);

    await expect(extractPackage(downloaded)).rejects.toBeInstanceOf(ExtractionError);
  });

  it("rejects a manifest whose bundleName would escape the extraction directory", async () => {
    const malicious = { ...manifest, bundleName: "../../../../etc/passwd" };
    existsMock.mockResolvedValue(true);

    await expect(extractPackage({ manifest: malicious, zipPath: downloaded.zipPath })).rejects.toBeInstanceOf(
      OTAError,
    );
  });

  it("wraps a native unzip failure and cleans up the partial extraction directory", async () => {
    unzipMock.mockRejectedValue(new Error("native unzip failed"));

    await expect(extractPackage(downloaded)).rejects.toBeInstanceOf(ExtractionError);
    expect(unlinkMock).toHaveBeenCalled();
  });
});
