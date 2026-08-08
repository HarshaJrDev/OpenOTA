import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-apps-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;
  delete process.env.OPENOTA_API_KEY;

  ({ app } = await import("../../../app.js"));
  const { initDb } = await import("../../../db/client.js");
  await initDb();
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

async function signup(email: string) {
  const res = await request(app).post("/api/v1/auth/signup").send({ email, password: "correct-horse-battery" });
  expect(res.status).toBe(201);
  const cookie = res.headers["set-cookie"];
  return Array.isArray(cookie) ? cookie[0] : cookie;
}

async function createProject(cookie: string, name: string) {
  const res = await request(app)
    .post("/api/v1/projects")
    .set("Cookie", cookie)
    .set("X-Requested-With", "XMLHttpRequest")
    .send({ name });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

describe("apps", () => {
  it("upserts, and a real save with an empty field doesn't get silently reverted (regression)", async () => {
    const cookie = await signup("apps-owner-a@example.test");
    const projectId = await createProject(cookie, "Apps Project A");

    // First save: everything filled in.
    const created = await request(app)
      .put(`/api/v1/projects/${projectId}/apps/android`)
      .set("Cookie", cookie!)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        runtimeVersion: "1.0.0",
        packageName: "com.example.app",
        minSupportedVersion: "1.0.0",
        remoteConfig: { uiVersion: "1.0.1" },
      });
    expect(created.status).toBe(200);
    expect(created.body.data.remote_config).toBe('{"uiVersion":"1.0.1"}');
    expect(created.body.data.min_supported_version).toBe("1.0.0");

    // Second save: the dashboard resends every field on every save. The user cleared Remote
    // Config and Min Supported Version in the UI — that must send `null` for those two fields.
    // Before the fix, this exact request (an emptied optional field) reproduced the "save
    // appears to roll back to the old value" bug: `null` was previously indistinguishable from
    // "field not sent" and got silently ignored server-side, keeping the stale value forever.
    const updated = await request(app)
      .put(`/api/v1/projects/${projectId}/apps/android`)
      .set("Cookie", cookie!)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        runtimeVersion: "1.0.0",
        packageName: "com.example.app",
        minSupportedVersion: null,
        remoteConfig: null,
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.remote_config).toBeNull();
    expect(updated.body.data.min_supported_version).toBeNull();
    // Untouched fields on this same request really do carry forward, unaffected.
    expect(updated.body.data.package_name).toBe("com.example.app");

    // Fetching it back confirms it's really persisted this way, not just echoed in the response.
    const list = await request(app)
      .get(`/api/v1/projects/${projectId}/apps`)
      .set("Cookie", cookie!)
      .set("X-Requested-With", "XMLHttpRequest");
    const android = list.body.data.find((c: { platform: string }) => c.platform === "android");
    expect(android.remote_config).toBeNull();
    expect(android.min_supported_version).toBeNull();
  });

  it("omitting a field entirely (undefined) still leaves it untouched, unlike sending null", async () => {
    const cookie = await signup("apps-owner-b@example.test");
    const projectId = await createProject(cookie, "Apps Project B");

    await request(app)
      .put(`/api/v1/projects/${projectId}/apps/android`)
      .set("Cookie", cookie!)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ runtimeVersion: "1.0.0", packageName: "com.example.app" })
      .expect(200);

    // A request that never mentions packageName at all — not the same as clearing it.
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/apps/android`)
      .set("Cookie", cookie!)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ runtimeVersion: "1.1.0" });

    expect(res.status).toBe(200);
    expect(res.body.data.runtime_version).toBe("1.1.0");
    expect(res.body.data.package_name).toBe("com.example.app");
  });

  it("rejects a remoteConfig that isn't a JSON object", async () => {
    const cookie = await signup("apps-owner-c@example.test");
    const projectId = await createProject(cookie, "Apps Project C");

    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/apps/android`)
      .set("Cookie", cookie!)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ remoteConfig: "not an object" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
