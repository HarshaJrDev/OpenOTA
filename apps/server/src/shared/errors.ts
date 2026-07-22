import type { ErrorCode } from "@openota/shared";

export type { ErrorCode };

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super("NOT_FOUND", message, 404);
  }
}

export class StorageError extends AppError {
  constructor(message = "Storage operation failed", details?: unknown) {
    super("STORAGE_ERROR", message, 500, details);
  }
}

export class UploadError extends AppError {
  constructor(message = "Upload failed", details?: unknown) {
    super("UPLOAD_FAILED", message, 400, details);
  }
}

export class PackageTooLargeError extends AppError {
  constructor(maxBytes: number, actualBytes?: number) {
    super(
      "PACKAGE_TOO_LARGE",
      `OTA package exceeds the configured ${Math.floor(maxBytes / (1024 * 1024))} MB limit.`,
      413,
      { maxBytes, actualBytes },
    );
  }
}

export class PackageAlreadyExistsError extends AppError {
  constructor(platform: string, version: string) {
    super(
      "PACKAGE_ALREADY_EXISTS",
      `Package for platform "${platform}" and version "${version}" already exists`,
      409,
    );
  }
}

export class PackageNotFoundError extends AppError {
  constructor(platform: string, version: string) {
    super(
      "PACKAGE_NOT_FOUND",
      `Package for platform "${platform}" and version "${version}" not found`,
      404,
    );
  }
}

export class InvalidManifestError extends AppError {
  constructor(message = "Invalid manifest", details?: unknown) {
    super("INVALID_MANIFEST", message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Missing or invalid API key") {
    super("UNAUTHORIZED", message, 401);
  }
}
