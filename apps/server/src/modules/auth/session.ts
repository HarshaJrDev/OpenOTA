import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../../config/env.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface SessionPayload {
  userId: string;
  expiresAt: number;
}

function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret).update(payload).digest("hex");
}

/**
 * Stateless signed session token — deliberately not a JWT library: this is a single first-party
 * cookie with one claim (`userId`) and an expiry, HMAC'd with a server-only secret. No JWT
 * library, no algorithm-confusion surface, no extra dependency for something this small.
 * Format: `base64url(userId:expiresAt).hex(hmac)`.
 */
export function createSessionToken(userId: string): string {
  const payload: SessionPayload = { userId, expiresAt: Date.now() + SESSION_TTL_MS };
  const encoded = Buffer.from(`${payload.userId}:${payload.expiresAt}`).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string): { userId: string } | null {
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
  const [userId, expiresAtRaw] = decoded.split(":");
  const expiresAt = Number(expiresAtRaw);

  if (!userId || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return null;
  }

  return { userId };
}
