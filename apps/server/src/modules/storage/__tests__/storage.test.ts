import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestBundleZip } from "../../../test-utils/bundle-fixture.js";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-storage-test-"));
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

function upload(projectId: string, apiKey: string, version: string, size: number) {
  const bundle = createTestBundleZip("index.android.bundle", "x".repeat(size));
  return request(app)
    .post(`/api/v1/projects/${projectId}/packages`)
    .set("Authorization", `Bearer ${apiKey}`)
    .field("platform", "android")
    .field("version", version)
    .field("runtimeVersion", "1.0.0")
    .field("bundleName", "index.android.bundle")
    .field("sha256", bundle.sha256)
    .field("size", String(bundle.size))
    .attach("file", bundle.buffer, { filename: "bundle.zip", contentType: "application/zip" });
}

describe("storage", () => {
  it("reports the local provider, healthy status, and real byte usage across distinct packages", async () => {
    const cookie = await signup("storage-owner-a@example.test");
    const projectId = await createProject(cookie, "Storage Project A");
    const apiKey = await createApiKey(cookie, projectId);

    await upload(projectId, apiKey, "1.0.0", 10);
    await upload(projectId, apiKey, "1.1.0", 20);

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/storage`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe("local");
    expect(res.body.data.bucket).toBeNull();
    expect(res.body.data.healthy).toBe(true);
    expect(res.body.data.packageCount).toBe(2);
    expect(res.body.data.bytesUsed).toBe(30);
  });

  it("does not double-count bytes when a version is rolled back to (same physical package, same storage_key)", async () => {
    const cookie = await signup("storage-owner-b@example.test");
    const projectId = await createProject(cookie, "Storage Project B");
    const apiKey = await createApiKey(cookie, projectId);

    await upload(projectId, apiKey, "1.0.0", 10);
    await upload(projectId, apiKey, "1.1.0", 20);
    await request(app)
      .post(`/api/v1/projects/${projectId}/packages/rollback`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ platform: "android", version: "1.0.0" });

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/storage`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");

    expect(res.status).toBe(200);
    expect(res.body.data.packageCount).toBe(2);
    expect(res.body.data.bytesUsed).toBe(30);
  });

  it("another user cannot read storage info for a project they don't own", async () => {
    const ownerCookie = await signup("storage-owner-c@example.test");
    const projectId = await createProject(ownerCookie, "Storage Project C");
    const attackerCookie = await signup("storage-attacker-c@example.test");

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/storage`)
      .set("Cookie", attackerCookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(res.status).toBe(404);
  });
});
