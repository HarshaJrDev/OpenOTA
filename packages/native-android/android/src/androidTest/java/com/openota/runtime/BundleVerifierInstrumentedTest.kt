package com.openota.runtime

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.MessageDigest

private const val APP_RUNTIME_VERSION = "1.0.0"

@RunWith(AndroidJUnit4::class)
class BundleVerifierInstrumentedTest {
    private lateinit var storage: BundleStorage
    private lateinit var verifier: BundleVerifier

    @Before
    fun setUp() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        storage = BundleStorage(context)
        storage.deleteRecursively(storage.tmpDir)
        storage.tmpDir.mkdirs()
        verifier = BundleVerifier(storage, APP_RUNTIME_VERSION)
    }

    private fun buildPackage(
        dirName: String,
        bundleContent: String = "console.log('hi')",
        runtimeVersion: String = APP_RUNTIME_VERSION,
        platform: String = "android",
        sha256Override: String? = null,
        includeAssets: Boolean = true,
    ): File {
        val packageDir = File(storage.tmpDir, dirName).apply { mkdirs() }
        val bundleDir = File(packageDir, "bundle").apply { mkdirs() }
        val bundleFile = File(bundleDir, "index.android.bundle").apply { writeText(bundleContent) }

        if (includeAssets) {
            File(packageDir, "assets").mkdirs()
        }

        val sha256 = sha256Override ?: MessageDigest.getInstance("SHA-256")
            .digest(bundleFile.readBytes())
            .joinToString("") { "%02x".format(it) }

        File(packageDir, "manifest.json").writeText(
            """
            {
              "manifestVersion": 1,
              "version": "1.2.0",
              "platform": "$platform",
              "runtimeVersion": "$runtimeVersion",
              "sha256": "$sha256",
              "size": ${bundleFile.length()},
              "createdAt": "2026-01-01T00:00:00.000Z",
              "bundleName": "index.android.bundle"
            }
            """.trimIndent(),
        )

        return packageDir
    }

    @Test
    fun verifiesAWellFormedPackage() {
        val packageDir = buildPackage("valid-package")
        val result = verifier.verify(packageDir)

        assertEquals("1.2.0", result.manifest.version)
        assertEquals(64, result.sha256.length)
    }

    @Test
    fun rejectsAChecksumMismatch() {
        val packageDir = buildPackage("bad-checksum", sha256Override = "f".repeat(64))

        assertThrows(BundleVerificationException::class.java) {
            verifier.verify(packageDir)
        }
    }

    @Test
    fun rejectsAMismatchedRuntimeVersion() {
        val packageDir = buildPackage("wrong-runtime", runtimeVersion = "2.0.0")

        assertThrows(UnsupportedRuntimeVersionException::class.java) {
            verifier.verify(packageDir)
        }
    }

    @Test
    fun rejectsAMismatchedPlatform() {
        val packageDir = buildPackage("wrong-platform", platform = "ios")

        assertThrows(BundleVerificationException::class.java) {
            verifier.verify(packageDir)
        }
    }

    @Test
    fun rejectsAMissingAssetsDirectory() {
        val packageDir = buildPackage("no-assets", includeAssets = false)

        assertThrows(BundleVerificationException::class.java) {
            verifier.verify(packageDir)
        }
    }

    @Test
    fun rejectsAMissingManifest() {
        val packageDir = File(storage.tmpDir, "no-manifest").apply { mkdirs() }
        File(File(packageDir, "bundle"), "index.android.bundle").apply { parentFile?.mkdirs(); writeText("x") }

        assertThrows(BundleVerificationException::class.java) {
            verifier.verify(packageDir)
        }
    }
}
