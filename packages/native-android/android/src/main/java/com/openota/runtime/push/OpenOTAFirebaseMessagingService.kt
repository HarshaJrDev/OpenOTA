package com.openota.runtime.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.openota.runtime.OpenOTALogger
import java.lang.ref.WeakReference

/**
 * Android instantiates this service entirely outside RN's own lifecycle (no ReactApplicationContext
 * is handed to it), so [OpenOTAModule] stashes one here via [attachReactContext] as soon as it has
 * one (see its `initialize()`) — a small companion-object holder, not a new architectural pattern.
 * A [WeakReference] so this service never keeps a ReactApplicationContext alive past its own
 * lifecycle.
 */
object ReactContextHolder {
    @Volatile
    private var ref: WeakReference<ReactApplicationContext>? = null

    fun attach(context: ReactApplicationContext) {
        ref = WeakReference(context)
    }

    fun get(): ReactApplicationContext? = ref?.get()
}

private const val CHANNEL_ID = "openota_updates"
private const val NOTIFICATION_ID = 1001
const val TOKEN_REFRESH_EVENT = "OpenOTA:pushTokenRefreshed"

class OpenOTAFirebaseMessagingService : FirebaseMessagingService() {

    /**
     * New/rotated token — the SDK re-POSTs this to the server's fcm-token endpoint. Standard RN
     * event-emitter shape; this is a net-new event for this codebase (no prior precedent to
     * follow/break), matching how RN modules routinely surface async native events to JS.
     */
    override fun onNewToken(token: String) {
        val reactContext = ReactContextHolder.get() ?: return
        runCatching {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(TOKEN_REFRESH_EVENT, token)
        }.onFailure { OpenOTALogger.e("Failed to emit $TOKEN_REFRESH_EVENT", it) }
    }

    /**
     * Data-only message (see fcm.ts's doc comment on the server side for why) — this is the ONLY
     * code path that ever shows a notification. A `notification:`-payload message would be handled
     * by the OS tray directly when the app is killed, bypassing this method entirely; the server
     * deliberately never sends one, exactly so this always runs.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            // Not granted (or pre-Android 13, where the permission doesn't exist as a runtime
            // check) — the message was still received, an update check will still happen next
            // launch; we simply can't show a tray notification. No-op, not a crash.
            return
        }

        val content = PushNotificationContentBuilder.fromDataPayload(message.data)
        ensureChannel()

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, pendingIntentFlags)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(content.title)
            .setContentText(content.body)
            .setSmallIcon(applicationInfo.icon)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIFICATION_ID, notification)
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "App updates", NotificationManager.IMPORTANCE_DEFAULT),
        )
    }
}
