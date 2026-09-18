import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import fse from "fs-extra";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Regression coverage for the real bug this fixes: `doctor` used to report "Authentication:
// logged in" purely from local credential *presence*, never asking the server whether the key
// still works. A self-hosted/flat setup (no projectId) skipped server validation entirely, so a
// stale/rotated/revoked key looked fine right up until a real `openota release` 401ed on the
// actual upload request. checkAuthentication now calls the real server (resolveProjectFromKey)
// the same way `openota login` already did, closing that gap for every setup shape.

let server: http.Server;
let serverUrl: string;
let currentFlatKey: string | undefined;
let currentProjectKey: { key: string; id: string; name: string } | undefined;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const auth = req.headers.authorization;
    const presented = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : undefined;

    if (req.url === "/api/v1/projects/me") {
      if (currentProjectKey && presented === currentProjectKey.key) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ success: true, data: { id: currentProjectKey.id, name: currentProjectKey.name } }));
        return;
      }
      if (currentFlatKey && presented === currentFlatKey) {
        // Real server behavior: requireApiKey accepts the flat OPENOTA_API_KEY, then /projects/me's
        // own handler rejects because req.project was never set — see project.service.ts's
        // FLAT_KEY_MESSAGE constant, which this string must exactly match.
        res.writeHead(401, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: { code: "UNAUTHORIZED", message: "This endpoint requires a project-scoped API key (Authorization: Bearer ota_live_...)." },
          }),
        );
        return;
      }
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Missing or invalid API key" } }));
      return;
    }

    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  serverUrl = `http://localhost:${port}/api/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

let root: string;
let fakeHome: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "openota-doctor-auth-test-"));
  fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "openota-doctor-auth-home-test-"));
  vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
  currentFlatKey = undefined;
  currentProjectKey = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(fakeHome, { recursive: true, force: true });
});

async function writeConfig(extra: Record<string, unknown> = {}): Promise<void> {
  await fse.writeJson(path.join(root, "openota.config.json"), {
    serverUrl,
    deployment: "production",
    platforms: ["android"],
    bundleOutput: "./openota",
    runtimeVersion: "1.0.0",
    ...extra,
  });
}

/** Fresh module graph every call so credentials.service.ts's CREDENTIALS_DIR (computed once from
 * os.homedir() at import time) picks up the current test's fakeHome, not a previous test's. */
async function freshModules() {
  vi.resetModules();
  const doctorService = await import("../doctor.service.js");
  const credentialsService = await import("../credentials.service.js");
  return { checkAuthentication: doctorService.checkAuthentication, saveApiKey: credentialsService.saveApiKey };
}

describe("checkAuthentication", () => {
  it("reports not logged in when no key is stored for this server", async () => {
    await writeConfig();
    const { checkAuthentication } = await freshModules();

    const result = await checkAuthentication(root);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("not logged in");
  });

  it("a valid flat (self-hosted) key passes", async () => {
    currentFlatKey = "real-flat-secret";
    await writeConfig();
    const { checkAuthentication, saveApiKey } = await freshModules();
    await saveApiKey(serverUrl, "real-flat-secret");

    const result = await checkAuthentication(root);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("logged in");
  });

  it("a stale/revoked/wrong key fails with an actionable message — the exact bug this closes", async () => {
    currentFlatKey = "the-real-current-secret";
    await writeConfig();
    const { checkAuthentication, saveApiKey } = await freshModules();
    // Stored locally, but no longer what the server accepts — e.g. OPENOTA_API_KEY was rotated
    // server-side after this machine last logged in. Before this fix, checkAuthentication never
    // asked the server at all, so this would have reported "logged in" regardless.
    await saveApiKey(serverUrl, "a-stale-key-the-server-no-longer-accepts");

    const result = await checkAuthentication(root);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("rejected by the server");
    expect(result.message).toContain("openota login");
  });

  it("a valid project-scoped key with a matching projectId passes", async () => {
    currentProjectKey = { key: "ota_live_abc123", id: "proj_1", name: "My App" };
    await writeConfig({ projectId: "proj_1" });
    const { checkAuthentication, saveApiKey } = await freshModules();
    await saveApiKey(serverUrl, "ota_live_abc123");

    const result = await checkAuthentication(root);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("My App");
  });

  it("a project-scoped key with NO projectId configured fails — releases would silently hit the flat routes", async () => {
    currentProjectKey = { key: "ota_live_abc123", id: "proj_1", name: "My App" };
    await writeConfig(); // no projectId
    const { checkAuthentication, saveApiKey } = await freshModules();
    await saveApiKey(serverUrl, "ota_live_abc123");

    const result = await checkAuthentication(root);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("no projectId set");
  });

  it("never includes the API key value itself in any check message", async () => {
    currentFlatKey = "the-real-current-secret";
    await writeConfig();
    const { checkAuthentication, saveApiKey } = await freshModules();
    await saveApiKey(serverUrl, "super-secret-value-should-never-leak");

    const result = await checkAuthentication(root);
    expect(result.message).not.toContain("super-secret-value-should-never-leak");
  });
});
