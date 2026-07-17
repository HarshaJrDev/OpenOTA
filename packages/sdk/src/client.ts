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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeout);

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json", ...config.headers },
      signal: controller.signal,
    });
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
