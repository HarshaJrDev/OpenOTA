import {
  DownloadError,
  ExtractionError,
  InstallError,
  NetworkError,
  OTAError,
  VerificationError,
  type OtaErrorCode,
} from "../errors.js";
import { getNativeOpenOTA, type RuntimeInfo } from "./NativeOpenOTA.js";

export type { RuntimeInfo };

// These string codes must match the native runtime's `OpenOTAException.code` values exactly
// (see `BundleExceptions.kt`) — both sides were aligned to the shared `ErrorCode` enum.
const NATIVE_CODE_TO_ERROR: Partial<Record<string, (message: string) => OTAError>> = {
  VERIFICATION_FAILED: (message) => new VerificationError(message),
  INSTALL_FAILED: (message) => new InstallError(message),
  EXTRACTION_FAILED: (message) => new ExtractionError(message),
  DOWNLOAD_FAILED: (message) => new DownloadError(message),
  NETWORK_ERROR: (message) => new NetworkError(message),
};

function isNativeErrorWithCode(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error && typeof (error as { code: unknown }).code === "string";
}

/** Translates a rejected native Promise (which carries a `code` string) into a typed [OTAError]. */
async function callNative<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isNativeErrorWithCode(error)) {
      const factory = NATIVE_CODE_TO_ERROR[error.code];
      if (factory) {
        throw factory(error.message);
      }

      throw new OTAError(error.code as OtaErrorCode, error.message, error);
    }

    throw error;
  }
}

function requireNativeModule(): NonNullable<ReturnType<typeof getNativeOpenOTA>> {
  const nativeModule = getNativeOpenOTA();

  if (!nativeModule) {
    throw new InstallError(
      "Native module 'OpenOTA' is not linked. Make sure @openota/sdk's native code is installed and the app was rebuilt.",
    );
  }

  return nativeModule;
}

export async function nativeSetBundlePath(path: string): Promise<void> {
  return callNative(() => requireNativeModule().setBundlePath(path));
}

export async function nativeGetBundlePath(): Promise<string | null> {
  return callNative(() => requireNativeModule().getBundlePath());
}

export async function nativeActivateBundle(): Promise<RuntimeInfo> {
  return callNative(() => requireNativeModule().activateBundle());
}

export async function nativeRollback(): Promise<RuntimeInfo> {
  return callNative(() => requireNativeModule().rollback());
}

export async function nativeRestart(): Promise<void> {
  return callNative(() => requireNativeModule().restart());
}

export async function nativeClearBundle(): Promise<void> {
  return callNative(() => requireNativeModule().clearBundle());
}

export async function nativeGetRuntimeInfo(): Promise<RuntimeInfo> {
  return callNative(() => requireNativeModule().getRuntimeInfo());
}
