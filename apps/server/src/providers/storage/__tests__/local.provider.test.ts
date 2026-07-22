import { Readable } from "node:stream";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLocalStorageProvider } from "../local.provider.js";
import type { StorageProvider } from "../provider.js";

let root: string;
let storage: StorageProvider;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "openota-local-storage-"));
  storage = createLocalStorageProvider(root);
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("LocalStorageProvider", () => {
  it("uploads and downloads a file", async () => {
    await storage.upload("android/1.0.0/ota-package.zip", Readable.from(Buffer.from("hello")));

    const stream = await storage.download("android/1.0.0/ota-package.zip");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe("hello");
  });

  it("reports exists() correctly", async () => {
    expect(await storage.exists("android/1.0.0/ota-package.zip")).toBe(true);
    expect(await storage.exists("android/9.9.9/ota-package.zip")).toBe(false);
  });

  it("reports size()", async () => {
    expect(await storage.size("android/1.0.0/ota-package.zip")).toBe(5);
  });

  it("round-trips JSON", async () => {
    await storage.writeJson("android/1.0.0/manifest.json", { version: "1.0.0" });
    expect(await storage.readJson("android/1.0.0/manifest.json")).toEqual({ version: "1.0.0" });
  });

  it("builds a download URL for a zip key", async () => {
    const url = await storage.getDownloadUrl("android/1.0.0/ota-package.zip");
    expect(url).toBe("/api/v1/packages/android/1.0.0/download");
  });

  it("refuses to build a download URL for a non-zip key", async () => {
    await expect(storage.getDownloadUrl("android/1.0.0/manifest.json")).rejects.toThrow();
  });

  it("deletes a package directory", async () => {
    await storage.delete("android/1.0.0");
    expect(await storage.exists("android/1.0.0/ota-package.zip")).toBe(false);
  });
});
