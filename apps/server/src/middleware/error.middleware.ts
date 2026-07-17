import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { logger } from "../config/logger.js";
import { AppError } from "../shared/errors.js";
import { sendError } from "../shared/responses.js";

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    logger.warn({ error: error.flatten() }, "validation error");
    sendError(res, "VALIDATION_ERROR", "Validation failed", 400, error.flatten());
    return;
  }

  if (error instanceof AppError) {
    logger.warn({ code: error.code, message: error.message }, "request error");
    sendError(res, error.code, error.message, error.statusCode, error.details);
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  logger.error({ err: error }, "unhandled error");
  sendError(res, "INTERNAL_ERROR", message, 500);
}
