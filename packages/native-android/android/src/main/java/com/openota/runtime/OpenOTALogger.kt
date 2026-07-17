package com.openota.runtime

import android.util.Log

/**
 * Thin structured-logging wrapper. Kept as a single object (not a class per call site) so timing
 * spans read as one coherent trace in `adb logcat` without needing a full observability SDK wired
 * in yet — [timed] is the extension point a future analytics/crash-reporting hook would wrap.
 */
object OpenOTALogger {
    private const val TAG = "OpenOTA"

    @Volatile
    var debugMode: Boolean = false

    fun d(message: String) {
        if (debugMode) Log.d(TAG, message)
    }

    fun i(message: String) {
        Log.i(TAG, message)
    }

    fun w(message: String, throwable: Throwable? = null) {
        Log.w(TAG, message, throwable)
    }

    fun e(message: String, throwable: Throwable? = null) {
        Log.e(TAG, message, throwable)
    }

    /** Runs [block], logging its wall-clock duration under [label]. Rethrows on failure. */
    inline fun <T> timed(label: String, block: () -> T): T {
        val startedAt = System.nanoTime()
        try {
            val result = block()
            logDuration(label, startedAt, success = true)
            return result
        } catch (error: Throwable) {
            logDuration(label, startedAt, success = false)
            throw error
        }
    }

    fun logDuration(label: String, startedAtNanos: Long, success: Boolean) {
        val durationMs = (System.nanoTime() - startedAtNanos) / 1_000_000
        val status = if (success) "ok" else "failed"
        i("[$label] $status in ${durationMs}ms")
    }
}
