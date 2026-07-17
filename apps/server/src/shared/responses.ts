import type { Response } from "express";

import { buildFailureResponse, buildSuccessResponse, type ErrorCode } from "@openota/shared";

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json(buildSuccessResponse(data));
}

export function sendError(
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: unknown,
): Response {
  return res.status(statusCode).json(buildFailureResponse(code, message, details));
}
