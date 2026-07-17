package com.openota.e2e

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * Copies a fixture package directory (produced by `pnpm fixtures:generate` from a REAL
 * `openota build`/`openota release` + real server round trip — see
 * `apps/e2e/scripts/generate-fixtures.ts`) out of the test APK's assets and into a real
 * filesystem directory the native runtime can operate on. Android's AssetManager exposes assets
 * read-only and doesn't support directory listing, so this walks the known fixture file list
 * rather than a generic recursive copy.
 */
object FixtureAssets {
    private val KNOWN_FILES = listOf(
        "manifest.json",
        "metadata.json",
        "bundle/index.android.bundle",
        "assets/logo.png",
    )

    fun copyFixture(context: Context, fixtureName: String, destDir: File): File {
        destDir.deleteRecursively()
        destDir.mkdirs()

        for (relativePath in KNOWN_FILES) {
            val assetPath = "fixtures/$fixtureName/$relativePath"

            val exists = try {
                context.assets.open(assetPath).use { true }
            } catch (_: Exception) {
                false
            }
            if (!exists) continue

            val outFile = File(destDir, relativePath)
            outFile.parentFile?.mkdirs()
            context.assets.open(assetPath).use { input ->
                outFile.outputStream().use { output -> input.copyTo(output) }
            }
        }

        return destDir
    }

    /** The real manifest/server values captured by the fixture generator — see `expected.json`. */
    fun expected(context: Context): ExpectedFixtureValues {
        val json = context.assets.open("fixtures/expected.json").use { it.readBytes().toString(Charsets.UTF_8) }
        val obj = JSONObject(json)
        return ExpectedFixtureValues(
            appVersion = obj.getString("appVersion"),
            runtimeVersion = obj.getString("runtimeVersion"),
            updateVersion = obj.getString("updateVersion"),
            manifestVersion = obj.getInt("manifestVersion"),
            bundleName = obj.getString("bundleName"),
            sha256 = obj.getString("sha256"),
        )
    }
}

data class ExpectedFixtureValues(
    val appVersion: String,
    val runtimeVersion: String,
    val updateVersion: String,
    val manifestVersion: Int,
    val bundleName: String,
    val sha256: String,
)
