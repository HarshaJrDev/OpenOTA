import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-apikey-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;
  process.env.OPENOTA_API_KEY = "test-shared-secret";

  ({ app } = await import("../../app.js"));
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
  delete process.env.OPENOTA_API_KEY;
});

describe("API key protection on mutating routes", () => {
  it("rejects an upload with no Authorization header", async () => {
    const res = await request(app)
      .post("/api/v1/packages")
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "a".repeat(64))
      .field("size", "18")
      .attach("file", Buffer.from("fake zip contents"), { filename: "bundle.zip", contentType: "application/zip" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an upload with the wrong key", async () => {
    const res = await request(app)
      .post("/api/v1/packages")
      .set("Authorization", "Bearer wrong-key")
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "a".repeat(64))
      .field("size", "18")
      .attach("file", Buffer.from("fake zip contents"), { filename: "bundle.zip", contentType: "application/zip" });

    expect(res.status).toBe(401);
  });

  it("accepts an upload with the correct key", async () => {
    const res = await request(app)
      .post("/api/v1/packages")
      .set("Authorization", "Bearer test-shared-secret")
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "a".repeat(64))
      .field("size", "18")
      .attach("file", Buffer.from("fake zip contents"), { filename: "bundle.zip", contentType: "application/zip" });

    expect(res.status).toBe(201);
  });

  it("rejects rollback without a key, even to an existing version", async () => {
    const res = await request(app)
      .post("/api/v1/packages/rollback")
      .send({ platform: "android", version: "1.0.0" });

    expect(res.status).toBe(401);
  });

  it("rejects delete without a key", async () => {
    const res = await request(app).delete("/api/v1/packages/android/1.0.0");
    expect(res.status).toBe(401);
  });

  it("leaves check/list/download open with no key required", async () => {
    const check = await request(app).get("/api/v1/packages/check").query({ platform: "android", currentVersion: "0.0.0" });
    expect(check.status).toBe(200);

    const list = await request(app).get("/api/v1/packages");
    expect(list.status).toBe(200);

    const download = await request(app).get("/api/v1/packages/android/1.0.0/download");
    expect(download.status).toBe(200);
  });
});
