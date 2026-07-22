import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import AdmZip from "adm-zip";
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

  it("survives a genuinely empty assets directory as a real entry in the zip", async () => {
    // Reproduces the real bug: archiver.directory() on a zero-file source directory emits no
    // entry at all, so an app with no bundled assets produced a package that, once extracted,
    // had no assets/ folder — which the native BundleVerifier correctly rejects as corrupt.
    await fse.emptyDir(path.join(dir, "assets"));

    const zipPath = await createOtaPackage(dir);
    const zip = new AdmZip(zipPath);
    const names = zip.getEntries().map((entry) => entry.entryName);

    expect(names).toContain("assets/");
  });

  it("does not duplicate the assets/ entry when real assets are present", async () => {
    const zipPath = await createOtaPackage(dir);
    const zip = new AdmZip(zipPath);
    const assetEntries = zip.getEntries().filter((entry) => entry.entryName.startsWith("assets/"));

    expect(assetEntries.map((entry) => entry.entryName)).toContain("assets/logo.png");
  });
});
