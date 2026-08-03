package com.openota.runtime

import java.lang.ref.WeakReference

import com.facebook.react.bridge.ReactApplicationContext

/**
 * [OpenOTAFirebaseMessagingService] is instantiated by Android outside React Native's own
 * lifecycle (a plain manifest-declared Service, not a NativeModule) — it has no
 * ReactApplicationContext of its own to emit JS events through. [OpenOTAModule.initialize] stashes
 * the current one here whenever RN itself starts up; a WeakReference so this never keeps a context
 * alive past its real lifecycle. If a push arrives before RN has ever initialized (app fully
 * killed, cold FCM delivery), [current] is null and the token-refresh event is simply skipped —
 * acceptable, since `OTA.registerPush()` re-reads the current token on every app launch anyway.
 */
object OpenOTAReactContextHolder {
    @Volatile
    private var ref: WeakReference<ReactApplicationContext>? = null

    var current: ReactApplicationContext?
        get() = ref?.get()
        set(value) {
            ref = value?.let { WeakReference(it) }
        }
}
