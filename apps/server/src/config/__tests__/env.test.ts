import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const envEntryPoint = path.resolve(import.meta.dirname, "../env.ts");

function runWithEnv(extraEnv: Record<string, string>) {
  // NODE_ENV=test makes env.ts skip dotenv entirely, so a real apps/server/.env (e.g. one
  // holding real Supabase credentials for manual testing) can never leak into this subprocess
  // and silently defeat the "missing config" cases below.
  const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: "test", ...extraEnv };
  for (const [key, value] of Object.entries(extraEnv)) {
    if (value === "") delete env[key];
  }

  return spawnSync(process.execPath, ["--import", "tsx", envEntryPoint], {
    encoding: "utf-8",
    env,
  });
}

describe("env validation", () => {
  it("fails startup with a clear error when STORAGE_PROVIDER=supabase is missing Supabase config", () => {
    const result = runWithEnv({
      STORAGE_PROVIDER: "supabase",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/SUPABASE_URL/);
    expect(result.stderr).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("boots fine when STORAGE_PROVIDER=supabase has full config", () => {
    const result = runWithEnv({
      STORAGE_PROVIDER: "supabase",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
    });

    expect(result.status).toBe(0);
  });

  it("boots fine with the default STORAGE_PROVIDER=local and no Supabase config", () => {
    const result = runWithEnv({ STORAGE_PROVIDER: "" });
    expect(result.status).toBe(0);
  });
});
