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

  // express.json() throws a SyntaxError (with a body-parser-attached `status`/`statusCode` of 400)
  // for malformed request bodies — a client mistake, not a server fault. Handled here so it isn't
  // reported as an unexpected 500/Sentry error and so the 400 status is preserved.
  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    logger.warn({ error: error.message }, "malformed request body");
    sendError(res, "VALIDATION_ERROR", "Request body is not valid JSON", 400);
    return;
  }

  logger.error({ err: error }, "unhandled error");
  captureException(error);
  // Never forward error.message here: this is the catch-all for genuinely unexpected exceptions
  // (a raw Postgres error, a TypeError, anything not already an AppError above) — .message on
  // those can contain schema/constraint/column names, file paths, or other internal detail. The
  // real message is already logged (and sent to Sentry) server-side; the client only ever gets a
  // generic message plus the request's pino-assigned id for support correlation via logs.
  sendError(res, "INTERNAL_ERROR", "An unexpected error occurred", 500);
}
