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
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;

  ({ app } = await import("../../../app.js"));
  const { initDb } = await import("../../../db/client.js");
  await initDb();
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("package module", () => {
  it("returns healthy status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
  });

  it("uploads a package and lists it", async () => {
    const bundle = createTestBundleZip();
    const uploadRes = await request(app)
      .post("/api/v1/packages")
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", bundle.sha256)
      .field("size", String(bundle.size))
      .attach("file", bundle.buffer, {
        filename: "bundle.zip",
        contentType: "application/zip",
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.data.bundleVersion).toBe("1.0.0");
    expect(uploadRes.body.data.sha256).toBe(bundle.sha256);

    const listRes = await request(app).get("/api/v1/packages");
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
  });

  it("rejects an upload whose claimed sha256 doesn't match the actual bundle bytes", async () => {
    const bundle = createTestBundleZip();
    const res = await request(app)
      .post("/api/v1/packages")
      .field("platform", "android")
      .field("version", "9.8.7")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "f".repeat(64)) // wrong on purpose — doesn't match the real bundle content
      .field("size", String(bundle.size))
      .attach("file", bundle.buffer, { filename: "bundle.zip", contentType: "application/zip" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UPLOAD_FAILED");
    expect(res.body.error.details.expected).toBe("f".repeat(64));

    // And the mismatched version was never actually persisted.
    const getRes = await request(app).get("/api/v1/packages/android/9.8.7");
    expect(getRes.status).toBe(404);
  });

  it("rejects a corrupted (non-zip) upload with a clean 400, not a 500", async () => {
    // Real bytes that are not a valid zip archive at all — e.g. a truncated/interrupted upload.
    // adm-zip's constructor throws a raw Error for this, which must be caught and translated,
    // not left to fall through to the generic 500 INTERNAL_ERROR handler.
    const garbage = Buffer.from("not a zip file, just random bytes ".repeat(50));
    const res = await request(app)
      .post("/api/v1/packages")
      .field("platform", "android")
      .field("version", "9.8.4")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "a".repeat(64))
      .field("size", String(garbage.length))
      .attach("file", garbage, { filename: "bundle.zip", contentType: "application/zip" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UPLOAD_FAILED");

    const getRes = await request(app).get("/api/v1/packages/android/9.8.4");
    expect(getRes.status).toBe(404);
  });

  it("rejects duplicate uploads", async () => {
    const bundle = createTestBundleZip();
    const res = await request(app)
      .post("/api/v1/packages")
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", bundle.sha256)
      .field("size", String(bundle.size))
      .attach("file", bundle.buffer, {
        filename: "bundle.zip",
        contentType: "application/zip",
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PACKAGE_ALREADY_EXISTS");
  });

  it("checks for update against an older version", async () => {
    const res = await request(app)
      .get("/api/v1/packages/check")
      .query({ platform: "android", currentVersion: "0.9.0" });

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(true);
    expect(res.body.data.latestVersion).toBe("1.0.0");
  });

  it("reports no update available for current version", async () => {
    const res = await request(app)
      .get("/api/v1/packages/check")
      .query({ platform: "android", currentVersion: "1.0.0" });

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
  });

  it("downloads a package", async () => {
    const res = await request(app).get("/api/v1/packages/android/1.0.0/download");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/zip");
  });

  it("returns 404 for missing package", async () => {
    const res = await request(app).get("/api/v1/packages/android/9.9.9");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PACKAGE_NOT_FOUND");
  });

  it("rejects invalid version format", async () => {
    const res = await request(app)
      .get("/api/v1/packages/check")
      .query({ platform: "android", currentVersion: "not-a-version" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rolls back the active version to an already-uploaded release", async () => {
    const bundle = createTestBundleZip("index.android.bundle", "console.log('v2');");
    const uploadRes = await request(app)
      .post("/api/v1/packages")
      .field("platform", "android")
      .field("version", "2.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", bundle.sha256)
      .field("size", String(bundle.size))
      .attach("file", bundle.buffer, {
        filename: "bundle.zip",
        contentType: "application/zip",
      });
    expect(uploadRes.status).toBe(201);

    // 2.0.0 is now active — a device on 1.0.0 should see it as available.
    const beforeRollback = await request(app)
      .get("/api/v1/packages/check")
      .query({ platform: "android", currentVersion: "1.0.0" });
    expect(beforeRollback.body.data.available).toBe(true);
    expect(beforeRollback.body.data.latestVersion).toBe("2.0.0");

    const rollbackRes = await request(app)
      .post("/api/v1/packages/rollback")
      .send({ platform: "android", version: "1.0.0" });
    expect(rollbackRes.status).toBe(200);
    expect(rollbackRes.body.data.bundleVersion).toBe("1.0.0");

    // Rolling back to 1.0.0 means a device already on 1.0.0 no longer sees an update...
    const afterRollback = await request(app)
      .get("/api/v1/packages/check")
      .query({ platform: "android", currentVersion: "1.0.0" });
    expect(afterRollback.body.data.available).toBe(false);
    expect(afterRollback.body.data.latestVersion).toBe("1.0.0");

    // ...but 2.0.0 still exists on the server, untouched — rollback moves a pointer, deletes nothing.
    const stillExists = await request(app).get("/api/v1/packages/android/2.0.0");
    expect(stillExists.status).toBe(200);

    // Clean up 2.0.0 so later tests in this file see a single-version world again.
    await request(app).delete("/api/v1/packages/android/2.0.0");
  });

  it("rejects rolling back to a version that was never uploaded", async () => {
    const res = await request(app)
      .post("/api/v1/packages/rollback")
      .send({ platform: "android", version: "9.9.9" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PACKAGE_NOT_FOUND");
  });

  it("refuses to delete the currently-active version", async () => {
    // At this point in the suite 1.0.0 is the active flat/default-channel version (restored by
    // the rollback test above) — deleting it would leave checkForUpdate broken for every device
    // still on it, exactly the bug a real negative-test pass against production found.
    const res = await request(app).delete("/api/v1/packages/android/1.0.0");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PACKAGE_IN_USE");

    const getRes = await request(app).get("/api/v1/packages/android/1.0.0");
    expect(getRes.status).toBe(200);
  });

  it("deletes a package once it's no longer active", async () => {
    const bundle = createTestBundleZip("index.android.bundle", "console.log('v3');");
    await request(app)
      .post("/api/v1/packages")
      .field("platform", "android")
      .field("version", "3.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", bundle.sha256)
      .field("size", String(bundle.size))
      .attach("file", bundle.buffer, { filename: "bundle.zip", contentType: "application/zip" })
      .expect(201);
    // 3.0.0 is now active — 1.0.0 is safe to delete.

    const res = await request(app).delete("/api/v1/packages/android/1.0.0");
    expect(res.status).toBe(200);

    const getRes = await request(app).get("/api/v1/packages/android/1.0.0");
    expect(getRes.status).toBe(404);
  });
});
