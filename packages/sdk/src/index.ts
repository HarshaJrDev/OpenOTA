export { OTA } from "./OTA.js";
export * from "./types.js";
export type { RuntimeInfo } from "./native/index.js";
export {
  OTAError,
  NetworkError,
  DownloadError,
  VerificationError,
  ExtractionError,
  InstallError,
} from "./errors.js";
export type { OtaErrorCode } from "./errors.js";
export { setLogHandler } from "./utils/logger.js";
export type { LogHandler, LogLevel } from "./utils/logger.js";
