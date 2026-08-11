import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// resolveProjectFromKey makes a real network call before login decides whether to save the key
// (see project.service.ts) — mocked here so these tests are deterministic regardless of what's
// actually listening on localhost:3001 on the machine running them (the original version of this
// test silently relied on "nothing answers there", which isn't guaranteed and broke once
// something real was running on that port).
const mockGet = vi.fn();
vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: mockGet },
  };
});

let root: string;
let fakeHome: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "openota-login-cmd-test-"));
  fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "openota-login-home-test-"));
  vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
  mockGet.mockReset();

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

async function runInRoot(apiKey: string) {
  const originalCwd = process.cwd();
  process.chdir(root);
  try {
    vi.resetModules();
    const { runLogin } = await import("../login.js");
    await runLogin({ apiKey });
  } finally {
    process.chdir(originalCwd);
  }
}

const credentialsPathFor = (home: string) => path.join(home, ".openota", "credentials.json");

describe("runLogin", () => {
  it("saves a key it couldn't verify (server unreachable) rather than blocking on a network blip", async () => {
    mockGet.mockRejectedValue(new Error("connect ECONNREFUSED"));

    await runInRoot("ota_live_super_secret_value");

    const configOnDisk = await fse.readJson(path.join(root, "openota.config.json"));
    expect(JSON.stringify(configOnDisk)).not.toContain("ota_live_super_secret_value");
    expect(configOnDisk.apiKey).toBeUndefined();

    const credentialsPath = credentialsPathFor(fakeHome);
    expect(await fse.pathExists(credentialsPath)).toBe(true);

    const credentials = await fse.readJson(credentialsPath);
    expect(credentials.servers["http://localhost:3001/api/v1"].apiKey).toBe("ota_live_super_secret_value");

    const stat = await fs.stat(credentialsPath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it("does NOT save a key the server explicitly rejected", async () => {
    mockGet.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { error: { message: "Missing or invalid API key" } } },
    });

    await runInRoot("ota_live_wrong_server_key");

    const credentialsPath = credentialsPathFor(fakeHome);
    const exists = await fse.pathExists(credentialsPath);
    if (exists) {
      const credentials = await fse.readJson(credentialsPath);
      expect(credentials.servers["http://localhost:3001/api/v1"]).toBeUndefined();
    }
  });

  it("saves and links the project when the key resolves to one", async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: { id: "proj_123", name: "Demo" } } });

    await runInRoot("ota_live_real_project_key");

    const credentials = await fse.readJson(credentialsPathFor(fakeHome));
    expect(credentials.servers["http://localhost:3001/api/v1"].apiKey).toBe("ota_live_real_project_key");

    const configOnDisk = await fse.readJson(path.join(root, "openota.config.json"));
    expect(configOnDisk.projectId).toBe("proj_123");
  });

  it("saves a self-hosted flat key (not project-scoped) without touching projectId", async () => {
    mockGet.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { error: { message: "This endpoint requires a project-scoped API key (Authorization: Bearer ota_live_...)." } } },
    });

    await runInRoot("ota_live_self_hosted_flat_key");

    const credentials = await fse.readJson(credentialsPathFor(fakeHome));
    expect(credentials.servers["http://localhost:3001/api/v1"].apiKey).toBe("ota_live_self_hosted_flat_key");

    const configOnDisk = await fse.readJson(path.join(root, "openota.config.json"));
    expect(configOnDisk.projectId).toBeUndefined();
  });
});
