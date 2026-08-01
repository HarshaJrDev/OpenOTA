import { parseApiResponse, ResponseValidationError, type ErrorCode } from "@openota/shared";

import { getAuthToken } from "./auth-token";
import { getServerUrlOverride } from "./server-config";

/**
 * The dashboard's ONLY way to reach OpenOTA. Every feature module calls through here — never
 * `fs`, never a storage SDK, never a database driver. This mirrors the same
 * `{success,data}`/`{success,error}` envelope the CLI and mobile SDK already speak.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode | "NETWORK_ERROR",
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The OpenOTA Cloud server. Used when neither a per-browser override (Settings) nor a build-time
 * `NEXT_PUBLIC_OPENOTA_SERVER_URL` is set, so a default deploy talks to the real Render server
 * (never the old Railway host) out of the box. Must include the `/api/v1` prefix.
 */
export const DEFAULT_SERVER_URL = "https://openota.onrender.com/api/v1";

function getServerUrl(): string {
  const url = getServerUrlOverride() ?? process.env.NEXT_PUBLIC_OPENOTA_SERVER_URL ?? DEFAULT_SERVER_URL;
  return url.replace(/\/+$/, "");
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | undefined>;
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = getServerUrl();
  const url = new URL(`${base}${path}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }

  // CSRF defense: forces a CORS preflight on every request (custom headers are never CORS-
  // safelisted), so CORS_ALLOWED_ORIGINS actually gets to reject cross-site requests even for
  // otherwise-"simple" methods/content-types. See apiKey.middleware.ts's requireApiKey for the
  // server-side check this satisfies — it rejects project-scoped, cookie-only requests without it.
  const headers: Record<string, string> = { "X-Requested-With": "XMLHttpRequest" };
  if (options.body) headers["Content-Type"] = "application/json";
  // Primary auth in production: the stored session token as a Bearer header, which works
  // cross-domain even when the third-party session cookie is blocked. `credentials: "include"`
  // still sends the cookie too, so same-origin/self-hosted keeps working with no token.
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response: Response;

  // The default deploy talks to a free-tier Render instance that can take 30-60s to wake from
  // cold. Without a timeout, a cold start left the caller's mutation pending forever with no
  // feedback (e.g. the signup button stuck on "Please wait..." indefinitely) — 50s comfortably
  // covers a cold start while still eventually surfacing a real error if the server is down.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50_000);

  try {
    response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(
        "NETWORK_ERROR",
        "The server took too long to respond. It may be waking up from sleep — please try again in a moment.",
      );
    }
    throw new ApiError("NETWORK_ERROR", error instanceof Error ? error.message : "Network request failed");
  } finally {
    clearTimeout(timeout);
  }

  let rawBody: unknown;
  try {
    rawBody = await response.json();
  } catch (error) {
    throw new ApiError("NETWORK_ERROR", "Server response was not valid JSON");
  }

  let parsed;
  try {
    parsed = parseApiResponse<T>(rawBody);
  } catch (error) {
    const message = error instanceof ResponseValidationError ? error.message : "Invalid server response";
    throw new ApiError("NETWORK_ERROR", message, response.status);
  }

  if (!parsed.success) {
    throw new ApiError(parsed.error.code, parsed.error.message, response.status);
  }

  return parsed.data;
}

/** For downloads, which are a raw binary stream, not a JSON envelope. */
export function downloadUrl(path: string): string {
  return `${getServerUrl()}${path}`;
}
