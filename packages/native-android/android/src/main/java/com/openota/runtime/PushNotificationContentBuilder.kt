package com.openota.runtime

data class PushNotificationContent(val title: String, val body: String, val type: String?)

/**
 * Extracted from [OpenOTAFirebaseMessagingService.onMessageReceived] so the actual content logic
 * can be unit-tested on the plain JVM — see PushNotificationContentBuilderTest.kt and
 * OpenOTAReactHostTest.kt's own doc comment for why this codebase prefers testing extracted pure
 * logic over the real framework callback. Falls back to sensible defaults when the server sent no
 * title/body (push configured but the operator never set custom text on the Apps page) — the
 * server already applies its own defaults too (see apps/server's modules/live/registry.ts), so
 * these are a second, independent safety net, not the primary source of the default copy.
 */
object PushNotificationContentBuilder {
    private const val DEFAULT_TITLE = "App update available"
    private const val DEFAULT_BODY = "A new version is ready."

    fun fromDataPayload(data: Map<String, String>): PushNotificationContent =
        PushNotificationContent(
            title = data["title"]?.takeIf { it.isNotBlank() } ?: DEFAULT_TITLE,
            body = data["body"]?.takeIf { it.isNotBlank() } ?: DEFAULT_BODY,
            type = data["type"],
        )
}
