import type { ErrorCode } from "@openota/shared";

export type { ErrorCode as OtaErrorCode };

export class OTAError extends Error {
  public readonly code: ErrorCode;
  public readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.cause = cause;
  }
}

export class NetworkError extends OTAError {
  constructor(message = "Network request failed", cause?: unknown) {
    super("NETWORK_ERROR", message, cause);
  }
}

export class DownloadError extends OTAError {
  constructor(message = "Failed to download package", cause?: unknown) {
    super("DOWNLOAD_FAILED", message, cause);
  }
}

export class VerificationError extends OTAError {
  constructor(message = "Package checksum verification failed", cause?: unknown) {
    super("VERIFICATION_FAILED", message, cause);
  }
}

export class ExtractionError extends OTAError {
  constructor(message = "Failed to extract package", cause?: unknown) {
    super("EXTRACTION_FAILED", message, cause);
  }
}

export class InstallError extends OTAError {
  constructor(message = "Failed to install package", cause?: unknown) {
    super("INSTALL_FAILED", message, cause);
  }
}
