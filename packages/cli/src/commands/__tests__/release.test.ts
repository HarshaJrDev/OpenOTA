import type { Manifest } from "@openota/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real bug this covers: `runRelease` never stopped the ora spinner it started when uploadPackage
// threw (e.g. a 401 mid-upload) — the process exited with "Uploading android package (100%)..."
// left running forever, and the raw axios error ("Request failed with status code 401") reached
// the user with no indication of what to actually do about it.
const uploadPackage = vi.fn();
const spinnerInstances: Array<{ text: string; succeed: ReturnType<typeof vi.fn>; fail: ReturnType<typeof vi.fn> }> = [];

vi.mock("../../services/upload.service.js", () => ({ uploadPackage }));
vi.mock("../../services/api.service.js", () => ({ createApiClient: vi.fn().mockReturnValue({}) }));
vi.mock("../../services/credentials.service.js", () => ({ getApiKey: vi.fn().mockResolvedValue("test-api-key") }));
vi.mock("../build.js", () => ({
  runBuild: vi.fn().mockResolvedValue([
    {
      platform: "android",
      version: "1.0.1",
      outputDir: "/tmp/android",
      zipPath: "/tmp/android/ota-package.zip",
      manifest: { runtimeVersion: "1.0.0", bundleName: "index.android.bundle", sha256: "a".repeat(64), size: 10 } as Manifest,
      metadata: {},
    },
    {
      platform: "ios",
      version: "1.0.1",
      outputDir: "/tmp/ios",
      zipPath: "/tmp/ios/ota-package.zip",
      manifest: { runtimeVersion: "1.0.0", bundleName: "main.jsbundle", sha256: "b".repeat(64), size: 5 } as Manifest,
      metadata: {},
    },
  ]),
}));
vi.mock("../../services/config.service.js", () => ({
  loadConfig: vi.fn().mockResolvedValue({
    serverUrl: "http://localhost:3001/api/v1",
    deployment: "production",
    platforms: ["android", "ios"],
    bundleOutput: "./openota",
    runtimeVersion: "1.0.0",
  }),
}));
vi.mock("../../utils/logger.js", () => ({
  log: { title: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn() },
  startSpinner: vi.fn().mockImplementation((text: string) => {
    const spinner = { text, succeed: vi.fn(), fail: vi.fn() };
    spinnerInstances.push(spinner);
    return spinner;
  }),
  succeed: vi.fn().mockImplementation((spinner: { succeed: (t: string) => void }, text: string) => spinner.succeed(text)),
  fail: vi.fn().mockImplementation((spinner: { fail: (t: string) => void }, text: string) => spinner.fail(text)),
}));

beforeEach(() => {
  vi.clearAllMocks();
  spinnerInstances.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runRelease", () => {
  it("uploads android then ios and succeeds both spinners", async () => {
    uploadPackage.mockResolvedValue({ downloadUrl: "https://example.test/pkg.zip" });
    const { runRelease } = await import("../release.js");

    await runRelease({ version: "1.0.1" });

    expect(uploadPackage).toHaveBeenCalledTimes(2);
    expect(spinnerInstances).toHaveLength(2);
    expect(spinnerInstances[0]?.fail).not.toHaveBeenCalled();
    expect(spinnerInstances[0]?.succeed).toHaveBeenCalledTimes(1);
    expect(spinnerInstances[1]?.succeed).toHaveBeenCalledTimes(1);
  });

  it("stops the spinner (does not leave it running) when the android upload 401s, and never attempts ios", async () => {
    uploadPackage.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error: { message: "Missing or invalid API key" } } },
    });
    const { runRelease } = await import("../release.js");

    await expect(runRelease({ version: "1.0.1" })).rejects.toThrow(/Authentication failed/);

    expect(spinnerInstances).toHaveLength(1); // ios build result never reached a spinner
    expect(spinnerInstances[0]?.succeed).not.toHaveBeenCalled();
    expect(spinnerInstances[0]?.fail).toHaveBeenCalledTimes(1);
    const failMessage = spinnerInstances[0]?.fail.mock.calls[0]?.[0] as string;
    expect(failMessage).toContain("android upload failed");
    expect(failMessage).toContain("Authentication failed");
  });

  it("produces an actionable message for a 401, not the raw axios error text", async () => {
    uploadPackage.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error: { message: "Missing or invalid API key" } } },
    });
    const { runRelease } = await import("../release.js");

    const error = await runRelease({ version: "1.0.1" }).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/invalid, expired, or revoked/);
    expect((error as Error).message).not.toContain("Request failed with status code 401");
  });

  it("fails fast with an actionable message when no API key is stored at all — never calls uploadPackage", async () => {
    const credentials = await import("../../services/credentials.service.js");
    vi.mocked(credentials.getApiKey).mockResolvedValueOnce(undefined);
    const { runRelease } = await import("../release.js");

    await expect(runRelease({ version: "1.0.1" })).rejects.toThrow(/Not logged in/);
    expect(uploadPackage).not.toHaveBeenCalled();
  });

  it("never includes the API key value in a thrown error message", async () => {
    uploadPackage.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error: { message: "Missing or invalid API key" } } },
    });
    const { runRelease } = await import("../release.js");

    const error = await runRelease({ version: "1.0.1" }).catch((e: Error) => e);
    expect((error as Error).message).not.toContain("test-api-key");
  });
});
