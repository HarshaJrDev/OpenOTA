package com.openota.runtime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RuntimeManifestTest {

    @Test
    fun `round-trips through JSON`() {
        val original = RuntimeManifest(
            activeVersion = "1.2.0",
            activeBundlePath = "/data/data/app/files/OpenOTA/current/bundle/index.android.bundle",
            runtimeVersion = "1.0.0",
            manifestVersion = 1,
            installTimeMillis = 1_700_000_000_000L,
            state = RuntimeState.ACTIVATED,
            bootConfirmed = false,
            bootAttempts = 1,
        )

        val restored = RuntimeManifest.parse(original.toJson())

        assertEquals(original, restored)
    }

    @Test
    fun `EMPTY represents the embedded state with no active bundle`() {
        assertEquals(RuntimeState.EMBEDDED, RuntimeManifest.EMPTY.state)
        assertNull(RuntimeManifest.EMPTY.activeVersion)
        assertNull(RuntimeManifest.EMPTY.activeBundlePath)
    }

    @Test
    fun `falls back to EMBEDDED for an unrecognized state string`() {
        val json = """{"state":"NOT_A_REAL_STATE","bootConfirmed":true,"bootAttempts":0}"""
        assertEquals(RuntimeState.EMBEDDED, RuntimeManifest.parse(json).state)
    }
}
