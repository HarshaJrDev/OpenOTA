import type { ErrorCode } from "./errors.js";

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface FailureResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | FailureResponse;

export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return typeof value === "object" && value !== null && "success" in value;
}

export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

export function isFailureResponse<T>(response: ApiResponse<T>): response is FailureResponse {
  return response.success === false;
}

/** Framework-agnostic envelope builders — HTTP-layer wiring (Express, etc.) stays local to each server. */
export function buildSuccessResponse<T>(data: T): SuccessResponse<T> {
  return { success: true, data };
}

export function buildFailureResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
): FailureResponse {
  return { success: false, error: { code, message, details } };
}
