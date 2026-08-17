import Foundation

let maxUnconfirmedBoots = 2 // Must match BundleManager.kt's MAX_UNCONFIRMED_BOOTS exactly.

/// Snapshot returned by `BundleManager.getRuntimeInfo`, mirrored 1:1 onto the JS `RuntimeInfo` type.
struct RuntimeInfo {
    let currentVersion: String?
    let bundleVersion: String?
    let runtimeVersion: String?
    let manifestVersion: Int?
    let bundlePath: String?
    let installTimeMillis: Int64?
    let state: RuntimeState
    let platform: String = "ios"
}

/// The single orchestrator for the bundle lifecycle — the Swift counterpart of `BundleManager.kt`.
/// Implemented as an `actor` (rather than a serial `DispatchQueue`) because every operation here is
/// short-lived synchronous file I/O with no callback-based APIs to bridge, so actor isolation gives
/// the same "one state-changing operation at a time" guarantee as Kotlin's `@Synchronized` with
/// none of the manual queue plumbing, and composes cleanly with `async`/`await` call sites in the
/// TurboModule shim. File I/O inside actor methods is deliberately kept synchronous+local (never
/// blocking the *main* thread — RN already dispatches TurboModule method bodies off the main
/// queue), so actor reentrancy from suspension points is not a concern here.
actor BundleManager {
    private let storage: BundleStorage
    private let verifier: BundleVerifier
    private let rollback: BundleRollback
    private let installer: BundleInstaller
    private let runtimeVersion: String

    private var stateHolder: RuntimeStateHolder
    private var pendingCandidatePath: URL?

    init(storage: BundleStorage, runtimeVersion: String) {
        self.storage = storage
        self.runtimeVersion = runtimeVersion
        self.verifier = BundleVerifier(storage: storage, appRuntimeVersion: runtimeVersion)
        self.rollback = BundleRollback(storage: storage)
        self.installer = BundleInstaller(storage: storage, rollback: rollback)
        self.stateHolder = RuntimeStateHolder(storage.readState().state)
    }

    func setBundlePath(_ path: String) throws {
        let resolved = try storage.resolveWithinRoot(path)
        guard storage.fileExists(resolved, isDirectory: true) else {
            throw OpenOTAException.verificationFailed("Candidate path \"\(path)\" is not a directory")
        }
        pendingCandidatePath = resolved
        try stateHolder.transition(to: .downloaded)
    }

    func getBundlePath() -> String? {
        storage.readState().activeBundlePath
    }

    /// Runs the full `Downloaded -> Verified -> Extracted -> Installed -> Activated` chain against
    /// whatever path was last registered via `setBundlePath`. On any failure the previous
    /// `current/` is left untouched and the candidate directory is deleted.
    func activateBundle() throws -> RuntimeInfo {
        guard let candidateDir = pendingCandidatePath else {
            throw OpenOTAException.notConfigured("setBundlePath() must be called before activateBundle()")
        }

        do {
            try stateHolder.transition(to: .verified)
            let verified = try OpenOTALogger.timed("activate.verify") { try verifier.verify(candidateDir) }

            try stateHolder.transition(to: .extracted)

            try stateHolder.transition(to: .installed)
            let installed = try OpenOTALogger.timed("activate.install") { try installer.promote(verified) }

            try stateHolder.transition(to: .activated)
            pendingCandidatePath = nil

            let manifest = RuntimeManifest(
                activeVersion: installed.manifest.version,
                activeBundlePath: installed.bundleFile.path,
                runtimeVersion: installed.manifest.runtimeVersion,
                manifestVersion: installed.manifest.manifestVersion,
                installTimeMillis: Int64(Date().timeIntervalSince1970 * 1000),
                state: .activated,
                bootConfirmed: false,
                bootAttempts: 0
            )
            try storage.writeState(manifest)

            OpenOTALogger.i("Activated \(installed.manifest.version) (runtime \(installed.manifest.runtimeVersion))")
            return toRuntimeInfo(manifest)
        } catch {
            OpenOTALogger.e("Activation failed", error: error)
            _ = try? stateHolder.transition(to: .failed)
            storage.deleteRecursively(candidateDir)
            pendingCandidatePath = nil
            throw error
        }
    }

    /// Restores the previous generation from `rollback/` and makes it the active bundle.
    @discardableResult
    func rollbackBundle() throws -> RuntimeInfo {
        try stateHolder.transition(to: .rollback)

        let restored: VerifiedBundle
        do {
            restored = try rollback.restore()
        } catch {
            _ = try? stateHolder.transition(to: .failed)
            throw error
        }
        try stateHolder.transition(to: .activated)

        let manifest = RuntimeManifest(
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
        OpenOTALogger.i("Rolled back to \(restored.manifest.version)")
        return toRuntimeInfo(manifest)
    }

    /// Wipes every downloaded/installed bundle and returns the runtime to `.embedded`. Never
    /// removes the app's embedded `main.jsbundle` inside the app bundle itself — only the OpenOTA
    /// tree in Application Support.
    func clearBundle() throws {
        storage.deleteRecursively(storage.currentDir)
        storage.deleteRecursively(storage.rollbackDir)
        storage.deleteRecursively(storage.downloadsDir)
        storage.deleteRecursively(storage.cacheDir)
        for dir in [storage.currentDir, storage.rollbackDir, storage.downloadsDir, storage.cacheDir] {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }

        pendingCandidatePath = nil
        try stateHolder.transition(to: .embedded)
        try storage.writeState(.empty)
    }

    func getRuntimeInfo() -> RuntimeInfo {
        toRuntimeInfo(storage.readState())
    }

    func getActiveVersion() -> String? {
        storage.readState().activeVersion
    }

    /// Called once JS has progressed far enough to construct the TurboModule (mirrors
    /// `OpenOTAModule.initialize()` -> `confirmBoot()` on Android).
    func confirmBoot() {
        var manifest = storage.readState()
        if !manifest.bootConfirmed {
            manifest.bootConfirmed = true
            manifest.bootAttempts = 0
            try? storage.writeState(manifest)
        }
    }

    /// Called at the very top of bundle resolution, before any JS has had a chance to run.
    /// Repeated launches without `confirmBoot()` past `maxUnconfirmedBoots` triggers an automatic
    /// rollback to the previous OTA generation (or, if none exists, leaves state such that the
    /// resolver falls back to the embedded bundle).
    @discardableResult
    func recordBootAttempt() -> RuntimeManifest {
        var manifest = storage.readState()
        guard manifest.state == .activated, !manifest.bootConfirmed else {
            return manifest
        }

        let attempts = manifest.bootAttempts + 1
        if attempts >= maxUnconfirmedBoots, rollback.hasRollback() {
            OpenOTALogger.w("Detected \(attempts) unconfirmed boots of \(manifest.activeVersion ?? "?"); rolling back")
            do {
                _ = try rollbackBundle()
                return storage.readState()
            } catch {
                OpenOTALogger.e("Automatic rollback failed", error: error)
                return manifest
            }
        }

        manifest.bootAttempts = attempts
        try? storage.writeState(manifest)
        return manifest
    }

    private func toRuntimeInfo(_ manifest: RuntimeManifest) -> RuntimeInfo {
        RuntimeInfo(
            currentVersion: manifest.activeVersion,
            bundleVersion: manifest.activeVersion,
            runtimeVersion: manifest.runtimeVersion,
            manifestVersion: manifest.manifestVersion,
            bundlePath: manifest.activeBundlePath,
            installTimeMillis: manifest.installTimeMillis,
            state: manifest.state
        )
    }

    /// Removes abandoned tmp downloads, failed extraction leftovers, and anything in `downloads/`
    /// and `cache/` older than the retention window — mirrors the "obsolete" bundles Android
    /// clears, which is *only* scratch space: Android's `BundleStorage` keeps exactly one
    /// `current/` and one `rollback/` and never has more than those two real generations on disk,
    /// so cleanup never has to choose among multiple obsolete OTA versions. `current/` (active),
    /// `rollback/` (required for automatic rollback) and the app's embedded bundle are never
    /// touched here.
    func cleanupObsolete() {
        for scratch in [storage.tmpDir, storage.downloadsDir, storage.cacheDir] {
            storage.deleteRecursively(scratch)
            try? FileManager.default.createDirectory(at: scratch, withIntermediateDirectories: true)
        }
    }
}
