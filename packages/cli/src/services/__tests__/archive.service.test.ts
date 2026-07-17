import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createOtaPackage } from "../archive.service.js";

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "openota-archive-test-"));
  await fse.ensureDir(path.join(dir, "bundle"));
  await fse.ensureDir(path.join(dir, "assets"));
  await fse.writeFile(path.join(dir, "bundle", "index.android.bundle"), "bundle-content");
  await fse.writeFile(path.join(dir, "assets", "logo.png"), "asset-content");
  await fse.writeJson(path.join(dir, "manifest.json"), { version: "1.0.0" });
  await fse.writeJson(path.join(dir, "metadata.json"), { appVersion: "1.0.0" });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("createOtaPackage", () => {
  it("creates a non-empty zip archive", async () => {
    const zipPath = await createOtaPackage(dir);
    const stat = await fs.stat(zipPath);

    expect(zipPath).toBe(path.join(dir, "ota-package.zip"));
    expect(stat.size).toBeGreaterThan(0);
  });
});
