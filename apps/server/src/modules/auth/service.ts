import { env } from "../../config/env.js";
import { query } from "../../db/client.js";
import { authTokensRepo, usersRepo } from "../../db/repositories.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.service.js";
import type { GoogleProfile } from "./google.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSessionToken } from "./session.js";
import { generateRawToken, hashToken } from "./token.js";

const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000; // 1 hour

export class InvalidCredentialsError extends ValidationError {
  constructor() {
    super("Invalid email or password");
  }
}

export class EmailAlreadyRegisteredError extends ValidationError {
  constructor() {
    super("An account with this email already exists");
  }
}

export class InvalidOrExpiredTokenError extends ValidationError {
  constructor() {
    super("This link is invalid or has expired");
  }
}

export class EmailNotVerifiedError extends ValidationError {
  constructor() {
    super("Please verify your email before logging in");
  }
}

/**
 * DEV MODE default (REQUIRE_EMAIL_VERIFICATION unset/false): signup logs the user in immediately
 * and login never checks email_verified — this has been true since verification was added, not a
 * behavior change. A verification email is still sent and the dashboard still shows the "verify
 * your account" banner; it's just advisory, not blocking.
 *
 * Set REQUIRE_EMAIL_VERIFICATION=true (production) to flip login() into rejecting unverified
 * accounts — see the check inside login() below. The verification system itself (tokens, email
 * sending, /verify-email/*) is never removed by DEV MODE; only whether login enforces it changes.
 */
export async function signup(email: string, password: string): Promise<{ userId: string; token: string }> {
  if (await usersRepo.findByEmail(email)) {
    throw new EmailAlreadyRegisteredError();
  }

  const user = await usersRepo.create(email, hashPassword(password));
  await issueVerificationEmail(user.id, user.email);
  return { userId: user.id, token: createSessionToken(user.id) };
}

/**
 * Find-by-google_id, else link onto an existing password account matching the same email
 * (safe: Google's userinfo endpoint only ever returns emails it has itself verified), else
 * create a brand-new Google-only account. Always ends by minting the same session token every
 * other auth path uses — Google sign-in is just another way to reach an existing session.
 */
export async function signInWithGoogle(profile: GoogleProfile): Promise<{ userId: string; token: string }> {
  let user = await usersRepo.findByGoogleId(profile.googleId);

  if (!user) {
    const existingByEmail = await usersRepo.findByEmail(profile.email);
    if (existingByEmail) {
      await usersRepo.linkGoogleId(existingByEmail.id, profile.googleId);
      user = { ...existingByEmail, google_id: profile.googleId, email_verified: true };
    } else {
      user = await usersRepo.createFromGoogle(profile.email, profile.googleId);
    }
  }

  return { userId: user.id, token: createSessionToken(user.id) };
}

export async function login(email: string, password: string): Promise<{ userId: string; token: string }> {
  const user = await usersRepo.findByEmail(email);
  // A Google-only account has no password_hash — same InvalidCredentialsError as a wrong password,
  // never a distinct "use Google instead" message (that would leak which accounts are Google-only).
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    throw new InvalidCredentialsError();
  }

  // Feature-flagged, off by default — see the doc comment above signup(). Checked after password
  // verification (never before) so this can't be used to enumerate registered emails.
  if (env.requireEmailVerification && !user.email_verified) {
    throw new EmailNotVerifiedError();
  }

  return { userId: user.id, token: createSessionToken(user.id) };
}

async function issueVerificationEmail(userId: string, email: string): Promise<void> {
  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + VERIFY_EMAIL_TTL_MS).toISOString();
  await authTokensRepo.create(userId, "verify_email", hashToken(rawToken), expiresAt);
  await sendVerificationEmail(email, rawToken);
}

export async function resendVerificationEmail(userId: string): Promise<void> {
  const user = await usersRepo.findById(userId);
  if (!user || user.email_verified) {
    return; // Silent no-op: nothing to resend for an unknown or already-verified user.
  }
  await issueVerificationEmail(user.id, user.email);
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  // Tokens aren't looked up by hash directly (no index on token_hash — volume here is tiny, one
  // active token per user in practice) so we scan each user's active verify_email tokens; simplest
  // correct approach given the auth_tokens table has no user context to start from.
  const match = await findMatchingToken("verify_email", tokenHash);
  if (!match) {
    throw new InvalidOrExpiredTokenError();
  }

  await authTokensRepo.markUsed(match.id);
  await usersRepo.markEmailVerified(match.user_id);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await usersRepo.findByEmail(email);
  if (!user) {
    return; // Silent no-op — never reveal whether an email is registered.
  }

  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + RESET_PASSWORD_TTL_MS).toISOString();
  await authTokensRepo.create(user.id, "reset_password", hashToken(rawToken), expiresAt);
  await sendPasswordResetEmail(user.email, rawToken);
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const match = await findMatchingToken("reset_password", tokenHash);
  if (!match) {
    throw new InvalidOrExpiredTokenError();
  }

  await authTokensRepo.markUsed(match.id);
  await usersRepo.updatePassword(match.user_id, hashPassword(newPassword));
}

/**
 * auth_tokens has no lookup-by-hash index (see verifyEmail comment) — this walks every unused
 * token of the given purpose across all users. Fine at this scale; would need a token_hash index
 * (and a targeted query) if this table ever grows past a trivial number of outstanding tokens.
 */
async function findMatchingToken(purpose: "verify_email" | "reset_password", tokenHash: string) {
  const candidates = await query<{ id: string; user_id: string; token_hash: string; expires_at: string }>(
    "SELECT id, user_id, token_hash, expires_at FROM auth_tokens WHERE purpose = $1 AND used_at IS NULL AND expires_at > $2",
    [purpose, new Date().toISOString()],
  );
  return candidates.find((c) => c.token_hash === tokenHash);
}

export async function getUser(userId: string) {
  const user = await usersRepo.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user;
}
