import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { serializeManifest, type Manifest } from "@openota/shared";
import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadPackage = vi.fn().mockResolvedValue({ downloadUrl: "https://example.test/pkg.zip" });

vi.mock("../../services/upload.service.js", () => ({ uploadPackage }));
vi.mock("../../services/api.service.js", () => ({ createApiClient: vi.fn().mockReturnValue({}) }));

let root: string;
let zipPath: string;

beforeEach(async () => {
  vi.clearAllMocks();
  root = await fs.mkdtemp(path.join(os.tmpdir(), "openota-upload-cmd-test-"));

  await fse.writeJson(path.join(root, "openota.config.json"), {
    serverUrl: "http://localhost:3001/api/v1",
    deployment: "production",
    platforms: ["android"],
    bundleOutput: "./openota",
    runtimeVersion: "1.0.0",
  });

  // package.json version is deliberately different from the manifest's runtimeVersion, to prove
  // upload never falls back to recomputing it from here.
  await fse.writeJson(path.join(root, "package.json"), { version: "0.0.1" });

  zipPath = path.join(root, "ota-package.zip");
  await fse.writeFile(zipPath, "zip-content");

  const manifest: Manifest = {
    manifestVersion: 1,
    bundleVersion: "1.0.4",
    platform: "android",
    runtimeVersion: "1.0.0",
    sha256: "a".repeat(64),
    size: 12,
    createdAt: new Date().toISOString(),
    bundleName: "index.android.bundle",
    assets: [],
  };
  await fse.writeJson(path.join(root, "manifest.json"), serializeManifest(manifest));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("runUpload", () => {
  it("D: uploads with the manifest's own runtimeVersion, never recomputing it", async () => {
    const originalCwd = process.cwd();
    process.chdir(root);

    try {
      const { runUpload } = await import("../upload.js");
      await runUpload({ zip: "ota-package.zip", platform: "android", version: "1.0.4" });
    } finally {
      process.chdir(originalCwd);
    }

    expect(uploadPackage).toHaveBeenCalledTimes(1);
    const [, endpoint, options] = uploadPackage.mock.calls[0] ?? [];
    expect(endpoint).toBe("/packages"); // no projectId in config -> flat self-hosted route
    expect(options.runtimeVersion).toBe("1.0.0");
    expect(options.runtimeVersion).not.toBe("0.0.1");
  });

  it("targets the project-scoped endpoint when openota.config.json has a projectId", async () => {
    await fse.writeJson(path.join(root, "openota.config.json"), {
      serverUrl: "http://localhost:3001/api/v1",
      deployment: "production",
      platforms: ["android"],
      bundleOutput: "./openota",
      runtimeVersion: "1.0.0",
      projectId: "proj_abc123",
    });

    const originalCwd = process.cwd();
    process.chdir(root);

    try {
      const { runUpload } = await import("../upload.js");
      await runUpload({ zip: "ota-package.zip", platform: "android", version: "1.0.4" });
    } finally {
      process.chdir(originalCwd);
    }

    const [, endpoint] = uploadPackage.mock.calls[0] ?? [];
    expect(endpoint).toBe("/projects/proj_abc123/packages");
  });
});
