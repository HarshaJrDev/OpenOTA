import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../../config/env.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface SessionPayload {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret).update(payload).digest("hex");
}

/**
 * Stateless signed session token — deliberately not a JWT library: this is a single first-party
 * cookie with a few claims (`userId`, issue time, expiry), HMAC'd with a server-only secret. No
 * JWT library, no algorithm-confusion surface, no extra dependency for something this small.
 * Format: `base64url(userId:issuedAt:expiresAt).hex(hmac)`.
 *
 * `issuedAt` exists purely so verification can reject a token issued before the user's
 * `sessions_revoked_at` (see repositories.ts#revokeSessions) — the token itself carries no other
 * server-side state, so this is the only way "log out" or "reset password" can invalidate a
 * token that's still within its normal 30-day expiry.
 */
export function createSessionToken(userId: string): string {
  const now = Date.now();
  const payload: SessionPayload = { userId, issuedAt: now, expiresAt: now + SESSION_TTL_MS };
  const encoded = Buffer.from(`${payload.userId}:${payload.issuedAt}:${payload.expiresAt}`).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string): { userId: string; issuedAt: number } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  const decoded = Buffer.from(encoded, "base64url").toString("utf8");
  const [userId, issuedAtRaw, expiresAtRaw] = decoded.split(":");
  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);

  if (!userId || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return null;
  }

  return { userId, issuedAt };
}
