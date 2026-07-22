package com.openota.runtime

import android.content.Context
import java.io.File

/**
 * The single call site a host app's `ReactNativeHost`/`ReactHost` override needs:
 *
 * ```kotlin
 * private const val OPENOTA_RUNTIME_VERSION = "1.0"
 *
 * override fun getJSBundleFile(): String? =
 *     BundleLoader.getJSBundleFile(applicationContext, OPENOTA_RUNTIME_VERSION)
 * ```
 *
 * `runtimeVersion` is deliberately a required parameter, not defaulted from the APK's own
 * `versionName` — those are different concepts that happen to look similar (see the
 * `BundleManager` class doc). A silent default here is exactly what caused OTA bundles built
 * with an explicit `openota.config.json` `runtimeVersion` to be rejected by apps that never
 * passed one through and fell back to `versionName` instead: `BundleVerifier` correctly refuses
 * to activate a bundle whose `runtimeVersion` doesn't match, but the mismatch only exists because
 * the host app's value was never explicit in the first place. Pick one constant, put it in both
 * `MainApplication.kt` and `openota.config.json`, and this whole class of bug can't happen again.
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

    fun getJSBundleFile(context: Context, runtimeVersion: String): String? {
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
