import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root: string;
let fakeHome: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "openota-login-cmd-test-"));
  fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "openota-login-home-test-"));
  vi.spyOn(os, "homedir").mockReturnValue(fakeHome);

  await fse.writeJson(path.join(root, "openota.config.json"), {
    serverUrl: "http://localhost:3001/api/v1",
    deployment: "production",
    platforms: ["android"],
    bundleOutput: "./openota",
    runtimeVersion: "1.0.0",
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(fakeHome, { recursive: true, force: true });
});

describe("runLogin", () => {
  it("never writes the API key into openota.config.json — only into the user-level credentials file", async () => {
    const originalCwd = process.cwd();
    process.chdir(root);

    try {
      const { runLogin } = await import("../login.js");
      await runLogin({ apiKey: "ota_live_super_secret_value" });
    } finally {
      process.chdir(originalCwd);
    }

    const configOnDisk = await fse.readJson(path.join(root, "openota.config.json"));
    expect(JSON.stringify(configOnDisk)).not.toContain("ota_live_super_secret_value");
    expect(configOnDisk.apiKey).toBeUndefined();

    const credentialsPath = path.join(fakeHome, ".openota", "credentials.json");
    expect(await fse.pathExists(credentialsPath)).toBe(true);

    const credentials = await fse.readJson(credentialsPath);
    expect(credentials.servers["http://localhost:3001/api/v1"].apiKey).toBe("ota_live_super_secret_value");

    const stat = await fs.stat(credentialsPath);
    expect(stat.mode & 0o777).toBe(0o600);
  });
});
