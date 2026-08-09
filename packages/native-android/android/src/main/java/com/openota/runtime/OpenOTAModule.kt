package com.openota.runtime

import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import com.google.firebase.messaging.FirebaseMessaging
import com.openota.runtime.push.ReactContextHolder

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
        runCatching { manager.confirmBoot() }
            .onFailure { OpenOTALogger.e("confirmBoot() failed", it) }
        // Android instantiates OpenOTAFirebaseMessagingService entirely outside RN's lifecycle —
        // this is the one point where a real ReactApplicationContext is available to hand it, via
        // the small companion-object holder (see push/OpenOTAFirebaseMessagingService.kt).
        ReactContextHolder.attach(reactApplicationContext)
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

    /** Thin wrapper — resolves null (never rejects) if Firebase isn't configured for this app (no google-services.json). */
    @ReactMethod
    fun getFcmToken(promise: Promise) {
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { promise.resolve(it) }
            .addOnFailureListener {
                OpenOTALogger.e("getFcmToken() failed — Firebase likely not configured for this app", it)
                promise.resolve(null)
            }
    }

    /**
     * No-ops (resolves immediately) on API < 33, where POST_NOTIFICATIONS doesn't exist as a
     * runtime permission — push delivery itself still works there, only the tray notification is
     * gated. Requesting requires the current Activity; if none is attached (e.g. called before any
     * screen mounted), resolves without requesting rather than crashing.
     */
    @ReactMethod
    fun registerForPushNotifications(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            promise.resolve(null)
            return
        }
        val activity = reactApplicationContext.currentActivity
        val permission = android.Manifest.permission.POST_NOTIFICATIONS
        if (activity == null || ContextCompat.checkSelfPermission(reactApplicationContext, permission) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            promise.resolve(null)
            return
        }
        androidx.core.app.ActivityCompat.requestPermissions(activity, arrayOf(permission), 0)
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
    }
}
