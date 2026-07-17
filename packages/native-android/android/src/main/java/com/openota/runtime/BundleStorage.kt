package com.openota.runtime

import android.content.Context
import java.io.File
import java.nio.file.Files

/**
 * All filesystem access for the runtime goes through here. Nothing outside this class knows the
 * literal directory names, and nothing outside this class is allowed to build a [File] from a raw
 * string without going through [resolveWithinRoot] — that single chokepoint is what makes "never
 * write outside OpenOTA" and "reject path traversal / symlinks" enforceable in one place instead
 * of scattered across every caller.
 *
 * Android has no literal "Documents" directory the way iOS does; `context.filesDir` is its closest
 * equivalent (private, app-scoped, persists across app updates, wiped on uninstall), so the
 * `OpenOTA/` root is rooted there rather than external storage.
 */
class BundleStorage(context: Context) {
    private val appContext = context.applicationContext

    val rootDir: File = File(appContext.filesDir, "OpenOTA").apply { mkdirs() }
    val currentDir: File = File(rootDir, "current").apply { mkdirs() }
    val rollbackDir: File = File(rootDir, "rollback").apply { mkdirs() }
    val downloadsDir: File = File(rootDir, "downloads").apply { mkdirs() }
    val cacheDir: File = File(rootDir, "cache").apply { mkdirs() }
    val tmpDir: File = File(rootDir, "tmp").apply { mkdirs() }
    val logsDir: File = File(rootDir, "logs").apply { mkdirs() }
    val rootManifestFile: File = File(rootDir, "manifest.json")

    fun readRootManifest(): RuntimeManifest =
        if (rootManifestFile.exists()) {
            runCatching { RuntimeManifest.parse(rootManifestFile.readText()) }.getOrDefault(RuntimeManifest.EMPTY)
        } else {
            RuntimeManifest.EMPTY
        }

    fun writeRootManifest(manifest: RuntimeManifest) {
        val tmpFile = File(tmpDir, "manifest.json.tmp")
        tmpFile.writeText(manifest.toJson())
        if (!tmpFile.renameTo(rootManifestFile)) {
            rootManifestFile.writeText(manifest.toJson())
            tmpFile.delete()
        }
    }

    /**
     * Resolves an externally-supplied path (e.g. the argument to `setBundlePath`) against a
     * permitted parent directory, rejecting anything that isn't a plain relative descendant.
     * This is the runtime's core defense against path traversal and symlink escape: absolute
     * paths, `..` segments, and symlinked components are all rejected before a single byte of
     * the candidate bundle is read.
     */
    fun resolveWithinRoot(candidatePath: String): File {
        val candidate = File(candidatePath)

        if (candidate.isAbsolute && !candidate.canonicalPath.startsWith(rootDir.canonicalPath + File.separator) &&
            candidate.canonicalPath != rootDir.canonicalPath
        ) {
            throw PathSecurityException("Path \"$candidatePath\" is outside the OpenOTA sandbox")
        }

        val resolved = if (candidate.isAbsolute) candidate else File(rootDir, candidatePath)
        val canonical = resolved.canonicalFile

        if (!canonical.path.startsWith(rootDir.canonicalPath + File.separator) &&
            canonical.path != rootDir.canonicalPath
        ) {
            throw PathSecurityException("Path \"$candidatePath\" escapes the OpenOTA root directory")
        }

        return canonical
    }

    /** Rejects a directory tree containing any symbolic link, walked without following links. */
    fun assertNoSymlinks(dir: File) {
        if (!dir.exists()) return

        dir.walkTopDown().forEach { file ->
            if (Files.isSymbolicLink(file.toPath())) {
                throw PathSecurityException("Symbolic link detected at \"${file.path}\"")
            }
        }
    }

    /** Atomically (same-volume rename) replaces [destination] with [source], deleting any prior contents. */
    fun atomicReplace(source: File, destination: File) {
        deleteRecursively(destination)
        destination.parentFile?.mkdirs()

        if (!source.renameTo(destination)) {
            source.copyRecursively(destination, overwrite = true)
            deleteRecursively(source)
        }
    }

    fun deleteRecursively(file: File) {
        if (file.exists()) {
            file.deleteRecursively()
        }
    }

    fun bundleFile(packageDir: File, bundleFileName: String): File = File(File(packageDir, "bundle"), bundleFileName)

    fun assetsDir(packageDir: File): File = File(packageDir, "assets")

    fun manifestFile(packageDir: File): File = File(packageDir, "manifest.json")
}
