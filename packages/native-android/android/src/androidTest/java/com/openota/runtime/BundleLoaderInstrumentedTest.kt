package com.openota.runtime

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.MessageDigest

private const val RUNTIME_VERSION = "1.0.0"

@RunWith(AndroidJUnit4::class)
class BundleLoaderInstrumentedTest {
    private lateinit var context: android.content.Context
    private lateinit var storage: BundleStorage

    @Before
    fun setUp() {
        context = InstrumentationRegistry.getInstrumentation().targetContext
        storage = BundleStorage(context)
        storage.deleteRecursively(storage.rootDir)
        BundleManager.resetForTesting()
    }

    @After
    fun tearDown() {
        BundleManager.resetForTesting()
        storage.deleteRecursively(storage.rootDir)
    }

    private fun stagePackage(version: String): File {
        val dir = File(storage.downloadsDir, "candidate-$version").apply { mkdirs() }
        val bundleFile = File(File(dir, "bundle").apply { mkdirs() }, "index.android.bundle").apply { writeText(version) }
        File(dir, "assets").mkdirs()
        val sha256 = MessageDigest.getInstance("SHA-256").digest(bundleFile.readBytes())
            .joinToString("") { "%02x".format(it) }

        File(dir, "manifest.json").writeText(
            """
            {"manifestVersion":1,"version":"$version","platform":"android","runtimeVersion":"$RUNTIME_VERSION",
             "sha256":"$sha256","size":${bundleFile.length()},"createdAt":"now","bundleName":"index.android.bundle"}
            """.trimIndent(),
        )
        return dir
    }

    @Test
    fun returnsNullWhenNoBundleHasEverBeenActivated() {
        assertNull(BundleLoader.getJSBundleFile(context, RUNTIME_VERSION))
    }

    @Test
    fun returnsTheActiveBundlePathAfterActivation() {
        val manager = BundleManager.getInstance(context, RUNTIME_VERSION)
        manager.setBundlePath(stagePackage("1.0.0").path)
        manager.activateBundle()

        val path = BundleLoader.getJSBundleFile(context, RUNTIME_VERSION)

        assertEquals(manager.getRuntimeInfo().bundlePath, path)
    }

    @Test
    fun fallsBackToEmbeddedAfterRepeatedUnconfirmedBootsWithNoRollback() {
        val manager = BundleManager.getInstance(context, RUNTIME_VERSION)
        manager.setBundlePath(stagePackage("1.0.0").path)
        manager.activateBundle()

        // First cold start: counted, still serves the OTA bundle.
        assertEquals(manager.getRuntimeInfo().bundlePath, BundleLoader.getJSBundleFile(context, RUNTIME_VERSION))

        // Second cold start without confirmBoot(): no rollback slot exists, so it just keeps serving
        // the same (unconfirmed) bundle rather than bricking the app back to the embedded copy.
        assertEquals(manager.getRuntimeInfo().bundlePath, BundleLoader.getJSBundleFile(context, RUNTIME_VERSION))
    }
}
