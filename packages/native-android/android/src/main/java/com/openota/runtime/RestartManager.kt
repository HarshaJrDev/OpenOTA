package com.openota.runtime

import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactApplicationContext

class RestartFailedException(message: String, cause: Throwable? = null) :
    OpenOTAException("RESTART_FAILED", message, cause)

/**
 * Reloads the JS bundle through React Native's own supported reload path — never `Process.kill`,
 * never `Activity.recreate()`. Killing the process would lose in-flight native state (and on some
 * OEM launchers gets treated as a crash, hurting vitals); recreating the Activity manually fights
 * the framework's own lifecycle and Fabric surface management. `ReactHost.reload` (bridgeless /
 * New Architecture) and `ReactInstanceManager.recreateReactContextInBackground` (bridge) are the
 * two paths React Native itself uses for Fast Refresh and dev-menu "Reload", so leaning on them
 * guarantees this stays correct as the framework's internals change underneath us.
 */
object RestartManager {

    fun restart(reactContext: ReactApplicationContext) {
        val application = reactContext.applicationContext as? ReactApplication
            ?: throw RestartFailedException("Application does not implement ReactApplication")

        val reactHost = application.reactHost
        if (reactHost != null) {
            reactHost.reload("OpenOTA bundle activation")
            return
        }

        val legacyHost = legacyReactInstanceManagerOrNull(application)
            ?: throw RestartFailedException("No ReactHost or legacy ReactInstanceManager is available")

        legacyHost.recreateReactContextInBackground()
    }

    @Suppress("DEPRECATION")
    private fun legacyReactInstanceManagerOrNull(application: ReactApplication) =
        runCatching { application.reactNativeHost.reactInstanceManager }.getOrNull()
}
