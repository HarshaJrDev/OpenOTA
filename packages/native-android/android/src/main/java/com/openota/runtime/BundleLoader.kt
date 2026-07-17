package com.openota.runtime

import android.content.Context
import java.io.File

/**
 * The single call site a host app's `ReactNativeHost`/`ReactHost` override needs:
 *
 * ```kotlin
 * override fun getJSBundleFile(): String? = BundleLoader.getJSBundleFile(applicationContext)
 * ```
 *
 * This must be extremely fast and must never re-run cryptographic verification — that already
 * happened once at `activateBundle()` time. Its only two jobs are (1) decide embedded vs. OTA
 * bundle, and (2) run the crash-loop heuristic described in [BundleManager.recordBootAttempt]
 * *before* handing back a path, so a bundle that never got a chance to boot cleanly twice in a row
 * is rolled back before a third attempt is made.
 *
 * Returning `null` tells React Native to fall back to the bundle packaged in the APK's assets,
 * which is what makes `Embedded` a real, always-available state rather than a name in an enum.
 */
object BundleLoader {

    fun getJSBundleFile(context: Context, runtimeVersion: String? = null): String? {
        val manager = BundleManager.getInstance(context, runtimeVersion)
        val manifest = manager.recordBootAttempt()

        if (manifest.state != RuntimeState.ACTIVATED) {
            return null
        }

        val bundlePath = manifest.activeBundlePath ?: return null
        val bundleFile = File(bundlePath)

        if (!bundleFile.exists() || !bundleFile.isFile) {
            OpenOTALogger.w("Active bundle path missing on disk (\"$bundlePath\"); falling back to embedded bundle")
            return null
        }

        return bundleFile.path
    }
}
