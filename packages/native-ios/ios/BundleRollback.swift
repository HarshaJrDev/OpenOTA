import Foundation

/// Owns the single previous-generation snapshot in `rollback/` — mirrors `BundleRollback.kt`.
/// Deliberately one generation deep: a device-side rollback is a last-resort safety net, not
/// version control.
final class BundleRollback {
    private let storage: BundleStorage

    init(storage: BundleStorage) {
        self.storage = storage
    }

    func hasRollback() -> Bool {
        storage.fileExists(storage.rollbackDir, isDirectory: true) &&
            storage.fileExists(storage.manifestFile(storage.rollbackDir))
    }

    /// Moves whatever is currently active into `rollback/`, discarding any older rollback snapshot.
    func snapshotCurrent() throws {
        guard storage.fileExists(storage.currentDir, isDirectory: true),
              storage.fileExists(storage.manifestFile(storage.currentDir))
        else {
            return
        }

        let staged = storage.tmpDir.appendingPathComponent("rollback-snapshot")
        storage.deleteRecursively(staged)
        try storage.copyRecursively(from: storage.currentDir, to: staged)
        try storage.atomicReplace(source: staged, destination: storage.rollbackDir)
    }

    /// Restores `rollback/` into `current/` and clears the rollback slot (single-use).
    func restore() throws -> VerifiedBundle {
        guard hasRollback() else {
            throw OpenOTAException.noRollbackAvailable
        }

        let rollbackManifest = try BundleManifest.parse(contentsOf: storage.manifestFile(storage.rollbackDir))

        let staged = storage.tmpDir.appendingPathComponent("rollback-restore")
        storage.deleteRecursively(staged)
        try storage.copyRecursively(from: storage.rollbackDir, to: staged)
        try storage.atomicReplace(source: staged, destination: storage.currentDir)
        storage.deleteRecursively(storage.rollbackDir)

        return VerifiedBundle(
            packageDir: storage.currentDir,
            manifest: rollbackManifest,
            bundleFile: storage.bundleFile(storage.currentDir, bundleFileName: rollbackManifest.bundleName),
            sha256: rollbackManifest.sha256
        )
    }

    func clear() {
        storage.deleteRecursively(storage.rollbackDir)
        try? FileManager.default.createDirectory(at: storage.rollbackDir, withIntermediateDirectories: true)
    }
}
