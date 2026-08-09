import { createSign } from "node:crypto";

import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/**
 * Never throws — a malformed/unset FIREBASE_SERVICE_ACCOUNT_JSON just disables push, same
 * graceful-degradation contract as RESEND_API_KEY. Parsed lazily and memoized (not at schema
 * level in config/env.ts) so a bad value fails at first use, not at server boot.
 */
let cachedServiceAccount: ServiceAccount | null | undefined; // undefined = not parsed yet, null = invalid/unset
function loadServiceAccount(): ServiceAccount | null {
  if (cachedServiceAccount !== undefined) {
    return cachedServiceAccount;
  }
  if (!env.firebaseServiceAccountJson) {
    cachedServiceAccount = null;
    return null;
  }
  try {
    const parsed = JSON.parse(env.firebaseServiceAccountJson) as Partial<ServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      logger.error("FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id/client_email/private_key — push disabled");
      cachedServiceAccount = null;
      return null;
    }
    cachedServiceAccount = parsed as ServiceAccount;
    return cachedServiceAccount;
  } catch {
    logger.error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON — push disabled");
    cachedServiceAccount = null;
    return null;
  }
}

export function isPushConfigured(): boolean {
  return loadServiceAccount() !== null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Standard Google OAuth2 "JWT Bearer Token Flow for Service Accounts"
 * (https://developers.google.com/identity/protocols/oauth2/service-account#jwt-auth), hand-rolled
 * with node:crypto rather than firebase-admin or a JWT library — same choice already made for
 * session tokens (HMAC, not a JWT library) and Google login (plain fetch, no OAuth library). One
 * RS256-signed assertion, traded for a short-lived bearer token at Google's token endpoint.
 */
function buildAssertion(account: ServiceAccount): string {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claimSet))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key);
  return `${unsigned}.${base64url(signature)}`;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;

/**
 * Caches the exchanged bearer token in-memory until ~60s before it expires, so a burst of
 * releases in quick succession doesn't re-sign-and-exchange on every single push.
 */
async function getAccessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.accessToken;
  }

  const assertion = buildAssertion(account);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Firebase token exchange failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

/**
 * Sends a single data-only FCM message — deliberately never an FCM `notification:` payload, so the
 * native Android layer fully controls whether/how anything is shown and killed-app delivery still
 * invokes custom code (a `notification:` payload is handled entirely by the OS tray when the app
 * is killed, bypassing app code altogether). Returns true/false rather than throwing — a single
 * dead token must never block the rest of a fan-out.
 */
export async function sendPushNotification(fcmToken: string, data: Record<string, string>): Promise<boolean> {
  const account = loadServiceAccount();
  if (!account) return false;

  try {
    const accessToken = await getAccessToken(account);
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: { token: fcmToken, data } }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      logger.warn({ status: response.status, body }, "FCM send failed for one token — continuing");
      return false;
    }
    return true;
  } catch (error) {
    logger.error({ err: error }, "FCM send threw — continuing without blocking the caller");
    return false;
  }
}
