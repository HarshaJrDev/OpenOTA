package com.openota.runtime

import org.json.JSONObject

/** Manifest schema versions the runtime knows how to parse. Never assume the latest is the only one. */
const val SUPPORTED_MANIFEST_VERSION_V1 = 1
private val SUPPORTED_MANIFEST_VERSIONS = setOf(SUPPORTED_MANIFEST_VERSION_V1)

/**
 * The manifest shipped inside every OTA package (`manifest.json`, produced by the CLI/server).
 * `runtimeVersion` and `manifestVersion` are the two forward-compatibility hinges: a future
 * breaking bundle format bumps `manifestVersion` and gets its own parser branch below, while
 * `runtimeVersion` lets a single server serve multiple native binary generations safely.
 */
data class BundleManifest(
    val manifestVersion: Int,
    val version: String,
    val platform: String,
    val runtimeVersion: String,
    val sha256: String,
    val size: Long,
    val createdAt: String,
    val bundleName: String,
) {
    companion object {
        fun parse(json: String): BundleManifest {
            val obj = try {
                JSONObject(json)
            } catch (error: Exception) {
                throw BundleManifestParseException("Manifest is not valid JSON", error)
            }

            val manifestVersion = obj.optInt("manifestVersion", SUPPORTED_MANIFEST_VERSION_V1)
            if (manifestVersion !in SUPPORTED_MANIFEST_VERSIONS) {
                throw UnsupportedManifestVersionException(manifestVersion, SUPPORTED_MANIFEST_VERSIONS)
            }

            return when (manifestVersion) {
                SUPPORTED_MANIFEST_VERSION_V1 -> parseV1(obj)
                else -> throw UnsupportedManifestVersionException(manifestVersion, SUPPORTED_MANIFEST_VERSIONS)
            }
        }

        private fun parseV1(obj: JSONObject): BundleManifest {
            fun requireString(key: String): String =
                obj.optString(key, "").ifEmpty { throw BundleManifestParseException("Missing field \"$key\"") }

            if (!obj.has("size")) {
                throw BundleManifestParseException("Missing field \"size\"")
            }

            return BundleManifest(
                manifestVersion = SUPPORTED_MANIFEST_VERSION_V1,
                version = requireString("version"),
                platform = requireString("platform"),
                runtimeVersion = requireString("runtimeVersion"),
                sha256 = requireString("sha256"),
                size = obj.getLong("size"),
                createdAt = requireString("createdAt"),
                bundleName = obj.optString("bundleName", "index.android.bundle"),
            )
        }
    }
}

/**
 * The runtime's own root-level state file (`OpenOTA/manifest.json`), distinct from the per-package
 * manifest above. This is what survives a cold start and tells [BundleLoader] what to serve, and
 * what tells [BundleManager] whether the last activation was ever confirmed booted.
 */
data class RuntimeManifest(
    val activeVersion: String?,
    val activeBundlePath: String?,
    val runtimeVersion: String?,
    val manifestVersion: Int?,
    val installTimeMillis: Long?,
    val state: RuntimeState,
    val bootConfirmed: Boolean,
    val bootAttempts: Int,
) {
    fun toJson(): String = JSONObject().apply {
        put("activeVersion", activeVersion ?: JSONObject.NULL)
        put("activeBundlePath", activeBundlePath ?: JSONObject.NULL)
        put("runtimeVersion", runtimeVersion ?: JSONObject.NULL)
        put("manifestVersion", manifestVersion ?: JSONObject.NULL)
        put("installTimeMillis", installTimeMillis ?: JSONObject.NULL)
        put("state", state.name)
        put("bootConfirmed", bootConfirmed)
        put("bootAttempts", bootAttempts)
    }.toString()

    companion object {
        val EMPTY = RuntimeManifest(
            activeVersion = null,
            activeBundlePath = null,
            runtimeVersion = null,
            manifestVersion = null,
            installTimeMillis = null,
            state = RuntimeState.EMBEDDED,
            bootConfirmed = true,
            bootAttempts = 0,
        )

        private fun optNullableString(obj: JSONObject, key: String): String? =
            if (obj.isNull(key)) null else obj.optString(key)

        fun parse(json: String): RuntimeManifest {
            val obj = JSONObject(json)
            return RuntimeManifest(
                activeVersion = optNullableString(obj, "activeVersion"),
                activeBundlePath = optNullableString(obj, "activeBundlePath"),
                runtimeVersion = optNullableString(obj, "runtimeVersion"),
                manifestVersion = if (obj.isNull("manifestVersion")) null else obj.optInt("manifestVersion"),
                installTimeMillis = if (obj.isNull("installTimeMillis")) null else obj.optLong("installTimeMillis"),
                state = runCatching { RuntimeState.valueOf(obj.getString("state")) }.getOrDefault(RuntimeState.EMBEDDED),
                bootConfirmed = obj.optBoolean("bootConfirmed", true),
                bootAttempts = obj.optInt("bootAttempts", 0),
            )
        }
    }
}
