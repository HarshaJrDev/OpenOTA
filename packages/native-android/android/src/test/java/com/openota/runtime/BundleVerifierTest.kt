package com.openota.runtime

import android.content.Context
import java.io.File
import java.security.MessageDigest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`

private const val RUNTIME_VERSION = "1.0.0"

/**
 * Regression coverage for the empty-assets fix: a package with zero static assets must verify
 * successfully whether or not its `assets/` directory exists on disk (some Android unzip
 * implementations don't materialize empty zip directory entries), while every other check
 * (bundle presence, checksum, runtimeVersion, platform, non-directory collisions) must still be
 * enforced exactly as before.
 */
class BundleVerifierTest {

    @get:Rule val tmp = TemporaryFolder()

    private lateinit var storage: BundleStorage
    private lateinit var verifier: BundleVerifier

    @Before
    fun setUp() {
        val filesDir = tmp.newFolder("files")
        val context = mock(Context::class.java)
        `when`(context.applicationContext).thenReturn(context)
        `when`(context.filesDir).thenReturn(filesDir)

        storage = BundleStorage(context)
        verifier = BundleVerifier(storage, RUNTIME_VERSION)
    }

    /** Builds a package directory with a manifest + bundle file, returning its sha256. */
    private fun buildPackage(
        dir: File,
        bundleBytes: ByteArray = "console.log('hi')".toByteArray(),
        sha256: String = sha256Hex(bundleBytes),
        runtimeVersion: String = RUNTIME_VERSION,
        platform: String = "android",
        includeAssetsDir: Boolean? = null, // null = don't create, true = dir, false = regular file
    ): File {
        dir.mkdirs()
        File(File(dir, "bundle"), "index.android.bundle").apply { parentFile?.mkdirs() }.writeBytes(bundleBytes)
        File(dir, "manifest.json").writeText(
            """
            {
              "manifestVersion": 1,
              "version": "1.0.1",
              "platform": "$platform",
              "runtimeVersion": "$runtimeVersion",
              "sha256": "$sha256",
              "size": ${bundleBytes.size},
              "createdAt": "2026-01-01T00:00:00.000Z",
              "bundleName": "index.android.bundle"
            }
            """.trimIndent(),
        )
        when (includeAssetsDir) {
            true -> File(dir, "assets").mkdirs()
            false -> File(dir, "assets").writeText("not a directory")
            null -> Unit // leave absent
        }
        return dir
    }

    private fun sha256Hex(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    // A. assets = [] semantics, assets directory missing -> PASS
    @Test
    fun `verifies successfully when assets directory is absent`() {
        val pkg = buildPackage(tmp.newFolder("pkg-a"), includeAssetsDir = null)

        val result = verifier.verify(pkg)

        assertEquals("1.0.1", result.manifest.version)
    }

    // B. assets = [], assets directory exists and is a directory -> PASS
    @Test
    fun `verifies successfully when assets directory exists and is empty`() {
        val pkg = buildPackage(tmp.newFolder("pkg-b"), includeAssetsDir = true)

        val result = verifier.verify(pkg)

        assertEquals("1.0.1", result.manifest.version)
    }

    // C. expected assets path exists as a regular file -> FAIL safely
    @Test
    fun `fails when assets path is a regular file instead of a directory`() {
        val pkg = buildPackage(tmp.newFolder("pkg-c"), includeAssetsDir = false)

        assertThrows(BundleVerificationException::class.java) {
            verifier.verify(pkg)
        }
    }

    // Bundle file missing entirely -> FAIL (unchanged behavior)
    @Test
    fun `fails when the bundle file itself is missing`() {
        val pkg = tmp.newFolder("pkg-nobundle")
        File(pkg, "manifest.json").writeText(
            """
            {"manifestVersion":1,"version":"1.0.1","platform":"android","runtimeVersion":"$RUNTIME_VERSION",
             "sha256":"${"0".repeat(64)}","size":1,"createdAt":"now","bundleName":"index.android.bundle"}
            """.trimIndent(),
        )

        assertThrows(BundleVerificationException::class.java) {
            verifier.verify(pkg)
        }
    }

    // E. checksum mismatch -> FAIL (unchanged behavior)
    @Test
    fun `fails on sha256 mismatch`() {
        val bytes = "actual content".toByteArray()
        val pkg = buildPackage(tmp.newFolder("pkg-badsha"), bundleBytes = bytes, sha256 = "f".repeat(64))

        assertThrows(BundleVerificationException::class.java) {
            verifier.verify(pkg)
        }
    }

    // runtimeVersion mismatch -> FAIL (unchanged behavior)
    @Test
    fun `fails on runtimeVersion mismatch`() {
        val pkg = buildPackage(tmp.newFolder("pkg-badruntime"), runtimeVersion = "2.0.0")

        assertThrows(UnsupportedRuntimeVersionException::class.java) {
            verifier.verify(pkg)
        }
    }

    // platform mismatch -> FAIL (unchanged behavior)
    @Test
    fun `fails on platform mismatch`() {
        val pkg = buildPackage(tmp.newFolder("pkg-badplatform"), platform = "ios")

        assertThrows(BundleVerificationException::class.java) {
            verifier.verify(pkg)
        }
    }

    // manifest missing entirely -> FAIL (unchanged behavior)
    @Test
    fun `fails when manifest is missing`() {
        val pkg = tmp.newFolder("pkg-nomanifest")

        assertThrows(BundleVerificationException::class.java) {
            verifier.verify(pkg)
        }
    }

    // F. symlink / path-traversal guard still runs before anything else -> FAIL
    @Test
    fun `still rejects a package directory containing a symlink`() {
        val pkg = buildPackage(tmp.newFolder("pkg-symlink"), includeAssetsDir = true)
        val linkTarget = tmp.newFile("outside-target.txt")
        val link = File(pkg, "assets/evil-link")
        java.nio.file.Files.createSymbolicLink(link.toPath(), linkTarget.toPath())

        assertThrows(PathSecurityException::class.java) {
            verifier.verify(pkg)
        }
    }
}
