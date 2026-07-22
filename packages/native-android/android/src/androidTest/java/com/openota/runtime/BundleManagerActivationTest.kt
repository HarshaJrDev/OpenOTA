package com.openota.runtime

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.MessageDigest

private const val RUNTIME_VERSION = "1.0.0"

@RunWith(AndroidJUnit4::class)
class BundleManagerActivationTest {
    private lateinit var context: android.content.Context
    private lateinit var storage: BundleStorage
    private lateinit var manager: BundleManager

    @Before
    fun setUp() {
        context = InstrumentationRegistry.getInstrumentation().targetContext
        storage = BundleStorage(context)
        storage.deleteRecursively(storage.rootDir)
        BundleManager.resetForTesting()
        manager = BundleManager.getInstance(context, RUNTIME_VERSION)
    }

    @After
    fun tearDown() {
        BundleManager.resetForTesting()
        storage.deleteRecursively(storage.rootDir)
    }

    private fun stagePackage(
        version: String,
        content: String = "console.log('$version')",
        runtimeVersion: String = RUNTIME_VERSION,
    ): File {
        val dir = File(storage.downloadsDir, "candidate-$version").apply { mkdirs() }
        val bundleFile = File(File(dir, "bundle").apply { mkdirs() }, "index.android.bundle").apply { writeText(content) }
        File(dir, "assets").mkdirs()
        val sha256 = MessageDigest.getInstance("SHA-256").digest(bundleFile.readBytes())
            .joinToString("") { "%02x".format(it) }

        File(dir, "manifest.json").writeText(
            """
            {"manifestVersion":1,"version":"$version","platform":"android","runtimeVersion":"$runtimeVersion",
             "sha256":"$sha256","size":${bundleFile.length()},"createdAt":"now","bundleName":"index.android.bundle"}
            """.trimIndent(),
        )
        return dir
    }

    @Test
    fun activatesAFirstBundleWithNoPriorRollback() {
        manager.setBundlePath(stagePackage("1.0.0").path)
        val info = manager.activateBundle()

        assertEquals("1.0.0", info.currentVersion)
        assertTrue(File(info.bundlePath!!).exists())
        assertFalse(BundleRollback(storage).hasRollback())
    }

    @Test
    fun secondActivationSnapshotsThePreviousVersionForRollback() {
        manager.setBundlePath(stagePackage("1.0.0").path)
        manager.activateBundle()

        manager.setBundlePath(stagePackage("2.0.0").path)
        val info = manager.activateBundle()

        assertEquals("2.0.0", info.currentVersion)
        assertTrue(BundleRollback(storage).hasRollback())
    }

    @Test
    fun rollbackRestoresThePreviousVersion() {
        manager.setBundlePath(stagePackage("1.0.0").path)
        manager.activateBundle()
        manager.setBundlePath(stagePackage("2.0.0").path)
        manager.activateBundle()

        val restored = manager.rollbackBundle()

        assertEquals("1.0.0", restored.currentVersion)
    }

    @Test
    fun rollbackWithNothingToRestoreThrows() {
        assertThrows(NoRollbackAvailableException::class.java) {
            manager.rollbackBundle()
        }
    }

    @Test
    fun aTamperedChecksumIsRejectedAndCurrentIsUntouched() {
        manager.setBundlePath(stagePackage("1.0.0").path)
        manager.activateBundle()

        val tampered = stagePackage("2.0.0")
        File(File(tampered, "bundle"), "index.android.bundle").writeText("tampered payload")
        manager.setBundlePath(tampered.path)

        assertThrows(BundleVerificationException::class.java) {
            manager.activateBundle()
        }

        assertEquals("1.0.0", manager.getActiveVersion())
    }

    @Test
    fun clearBundleWipesEverythingBackToEmbedded() {
        manager.setBundlePath(stagePackage("1.0.0").path)
        manager.activateBundle()

        manager.clearBundle()

        assertEquals(null, manager.getActiveVersion())
        assertFalse(BundleRollback(storage).hasRollback())
    }

    @Test
    fun activationSucceedsWhenBundleRuntimeVersionMatchesAppRuntimeVersion() {
        manager.setBundlePath(stagePackage("1.0.4", runtimeVersion = RUNTIME_VERSION).path)

        val info = manager.activateBundle()

        assertEquals("1.0.4", info.currentVersion)
        assertEquals(RUNTIME_VERSION, info.runtimeVersion)
    }

    @Test
    fun activationRejectedWithInvalidRuntimeWhenBundleRuntimeVersionMismatches() {
        // Reproduces the exact real-world bug report: a bundle built with the app's own
        // package.json version ("0.0.1") instead of its configured runtimeVersion ("1.0").
        manager.setBundlePath(stagePackage("1.0.4", runtimeVersion = "0.0.1").path)

        val error = assertThrows(UnsupportedRuntimeVersionException::class.java) {
            manager.activateBundle()
        }

        assertEquals("INVALID_RUNTIME", error.code)
        assertEquals(null, manager.getActiveVersion())
    }

    @Test
    fun recordBootAttemptAutoRollsBackAfterRepeatedUnconfirmedBoots() {
        manager.setBundlePath(stagePackage("1.0.0").path)
        manager.activateBundle()
        manager.setBundlePath(stagePackage("2.0.0").path)
        manager.activateBundle()

        // Simulate two cold starts of 2.0.0 that never call confirmBoot().
        manager.recordBootAttempt()
        val afterSecondAttempt = manager.recordBootAttempt()

        assertEquals("1.0.0", afterSecondAttempt.activeVersion)
        assertNotNull(afterSecondAttempt.activeBundlePath)
    }
}
