import Foundation
import CryptoKit

private let iosPlatform = "ios"

/// The outcome of a full verification pass: the parsed manifest plus its already-computed hash.
struct VerifiedBundle {
    let packageDir: URL
    let manifest: BundleManifest
    let bundleFile: URL
    let sha256: String
}

/// Re-verifies a staged package independently of whatever checks the JS SDK already performed —
/// mirrors `BundleVerifier.kt`. JS is not a trust boundary, so every field the runtime depends on
/// is re-derived from the bytes on disk here, once.
final class BundleVerifier {
    private let storage: BundleStorage
    private let appRuntimeVersion: String

    init(storage: BundleStorage, appRuntimeVersion: String) {
        self.storage = storage
        self.appRuntimeVersion = appRuntimeVersion
    }

    func verify(_ packageDir: URL) throws -> VerifiedBundle {
        try storage.assertNoSymlinks(packageDir)

        let manifestFile = storage.manifestFile(packageDir)
        guard storage.fileExists(manifestFile) else {
            throw OpenOTAException.verificationFailed("Manifest not found at \"\(manifestFile.path)\"")
        }
        let manifest = try BundleManifest.parse(contentsOf: manifestFile)

        guard manifest.platform == iosPlatform else {
            throw OpenOTAException.verificationFailed("Manifest platform \"\(manifest.platform)\" is not \"\(iosPlatform)\"")
        }

        guard manifest.runtimeVersion == appRuntimeVersion else {
            throw OpenOTAException.invalidRuntime(bundleRuntimeVersion: manifest.runtimeVersion, appRuntimeVersion: appRuntimeVersion)
        }

        let bundleFile = storage.bundleFile(packageDir, bundleFileName: manifest.bundleName)
        guard storage.fileExists(bundleFile, isDirectory: false) else {
            throw OpenOTAException.verificationFailed("Bundle file not found at \"\(bundleFile.path)\"")
        }

        // Packages with no static assets may not ship an assets/ directory at all. Only a
        // *non-directory* in its place is an error; missing simply means "no assets".
        let assetsDir = storage.assetsDir(packageDir)
        if storage.fileExists(assetsDir), !storage.fileExists(assetsDir, isDirectory: true) {
            throw OpenOTAException.verificationFailed("Assets path is not a directory at \"\(assetsDir.path)\"")
        }

        let actualSha256 = try OpenOTALogger.timed("verify.sha256") { try Self.computeSha256(bundleFile) }
        guard actualSha256.caseInsensitiveCompare(manifest.sha256) == .orderedSame else {
            throw OpenOTAException.verificationFailed(
                "Checksum mismatch for \(manifest.platform)@\(manifest.version): expected \(manifest.sha256), got \(actualSha256)"
            )
        }

        return VerifiedBundle(packageDir: packageDir, manifest: manifest, bundleFile: bundleFile, sha256: actualSha256)
    }

    /// Streams the file through SHA-256 in fixed-size chunks so the whole file is never buffered
    /// in memory, mirroring the Kotlin implementation's `MessageDigest` streaming approach.
    static func computeSha256(_ url: URL) throws -> String {
        guard let stream = InputStream(url: url) else {
            throw OpenOTAException.verificationFailed("Bundle file is unreadable at \"\(url.path)\"")
        }
        stream.open()
        defer { stream.close() }

        var hasher = SHA256()
        let bufferSize = 1 << 16 // 64 KiB
        var buffer = [UInt8](repeating: 0, count: bufferSize)

        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: bufferSize)
            if read < 0 {
                throw OpenOTAException.verificationFailed("Failed reading bundle file at \"\(url.path)\"")
            }
            if read == 0 { break }
            hasher.update(data: Data(buffer[0..<read]))
        }

        let digest = hasher.finalize()
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
