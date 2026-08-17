import Foundation

/// Performs the `Extracted -> Installed` transition: physically promoting an already-`VerifiedBundle`
/// into `current/`. Mirrors `BundleInstaller.kt`: extraction of the zip itself is intentionally
/// *not* this class's job. On Android, the JS SDK unzips with `react-native-zip-archive` and hands
/// the runtime a plain directory via `setBundlePath`; the same is true on iOS (see
/// `packages/sdk/src/native/ios.ts`'s `setBundlePath`, which just forwards a `file://` path — there
/// is no native download/unzip call in the Spec). This installer's only concern is promoting that
/// already-staged directory atomically and never leaving `current/` half-written.
///
/// `PathTraversalGuard` below is the defense-in-depth companion for step 9 of the spec: even though
/// this runtime doesn't perform its own unzip, any directory handed to `setBundlePath` is walked
/// and every entry's resolved path is verified to stay within that directory before promotion —
/// protecting against a compromised/buggy JS-side unzip step (Zip Slip's underlying symptom is
/// exactly "an extracted entry escapes its target directory", which this check catches regardless
/// of which layer performed the extraction).
enum PathTraversalGuard {
    /// Walks `dir` and asserts every entry's *standardized* path remains a descendant of `dir`.
    /// A JS-side Zip Slip bug would manifest as a real symlink or a file whose true (resolved)
    /// location resolves outside `dir` — both are caught here before this runtime ever reads it.
    static func assertContained(_ dir: URL) throws {
        let fm = FileManager.default
        let root = dir.standardizedFileURL.resolvingSymlinksInPath().path
        guard let enumerator = fm.enumerator(at: dir, includingPropertiesForKeys: [.isSymbolicLinkKey]) else {
            return
        }
        for case let entry as URL in enumerator {
            let resolved = entry.standardizedFileURL.resolvingSymlinksInPath().path
            guard resolved == root || resolved.hasPrefix(root + "/") else {
                throw OpenOTAException.pathSecurityError("Entry \"\(entry.lastPathComponent)\" escapes its package directory")
            }
        }
    }
}

final class BundleInstaller {
    private let storage: BundleStorage
    private let rollback: BundleRollback

    init(storage: BundleStorage, rollback: BundleRollback) {
        self.storage = storage
        self.rollback = rollback
    }

    /// Snapshots whatever is currently active into `rollback/`, then atomically swaps the verified
    /// candidate into `current/`. If either step throws, `current/` is left exactly as it was.
    func promote(_ verified: VerifiedBundle) throws -> VerifiedBundle {
        try PathTraversalGuard.assertContained(verified.packageDir)
        try rollback.snapshotCurrent()

        do {
            try storage.atomicReplace(source: verified.packageDir, destination: storage.currentDir)
        } catch {
            throw OpenOTAException.installFailed("Failed to promote bundle into current/: \(error.localizedDescription)")
        }

        return VerifiedBundle(
            packageDir: storage.currentDir,
            manifest: verified.manifest,
            bundleFile: storage.bundleFile(storage.currentDir, bundleFileName: verified.manifest.bundleName),
            sha256: verified.sha256
        )
    }
}
