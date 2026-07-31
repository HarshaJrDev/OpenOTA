import { createHash, randomBytes } from "node:crypto";

/** Raw token goes in the email link; only its hash is ever stored, same principle as api_keys. */
export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
