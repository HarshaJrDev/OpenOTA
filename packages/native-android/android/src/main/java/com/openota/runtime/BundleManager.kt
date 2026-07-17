package com.openota.runtime

import android.content.Context
import java.io.File

private const val MAX_UNCONFIRMED_BOOTS = 2

/** Snapshot returned by [BundleManager.getRuntimeInfo], mirrored 1:1 onto the JS `RuntimeInfo` type. */
data class RuntimeInfo(
    val currentVersion: String?,
    val bundleVersion: String?,
    val runtimeVersion: String?,
    val manifestVersion: Int?,
    val bundlePath: String?,
    val installTimeMillis: Long?,
    val state: RuntimeState,
    val platform: String = "android",
)

/**
 * The single orchestrator for the bundle lifecycle. `BundleManager` composes [BundleStorage],
 * [BundleVerifier], [BundleInstaller] and [BundleRollback] rather than absorbing their logic — it
 * is the only class that is allowed to drive [RuntimeStateHolder] transitions, which keeps the
 * state machine's invariants ("every transition explicit, never skipped") enforceable from one
 * place instead of re-implemented at every call site.
 *
 * `runtimeVersion` is supplied by the host app (there is no way to derive "what breaking bundle
 * format generation is this native binary" automatically) and is compared against every candidate
 * bundle's manifest before it is ever staged, per the "future-proof for breaking bundle formats"
 * requirement.
 */
class BundleManager private constructor(context: Context, private val runtimeVersion: String) {
    private val storage = BundleStorage(context)
    private val verifier = BundleVerifier(storage, runtimeVersion)
    private val rollback = BundleRollback(storage)
    private val installer = BundleInstaller(storage, rollback)

    private val stateHolder = RuntimeStateHolder(storage.readRootManifest().state)

    @Volatile
    private var pendingCandidatePath: String? = null

    @Synchronized
    fun setBundlePath(path: String) {
        val resolved = storage.resolveWithinRoot(path)
        if (!resolved.exists() || !resolved.isDirectory) {
            throw BundleVerificationException("Candidate path \"$path\" is not a directory")
        }

        pendingCandidatePath = resolved.path
        stateHolder.transition(RuntimeState.DOWNLOADED)
    }

    fun getBundlePath(): String? = storage.readRootManifest().activeBundlePath

    /**
     * Runs the full `Downloaded -> Verified -> Extracted -> Installed -> Activated` chain against
     * whatever path was last registered via [setBundlePath]. On any failure the previous `current/`
     * is left untouched and the candidate directory is deleted — the app never ends up serving a
     * half-verified bundle.
     */
    @Synchronized
    fun activateBundle(): RuntimeInfo {
        val candidatePath = pendingCandidatePath
            ?: throw NotConfiguredException("setBundlePath() must be called before activateBundle()")
        val candidateDir = File(candidatePath)

        return try {
            val verified = OpenOTALogger.timed("activate.verify") {
                stateHolder.transition(RuntimeState.VERIFIED)
                verifier.verify(candidateDir)
            }

            stateHolder.transition(RuntimeState.EXTRACTED)

            val installed = OpenOTALogger.timed("activate.install") {
                stateHolder.transition(RuntimeState.INSTALLED)
                installer.promote(verified)
            }

            stateHolder.transition(RuntimeState.ACTIVATED)
            pendingCandidatePath = null

            val manifest = RuntimeManifest(
                activeVersion = installed.manifest.version,
                activeBundlePath = installed.bundleFile.path,
                runtimeVersion = installed.manifest.runtimeVersion,
                manifestVersion = installed.manifest.manifestVersion,
                installTimeMillis = System.currentTimeMillis(),
                state = RuntimeState.ACTIVATED,
                bootConfirmed = false,
                bootAttempts = 0,
            )
            storage.writeRootManifest(manifest)

            OpenOTALogger.i("Activated ${installed.manifest.version} (runtime ${installed.manifest.runtimeVersion})")
            toRuntimeInfo(manifest)
        } catch (error: OpenOTAException) {
            OpenOTALogger.e("Activation failed: ${error.message}", error)
            stateHolder.transition(RuntimeState.FAILED)
            storage.deleteRecursively(candidateDir)
            pendingCandidatePath = null
            throw error
        }
    }

    /** Restores the previous generation from `rollback/` and makes it the active bundle. */
    @Synchronized
    fun rollbackBundle(): RuntimeInfo {
        stateHolder.transition(RuntimeState.ROLLBACK)

        val restored = rollback.restore()
        stateHolder.transition(RuntimeState.ACTIVATED)

        val manifest = RuntimeManifest(
            activeVersion = restored.manifest.version,
            activeBundlePath = restored.bundleFile.path,
            runtimeVersion = restored.manifest.runtimeVersion,
            manifestVersion = restored.manifest.manifestVersion,
            installTimeMillis = System.currentTimeMillis(),
            state = RuntimeState.ACTIVATED,
            bootConfirmed = true,
            bootAttempts = 0,
        )
        storage.writeRootManifest(manifest)
        OpenOTALogger.i("Rolled back to ${restored.manifest.version}")
        return toRuntimeInfo(manifest)
    }

    /** Wipes every downloaded/installed bundle and returns the runtime to [RuntimeState.EMBEDDED]. */
    @Synchronized
    fun clearBundle() {
        storage.deleteRecursively(storage.currentDir)
        storage.deleteRecursively(storage.rollbackDir)
        storage.deleteRecursively(storage.downloadsDir)
        storage.deleteRecursively(storage.cacheDir)
        storage.currentDir.mkdirs()
        storage.rollbackDir.mkdirs()
        storage.downloadsDir.mkdirs()
        storage.cacheDir.mkdirs()

        pendingCandidatePath = null
        stateHolder.transition(RuntimeState.EMBEDDED)
        storage.writeRootManifest(RuntimeManifest.EMPTY)
    }

    fun getRuntimeInfo(): RuntimeInfo = toRuntimeInfo(storage.readRootManifest())

    fun getActiveVersion(): String? = storage.readRootManifest().activeVersion

    /**
     * Called once JS has progressed far enough to construct this native module (see
     * `OpenOTAModule.initialize`). Two activations in a row without this ever firing is treated as
     * a boot crash-loop and triggers an automatic rollback — see the class doc on [BundleLoader]
     * for why this heuristic, rather than an explicit JS "I booted fine" call, is what v1 uses.
     */
    @Synchronized
    fun confirmBoot() {
        val manifest = storage.readRootManifest()
        if (!manifest.bootConfirmed) {
            storage.writeRootManifest(manifest.copy(bootConfirmed = true, bootAttempts = 0))
        }
    }

    /** Called at the very top of [BundleLoader.getJSBundleFile], before any JS has had a chance to run. */
    @Synchronized
    fun recordBootAttempt(): RuntimeManifest {
        val manifest = storage.readRootManifest()
        if (manifest.state != RuntimeState.ACTIVATED || manifest.bootConfirmed) {
            return manifest
        }

        val attempts = manifest.bootAttempts + 1
        if (attempts >= MAX_UNCONFIRMED_BOOTS && rollback.hasRollback()) {
            OpenOTALogger.w("Detected $attempts unconfirmed boots of ${manifest.activeVersion}; rolling back")
            return try {
                rollbackBundle().let { storage.readRootManifest() }
            } catch (error: OpenOTAException) {
                OpenOTALogger.e("Automatic rollback failed", error)
                manifest
            }
        }

        val updated = manifest.copy(bootAttempts = attempts)
        storage.writeRootManifest(updated)
        return updated
    }

    private fun toRuntimeInfo(manifest: RuntimeManifest) = RuntimeInfo(
        currentVersion = manifest.activeVersion,
        bundleVersion = manifest.activeVersion,
        runtimeVersion = manifest.runtimeVersion,
        manifestVersion = manifest.manifestVersion,
        bundlePath = manifest.activeBundlePath,
        installTimeMillis = manifest.installTimeMillis,
        state = manifest.state,
    )

    companion object {
        @Volatile
        private var instance: BundleManager? = null

        fun getInstance(context: Context, runtimeVersion: String? = null): BundleManager {
            return instance ?: synchronized(this) {
                instance ?: BundleManager(
                    context,
                    runtimeVersion ?: resolveAppVersionName(context),
                ).also { instance = it }
            }
        }

        private fun resolveAppVersionName(context: Context): String {
            val appContext = context.applicationContext
            val packageInfo = appContext.packageManager.getPackageInfo(appContext.packageName, 0)
            return packageInfo.versionName ?: "0.0.0"
        }

        /** Test-only: forces the next [getInstance] call to construct a fresh manager. */
        @androidx.annotation.VisibleForTesting
        fun resetForTesting() {
            instance = null
        }
    }
}
