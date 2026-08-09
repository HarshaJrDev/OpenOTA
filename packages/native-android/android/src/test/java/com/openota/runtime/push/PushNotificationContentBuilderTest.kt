package com.openota.runtime.push

import org.junit.Assert.assertEquals
import org.junit.Test

class PushNotificationContentBuilderTest {

    @Test
    fun `uses the real title and body when the server sent both`() {
        val content = PushNotificationContentBuilder.fromDataPayload(
            mapOf("title" to "New update!", "body" to "Tap to see what's new."),
        )
        assertEquals("New update!", content.title)
        assertEquals("Tap to see what's new.", content.body)
    }

    @Test
    fun `falls back to defaults when the payload has neither key`() {
        val content = PushNotificationContentBuilder.fromDataPayload(mapOf("type" to "openota-release-changed"))
        assertEquals("App update available", content.title)
        assertEquals("A new version is ready. Open the app to update.", content.body)
    }

    @Test
    fun `falls back to defaults when title or body is present but blank`() {
        val content = PushNotificationContentBuilder.fromDataPayload(mapOf("title" to "", "body" to "   "))
        assertEquals("App update available", content.title)
        assertEquals("A new version is ready. Open the app to update.", content.body)
    }

    @Test
    fun `passes through one real value while the other falls back`() {
        val content = PushNotificationContentBuilder.fromDataPayload(mapOf("title" to "Custom title only"))
        assertEquals("Custom title only", content.title)
        assertEquals("A new version is ready. Open the app to update.", content.body)
    }
}
