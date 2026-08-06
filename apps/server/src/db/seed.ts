import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { hashPassword } from "../modules/auth/password.js";
import { usersRepo } from "./repositories.js";

/**
 * DEV MODE ONLY. Hard-guarded on NODE_ENV !== "production" regardless of SEED_DEMO_ACCOUNT — a
 * demo account with a publicly-documented password must never be creatable in a real deployment,
 * so the production check is not something an operator can override via env var, only the dev-mode
 * opt-in can. Idempotent: safe to call on every boot, only inserts once.
 */
const DEMO_EMAIL = "demo@openota.dev";
const DEMO_PASSWORD = "OpenOTA-Demo-2026!"; // ggignore — intentionally public, documented in docs/CLOUD.md, hard-guarded off in production above

export async function seedDemoAccountIfEnabled(): Promise<void> {
  if (env.nodeEnv === "production" || !env.seedDemoAccount) {
    return;
  }

  const existing = await usersRepo.findByEmail(DEMO_EMAIL);
  if (existing) {
    return;
  }

  const user = await usersRepo.create(DEMO_EMAIL, hashPassword(DEMO_PASSWORD));
  // Verified immediately — a demo account should work regardless of REQUIRE_EMAIL_VERIFICATION.
  await usersRepo.markEmailVerified(user.id);
  // Deliberately does not log DEMO_PASSWORD — even a fixed, publicly-documented dev password
  // shouldn't go through the same log pipeline as everything else (log aggregators, etc.). The
  // password lives here in source and in docs/CLOUD.md, not in runtime logs.
  logger.info({ email: DEMO_EMAIL }, "DEV MODE: seeded demo account — see docs/CLOUD.md for credentials");
}
