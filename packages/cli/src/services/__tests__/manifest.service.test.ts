import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildManifest } from "../manifest.service.js";
import type { BundleResult } from "../../types/index.js";

let dir: string;
let bundleResult: BundleResult;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "openota-manifest-test-"));

  const bundleDir = path.join(dir, "bundle");
  const assetsDir = path.join(dir, "assets");
  await fse.ensureDir(bundleDir);
  await fse.ensureDir(assetsDir);

  const bundlePath = path.join(bundleDir, "index.android.bundle");
  await fse.writeFile(bundlePath, "bundle-content");

  bundleResult = {
    platform: "android",
    bundlePath,
    bundleFilename: "index.android.bundle",
    assetsDir,
  };

  // package.json version is deliberately unrelated to runtimeVersion, matching the real bug
  // report: PebloBuddy's package.json stayed at 0.0.1 while runtimeVersion was 1.0.
  await fse.writeJson(path.join(dir, "package.json"), { version: "0.0.1" });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("buildManifest", () => {
  it("A: uses the runtimeVersion passed in, independent of the OTA release version", async () => {
    const manifest = await buildManifest(dir, bundleResult, "1.0.4", "1.0.0");

    expect(manifest.bundleVersion).toBe("1.0.4");
    expect(manifest.runtimeVersion).toBe("1.0.0");
  });

  it("B: ignores package.json's version entirely, even when it differs from runtimeVersion", async () => {
    // package.json in `dir` is "0.0.1" (see beforeEach) — must not leak into the manifest.
    const manifest = await buildManifest(dir, bundleResult, "1.0.4", "1.0.0");

    expect(manifest.runtimeVersion).toBe("1.0.0");
    expect(manifest.runtimeVersion).not.toBe("0.0.1");
  });

  it("writes the same runtimeVersion to the on-disk manifest.json", async () => {
    await buildManifest(dir, bundleResult, "1.0.4", "1.0.0");

    const written = await fse.readJson(path.join(dir, "manifest.json"));
    expect(written.runtimeVersion).toBe("1.0.0");
  });
});
