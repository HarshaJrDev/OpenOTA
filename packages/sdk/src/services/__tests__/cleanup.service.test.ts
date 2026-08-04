import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const existsMock = vi.fn();
const readDirMock = vi.fn();
const unlinkMock = vi.fn();

vi.mock("react-native-fs", () => ({
  default: {
    DocumentDirectoryPath: "/data/user/0/com.example.app/files",
    exists: (...args: unknown[]) => existsMock(...args),
    readDir: (...args: unknown[]) => readDirMock(...args),
    unlink: (...args: unknown[]) => unlinkMock(...args),
  },
}));

const { pruneOldBundleVersions } = await import("../cleanup.service.js");

function dirEntry(name: string, path: string) {
  return { name, path, isDirectory: () => true, isFile: () => false } as never;
}

beforeEach(() => {
  existsMock.mockReset().mockResolvedValue(true);
  readDirMock.mockReset().mockResolvedValue([]);
  unlinkMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pruneOldBundleVersions", () => {
  it("deletes every version directory except the one just installed", async () => {
    readDirMock.mockResolvedValue([
      dirEntry("1.0.0", "/root/bundles/android/1.0.0"),
      dirEntry("1.1.0", "/root/bundles/android/1.1.0"),
      dirEntry("1.2.0", "/root/bundles/android/1.2.0"),
    ]);

    await pruneOldBundleVersions("android", "1.2.0");

    expect(unlinkMock).toHaveBeenCalledTimes(2);
    expect(unlinkMock).toHaveBeenCalledWith("/root/bundles/android/1.0.0");
    expect(unlinkMock).toHaveBeenCalledWith("/root/bundles/android/1.1.0");
    expect(unlinkMock).not.toHaveBeenCalledWith("/root/bundles/android/1.2.0");
  });

  it("does nothing if the platform directory doesn't exist yet", async () => {
    existsMock.mockResolvedValue(false);

    await pruneOldBundleVersions("android", "1.0.0");

    expect(readDirMock).not.toHaveBeenCalled();
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it("never throws even if deleting a stale version fails", async () => {
    readDirMock.mockResolvedValue([dirEntry("1.0.0", "/root/bundles/android/1.0.0")]);
    unlinkMock.mockRejectedValue(new Error("permission denied"));

    await expect(pruneOldBundleVersions("android", "1.1.0")).resolves.toBeUndefined();
  });
});
