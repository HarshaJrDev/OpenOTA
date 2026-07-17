package com.openota.e2e

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.openota.runtime.BundleManager
import com.openota.runtime.BundleRollback
import com.openota.runtime.BundleStorage
import com.openota.runtime.BundleLoader
import com.openota.runtime.NoRollbackAvailableException
import com.openota.runtime.RuntimeState
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Certification suite for the full OTA lifecycle, driven entirely by REAL artifacts:
 * `apps/e2e/scripts/generate-fixtures.ts` runs the actual `openota` CLI against the actual
 * `@openota/server` and captures the output. Nothing here is a hand-typed JSON fixture.
 *
 * Maps to `apps/e2e/docs/ACCEPTANCE_CRITERIA.md` scenarios A1-A8. See that document for the
 * pass/fail bar each test enforces.
 */
@RunWith(AndroidJUnit4::class)
class LifecycleIntegrationTest {
    private lateinit var context: android.content.Context
    private lateinit var storage: BundleStorage
    private lateinit var manager: BundleManager
    private lateinit var expected: ExpectedFixtureValues
    private lateinit var stagingDir: File

    @Before
    fun setUp() {
        context = InstrumentationRegistry.getInstrumentation().targetContext
        expected = FixtureAssets.expected(context)
        storage = BundleStorage(context)
        storage.deleteRecursively(storage.rootDir)
        BundleManager.resetForTesting()
        manager = BundleManager.getInstance(context, expected.runtimeVersion)
        stagingDir = File(storage.downloadsDir, "staging")
    }

    @After
    fun tearDown() {
        BundleManager.resetForTesting()
        storage.deleteRecursively(storage.rootDir)
    }

    private fun stage(fixtureName: String): String =
        FixtureAssets.copyFixture(context, fixtureName, File(stagingDir, fixtureName)).path

    // ---- A1: initial install / embedded bundle fallback -----------------------------------

    @Test
    fun a1_freshInstallServesTheEmbeddedBundle() {
        assertEquals(RuntimeState.EMBEDDED, manager.getRuntimeInfo().state)
        assertNull(manager.getActiveVersion())
        assertNull(BundleLoader.getJSBundleFile(context, expected.runtimeVersion))
    }

    // ---- A2: download -> verify -> extract -> install -> activate (one real CLI-built package) --

    @Test
    fun a2_activatesARealCliBuiltPackage() {
        manager.setBundlePath(stage("valid"))
        val info = manager.activateBundle()

        assertEquals(RuntimeState.ACTIVATED, info.state)
        assertEquals(expected.updateVersion, info.currentVersion)
        assertEquals(expected.runtimeVersion, info.runtimeVersion)
        assertEquals(expected.manifestVersion, info.manifestVersion)
        assertTrue("activated bundle file must exist on disk", File(info.bundlePath!!).exists())
        assertTrue(info.bundlePath!!.endsWith(expected.bundleName))

        // The application must now actually load the OTA bundle, not the embedded one.
        val servedPath = BundleLoader.getJSBundleFile(context, expected.runtimeVersion)
        assertEquals(info.bundlePath, servedPath)
    }

    // ---- A3: SHA-256 is independently re-verified against the real bundle bytes -------------

    @Test
    fun a3_activatedBundleFileHashMatchesTheManifest() {
        manager.setBundlePath(stage("valid"))
        val info = manager.activateBundle()

        val digest = java.security.MessageDigest.getInstance("SHA-256")
        File(info.bundlePath!!).inputStream().use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        val actualSha256 = digest.digest().joinToString("") { "%02x".format(it) }
        assertEquals(expected.sha256, actualSha256)
    }

    // ---- A4: bundle switching — a second real generation replaces the first -----------------

    @Test
    fun a4_bundleSwitchingToASecondGeneration() {
        manager.setBundlePath(stage("valid"))
        val first = manager.activateBundle()

        manager.setBundlePath(stage("valid-v3"))
        val second = manager.activateBundle()

        assertEquals("3.0.0", second.currentVersion)
        assertTrue(second.bundlePath != first.bundlePath || second.currentVersion != first.currentVersion)
        assertTrue("switching must snapshot the previous generation for rollback", BundleRollback(storage).hasRollback())
    }

    // ---- A5: rollback restores the previous real generation ----------------------------------

    @Test
    fun a5_rollbackRestoresThePreviousGeneration() {
        manager.setBundlePath(stage("valid"))
        manager.activateBundle()
        manager.setBundlePath(stage("valid-v3"))
        manager.activateBundle()

        val restored = manager.rollbackBundle()

        assertEquals(expected.updateVersion, restored.currentVersion)
        assertEquals(RuntimeState.ACTIVATED, restored.state)
        assertFalse("rollback is single-use", BundleRollback(storage).hasRollback())
    }

    @Test
    fun a5b_rollbackWithNoPriorGenerationThrows() {
        manager.setBundlePath(stage("valid"))
        manager.activateBundle()

        assertThrows(NoRollbackAvailableException::class.java) { manager.rollbackBundle() }
    }

    // ---- A6: crash-safety — repeated unconfirmed boots trigger an automatic rollback --------

    @Test
    fun a6_repeatedUnconfirmedBootsAutoRollBack() {
        manager.setBundlePath(stage("valid"))
        manager.activateBundle()
        manager.setBundlePath(stage("valid-v3"))
        manager.activateBundle()

        manager.recordBootAttempt() // 1st unconfirmed cold start of v3.0.0
        val afterSecondBoot = manager.recordBootAttempt() // 2nd — must trigger rollback

        assertEquals(expected.updateVersion, afterSecondBoot.activeVersion)
        assertEquals(RuntimeState.ACTIVATED, afterSecondBoot.state)
    }

    @Test
    fun a6b_confirmedBootIsNeverRolledBack() {
        manager.setBundlePath(stage("valid"))
        manager.activateBundle()
        manager.confirmBoot()

        repeat(5) { manager.recordBootAttempt() }

        assertEquals(expected.updateVersion, manager.getActiveVersion())
    }

    // ---- A7: reset runtime / delete bundle wipes everything back to embedded ---------------

    @Test
    fun a7_resetRuntimeReturnsToEmbedded() {
        manager.setBundlePath(stage("valid"))
        manager.activateBundle()

        manager.clearBundle()

        assertEquals(RuntimeState.EMBEDDED, manager.getRuntimeInfo().state)
        assertNull(manager.getActiveVersion())
        assertFalse(BundleRollback(storage).hasRollback())
        assertNull(BundleLoader.getJSBundleFile(context, expected.runtimeVersion))
    }

    // ---- A8: a failed activation never disturbs a known-good running bundle -----------------

    @Test
    fun a8_aFailedActivationLeavesTheCurrentBundleUntouched() {
        manager.setBundlePath(stage("valid"))
        val goodInfo = manager.activateBundle()

        manager.setBundlePath(stage("invalid-sha"))
        assertThrows(com.openota.runtime.BundleVerificationException::class.java) { manager.activateBundle() }

        val infoAfterFailedAttempt = manager.getRuntimeInfo()
        assertEquals(goodInfo.currentVersion, infoAfterFailedAttempt.currentVersion)
        assertEquals(goodInfo.bundlePath, infoAfterFailedAttempt.bundlePath)
        assertEquals(RuntimeState.ACTIVATED, infoAfterFailedAttempt.state)
        assertNotNull(BundleLoader.getJSBundleFile(context, expected.runtimeVersion))
    }
}
