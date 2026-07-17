package com.openota.runtime

/**
 * Performs the `Extracted -> Installed` transition: physically promoting an already-[VerifiedBundle]
 * into `current/`. Extraction of the zip itself is intentionally not this class's job — the JS SDK
 * already unzips with `react-native-zip-archive` and hands the runtime a plain directory, so there is
 * no native unzip step to duplicate here. This installer's only concern is doing the promotion
 * atomically and never leaving `current/` in a half-written state.
 */
class BundleInstaller(private val storage: BundleStorage, private val rollback: BundleRollback) {

    /**
     * Snapshots whatever is currently active into `rollback/`, then atomically swaps the verified
     * candidate into `current/`. If either step throws, `current/` is left exactly as it was.
     */
    fun promote(verified: VerifiedBundle): VerifiedBundle {
        rollback.snapshotCurrent()
        storage.atomicReplace(verified.packageDir, storage.currentDir)

        return VerifiedBundle(
            packageDir = storage.currentDir,
            manifest = verified.manifest,
            bundleFile = storage.bundleFile(storage.currentDir, verified.manifest.bundleName),
            sha256 = verified.sha256,
        )
    }
}
