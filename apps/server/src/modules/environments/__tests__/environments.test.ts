import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-environments-test-"));
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

async function createApiKey(cookie: string, projectId: string) {
  const res = await request(app)
    .post(`/api/v1/projects/${projectId}/api-keys`)
    .set("Cookie", cookie)
    .set("X-Requested-With", "XMLHttpRequest")
    .send({ name: "ci-key" });
  expect(res.status).toBe(201);
  return res.body.data.fullKey as string;
}

function upload(projectId: string, apiKey: string, version: string, opts: { channel?: string; releaseNotes?: string } = {}) {
  const req = request(app)
    .post(`/api/v1/projects/${projectId}/packages`)
    .set("Authorization", `Bearer ${apiKey}`)
    .field("platform", "android")
    .field("version", version)
    .field("runtimeVersion", "1.0.0")
    .field("bundleName", "index.android.bundle")
    .field("sha256", "a".repeat(64))
    .field("size", "18");
  if (opts.channel) req.field("channel", opts.channel);
  if (opts.releaseNotes) req.field("releaseNotes", opts.releaseNotes);
  return req.attach("file", Buffer.from("x"), { filename: "bundle.zip", contentType: "application/zip" });
}

describe("environments", () => {
  it("auto-seeds Production/Staging/Development on project creation", async () => {
    const cookie = await signup("env-owner-a@example.test");
    const projectId = await createProject(cookie, "Env Project A");

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/environments`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(200);
    const channels = res.body.data.map((e: { channel: string }) => e.channel).sort();
    expect(channels).toEqual(["development", "production", "staging"]);
    // Nothing released yet — every environment's active pointer must be null, not fabricated.
    for (const env of res.body.data) {
      expect(env.active.android).toBeNull();
      expect(env.active.ios).toBeNull();
    }
  });

  it("upload writes release history with notes; environments reflects the active release", async () => {
    const cookie = await signup("env-owner-b@example.test");
    const projectId = await createProject(cookie, "Env Project B");
    const apiKey = await createApiKey(cookie, projectId);

    const uploadRes = await upload(projectId, apiKey, "1.0.0", { releaseNotes: "Initial release" });
    expect(uploadRes.status).toBe(201);

    const envRes = await request(app)
      .get(`/api/v1/projects/${projectId}/environments`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    const production = envRes.body.data.find((e: { channel: string }) => e.channel === "production");
    expect(production.active.android.version).toBe("1.0.0");
    expect(production.active.android.release_notes).toBe("Initial release");
    expect(production.active.android.status).toBe("active");

    const historyRes = await request(app)
      .get(`/api/v1/projects/${projectId}/environments/production/history?platform=android`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(historyRes.body.data).toHaveLength(1);
    expect(historyRes.body.data[0].version).toBe("1.0.0");
  });

  it("a second upload supersedes the first (inactive), and rollback restores it (active) with a reason", async () => {
    const cookie = await signup("env-owner-c@example.test");
    const projectId = await createProject(cookie, "Env Project C");
    const apiKey = await createApiKey(cookie, projectId);

    await upload(projectId, apiKey, "1.0.0");
    await upload(projectId, apiKey, "2.0.0");

    const rollbackRes = await request(app)
      .post(`/api/v1/projects/${projectId}/packages/rollback`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ platform: "android", version: "1.0.0", reason: "2.0.0 crashed on launch" });
    expect(rollbackRes.status).toBe(200);

    const historyRes = await request(app)
      .get(`/api/v1/projects/${projectId}/environments/production/history?platform=android`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");

    const byVersion = Object.fromEntries(
      (historyRes.body.data as Array<{ version: string; status: string; rollback_reason: string | null }>).map((r) => [r.version, r]),
    );
    expect(byVersion["1.0.0"].status).toBe("active");
    expect(byVersion["1.0.0"].rollback_reason).toBe("2.0.0 crashed on launch");
    expect(byVersion["2.0.0"].status).toBe("rolled_back");
  });

  it("channels stay isolated: a release on staging never appears in production's history", async () => {
    const cookie = await signup("env-owner-d@example.test");
    const projectId = await createProject(cookie, "Env Project D");
    const apiKey = await createApiKey(cookie, projectId);

    await upload(projectId, apiKey, "9.0.0", { channel: "staging" });

    const prodHistory = await request(app)
      .get(`/api/v1/projects/${projectId}/environments/production/history?platform=android`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(prodHistory.body.data).toHaveLength(0);

    const stagingHistory = await request(app)
      .get(`/api/v1/projects/${projectId}/environments/staging/history?platform=android`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(stagingHistory.body.data).toHaveLength(1);
    expect(stagingHistory.body.data[0].version).toBe("9.0.0");
  });

  it("editing an environment's name/color/description persists", async () => {
    const cookie = await signup("env-owner-e@example.test");
    const projectId = await createProject(cookie, "Env Project E");

    const patchRes = await request(app)
      .patch(`/api/v1/projects/${projectId}/environments/production`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ color: "red", description: "Custom description" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.color).toBe("red");
    expect(patchRes.body.data.description).toBe("Custom description");
    expect(patchRes.body.data.name).toBe("Production"); // untouched field preserved
  });

  it("another user cannot read or edit environments for a project they don't own", async () => {
    const ownerCookie = await signup("env-owner-f@example.test");
    const projectId = await createProject(ownerCookie, "Env Project F");
    const attackerCookie = await signup("env-attacker-f@example.test");

    const getRes = await request(app)
      .get(`/api/v1/projects/${projectId}/environments`)
      .set("Cookie", attackerCookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(getRes.status).toBe(404);

    const patchRes = await request(app)
      .patch(`/api/v1/projects/${projectId}/environments/production`)
      .set("Cookie", attackerCookie)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ color: "red" });
    expect(patchRes.status).toBe(404);
  });
});
