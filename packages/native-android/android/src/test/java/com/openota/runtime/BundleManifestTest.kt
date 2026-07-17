package com.openota.runtime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BundleManifestTest {

    private val validJson = """
        {
          "manifestVersion": 1,
          "version": "1.2.0",
          "platform": "android",
          "runtimeVersion": "1.0.0",
          "sha256": "${"a".repeat(64)}",
          "size": 12345,
          "createdAt": "2026-01-01T00:00:00.000Z",
          "bundleName": "index.android.bundle"
        }
    """.trimIndent()

    @Test
    fun `parses a well-formed v1 manifest`() {
        val manifest = BundleManifest.parse(validJson)

        assertEquals(1, manifest.manifestVersion)
        assertEquals("1.2.0", manifest.version)
        assertEquals("android", manifest.platform)
        assertEquals("1.0.0", manifest.runtimeVersion)
        assertEquals(12345L, manifest.size)
    }

    @Test
    fun `defaults manifestVersion to 1 when absent`() {
        val json = """{"version":"1.0.0","platform":"android","runtimeVersion":"1.0.0",
            "sha256":"${"a".repeat(64)}","size":1,"createdAt":"now"}"""

        assertEquals(1, BundleManifest.parse(json).manifestVersion)
    }

    @Test
    fun `rejects an unsupported manifest version`() {
        val json = """{"manifestVersion":99,"version":"1.0.0","platform":"android",
            "runtimeVersion":"1.0.0","sha256":"${"a".repeat(64)}","size":1,"createdAt":"now"}"""

        assertThrows(UnsupportedManifestVersionException::class.java) {
            BundleManifest.parse(json)
        }
    }

    @Test
    fun `rejects malformed JSON`() {
        assertThrows(BundleManifestParseException::class.java) {
            BundleManifest.parse("not json")
        }
    }

    @Test
    fun `rejects a manifest missing a required field`() {
        val json = """{"version":"1.0.0","platform":"android","runtimeVersion":"1.0.0"}"""

        assertThrows(BundleManifestParseException::class.java) {
            BundleManifest.parse(json)
        }
    }

    @Test
    fun `falls back to the default android bundle name when absent`() {
        val json = """{"version":"1.0.0","platform":"android","runtimeVersion":"1.0.0",
            "sha256":"${"a".repeat(64)}","size":1,"createdAt":"now"}"""

        assertEquals("index.android.bundle", BundleManifest.parse(json).bundleName)
    }
}
