import Foundation

/// All filesystem access for the runtime goes through here — mirrors `BundleStorage.kt`. Nothing
/// outside this class builds a path from a raw string without going through `resolveWithinRoot`,
/// which is the single chokepoint enforcing "never write outside OpenOTA" and "reject path
/// traversal / symlinks".
///
/// iOS's equivalent of Android's `context.filesDir` is `Application Support` — private,
/// app-scoped, persists across updates, excluded from iCloud backup once marked, and (per Apple's
/// guidance) the correct home for app-managed data that isn't user-visible documents. Never
/// Documents/Caches for the *active* bundle: Caches can be purged by the OS under disk pressure at
/// any time, which would silently break app launch.
final class BundleStorage {
    let rootDir: URL
    let currentDir: URL
    let rollbackDir: URL
    let downloadsDir: URL
    let cacheDir: URL
    let tmpDir: URL
    let logsDir: URL
    let stateFile: URL

    private let fm = FileManager.default

    /// `root` is injectable so tests run against an isolated temp directory instead of the real
    /// Application Support path (spec requirement: hermetic tests).
    init(root: URL? = nil) {
        let base: URL
        if let root {
            base = root
        } else {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            base = appSupport.appendingPathComponent("OpenOTA", isDirectory: true)
        }
        rootDir = base
        currentDir = base.appendingPathComponent("current", isDirectory: true)
        rollbackDir = base.appendingPathComponent("rollback", isDirectory: true)
        downloadsDir = base.appendingPathComponent("downloads", isDirectory: true)
        cacheDir = base.appendingPathComponent("cache", isDirectory: true)
        tmpDir = base.appendingPathComponent("tmp", isDirectory: true)
        logsDir = base.appendingPathComponent("logs", isDirectory: true)
        stateFile = base.appendingPathComponent("state.json")

        for dir in [rootDir, currentDir, rollbackDir, downloadsDir, cacheDir, tmpDir, logsDir] {
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        // Exclude the whole OpenOTA tree from iCloud/iTunes backup — OTA bundles are re-downloadable
        // and shouldn't bloat user backups or leak into them.
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableRoot = rootDir
        try? mutableRoot.setResourceValues(values)
    }

    func readState() -> RuntimeManifest {
        guard let data = try? Data(contentsOf: stateFile) else { return .empty }
        return RuntimeManifest.parse(data)
    }

    /// Temp-write + rename so a crash mid-write never leaves a torn/partial `state.json` readable
    /// as valid JSON.
    func writeState(_ manifest: RuntimeManifest) throws {
        let data = try manifest.toJSON()
        let tmpFile = tmpDir.appendingPathComponent("state.json.tmp")
        try data.write(to: tmpFile, options: .atomic)
        _ = try? fm.removeItem(at: stateFile)
        try fm.moveItem(at: tmpFile, to: stateFile)
    }

    /// Resolves an externally-supplied path against the OpenOTA sandbox, rejecting anything that
    /// isn't a plain descendant. Defends against path traversal and symlink escape before a single
    /// byte of the candidate bundle is read.
    func resolveWithinRoot(_ candidatePath: String) throws -> URL {
        var path = candidatePath
        if path.hasPrefix("file://"), let url = URL(string: path) {
            path = url.path
        }

        let candidate = URL(fileURLWithPath: path)
        let resolved: URL = candidate.path.hasPrefix("/") ? candidate : rootDir.appendingPathComponent(path)

        let standardizedRoot = rootDir.standardizedFileURL.resolvingSymlinksInPath().path
        let standardizedCandidate = resolved.standardizedFileURL.resolvingSymlinksInPath().path

        guard standardizedCandidate == standardizedRoot || standardizedCandidate.hasPrefix(standardizedRoot + "/") else {
            throw OpenOTAException.pathSecurityError("Path \"\(candidatePath)\" escapes the OpenOTA root directory")
        }
        return URL(fileURLWithPath: standardizedCandidate)
    }

    /// Rejects a directory tree containing any symbolic link, without following links.
    func assertNoSymlinks(_ dir: URL) throws {
        guard fm.fileExists(atPath: dir.path) else { return }
        guard let enumerator = fm.enumerator(
            at: dir,
            includingPropertiesForKeys: [.isSymbolicLinkKey],
            options: [.producesRelativePathURLs]
        ) else { return }

        for case let fileURL as URL in enumerator {
            let values = try fileURL.resourceValues(forKeys: [.isSymbolicLinkKey])
            if values.isSymbolicLink == true {
                throw OpenOTAException.pathSecurityError("Symbolic link detected at \"\(fileURL.path)\"")
            }
        }
    }

    /// Atomically (same-volume rename) replaces `destination` with `source`, deleting any prior
    /// contents first.
    func atomicReplace(source: URL, destination: URL) throws {
        deleteRecursively(destination)
        try? fm.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)

        do {
            try fm.moveItem(at: source, to: destination)
        } catch {
            // Cross-volume fallback: copy then delete the source.
            try fm.copyItem(at: source, to: destination)
            deleteRecursively(source)
        }
    }

    func deleteRecursively(_ url: URL) {
        try? fm.removeItem(at: url)
    }

    func bundleFile(_ packageDir: URL, bundleFileName: String) -> URL {
        packageDir.appendingPathComponent("bundle", isDirectory: true).appendingPathComponent(bundleFileName)
    }

    func assetsDir(_ packageDir: URL) -> URL {
        packageDir.appendingPathComponent("assets", isDirectory: true)
    }

    func manifestFile(_ packageDir: URL) -> URL {
        packageDir.appendingPathComponent("manifest.json")
    }

    func fileExists(_ url: URL, isDirectory: Bool? = nil) -> Bool {
        var isDir: ObjCBool = false
        let exists = fm.fileExists(atPath: url.path, isDirectory: &isDir)
        if let isDirectory {
            return exists && isDir.boolValue == isDirectory
        }
        return exists
    }

    func copyRecursively(from: URL, to: URL) throws {
        deleteRecursively(to)
        try fm.copyItem(at: from, to: to)
    }
}
