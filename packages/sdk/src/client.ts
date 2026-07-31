import { isSuccessResponse, parseApiResponse, ResponseValidationError } from "@openota/shared";

import { getConfig } from "./config.js";
import { NetworkError } from "./errors.js";

export async function apiGet<T>(path: string, query?: Record<string, string>): Promise<T> {
  const config = getConfig();
  const url = new URL(`${config.serverUrl}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  return performRequest<T>(url, { method: "GET", headers: { Accept: "application/json", ...config.headers } });
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const config = getConfig();
  const url = new URL(`${config.serverUrl}${path}`);

  return performRequest<T>(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...config.headers },
    body: JSON.stringify(body),
  });
}

async function performRequest<T>(url: URL, init: { method: string; headers: Record<string, string>; body?: string }): Promise<T> {
  const config = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeout);

  let response: Response;

  try {
    response = await fetch(url.toString(), { ...init, signal: controller.signal });
  } catch (error) {
    throw new NetworkError(`Request to ${url.toString()} failed`, error);
  } finally {
    clearTimeout(timeout);
  }

  let rawBody: unknown;

  try {
    rawBody = await response.json();
  } catch (error) {
    throw new NetworkError("Failed to parse server response as JSON", error);
  }

  let body: ReturnType<typeof parseApiResponse<T>>;

  try {
    body = parseApiResponse<T>(rawBody);
  } catch (error) {
    const message = error instanceof ResponseValidationError ? error.message : "Invalid server response";
    throw new NetworkError(message, error);
  }

  if (!response.ok || !isSuccessResponse(body)) {
    const message = !isSuccessResponse(body) ? body.error.message : `Request failed with status ${response.status}`;
    throw new NetworkError(message);
  }

  return body.data;
}
