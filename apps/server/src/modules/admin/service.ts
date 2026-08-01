import { settingsRepo } from "../../db/repositories.js";

const EMAIL_TEST_MODE_KEY = "email_test_mode";

/** Test mode ON (default) = never actually call Resend, only log — see auth/email.service.ts. */
export async function getEmailTestMode(): Promise<boolean> {
  const value = await settingsRepo.get(EMAIL_TEST_MODE_KEY);
  return value !== "false"; // missing/anything-but-"false" defaults to ON, fail-safe
}

export async function setEmailTestMode(enabled: boolean): Promise<void> {
  await settingsRepo.set(EMAIL_TEST_MODE_KEY, enabled ? "true" : "false");
}
