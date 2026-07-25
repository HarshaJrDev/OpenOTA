package com.openota.runtime

import android.content.Context
import android.content.res.AssetManager
import com.facebook.react.bridge.JSBundleLoaderDelegate
import java.io.File
import java.security.MessageDigest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`

private const val RUNTIME_VERSION = "1.0.0"

/** Records which `loadScriptFrom*` call the resolved loader actually made, without Mockito. */
private class RecordingBundleLoaderDelegate : JSBundleLoaderDelegate {
    var loadedFilePath: String? = null
    var loadedAssetUrl: String? = null

    override fun loadScriptFromAssets(assetManager: AssetManager, assetURL: String, loadSynchronously: Boolean) {
        loadedAssetUrl = assetURL
    }

    override fun loadScriptFromFile(fileName: String, sourceURL: String, loadSynchronously: Boolean) {
        loadedFilePath = fileName
    }

    override fun loadSplitBundleFromFile(fileName: String, sourceURL: String) {
        error("not used by these tests")
    }

    override fun setSourceURLs(deviceURL: String, remoteURL: String) {
        // no-op
    }
}

/**
 * Regression coverage for the stale-reload bug: `getDefaultReactHost`'s bundle loader is captured
 * once at `ReactHost` construction, so `ReactHost.reload()` after an OTA activation kept replaying
 * whatever bundle was active at cold start. [ActiveBundleLoaderResolver.resolve] (the logic behind
 * [DynamicBundleReactHostDelegate.jsBundleLoader]) must instead be resolved fresh on *every* call,
 * so that a single long-lived `ReactHost` correctly serves: embedded -> OTA A -> OTA B -> rollback
 * to OTA A. Exercised here directly (rather than through the full delegate/ReactHostImpl) because
 * the delegate's other required fields (e.g. `JSRuntimeFactory`) trigger native library loads that
 * no plain-JVM test can satisfy.
 */
class OpenOTAReactHostTest {

    @get:Rule val tmp = TemporaryFolder()

    private lateinit var context: Context
    private lateinit var storage: BundleStorage

    @Before
    fun setUp() {
        val filesDir = tmp.newFolder("files")
        context = mock(Context::class.java)
        `when`(context.applicationContext).thenReturn(context)
        `when`(context.filesDir).thenReturn(filesDir)
        `when`(context.assets).thenReturn(mock(AssetManager::class.java))

        storage = BundleStorage(context)
        BundleManager.resetForTesting()
    }

    @After
    fun tearDown() {
        BundleManager.resetForTesting()
    }

    private fun resolvedFilePath(): String? {
        val recorder = RecordingBundleLoaderDelegate()
        ActiveBundleLoaderResolver.resolve(context, RUNTIME_VERSION, "index.android.bundle").loadScript(recorder)
        return recorder.loadedFilePath
    }

    private fun resolvedAssetUrl(): String? {
        val recorder = RecordingBundleLoaderDelegate()
        ActiveBundleLoaderResolver.resolve(context, RUNTIME_VERSION, "index.android.bundle").loadScript(recorder)
        return recorder.loadedAssetUrl
    }

    /** Stages and activates a fake OTA bundle directly through BundleManager, as a real sync would. */
    private fun activate(version: String): String {
        val manager = BundleManager.getInstance(context, RUNTIME_VERSION)
        val candidateDir = File(storage.downloadsDir, version).apply { mkdirs() }
        val bytes = "console.log('$version')".toByteArray()
        val sha256 = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

        File(File(candidateDir, "bundle"), "index.android.bundle").apply { parentFile?.mkdirs() }.writeBytes(bytes)
        File(candidateDir, "manifest.json").writeText(
            """
            {"manifestVersion":1,"version":"$version","platform":"android","runtimeVersion":"$RUNTIME_VERSION",
             "sha256":"$sha256","size":${bytes.size},"createdAt":"now","bundleName":"index.android.bundle"}
            """.trimIndent(),
        )

        manager.setBundlePath(candidateDir.path)
        val info = manager.activateBundle()
        return info.bundlePath!!
    }

    @Test
    fun `cold start with no activation resolves the embedded asset bundle`() {
        assertEquals("assets://index.android.bundle", resolvedAssetUrl())
        assertEquals(null, resolvedFilePath())
    }

    @Test
    fun `same resolver call resolves the newly activated bundle without recreating the host`() {
        // Before any OTA activity, resolving points at the embedded bundle.
        assertEquals("assets://index.android.bundle", resolvedAssetUrl())

        val pathA = activate("1.0.1")

        // The exact same resolver, called again, must now resolve to the OTA bundle - proving
        // resolution isn't permanently captured the first time it's called.
        assertEquals(pathA, resolvedFilePath())
    }

    @Test
    fun `activating a second OTA bundle supersedes the first on repeated resolution`() {
        activate("1.0.1")
        val pathB = activate("1.0.2")

        assertEquals(pathB, resolvedFilePath())
    }

    @Test
    fun `rollback after two activations resolves back to the previous bundle`() {
        val pathA = activate("1.0.1")
        activate("1.0.2")

        val manager = BundleManager.getInstance(context, RUNTIME_VERSION)
        manager.rollbackBundle()

        assertEquals(pathA, resolvedFilePath())
    }
}
