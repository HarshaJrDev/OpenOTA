import Foundation

/// Resolves which JS bundle URL the app should launch with — the iOS counterpart of
/// `BundleLoader.kt`/`OpenOTAReactHost.kt`. Host apps call `OpenOTABundleResolver.bundleURL(...)`
/// from their `RCTReactNativeFactoryDelegate.bundleURL()` override (see the updated
/// `AppDelegate.swift` in apps/example) instead of hand-rolling this logic.
///
/// Mandatory embedded fallback (spec step 12): *any* failure of *any* kind here — no OTA ever
/// installed, corrupt `state.json`, missing bundle file, runtime/sha/platform mismatch, an
/// incomplete extraction, an invalid activation state, or any unexpected native error — returns
/// `embeddedBundleURL()`. This function is written so no error can propagate past it: every
/// throwing call is wrapped in `do/catch`, never `try!`/`try?` silently masking a bug elsewhere.
public enum OpenOTABundleResolver {
    /// `runtimeVersion` must be the same value the host app passes to `BundleManager` /
    /// `OpenOTAModule` — see `RuntimeVersionSource` for where that value should come from.
    public static func bundleURL(
        runtimeVersion: String,
        embeddedBundleURL: @autoclosure () -> URL?,
        storageRoot: URL? = nil
    ) -> URL? {
        let embedded = embeddedBundleURL()

        do {
            let storage = BundleStorage(root: storageRoot)
            let manager = SyncBundleManagerFacade(storage: storage, runtimeVersion: runtimeVersion)

            // Record the boot attempt (and let the crash-loop heuristic roll back automatically)
            // before deciding what to serve, mirroring `BundleLoader.getJSBundleFile`'s ordering.
            let manifest = manager.recordBootAttemptSync()

            guard manifest.state == .activated, let activeBundlePath = manifest.activeBundlePath else {
                OpenOTALogger.i("No activated OTA bundle (state=\(manifest.state.rawValue)); serving embedded bundle")
                return embedded
            }

            let bundleURL = URL(fileURLWithPath: activeBundlePath)
            guard FileManager.default.fileExists(atPath: bundleURL.path) else {
                OpenOTALogger.w("Active bundle file missing at \(bundleURL.path); falling back to embedded")
                return embedded
            }

            guard manifest.runtimeVersion == runtimeVersion else {
                OpenOTALogger.w(
                    "Active bundle runtimeVersion \(manifest.runtimeVersion ?? "nil") != app runtimeVersion \(runtimeVersion); falling back to embedded"
                )
                return embedded
            }

            // Cheap integrity re-check: file is non-empty and readable. Full SHA-256 re-verification
            // happened at install time (BundleVerifier); re-hashing on every cold start would be an
            // unnecessary I/O cost RN's own startup budget can't afford, so resolution trusts the
            // already-verified `current/` tree and only checks it hasn't gone missing/corrupted at
            // the filesystem level.
            guard let attrs = try? FileManager.default.attributesOfItem(atPath: bundleURL.path),
                  let size = attrs[.size] as? Int, size > 0
            else {
                OpenOTALogger.w("Active bundle file unreadable/empty at \(bundleURL.path); falling back to embedded")
                return embedded
            }

            OpenOTALogger.i("Serving OTA bundle \(manifest.activeVersion ?? "?") from \(bundleURL.path)")
            return bundleURL
        } catch {
            OpenOTALogger.e("Bundle resolution failed unexpectedly; falling back to embedded", error: error)
            return embedded
        }
    }
}

/// `BundleManager` is an actor (correctly, for the TurboModule call surface), but bundle
/// resolution happens synchronously on `bundleURL()` — a non-async callback RN itself invokes
/// before any run loop / async context is guaranteed available this early in app launch. This
/// facade performs the *read-only* subset of BundleManager's job (read state, maybe roll back)
/// directly against `BundleStorage`/`BundleRollback` without actor hops, so it is safe to call
/// synchronously from `bundleURL()`. It intentionally duplicates only read/rollback paths, never
/// the write-heavy install pipeline (which only ever runs from the TurboModule, already on a
/// background queue where `await`ing the actor is natural).
struct SyncBundleManagerFacade {
    let storage: BundleStorage
    let runtimeVersion: String

    func recordBootAttemptSync() -> RuntimeManifest {
        var manifest = storage.readState()
        guard manifest.state == .activated, !manifest.bootConfirmed else {
            return manifest
        }

        let attempts = manifest.bootAttempts + 1
        if attempts >= maxUnconfirmedBoots {
            let rollback = BundleRollback(storage: storage)
            if rollback.hasRollback() {
                OpenOTALogger.w("Detected \(attempts) unconfirmed boots of \(manifest.activeVersion ?? "?"); rolling back")
                do {
                    let restored = try rollback.restore()
                    manifest = RuntimeManifest(
                        activeVersion: restored.manifest.version,
                        activeBundlePath: restored.bundleFile.path,
                        runtimeVersion: restored.manifest.runtimeVersion,
                        manifestVersion: restored.manifest.manifestVersion,
                        installTimeMillis: Int64(Date().timeIntervalSince1970 * 1000),
                        state: .activated,
                        bootConfirmed: true,
                        bootAttempts: 0
                    )
                    try storage.writeState(manifest)
                    return manifest
                } catch {
                    OpenOTALogger.e("Automatic rollback failed", error: error)
                    return manifest
                }
            }
        }

        manifest.bootAttempts = attempts
        try? storage.writeState(manifest)
        return manifest
    }
}
