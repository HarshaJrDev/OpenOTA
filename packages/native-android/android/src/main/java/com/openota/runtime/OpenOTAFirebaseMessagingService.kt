package com.openota.runtime

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

private const val CHANNEL_ID = "openota-updates"
private const val NOTIFICATION_ID = 1
private const val TOKEN_REFRESH_EVENT = "OpenOTA:pushTokenRefreshed"

/**
 * Never relies on FCM's own auto-displayed "notification" payload — the server only ever sends a
 * data-only message (see apps/server's modules/push/fcm.ts doc comment) specifically so this class
 * is what builds and shows the actual notification, which is the only way to get custom
 * title/body *and* have it fire when the app is fully killed (a notification-payload message is
 * auto-displayed by the OS with no app code running at all in that state).
 */
class OpenOTAFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        runCatching { emitTokenRefresh(token) }
            .onFailure { OpenOTALogger.e("onNewToken emit failed", it) }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        runCatching { showNotification(PushNotificationContentBuilder.fromDataPayload(message.data)) }
            .onFailure { OpenOTALogger.e("onMessageReceived failed", it) }
    }

    private fun emitTokenRefresh(token: String) {
        val reactContext = OpenOTAReactContextHolder.current ?: return
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(TOKEN_REFRESH_EVENT, token)
    }

    private fun showNotification(content: PushNotificationContent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            // Never crash over a missing permission — the release itself already landed via the
            // normal check/download path; the notification is a convenience, not a requirement.
            OpenOTALogger.w("POST_NOTIFICATIONS not granted — skipping push notification display")
            return
        }

        ensureNotificationChannel()

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(content.title)
            .setContentText(content.body)
            .setSmallIcon(applicationInfo.icon)
            .setAutoCancel(true)
            .apply { if (pendingIntent != null) setContentIntent(pendingIntent) }
            .build()

        NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification)
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) {
            return
        }
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "App updates", NotificationManager.IMPORTANCE_DEFAULT),
        )
    }
}
