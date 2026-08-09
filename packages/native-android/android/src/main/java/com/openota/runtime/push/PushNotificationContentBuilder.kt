package com.openota.runtime.push

/** What actually gets shown in the Android notification tray. */
data class PushNotificationContent(val title: String, val body: String)

/**
 * Pure Kotlin, no Android framework types — same convention as the rest of this module ("don't
 * unit-test the real FirebaseMessagingService callback, extract the logic and test that", see
 * OpenOTAReactHostTest.kt / ActiveBundleLoaderResolver). Server sends title/body in the data
 * payload when the operator has set custom text (app_configs.push_title/push_body); falls back to
 * a sensible default here when it hasn't, so a push is never shown with blank/missing content.
 */
object PushNotificationContentBuilder {
    private const val DEFAULT_TITLE = "App update available"
    private const val DEFAULT_BODY = "A new version is ready. Open the app to update."

    fun fromDataPayload(data: Map<String, String>): PushNotificationContent {
        val title = data["title"]?.takeIf { it.isNotBlank() } ?: DEFAULT_TITLE
        val body = data["body"]?.takeIf { it.isNotBlank() } ?: DEFAULT_BODY
        return PushNotificationContent(title, body)
    }
}
