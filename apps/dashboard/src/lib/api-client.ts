import { parseApiResponse, ResponseValidationError, type ErrorCode } from "@openota/shared";

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

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      // Sends/receives the dashboard's session cookie — required for every /auth, /projects and
      // /projects/:id/api-keys call. See app.ts's CORS config: this only works because the server
      // sets `credentials: true` and reflects a real origin (never `*`) in response.
      credentials: "include",
    });
  } catch (error) {
    throw new ApiError("NETWORK_ERROR", error instanceof Error ? error.message : "Network request failed");
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
