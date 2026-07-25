package com.openota.runtime

import java.io.File
import java.security.MessageDigest

private const val ANDROID_PLATFORM = "android"
private const val HASH_BUFFER_SIZE = 1 shl 16 // 64 KiB

/** The outcome of a full verification pass: the parsed manifest plus its already-computed hash. */
data class VerifiedBundle(
    val packageDir: File,
    val manifest: BundleManifest,
    val bundleFile: File,
    val sha256: String,
)

/**
 * Re-verifies a staged package independently of whatever checks the JS SDK already performed.
 * The JS layer is not a trust boundary — it can be bypassed, patched, or simply buggy — so every
 * field the runtime depends on to decide "is this bundle safe to serve" is re-derived from the
 * bytes on disk here, once, and the result ([VerifiedBundle]) is threaded through the rest of the
 * pipeline so [BundleInstaller] never has to hash the file again.
 */
class BundleVerifier(private val storage: BundleStorage, private val appRuntimeVersion: String) {

    fun verify(packageDir: File): VerifiedBundle {
        storage.assertNoSymlinks(packageDir)

        val manifestFile = storage.manifestFile(packageDir)
        if (!manifestFile.exists()) {
            throw BundleVerificationException("Manifest not found at \"${manifestFile.path}\"")
        }

        val manifest = BundleManifest.parse(manifestFile.readText())

        if (manifest.platform != ANDROID_PLATFORM) {
            throw BundleVerificationException("Manifest platform \"${manifest.platform}\" is not \"$ANDROID_PLATFORM\"")
        }

        if (manifest.runtimeVersion != appRuntimeVersion) {
            throw UnsupportedRuntimeVersionException(manifest.runtimeVersion, appRuntimeVersion)
        }

        val bundleFile = storage.bundleFile(packageDir, manifest.bundleName)
        if (!bundleFile.exists() || !bundleFile.isFile) {
            throw BundleVerificationException("Bundle file not found at \"${bundleFile.path}\"")
        }

        // Packages with no static assets may not have an assets/ directory at all: the CLI omits
        // it, and even when present as an empty zip entry, some Android unzip implementations
        // don't materialize empty directories on extraction. Only a *non-directory* in its place
        // is an error; a missing directory simply means "no assets".
        val assetsDir = storage.assetsDir(packageDir)
        if (assetsDir.exists() && !assetsDir.isDirectory) {
            throw BundleVerificationException("Assets path is not a directory at \"${assetsDir.path}\"")
        }

        val actualSha256 = OpenOTALogger.timed("verify.sha256") { computeSha256(bundleFile) }

        if (!actualSha256.equals(manifest.sha256, ignoreCase = true)) {
            throw BundleVerificationException(
                "Checksum mismatch for ${manifest.platform}@${manifest.version}: " +
                    "expected ${manifest.sha256}, got $actualSha256",
            )
        }

        return VerifiedBundle(packageDir, manifest, bundleFile, actualSha256)
    }

    /** Streams the file through a digest in fixed-size chunks; the whole file is never buffered in memory. */
    private fun computeSha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(HASH_BUFFER_SIZE)

        file.inputStream().buffered().use { input ->
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }

        return digest.digest().joinToString(separator = "") { "%02x".format(it) }
    }
}
