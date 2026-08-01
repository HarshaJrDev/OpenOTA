import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-analytics-test-"));
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

function upload(projectId: string, apiKey: string, version: string) {
  return request(app)
    .post(`/api/v1/projects/${projectId}/packages`)
    .set("Authorization", `Bearer ${apiKey}`)
    .field("platform", "android")
    .field("version", version)
    .field("runtimeVersion", "1.0.0")
    .field("bundleName", "index.android.bundle")
    .field("sha256", "a".repeat(64))
    .field("size", "18")
    .attach("file", Buffer.from("x"), { filename: "bundle.zip", contentType: "application/zip" });
}

describe("release stats", () => {
  it("aggregates install outcomes, live device count, and channel activation for a release", async () => {
    const cookie = await signup("analytics-owner-a@example.test");
    const projectId = await createProject(cookie, "Analytics Project A");
    const apiKey = await createApiKey(cookie, projectId);

    await upload(projectId, apiKey, "1.0.0");

    // A device checks in on this version (drives devicesOnVersion), then reports a successful install.
    await request(app)
      .get(`/api/v1/projects/${projectId}/packages/check`)
      .query({ platform: "android", currentVersion: "1.0.0", deviceId: "device-1" });
    await request(app)
      .post(`/api/v1/projects/${projectId}/packages/report`)
      .send({ deviceId: "device-1", platform: "android", version: "1.0.0", runtimeVersion: "1.0.0", status: "success" });

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/analytics/releases/android/1.0.0`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(200);
    expect(res.body.data.installCounts.success).toBe(1);
    expect(res.body.data.devicesOnVersion).toBe(1);
    expect(res.body.data.channels).toHaveLength(1);
    expect(res.body.data.channels[0].channel).toBe("production");
    expect(res.body.data.channels[0].status).toBe("active");
  });

  it("another user cannot read release stats for a project they don't own", async () => {
    const ownerCookie = await signup("analytics-owner-b@example.test");
    const projectId = await createProject(ownerCookie, "Analytics Project B");
    const attackerCookie = await signup("analytics-attacker-b@example.test");

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/analytics/releases/android/1.0.0`)
      .set("Cookie", attackerCookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(res.status).toBe(404);
  });
});
