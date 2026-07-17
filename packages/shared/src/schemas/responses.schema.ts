import { isErrorCode } from "../api/errors.js";
import type { ApiResponse } from "../api/responses.js";

export class ResponseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResponseValidationError";
  }
}

/**
 * Validates that a decoded JSON body matches the shared `{success,data}` / `{success,error}`
 * envelope, including that `error.code` is one of the shared `ErrorCode`s. Callers that only need
 * the loose shape check can use `isApiResponse` from `api/responses.ts` instead; this is for
 * callers (the SDK's HTTP client) that want to fail loudly on an envelope a server shouldn't send.
 */
export function parseApiResponse<T>(input: unknown): ApiResponse<T> {
  if (typeof input !== "object" || input === null || !("success" in input)) {
    throw new ResponseValidationError("Response body is not a valid OpenOTA API envelope");
  }

  const body = input as { success: unknown };

  if (body.success === true) {
    if (!("data" in body)) {
      throw new ResponseValidationError("Success response is missing a \"data\" field");
    }
    return input as ApiResponse<T>;
  }

  if (body.success === false) {
    const withError = input as { error?: { code?: unknown; message?: unknown } };
    if (!withError.error || typeof withError.error.message !== "string") {
      throw new ResponseValidationError("Failure response is missing \"error.message\"");
    }
    if (!isErrorCode(withError.error.code)) {
      throw new ResponseValidationError(`Failure response has an unrecognized error code "${String(withError.error.code)}"`);
    }
    return input as ApiResponse<T>;
  }

  throw new ResponseValidationError("Response \"success\" field must be a boolean");
}
