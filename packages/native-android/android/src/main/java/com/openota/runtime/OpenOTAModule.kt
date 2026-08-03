package com.openota.runtime

import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import com.google.firebase.messaging.FirebaseMessaging

/**
 * The only surface JS ever touches. Every method here is a thin translation to [BundleManager] or
 * [RestartManager] plus exception-to-rejection mapping — no bundle lifecycle logic lives in this
 * class, so the TurboModule boundary can be re-generated, re-codegen'd, or reimplemented on
 * bridgeless without ever touching the actual runtime engine.
 */
class OpenOTAModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TurboModule {

    private val manager: BundleManager
        get() = BundleManager.getInstance(reactApplicationContext)

    override fun getName(): String = NAME

    override fun initialize() {
        super.initialize()
        OpenOTAReactContextHolder.current = reactApplicationContext
        runCatching { manager.confirmBoot() }
            .onFailure { OpenOTALogger.e("confirmBoot() failed", it) }
    }

    @ReactMethod
    fun setBundlePath(path: String, promise: Promise) {
        runCatching { manager.setBundlePath(path) }
            .onSuccess { promise.resolve(null) }
            .onFailure { promise.reject(errorCode(it), it.message, it) }
    }

    @ReactMethod
    fun getBundlePath(promise: Promise) {
        runCatching { manager.getBundlePath() }
            .onSuccess { promise.resolve(it) }
            .onFailure { promise.reject(errorCode(it), it.message, it) }
    }

    @ReactMethod
    fun activateBundle(promise: Promise) {
        runCatching { manager.activateBundle() }
            .onSuccess { promise.resolve(it.toWritableMap()) }
            .onFailure { promise.reject(errorCode(it), it.message, it) }
    }

    @ReactMethod
    fun rollback(promise: Promise) {
        runCatching { manager.rollbackBundle() }
            .onSuccess { promise.resolve(it.toWritableMap()) }
            .onFailure { promise.reject(errorCode(it), it.message, it) }
    }

    @ReactMethod
    fun restart(promise: Promise) {
        runCatching { RestartManager.restart(reactApplicationContext) }
            .onSuccess { promise.resolve(null) }
            .onFailure { promise.reject(errorCode(it), it.message, it) }
    }

    @ReactMethod
    fun clearBundle(promise: Promise) {
        runCatching { manager.clearBundle() }
            .onSuccess { promise.resolve(null) }
            .onFailure { promise.reject(errorCode(it), it.message, it) }
    }

    @ReactMethod
    fun getRuntimeInfo(promise: Promise) {
        runCatching { manager.getRuntimeInfo() }
            .onSuccess { promise.resolve(it.toWritableMap()) }
            .onFailure { promise.reject(errorCode(it), it.message, it) }
    }

    @ReactMethod
    fun getFcmToken(promise: Promise) {
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { promise.resolve(it) }
            .addOnFailureListener { promise.reject("PUSH_TOKEN_FAILED", it.message, it) }
    }

    /** No-op resolve(null) on API <33 — the runtime permission doesn't exist before Tiramisu, notifications just work. */
    @ReactMethod
    fun registerForPushNotifications(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            promise.resolve(null)
            return
        }

        val alreadyGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            android.Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED

        if (alreadyGranted) {
            promise.resolve(null)
            return
        }

        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            // Nothing we can do without a foreground Activity to request through — the app can
            // call this again once it has one; not an error condition worth rejecting over.
            promise.resolve(null)
            return
        }

        ActivityCompat.requestPermissions(activity, arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), POST_NOTIFICATIONS_REQUEST_CODE)
        promise.resolve(null)
    }

    private fun errorCode(error: Throwable): String = (error as? OpenOTAException)?.code ?: "INTERNAL_ERROR"

    private fun RuntimeInfo.toWritableMap(): WritableMap = Arguments.createMap().apply {
        putString("currentVersion", currentVersion)
        putString("bundleVersion", bundleVersion)
        putString("runtimeVersion", runtimeVersion)
        if (manifestVersion != null) putInt("manifestVersion", manifestVersion) else putNull("manifestVersion")
        putString("bundlePath", bundlePath)
        if (installTimeMillis != null) putDouble("installTime", installTimeMillis.toDouble()) else putNull("installTime")
        putString("platform", platform)
        putString("state", state.name)
    }

    companion object {
        const val NAME = "OpenOTA"
        // We never observe the permission-request result ourselves (no onRequestPermissionsResult
        // listener registered) — the caller just re-checks via getFcmToken()/registerForPushNotifications()
        // on next use, so this code only needs to be a value distinct enough not to collide with
        // some other library's request in the same Activity.
        private const val POST_NOTIFICATIONS_REQUEST_CODE = 4271
    }
}
