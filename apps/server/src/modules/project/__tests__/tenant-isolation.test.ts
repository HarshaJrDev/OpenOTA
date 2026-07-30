import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-tenant-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;
  delete process.env.OPENOTA_API_KEY;

  ({ app } = await import("../../../app.js"));
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
  const res = await request(app).post("/api/v1/projects").set("Cookie", cookie).send({ name });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

async function createApiKey(cookie: string, projectId: string) {
  const res = await request(app)
    .post(`/api/v1/projects/${projectId}/api-keys`)
    .set("Cookie", cookie)
    .send({ name: "ci-key" });
  expect(res.status).toBe(201);
  return { id: res.body.data.id as string, fullKey: res.body.data.fullKey as string };
}

async function uploadPackage(projectId: string, apiKey: string) {
  return request(app)
    .post(`/api/v1/projects/${projectId}/packages`)
    .set("Authorization", `Bearer ${apiKey}`)
    .field("platform", "android")
    .field("version", "1.0.0")
    .field("runtimeVersion", "1.0.0")
    .field("bundleName", "index.android.bundle")
    .field("sha256", "a".repeat(64))
    .field("size", "18")
    .attach("file", Buffer.from("fake zip contents"), { filename: "bundle.zip", contentType: "application/zip" });
}

describe("multi-tenant isolation", () => {
  it("a logged-in user cannot see another user's projects", async () => {
    const cookieA = await signup("owner-a@example.test");
    const cookieB = await signup("owner-b@example.test");

    const projectAId = await createProject(cookieA, "Project A");

    // 404, not 401/403 — a logged-in user shouldn't learn whether a project id they don't own
    // even exists.
    const getAsB = await request(app).get(`/api/v1/projects/${projectAId}`).set("Cookie", cookieB);
    expect(getAsB.status).toBe(404);

    const listAsB = await request(app).get("/api/v1/projects").set("Cookie", cookieB);
    expect(listAsB.status).toBe(200);
    expect(listAsB.body.data).toHaveLength(0);
  });

  it("project A's API key is rejected on project B's routes (upload, list, rollback, delete)", async () => {
    const cookie = await signup("owner-c@example.test");
    const projectAId = await createProject(cookie, "Project C-A");
    const projectBId = await createProject(cookie, "Project C-B");
    const { fullKey: keyA } = await createApiKey(cookie, projectAId);

    const uploadCrossProject = await request(app)
      .post(`/api/v1/projects/${projectBId}/packages`)
      .set("Authorization", `Bearer ${keyA}`)
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "a".repeat(64))
      .field("size", "18")
      .attach("file", Buffer.from("x"), { filename: "bundle.zip", contentType: "application/zip" });
    expect(uploadCrossProject.status).toBe(401);

    const listCrossProject = await request(app)
      .get(`/api/v1/projects/${projectBId}/packages`)
      .set("Authorization", `Bearer ${keyA}`);
    expect(listCrossProject.status).toBe(401);

    const rollbackCrossProject = await request(app)
      .post(`/api/v1/projects/${projectBId}/packages/rollback`)
      .set("Authorization", `Bearer ${keyA}`)
      .send({ platform: "android", version: "1.0.0" });
    expect(rollbackCrossProject.status).toBe(401);

    const deleteCrossProject = await request(app)
      .delete(`/api/v1/projects/${projectBId}/packages/android/1.0.0`)
      .set("Authorization", `Bearer ${keyA}`);
    expect(deleteCrossProject.status).toBe(401);
  });

  it("a revoked API key is rejected", async () => {
    const cookie = await signup("owner-d@example.test");
    const projectId = await createProject(cookie, "Project D");
    const { id: keyId, fullKey } = await createApiKey(cookie, projectId);

    const beforeRevoke = await uploadPackage(projectId, fullKey);
    expect(beforeRevoke.status).toBe(201);

    const revokeRes = await request(app).delete(`/api/v1/projects/${projectId}/api-keys/${keyId}`).set("Cookie", cookie);
    expect(revokeRes.status).toBe(200);

    const afterRevoke = await request(app)
      .post(`/api/v1/projects/${projectId}/packages/rollback`)
      .set("Authorization", `Bearer ${fullKey}`)
      .send({ platform: "android", version: "1.0.0" });
    expect(afterRevoke.status).toBe(401);
  });

  it("an invalid/garbage API key is rejected", async () => {
    const cookie = await signup("owner-e@example.test");
    const projectId = await createProject(cookie, "Project E");

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/packages`)
      .set("Authorization", "Bearer ota_live_not_a_real_key_at_all");
    expect(res.status).toBe(401);
  });

  it("a release uploaded to project A is only visible/downloadable under project A's storage prefix", async () => {
    const cookie = await signup("owner-f@example.test");
    const projectAId = await createProject(cookie, "Project F-A");
    const projectBId = await createProject(cookie, "Project F-B");
    const { fullKey: keyA } = await createApiKey(cookie, projectAId);
    const { fullKey: keyB } = await createApiKey(cookie, projectBId);

    const upload = await uploadPackage(projectAId, keyA);
    expect(upload.status).toBe(201);

    // check/download are open (device-facing, no secret) but still scoped by the URL's own
    // :projectId — project B's namespace must report no update available for the exact same
    // platform/version project A just published.
    const checkOnA = await request(app).get(`/api/v1/projects/${projectAId}/packages/check?platform=android&currentVersion=0.0.1`);
    expect(checkOnA.body.data.available).toBe(true);

    const checkOnB = await request(app).get(`/api/v1/projects/${projectBId}/packages/check?platform=android&currentVersion=0.0.1`);
    expect(checkOnB.body.data.available).toBe(false);

    const listB = await request(app).get(`/api/v1/projects/${projectBId}/packages`).set("Authorization", `Bearer ${keyB}`);
    expect(listB.body.data).toHaveLength(0);
  });

  it("full API keys never appear in list responses, only hashed_key is always absent", async () => {
    const cookie = await signup("owner-g@example.test");
    const projectId = await createProject(cookie, "Project G");
    const { fullKey } = await createApiKey(cookie, projectId);

    const listRes = await request(app).get(`/api/v1/projects/${projectId}/api-keys`).set("Cookie", cookie);
    expect(listRes.status).toBe(200);
    const serialized = JSON.stringify(listRes.body);
    expect(serialized).not.toContain(fullKey);
    expect(serialized).not.toContain("hashed_key");
  });

  it("legacy flat routes and OPENOTA_API_KEY behavior are unaffected by project-scoped keys", async () => {
    // No Authorization header at all, and no project involved — the pre-existing open-by-default
    // flat-route behavior (see apiKey.middleware.ts) must still work exactly as before.
    const res = await request(app)
      .post("/api/v1/packages")
      .field("platform", "ios")
      .field("version", "9.9.9")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "main.jsbundle")
      .field("sha256", "b".repeat(64))
      .field("size", "3")
      .attach("file", Buffer.from("abc"), { filename: "bundle.zip", contentType: "application/zip" });

    expect(res.status).toBe(201);
  });

  it("dashboard session cookie (owner) can manage releases without an API key", async () => {
    const cookie = await signup("owner-h@example.test");
    const projectId = await createProject(cookie, "Project H");

    const upload = await request(app)
      .post(`/api/v1/projects/${projectId}/packages`)
      .set("Cookie", cookie)
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "c".repeat(64))
      .field("size", "9")
      .attach("file", Buffer.from("session-auth"), { filename: "bundle.zip", contentType: "application/zip" });
    expect(upload.status).toBe(201);

    const list = await request(app).get(`/api/v1/projects/${projectId}/packages`).set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const rollback = await request(app)
      .post(`/api/v1/projects/${projectId}/packages/rollback`)
      .set("Cookie", cookie)
      .send({ platform: "android", version: "1.0.0" });
    expect(rollback.status).toBe(200);
  });

  it("dashboard session cookie for a NON-owner is rejected on someone else's project", async () => {
    const cookieOwner = await signup("owner-i-owner@example.test");
    const cookieOther = await signup("owner-i-other@example.test");
    const projectId = await createProject(cookieOwner, "Project I");

    const listAsOther = await request(app).get(`/api/v1/projects/${projectId}/packages`).set("Cookie", cookieOther);
    expect(listAsOther.status).toBe(401);

    const uploadAsOther = await request(app)
      .post(`/api/v1/projects/${projectId}/packages`)
      .set("Cookie", cookieOther)
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "d".repeat(64))
      .field("size", "1")
      .attach("file", Buffer.from("x"), { filename: "bundle.zip", contentType: "application/zip" });
    expect(uploadAsOther.status).toBe(401);
  });

  it("an unauthenticated request (no key, no session) to a project-scoped mutating route is rejected", async () => {
    const cookie = await signup("owner-j@example.test");
    const projectId = await createProject(cookie, "Project J");

    const res = await request(app).get(`/api/v1/projects/${projectId}/packages`);
    expect(res.status).toBe(401);
  });

  it("owner can rename their project; slug stays stable", async () => {
    const cookie = await signup("owner-k@example.test");
    const projectId = await createProject(cookie, "Old Name");
    const before = await request(app).get(`/api/v1/projects/${projectId}`).set("Cookie", cookie);
    const slug = before.body.data.slug as string;

    const res = await request(app).patch(`/api/v1/projects/${projectId}`).set("Cookie", cookie).send({ name: "New Name" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("New Name");
    expect(res.body.data.slug).toBe(slug); // slug intentionally unchanged
  });

  it("a non-owner cannot rename or delete someone else's project (404, not 403 — no existence leak)", async () => {
    const ownerCookie = await signup("owner-l-owner@example.test");
    const otherCookie = await signup("owner-l-other@example.test");
    const projectId = await createProject(ownerCookie, "Project L");

    const rename = await request(app).patch(`/api/v1/projects/${projectId}`).set("Cookie", otherCookie).send({ name: "hijack" });
    expect(rename.status).toBe(404);

    const del = await request(app).delete(`/api/v1/projects/${projectId}`).set("Cookie", otherCookie);
    expect(del.status).toBe(404);

    // owner's project is untouched
    const stillThere = await request(app).get(`/api/v1/projects/${projectId}`).set("Cookie", ownerCookie);
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.data.name).toBe("Project L");
  });

  it("owner can delete their project; it and its API keys become inaccessible afterwards", async () => {
    const cookie = await signup("owner-m@example.test");
    const projectId = await createProject(cookie, "Project M");
    const { fullKey } = await createApiKey(cookie, projectId);

    const del = await request(app).delete(`/api/v1/projects/${projectId}`).set("Cookie", cookie);
    expect(del.status).toBe(200);
    expect(del.body.data.deleted).toBe(true);

    // project gone
    expect((await request(app).get(`/api/v1/projects/${projectId}`).set("Cookie", cookie)).status).toBe(404);
    // its API key no longer authorizes anything (cascade-deleted)
    const withDeadKey = await request(app)
      .get(`/api/v1/projects/${projectId}/packages`)
      .set("Authorization", `Bearer ${fullKey}`);
    expect(withDeadKey.status).toBe(401);
  });

  it("rejects an empty project name on rename (validation)", async () => {
    const cookie = await signup("owner-n@example.test");
    const projectId = await createProject(cookie, "Project N");
    const res = await request(app).patch(`/api/v1/projects/${projectId}`).set("Cookie", cookie).send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("a Bearer session token authenticates with NO cookie (cross-domain path)", async () => {
    // Login/signup return the token in the body; the cross-domain dashboard sends it as a Bearer
    // header because the third-party session cookie may be blocked. Prove every session-authed
    // surface works with the token alone and no Cookie header at all.
    const res = await request(app).post("/api/v1/auth/signup").send({ email: "bearer@example.test", password: "correct-horse" });
    const token = res.body.data.token as string;
    expect(token).toBeTruthy();

    const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("bearer@example.test");

    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bearer Project" });
    expect(created.status).toBe(201);

    // a project-scoped route (session, not API key) via the Bearer token
    const list = await request(app)
      .get(`/api/v1/projects/${created.body.data.id}/packages`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
  });

  it("a garbage Bearer token is rejected", async () => {
    const me = await request(app).get("/api/v1/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(me.status).toBe(401);
  });
});
