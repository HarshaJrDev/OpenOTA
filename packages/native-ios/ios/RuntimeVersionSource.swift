import Foundation

/// Single source of truth for "what runtimeVersion is this native binary" on iOS, matching the
/// wiring pattern `apps/example/android/.../MainApplication.kt` uses for Android
/// (`OPENOTA_RUNTIME_VERSION` passed explicitly into `OpenOTAReactHost.create(...)`). Android has
/// no build-time mechanism that reads `openota.config.json` into Gradle either — it is a hand-kept
/// constant the app author is responsible for matching to `openota.config.json`'s `runtimeVersion`
/// field, so the iOS equivalent deliberately mirrors that shape rather than inventing a divergent
/// config-loading mechanism (e.g. parsing `openota.config.json` from the app bundle at runtime).
///
/// Host apps set this once, e.g. in `AppDelegate.swift`:
/// ```swift
/// RuntimeVersionSource.runtimeVersion = "1.0.0" // must match openota.config.json's runtimeVersion
/// ```
public enum RuntimeVersionSource {
    /// `nil` until the host app sets it explicitly. Falls back (with a loud warning, exactly like
    /// `BundleManager.kt`'s `resolveAppVersionName` fallback) to `CFBundleShortVersionString` if
    /// never set — a real integration bug, not a supported configuration.
    public static var runtimeVersion: String?

    public static func resolve() -> String {
        if let runtimeVersion { return runtimeVersion }
        let fallback = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
        OpenOTALogger.w(
            "RuntimeVersionSource.runtimeVersion was never set; falling back to the app's " +
                "CFBundleShortVersionString (\"\(fallback)\"). This is almost certainly a bug: set " +
                "RuntimeVersionSource.runtimeVersion in AppDelegate before any bundle resolution or " +
                "OpenOTA TurboModule call, matching the runtimeVersion in openota.config.json."
        )
        return fallback
    }
}
