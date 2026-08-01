import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
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

  // Multer aborts the upload stream as soon as the configured byte limit is exceeded, before our
  // own PackageTooLargeError check (in package/service.ts) ever runs — translate it the same way.
  if (error instanceof MulterError && error.code === "LIMIT_FILE_SIZE") {
    logger.warn({ maxBytes: env.maxPackageSizeBytes }, "package exceeded upload size limit");
    sendError(res, "PACKAGE_TOO_LARGE", "OTA package exceeds the configured upload size limit.", 413, {
      maxBytes: env.maxPackageSizeBytes,
    });
    return;
  }

  if (error instanceof AppError) {
    logger.warn({ code: error.code, message: error.message }, "request error");
    sendError(res, error.code, error.message, error.statusCode, error.details);
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  logger.error({ err: error }, "unhandled error");
  // Only genuinely unexpected errors reach here — ZodError/MulterError/AppError are all expected,
  // already-handled cases above and would just be noise in Sentry.
  captureException(error);
  sendError(res, "INTERNAL_ERROR", message, 500);
}
