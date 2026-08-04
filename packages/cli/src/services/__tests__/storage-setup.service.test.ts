import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validateStorage, writeStorageEnv } from "../storage-setup.service.js";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "openota-cli-storage-test-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("validateStorage (local)", () => {
  it("creates the directory if missing and confirms write permission", async () => {
    const result = await validateStorage({ provider: "local", storageRoot: "./data-storage" }, root);

    expect(result.ok).toBe(true);
    expect(result.checks.map((c) => c.name)).toEqual(["Directory exists", "Write permission"]);
    const exists = await fs
      .stat(path.join(root, "data-storage"))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });
});

describe("writeStorageEnv", () => {
  it("writes a fresh .env when none exists", async () => {
    const envPath = await writeStorageEnv(root, { provider: "local", storageRoot: "./storage" });

    const content = await fs.readFile(envPath, "utf-8");
    expect(content).toContain("STORAGE_PROVIDER=local");
    expect(content).toContain("STORAGE_ROOT=./storage");
  });

  it("replaces only storage keys, preserving unrelated existing lines", async () => {
    await fs.writeFile(
      path.join(root, ".env"),
      ["DATABASE_URL=postgres://example", "STORAGE_PROVIDER=local", "STORAGE_ROOT=./old-storage", "SESSION_SECRET=abc123"].join("\n"),
    );

    const envPath = await writeStorageEnv(root, {
      provider: "supabase",
      supabaseUrl: "https://example.supabase.co",
      supabaseServiceRoleKey: "service-role-key",
      supabaseStorageBucket: "openota-releases",
    });

    const content = await fs.readFile(envPath, "utf-8");
    expect(content).toContain("DATABASE_URL=postgres://example");
    expect(content).toContain("SESSION_SECRET=abc123");
    expect(content).toContain("STORAGE_PROVIDER=supabase");
    expect(content).toContain("SUPABASE_URL=https://example.supabase.co");
    expect(content).not.toContain("STORAGE_ROOT=./old-storage");
  });
});
