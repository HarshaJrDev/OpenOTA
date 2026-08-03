import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "../../config/env.js";
import { ValidationError } from "../../shared/errors.js";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — just long enough for a real login, not longer
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export class GoogleAuthError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}

export interface GoogleProfile {
  googleId: string;
  email: string;
}

function signState(payload: string): string {
  return createHmac("sha256", env.sessionSecret).update(payload).digest("hex");
}

/**
 * CSRF protection for the OAuth redirect, in the same stateless-HMAC style as session.ts's
 * session token — no server-side state store needed, just a short-lived signed nonce+timestamp
 * that the callback verifies before trusting `code`.
 */
export function createState(): string {
  const payload = `${randomBytes(16).toString("hex")}:${Date.now() + STATE_TTL_MS}`;
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${signState(encoded)}`;
}

export function verifyState(state: string | undefined): boolean {
  if (!state) {
    return false;
  }
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) {
    return false;
  }

  const expectedSignature = signState(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return false;
  }

  const decoded = Buffer.from(encoded, "base64url").toString("utf8");
  const expiresAt = Number(decoded.split(":")[1]);
  return Number.isFinite(expiresAt) && expiresAt >= Date.now();
}

/** True only when all three GOOGLE_* env vars are set — see config/env.ts's superRefine (all-or-none). */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(env.googleClientId && env.googleClientSecret && env.googleRedirectUri);
}

export function buildAuthorizationUrl(): string {
  if (!isGoogleAuthConfigured()) {
    throw new GoogleAuthError("Google sign-in is not configured on this server");
  }

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.googleClientId!);
  url.searchParams.set("redirect_uri", env.googleRedirectUri!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", createState());
  // Always show the account chooser rather than silently reusing whatever Google session happens
  // to be active in the browser — much less surprising for a shared/public machine.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

interface GoogleTokenResponse {
  access_token: string;
}

interface GoogleUserinfoResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
}

/**
 * Plain fetch() against Google's REST endpoints — no OAuth/passport library, matching this
 * codebase's existing hand-rolled-auth philosophy (scrypt over bcrypt, HMAC tokens over JWT).
 * Verifying the profile via Google's own authenticated userinfo endpoint (rather than decoding
 * the id_token ourselves) avoids needing a JWKS/JWT-signature-verification dependency entirely.
 */
export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  if (!isGoogleAuthConfigured()) {
    throw new GoogleAuthError("Google sign-in is not configured on this server");
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId!,
      client_secret: env.googleClientSecret!,
      redirect_uri: env.googleRedirectUri!,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) {
    throw new GoogleAuthError("Google rejected the authorization code");
  }

  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

  const userinfoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userinfoRes.ok) {
    throw new GoogleAuthError("Failed to fetch the Google account's profile");
  }

  const profile = (await userinfoRes.json()) as GoogleUserinfoResponse;

  if (!profile.email || profile.email_verified === false) {
    throw new GoogleAuthError("Google account has no verified email");
  }

  return { googleId: profile.sub, email: profile.email };
}
