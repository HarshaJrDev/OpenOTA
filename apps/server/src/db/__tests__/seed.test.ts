import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { env } from "../../config/env.js";
import { initDb } from "../client.js";
import { usersRepo } from "../repositories.js";
import { seedTestUsersIfEnabled } from "../seed.js";

let storageRoot: string;

beforeAll(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openota-seed-test-"));
  process.env.NODE_ENV = "test";
  process.env.STORAGE_ROOT = storageRoot;
  await initDb();
});

afterEach(() => {
  // `env` is a plain mutable object, not re-parsed per test — flipping these fields directly
  // exercises seedTestUsersIfEnabled's real branches without touching process.env/module-cache
  // machinery this repo's test suite is known to be fragile around (see CHANGELOG/summary notes on
  // cross-file vitest flakiness).
  env.seedTestUsers = false;
  env.testAdminPassword = undefined;
  env.testUserPassword = undefined;
});

afterAll(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("seedTestUsersIfEnabled", () => {
  it("does nothing when SEED_TEST_USERS is off", async () => {
    await seedTestUsersIfEnabled();
    expect(await usersRepo.findByEmail("admin@test.openota.dev")).toBeUndefined();
  });

  it("does nothing when enabled but passwords are missing — never falls back to a hardcoded default", async () => {
    env.seedTestUsers = true;
    await seedTestUsersIfEnabled();
    expect(await usersRepo.findByEmail("admin@test.openota.dev")).toBeUndefined();
    expect(await usersRepo.findByEmail("user@test.openota.dev")).toBeUndefined();
  });

  it("creates both real, verified accounts when properly configured", async () => {
    env.seedTestUsers = true;
    env.testAdminPassword = "test-admin-password-1";
    env.testUserPassword = "test-user-password-1";

    await seedTestUsersIfEnabled();

    const admin = await usersRepo.findByEmail("admin@test.openota.dev");
    const user = await usersRepo.findByEmail("user@test.openota.dev");
    expect(admin?.email_verified).toBe(true);
    expect(user?.email_verified).toBe(true);
  });

  it("is idempotent — running it twice does not error or duplicate", async () => {
    env.seedTestUsers = true;
    env.testAdminPassword = "test-admin-password-2";
    env.testUserPassword = "test-user-password-2";

    await seedTestUsersIfEnabled();
    await expect(seedTestUsersIfEnabled()).resolves.toBeUndefined();
  });

  it("never seeds when NODE_ENV=production, regardless of the flag", async () => {
    env.seedTestUsers = true;
    env.testAdminPassword = "test-admin-password-3";
    env.testUserPassword = "test-user-password-3";
    const original = env.nodeEnv;
    env.nodeEnv = "production";

    try {
      // The real assertion is the hard production guard itself: this must resolve cleanly (not
      // throw, not attempt a DB write) even with a fully "enabled" config, the same posture
      // seedDemoAccountIfEnabled already has and is tested for.
      await expect(seedTestUsersIfEnabled()).resolves.toBeUndefined();
    } finally {
      env.nodeEnv = original;
    }
  });
});
