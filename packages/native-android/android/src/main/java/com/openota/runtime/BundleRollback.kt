package com.openota.runtime

import java.io.File

/**
 * Owns the single previous-generation snapshot in `rollback/`. Deliberately one generation deep,
 * not a full history: a device-side rollback is a last-resort safety net for "the last install was
 * bad," not a version-control system. Multi-generation history is a natural v2 extension (a small
 * ring of numbered directories instead of one `rollback/`) and nothing here would need to change
 * shape to support it — see the note on [RuntimeManifest] in Manifest.kt.
 */
class BundleRollback(private val storage: BundleStorage) {

    fun hasRollback(): Boolean = storage.rollbackDir.exists() && storage.manifestFile(storage.rollbackDir).exists()

    /** Moves whatever is currently active into `rollback/`, discarding any older rollback snapshot. */
    fun snapshotCurrent() {
        if (!storage.currentDir.exists() || !storage.manifestFile(storage.currentDir).exists()) {
            return
        }

        val stagedRollback = File(storage.tmpDir, "rollback-snapshot")
        storage.deleteRecursively(stagedRollback)
        storage.currentDir.copyRecursively(stagedRollback, overwrite = true)
        storage.atomicReplace(stagedRollback, storage.rollbackDir)
    }

    /** Restores `rollback/` into `current/` and clears the rollback slot (single-use). */
    fun restore(): VerifiedBundle {
        if (!hasRollback()) {
            throw NoRollbackAvailableException()
        }

        val rollbackManifest = BundleManifest.parse(storage.manifestFile(storage.rollbackDir).readText())

        val stagedCurrent = File(storage.tmpDir, "rollback-restore")
        storage.deleteRecursively(stagedCurrent)
        storage.rollbackDir.copyRecursively(stagedCurrent, overwrite = true)
        storage.atomicReplace(stagedCurrent, storage.currentDir)
        storage.deleteRecursively(storage.rollbackDir)

        return VerifiedBundle(
            packageDir = storage.currentDir,
            manifest = rollbackManifest,
            bundleFile = storage.bundleFile(storage.currentDir, rollbackManifest.bundleName),
            sha256 = rollbackManifest.sha256,
        )
    }

    fun clear() {
        storage.deleteRecursively(storage.rollbackDir)
        storage.rollbackDir.mkdirs()
    }
}
