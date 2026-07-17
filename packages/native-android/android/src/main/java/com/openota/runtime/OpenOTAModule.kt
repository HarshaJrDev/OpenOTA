package com.openota.runtime

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.turbomodule.core.interfaces.TurboModule

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
