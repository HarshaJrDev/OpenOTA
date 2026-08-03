package com.openota.runtime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PushNotificationContentBuilderTest {

    @Test
    fun `uses the server-provided title and body when present`() {
        val content = PushNotificationContentBuilder.fromDataPayload(
            mapOf("type" to "release-changed", "title" to "Custom title", "body" to "Custom body"),
        )

        assertEquals("Custom title", content.title)
        assertEquals("Custom body", content.body)
        assertEquals("release-changed", content.type)
    }

    @Test
    fun `falls back to default title and body when the payload has neither`() {
        val content = PushNotificationContentBuilder.fromDataPayload(emptyMap())

        assertEquals("App update available", content.title)
        assertEquals("A new version is ready.", content.body)
        assertNull(content.type)
    }

    @Test
    fun `falls back to defaults when title or body is blank, not just absent`() {
        val content = PushNotificationContentBuilder.fromDataPayload(mapOf("title" to "", "body" to "   "))

        assertEquals("App update available", content.title)
        assertEquals("A new version is ready.", content.body)
    }

    @Test
    fun `title and body fall back independently`() {
        val content = PushNotificationContentBuilder.fromDataPayload(mapOf("title" to "Only title set"))

        assertEquals("Only title set", content.title)
        assertEquals("A new version is ready.", content.body)
    }
}
