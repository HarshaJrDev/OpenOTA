import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// syncPackage's whole job on a "nothing to do" boot is: (1) ask the server if an update
// exists, (2) touch the native bridge so BundleManager.confirmBoot() fires. Everything else
// (download/extract/verify/install) only matters on the update-found path, so those services
// are mocked out here rather than exercised — that's covered by their own unit tests.
const getRuntimeInfoMock = vi.fn().mockResolvedValue({
  currentVersion: "1.0.0",
  bundleVersion: "1.0.0",
  runtimeVersion: "1.0.0",
  manifestVersion: 1,
  bundlePath: "/fake/path",
  installTime: null,
  platform: "android",
  state: "ACTIVATED",
});

vi.mock("../../native/index.js", () => ({
  nativeBridge: {
    getRuntimeInfo: () => getRuntimeInfoMock(),
  },
}));

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

const checkForUpdateMock = vi.fn();
vi.mock("../check.service.js", () => ({
  checkForUpdate: (...args: unknown[]) => checkForUpdateMock(...args),
}));

const downloadPackageMock = vi.fn();
vi.mock("../download.service.js", () => ({
  downloadPackage: (...args: unknown[]) => downloadPackageMock(...args),
}));

const extractPackageMock = vi.fn();
vi.mock("../extract.service.js", () => ({
  extractPackage: (...args: unknown[]) => extractPackageMock(...args),
}));

const verifyPackageMock = vi.fn();
vi.mock("../verify.service.js", () => ({
  verifyPackage: (...args: unknown[]) => verifyPackageMock(...args),
}));

const installPackageMock = vi.fn();
vi.mock("../install.service.js", () => ({
  installPackage: (...args: unknown[]) => installPackageMock(...args),
}));

import { configure, resetConfig } from "../../config.js";
import { syncPackage } from "../sync.service.js";

beforeEach(() => {
  configure({ serverUrl: "https://api.example.com/api/v1" });
});

afterEach(() => {
  resetConfig();
  vi.clearAllMocks();
});

describe("syncPackage — native boot confirmation", () => {
  it("touches the native bridge even when no update is available", async () => {
    checkForUpdateMock.mockResolvedValue({ available: false, manifest: null });

    const result = await syncPackage("android");

    expect(result.status).toBe("up-to-date");
    // This is the actual regression this test guards: without a native touch here, a device
    // that's already up to date never runs BundleManager.confirmBoot() natively, and after
    // MAX_UNCONFIRMED_BOOTS the crash-loop heuristic silently rolls the bundle back.
    expect(getRuntimeInfoMock).toHaveBeenCalledTimes(1);
  });

  it("does not let a native bridge failure block the sync result", async () => {
    getRuntimeInfoMock.mockRejectedValueOnce(new Error("native module not ready"));
    checkForUpdateMock.mockResolvedValue({ available: false, manifest: null });

    const result = await syncPackage("android");

    expect(result.status).toBe("up-to-date");
  });

  it("still touches the native bridge on the update-found path", async () => {
    const manifest = { bundleVersion: "1.2.0" };
    checkForUpdateMock.mockResolvedValue({ available: true, manifest });
    downloadPackageMock.mockResolvedValue({ path: "/fake/download" });
    extractPackageMock.mockResolvedValue({ path: "/fake/extract" });
    verifyPackageMock.mockResolvedValue(undefined);
    installPackageMock.mockResolvedValue({ manifest });

    const result = await syncPackage("android");

    expect(["updated", "restart-required"]).toContain(result.status);
    expect(getRuntimeInfoMock).toHaveBeenCalledTimes(1);
  });
});
