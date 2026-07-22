import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Express } from "express";

let app: Express;
let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-size-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;
  // 1 byte, so any real upload trips PACKAGE_TOO_LARGE — isolated to this test file's own
  // module registry (vitest gives each test file a fresh import cache by default).
  process.env.OPENOTA_MAX_PACKAGE_SIZE_MB = "0.000001";

  ({ app } = await import("../../../app.js"));
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
  delete process.env.OPENOTA_MAX_PACKAGE_SIZE_MB;
});

describe("package size limit", () => {
  it("rejects an oversized upload with a structured PACKAGE_TOO_LARGE error", async () => {
    const res = await request(app)
      .post("/api/v1/packages")
      .field("platform", "android")
      .field("version", "1.0.0")
      .field("runtimeVersion", "1.0.0")
      .field("bundleName", "index.android.bundle")
      .field("sha256", "a".repeat(64))
      .field("size", "18")
      .attach("file", Buffer.from("this payload is definitely bigger than one byte"), {
        filename: "bundle.zip",
        contentType: "application/zip",
      });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PACKAGE_TOO_LARGE");
    expect(res.body.error.details.maxBytes).toBeTypeOf("number");
  });
});
