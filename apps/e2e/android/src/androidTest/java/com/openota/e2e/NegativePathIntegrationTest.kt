package com.openota.e2e

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.openota.runtime.BundleManager
import com.openota.runtime.BundleManifestParseException
import com.openota.runtime.BundleStorage
import com.openota.runtime.BundleVerificationException
import com.openota.runtime.RuntimeState
import com.openota.runtime.UnsupportedRuntimeVersionException
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Every rejection path a corrupted, tampered, or malformed package can take, all derived from the
 * SAME real CLI-built package (only the field under test is mutated — see
 * `apps/e2e/scripts/generate-fixtures.ts`). Maps to `ACCEPTANCE_CRITERIA.md` scenarios N1-N7.
 *
 * The bar for every test here is not just "activateBundle() throws" — it's "throws the SPECIFIC
 * documented exception/code AND leaves the runtime in EMBEDDED (nothing was ever activated)".
 * A generic catch-all failure would make these tests pass even if verification were silently
 * skipped and something else failed later; asserting the exact type closes that gap.
 */
@RunWith(AndroidJUnit4::class)
class NegativePathIntegrationTest {
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

    private fun assertRejectedAndStillEmbedded(fixtureName: String, expectedException: Class<out Exception>) {
        manager.setBundlePath(stage(fixtureName))
        assertThrows(expectedException) { manager.activateBundle() }

        assertEquals(RuntimeState.EMBEDDED, manager.getRuntimeInfo().state)
        assertNull(manager.getActiveVersion())
    }

    // ---- N1: invalid SHA-256 (manifest.sha256 doesn't match the real bundle bytes) -----------
    @Test
    fun n1_invalidSha256IsRejected() {
        assertRejectedAndStillEmbedded("invalid-sha", BundleVerificationException::class.java)
    }

    // ---- N2: corrupt bundle bytes (manifest kept from the real package, bytes flipped after) --
    @Test
    fun n2_corruptBundleBytesAreRejected() {
        assertRejectedAndStillEmbedded("corrupt-bundle", BundleVerificationException::class.java)
    }

    // ---- N3: runtime version incompatible with this app binary -------------------------------
    @Test
    fun n3_incompatibleRuntimeVersionIsRejected() {
        assertRejectedAndStillEmbedded("wrong-runtime-version", UnsupportedRuntimeVersionException::class.java)
    }

    // ---- N4: platform mismatch (an iOS-tagged manifest fed to the Android runtime) -----------
    @Test
    fun n4_platformMismatchIsRejected() {
        assertRejectedAndStillEmbedded("wrong-platform", BundleVerificationException::class.java)
    }

    // ---- N5: invalid manifest (required fields missing) --------------------------------------
    @Test
    fun n5_invalidManifestIsRejected() {
        assertRejectedAndStillEmbedded("invalid-manifest", BundleManifestParseException::class.java)
    }

    // ---- N5b: missing manifest entirely -------------------------------------------------------
    @Test
    fun n5b_missingManifestIsRejected() {
        assertRejectedAndStillEmbedded("missing-manifest", BundleVerificationException::class.java)
    }

    // ---- N6: missing bundle file (manifest + assets present, bundle/ absent) -----------------
    @Test
    fun n6_missingBundleFileIsRejected() {
        assertRejectedAndStillEmbedded("missing-bundle", BundleVerificationException::class.java)
    }

    // ---- N7: missing assets directory ---------------------------------------------------------
    @Test
    fun n7_missingAssetsDirectoryIsRejected() {
        assertRejectedAndStillEmbedded("missing-assets", BundleVerificationException::class.java)
    }

    // ---- N8: a candidate path that isn't even a directory (e.g. a corrupt/failed extraction) --
    @Test
    fun n8_nonDirectoryCandidatePathIsRejected() {
        val bogusFile = File(stagingDir, "not-a-directory.txt")
        bogusFile.parentFile?.mkdirs()
        bogusFile.writeText("this is not an extracted package")

        assertThrows(com.openota.runtime.BundleVerificationException::class.java) {
            manager.setBundlePath(bogusFile.path)
        }
    }
}
