import Foundation

/// Every error the runtime can raise, carrying a stable `code` that mirrors
/// `OpenOTAException.code` in `BundleExceptions.kt` 1:1 — the JS SDK's `bridge.ts` maps these
/// same string codes onto typed `OTAError` subclasses (see `packages/sdk/src/errors.ts`), so the
/// codes here are a cross-platform contract, not an implementation detail.
enum OpenOTAException: Error, CustomNSError {
    case invalidManifest(String)
    case unsupportedManifestVersion(found: Int, supported: Set<Int>)
    case invalidRuntime(bundleRuntimeVersion: String, appRuntimeVersion: String)
    case verificationFailed(String)
    case pathSecurityError(String)
    case installFailed(String)
    case noRollbackAvailable
    case notConfigured(String)

    var code: String {
        switch self {
        case .invalidManifest: return "INVALID_MANIFEST"
        case .unsupportedManifestVersion: return "UNSUPPORTED_MANIFEST_VERSION"
        case .invalidRuntime: return "INVALID_RUNTIME"
        case .verificationFailed: return "VERIFICATION_FAILED"
        case .pathSecurityError: return "PATH_SECURITY_ERROR"
        case .installFailed: return "INSTALL_FAILED"
        case .noRollbackAvailable: return "NO_ROLLBACK_AVAILABLE"
        case .notConfigured: return "NOT_CONFIGURED"
        }
    }

    var message: String {
        switch self {
        case .invalidManifest(let m): return m
        case .unsupportedManifestVersion(let found, let supported):
            return "Manifest version \(found) is not supported (supported: \(supported))"
        case .invalidRuntime(let bundleRuntimeVersion, let appRuntimeVersion):
            return "Bundle runtimeVersion \"\(bundleRuntimeVersion)\" does not match app runtimeVersion \"\(appRuntimeVersion)\""
        case .verificationFailed(let m): return m
        case .pathSecurityError(let m): return m
        case .installFailed(let m): return m
        case .noRollbackAvailable: return "No rollback bundle is available"
        case .notConfigured(let m): return m
        }
    }

    // NSError bridging so this surfaces cleanly through RCTPromiseRejectBlock(code, message, error).
    static var errorDomain: String { "com.openota.runtime" }
    var errorCode: Int { 1 }
    var errorUserInfo: [String: Any] { [NSLocalizedDescriptionKey: message, "code": code] }
}
