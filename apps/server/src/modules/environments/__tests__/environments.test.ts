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

function upload(
  projectId: string,
  apiKey: string,
  version: string,
  opts: { channel?: string; releaseNotes?: string; force?: boolean } = {},
) {
  const bundle = createTestBundleZip("index.android.bundle", `console.log('${version}');`);
  const req = request(app)
    .post(`/api/v1/projects/${projectId}/packages`)
    .set("Authorization", `Bearer ${apiKey}`)
    .field("platform", "android")
    .field("version", version)
    .field("runtimeVersion", "1.0.0")
    .field("bundleName", "index.android.bundle")
    .field("sha256", bundle.sha256)
    .field("size", String(bundle.size));
  if (opts.channel) req.field("channel", opts.channel);
  if (opts.releaseNotes) req.field("releaseNotes", opts.releaseNotes);
  if (opts.force) req.field("force", "true");
  return req.attach("file", bundle.buffer, { filename: "bundle.zip", contentType: "application/zip" });
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

    // Full-fidelity timeline: 3 distinct actions happened (release 1.0.0, release 2.0.0, rollback
    // to 1.0.0), so 3 entries — not one collapsed entry per version.
    const entries = historyRes.body.data as Array<{ version: string; event_type: string; reason: string | null }>;
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ version: "1.0.0", event_type: "rollback", reason: "2.0.0 crashed on launch" });
    expect(entries.some((e) => e.version === "2.0.0" && e.event_type === "release")).toBe(true);
    expect(entries.some((e) => e.version === "1.0.0" && e.event_type === "release")).toBe(true);
  });

  it("uploading an older version stores it but does not regress the active pointer", async () => {
    const cookie = await signup("env-owner-downgrade@example.test");
    const projectId = await createProject(cookie, "Env Project Downgrade");
    const apiKey = await createApiKey(cookie, projectId);

    await upload(projectId, apiKey, "5.0.0").expect(201);

    // 4.0.0 is older than the already-active 5.0.0 — a real scenario for a stale CI re-run or a
    // fat-fingered --version. It must still upload successfully (so it's stored and available as
    // a rollback target)...
    const olderRes = await upload(projectId, apiKey, "4.0.0");
    expect(olderRes.status).toBe(201);

    // ...but must NOT become what devices are offered.
    const checkRes = await request(app)
      .get(`/api/v1/projects/${projectId}/packages/check`)
      .query({ platform: "android", currentVersion: "0.0.0" });
    expect(checkRes.body.data.latestVersion).toBe("5.0.0");
  });

  it("force:true lets an older version become active anyway", async () => {
    const cookie = await signup("env-owner-force@example.test");
    const projectId = await createProject(cookie, "Env Project Force");
    const apiKey = await createApiKey(cookie, projectId);

    await upload(projectId, apiKey, "5.0.0").expect(201);
    await upload(projectId, apiKey, "4.0.0", { force: true }).expect(201);

    const checkRes = await request(app)
      .get(`/api/v1/projects/${projectId}/packages/check`)
      .query({ platform: "android", currentVersion: "0.0.0" });
    expect(checkRes.body.data.latestVersion).toBe("4.0.0");
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

  it("staged rollout: 0% withholds the update from every device, 100% (default) serves it to all", async () => {
    const cookie = await signup("env-owner-g@example.test");
    const projectId = await createProject(cookie, "Env Project G");
    const apiKey = await createApiKey(cookie, projectId);

    await upload(projectId, apiKey, "1.0.0");

    const rolloutRes = await request(app)
      .patch(`/api/v1/projects/${projectId}/environments/production/rollout`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ platform: "android", percentage: 0 });
    expect(rolloutRes.status).toBe(200);
    expect(rolloutRes.body.data.rollout_percentage).toBe(0);

    for (const deviceId of ["device-a", "device-b", "device-c"]) {
      const checkRes = await request(app)
        .get(`/api/v1/projects/${projectId}/packages/check`)
        .query({ platform: "android", currentVersion: "0.0.1", deviceId });
      expect(checkRes.body.data.available).toBe(false);
    }

    // A device with no id can't be bucketed, so it's let through rather than starved forever.
    const anonymousCheck = await request(app)
      .get(`/api/v1/projects/${projectId}/packages/check`)
      .query({ platform: "android", currentVersion: "0.0.1" });
    expect(anonymousCheck.body.data.available).toBe(true);

    await request(app)
      .patch(`/api/v1/projects/${projectId}/environments/production/rollout`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ platform: "android", percentage: 100 });

    const fullyRolledOut = await request(app)
      .get(`/api/v1/projects/${projectId}/packages/check`)
      .query({ platform: "android", currentVersion: "0.0.1", deviceId: "device-a" });
    expect(fullyRolledOut.body.data.available).toBe(true);
  });

  it("rollout percentage changes appear in history (previously left no trace at all)", async () => {
    const cookie = await signup("env-owner-h@example.test");
    const projectId = await createProject(cookie, "Env Project H");
    const apiKey = await createApiKey(cookie, projectId);

    await upload(projectId, apiKey, "1.0.0");

    await request(app)
      .patch(`/api/v1/projects/${projectId}/environments/production/rollout`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ platform: "android", percentage: 25 });

    // Setting the same percentage again shouldn't create a duplicate/no-op event.
    await request(app)
      .patch(`/api/v1/projects/${projectId}/environments/production/rollout`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ platform: "android", percentage: 25 });

    const historyRes = await request(app)
      .get(`/api/v1/projects/${projectId}/environments/production/history?platform=android`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest");

    const entries = historyRes.body.data as Array<{
      event_type: string;
      rollout_percentage: number | null;
      previous_rollout_percentage: number | null;
    }>;
    const rolloutEvents = entries.filter((e) => e.event_type === "rollout_change");
    expect(rolloutEvents).toHaveLength(1);
    expect(rolloutEvents[0]).toMatchObject({ rollout_percentage: 25, previous_rollout_percentage: 100 });
  });

  it("a release, a rollback, and a rollout change each broadcast a live 'check now' nudge to connected devices on that channel", async () => {
    const { liveRegistry, keyFor } = await import("../../live/registry.js");

    const cookie = await signup("env-owner-i@example.test");
    const projectId = await createProject(cookie, "Env Project I");
    const apiKey = await createApiKey(cookie, projectId);

    const key = keyFor(projectId, "android", "production");
    const received: string[] = [];
    const fakeSocket = {
      readyState: 1,
      OPEN: 1,
      send: (payload: string) => received.push(payload),
    } as unknown as import("ws").WebSocket;
    liveRegistry.add(key, fakeSocket);

    await upload(projectId, apiKey, "1.0.0");
    expect(received).toHaveLength(1);
    expect(JSON.parse(received[0]!)).toEqual({ type: "release-changed" });

    await upload(projectId, apiKey, "2.0.0");
    expect(received).toHaveLength(2);

    await request(app)
      .post(`/api/v1/projects/${projectId}/packages/rollback`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ platform: "android", version: "1.0.0" });
    expect(received).toHaveLength(3);

    await request(app)
      .patch(`/api/v1/projects/${projectId}/environments/production/rollout`)
      .set("Cookie", cookie)
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ platform: "android", percentage: 50 });
    expect(received).toHaveLength(4);

    // Never leaks manifest/version data — a device must always re-check to find out what's new.
    for (const raw of received) {
      expect(JSON.parse(raw)).toEqual({ type: "release-changed" });
    }

    liveRegistry.remove(key, fakeSocket);
  });
});
