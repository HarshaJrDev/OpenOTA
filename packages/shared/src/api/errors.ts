/**
 * The single set of error codes used across the server, CLI, SDK and native bridge. A code here
 * must mean the same thing everywhere it appears — do not add a package-local synonym for one of
 * these; extend this list instead.
 */
export const ERROR_CODES = [
  // Generic / cross-cutting
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "NETWORK_ERROR",
  "INTERNAL_ERROR",
  "NOT_CONFIGURED",
  "PATH_SECURITY_ERROR",

  // Package / manifest
  "PACKAGE_NOT_FOUND",
  "PACKAGE_ALREADY_EXISTS",
  "INVALID_MANIFEST",
  "INVALID_RUNTIME",
  "UNSUPPORTED_MANIFEST_VERSION",

  // Server-side upload / storage
  "UPLOAD_FAILED",
  "STORAGE_ERROR",

  // SDK / native runtime lifecycle
  "DOWNLOAD_FAILED",
  "VERIFICATION_FAILED",
  "EXTRACTION_FAILED",
  "INSTALL_FAILED",
  "ROLLBACK_FAILED",
  "NO_ROLLBACK_AVAILABLE",
  "NO_UPDATE_AVAILABLE",
  "RESTART_FAILED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}
