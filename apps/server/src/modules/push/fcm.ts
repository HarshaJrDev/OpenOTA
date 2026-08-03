import { createSign } from "node:crypto";

import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { deviceTokensRepo } from "../../db/repositories.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const JWT_TTL_SECONDS = 3600;
// Refresh a bit before the token actually expires so a send in flight never races an exact-expiry
// boundary — same spirit as session.ts's own TTL margins, just for a different token.
const REFRESH_MARGIN_MS = 60_000;

export interface FirebaseServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function base64url(input: Buffer | string): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input)).toString("base64url");
}

// Memoized, not re-parsed per call — this runs on every push send. Never throws: a malformed or
// unset value just means push is disabled, exactly like an unset RESEND_API_KEY disables email.
let cachedAccount: FirebaseServiceAccount | null | undefined;

function loadServiceAccount(): FirebaseServiceAccount | null {
  if (cachedAccount !== undefined) {
    return cachedAccount;
  }

  if (!env.firebaseServiceAccountJson) {
    cachedAccount = null;
    return cachedAccount;
  }

  try {
    const parsed = JSON.parse(env.firebaseServiceAccountJson) as Partial<FirebaseServiceAccount>;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      logger.warn("FIREBASE_SERVICE_ACCOUNT_JSON is missing client_email/private_key/project_id — push disabled");
      cachedAccount = null;
    } else {
      cachedAccount = { client_email: parsed.client_email, private_key: parsed.private_key, project_id: parsed.project_id };
    }
  } catch {
    logger.warn("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON — push disabled");
    cachedAccount = null;
  }

  return cachedAccount;
}

export function isPushConfigured(): boolean {
  return loadServiceAccount() !== null;
}

/**
 * Hand-rolled RS256 JWT-bearer assertion — no `jsonwebtoken` dependency, matching this codebase's
 * existing hand-rolled-auth philosophy (see auth/session.ts, auth/google.ts). This is the
 * *service-account* grant (proving the server's own identity to Google), distinct from
 * auth/google.ts's user-login authorization-code exchange.
 */
export function buildAssertion(account: FirebaseServiceAccount, now: number = Date.now()): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const issuedAt = Math.floor(now / 1000);
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: FCM_SCOPE,
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + JWT_TTL_SECONDS,
    }),
  );

  const signingInput = `${header}.${claims}`;
  const signature = base64url(createSign("RSA-SHA256").update(signingInput).sign(account.private_key));
  return `${signingInput}.${signature}`;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
}

async function getAccessToken(account: FirebaseServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: buildAssertion(account),
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Firebase token exchange failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as GoogleTokenResponse;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

export interface PushMessage {
  type: "release-changed";
  title: string;
  body: string;
}

/**
 * Data-only — never an FCM `notification:` payload. A notification payload is auto-displayed by
 * the OS with fixed styling and (critically) never runs app code when the app is killed; a data
 * payload always reaches the native FirebaseMessagingService, which builds the actual
 * notification itself (see native-android's OpenOTAFirebaseMessagingService).
 */
export async function sendPushNotification(fcmToken: string, message: PushMessage): Promise<void> {
  const account = loadServiceAccount();
  if (!account) {
    return;
  }

  const accessToken = await getAccessToken(account);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token: fcmToken, data: message } }),
  });

  if (!res.ok) {
    throw new Error(`FCM send failed: HTTP ${res.status}`);
  }
}

/**
 * Best-effort, fire-and-forget from the caller's perspective — same posture as the WS registry's
 * broadcast(): a push failure must never break a release/rollback/rollout-change response.
 */
export async function notifyDevicesOfReleaseChange(params: {
  projectId: string;
  platform: string;
  channel: string;
  title: string;
  body: string;
}): Promise<void> {
  if (!isPushConfigured()) {
    return;
  }

  const tokens = await deviceTokensRepo.listByProjectPlatformChannel(params.projectId, params.platform, params.channel);
  if (tokens.length === 0) {
    return;
  }

  const message: PushMessage = { type: "release-changed", title: params.title, body: params.body };
  const results = await Promise.allSettled(tokens.map((row) => sendPushNotification(row.fcm_token, message)));

  const failures = results.filter((result) => result.status === "rejected").length;
  if (failures > 0) {
    logger.warn({ projectId: params.projectId, platform: params.platform, channel: params.channel, failures, total: tokens.length }, "some FCM pushes failed");
  }
}
