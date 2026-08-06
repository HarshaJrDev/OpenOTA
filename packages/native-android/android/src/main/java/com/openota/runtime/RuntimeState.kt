package com.openota.runtime

/**
 * The lifecycle states a candidate bundle moves through, from the moment the JS SDK hands off a
 * staged directory (`Downloaded`) to the moment it is safely serving the app (`Activated`).
 *
 * `Failed` and `Rollback` are recovery states: every failure mode in the pipeline has exactly one
 * explicit successor state, so the runtime can never be left in an ambiguous or partially-applied
 * condition. This is what makes the engine crash-safe: a device that loses power or force-quits
 * mid-transition always resumes into a state with a well-defined recovery action.
 */
enum class RuntimeState {
    /** No OTA bundle has ever been installed; the app serves the bundle embedded in the APK. */
    EMBEDDED,

    /** A candidate directory has been registered via `setBundlePath` but not yet examined. */
    DOWNLOADED,

    /** The candidate's manifest, checksum, runtime version and platform have all been verified. */
    VERIFIED,

    /** The candidate's on-disk layout (bundle file + assets dir, no symlinks/traversal) is confirmed. */
    EXTRACTED,

    /** The candidate has been atomically promoted into `current/`, but not yet confirmed booted. */
    INSTALLED,

    /** `current/` is serving the app and has been persisted to the root manifest. */
    ACTIVATED,

    /** The last transition attempt threw; the previous good state was left untouched. */
    FAILED,

    /** The runtime is restoring (or has restored) the previous generation from `rollback/`. */
    ROLLBACK,
}

class IllegalStateTransitionException(from: RuntimeState, to: RuntimeState) :
    IllegalStateException("Illegal OpenOTA runtime transition: $from -> $to")

/**
 * Enforces the explicit transition table described by the runtime spec. Every edge below is a
 * deliberate design decision — there is no default/else branch, so adding a new state or wiring a
 * new transition requires a conscious change here rather than an implicit fallthrough.
 */
object RuntimeStateMachine {
    private val allowedTransitions: Map<RuntimeState, Set<RuntimeState>> = mapOf(
        RuntimeState.EMBEDDED to setOf(RuntimeState.DOWNLOADED),
        RuntimeState.DOWNLOADED to setOf(RuntimeState.VERIFIED, RuntimeState.FAILED),
        RuntimeState.VERIFIED to setOf(RuntimeState.EXTRACTED, RuntimeState.FAILED),
        RuntimeState.EXTRACTED to setOf(RuntimeState.INSTALLED, RuntimeState.FAILED),
        RuntimeState.INSTALLED to setOf(RuntimeState.ACTIVATED, RuntimeState.FAILED),
        RuntimeState.ACTIVATED to setOf(RuntimeState.FAILED, RuntimeState.ROLLBACK, RuntimeState.DOWNLOADED),
        RuntimeState.FAILED to setOf(RuntimeState.ROLLBACK, RuntimeState.DOWNLOADED, RuntimeState.EMBEDDED),
        // FAILED is included because rollbackBundle() writes ROLLBACK first, then — if
        // rollback.restore() throws (e.g. NoRollbackAvailableException, nothing to restore) —
        // catches it and calls stateHolder.transition(FAILED) before rethrowing the original
        // exception (see BundleManager.rollbackBundle()'s catch block). Without ROLLBACK ->
        // FAILED being legal, that recovery transition itself throws IllegalStateTransitionException
        // from inside the catch block, which replaces/masks the real, actionable
        // NoRollbackAvailableException the caller was supposed to see. Confirmed via a pre-existing
        // test (`a failed rollback with nothing to restore does not block the next activation`)
        // that was already failing on main before this fix, independent of the DOWNLOADED edge
        // below — this is a second, separate instance of the same category of bug.
        //
        // DOWNLOADED is included here (not just ACTIVATED/EMBEDDED) because `stateHolder` is
        // initialized directly from the *persisted* root manifest's state on every BundleManager
        // construction (see the constructor). rollbackBundle() writes ROLLBACK before attempting
        // the restore and only reaches ACTIVATED afterward — a process kill/crash in that exact
        // window (force-stop, OOM, OS kill) durably persists ROLLBACK with no further transition
        // ever recorded. Every future launch would then construct a fresh BundleManager that reads
        // ROLLBACK straight off disk and, without this edge, could never legally re-enter the
        // install pipeline again — permanently blocking every future OTA update on that device
        // until the app was reinstalled. Confirmed live: `openota rollback`'s device-side
        // equivalent (a stray double-tap of "Roll back") left a real device in exactly this state,
        // and the very next release upload failed with "Illegal OpenOTA runtime transition:
        // ROLLBACK -> DOWNLOADED".
        RuntimeState.ROLLBACK to setOf(
            RuntimeState.ACTIVATED,
            RuntimeState.EMBEDDED,
            RuntimeState.DOWNLOADED,
            RuntimeState.FAILED,
        ),
    )

    /**
     * `clearBundle()` is the one operation that is valid from *any* state: wiping the runtime back
     * to serving the embedded bundle is always a safe, well-defined action, so it is modeled as an
     * explicit reset edge from every state rather than forcing callers to route through fake
     * intermediate transitions to reach [RuntimeState.EMBEDDED].
     */
    private val resettableFrom = RuntimeState.entries.toSet() - RuntimeState.EMBEDDED

    fun assertTransition(from: RuntimeState, to: RuntimeState) {
        if (to == RuntimeState.EMBEDDED && from in resettableFrom) {
            return
        }

        val allowed = allowedTransitions[from].orEmpty()
        if (to !in allowed) {
            throw IllegalStateTransitionException(from, to)
        }
    }
}

/**
 * Thread-safe holder for the current [RuntimeState]. All mutation goes through [transition], which
 * validates the edge before applying it, so no caller can silently skip a step.
 */
class RuntimeStateHolder(initial: RuntimeState) {
    @Volatile
    var current: RuntimeState = initial
        private set

    @Synchronized
    fun transition(to: RuntimeState): RuntimeState {
        RuntimeStateMachine.assertTransition(current, to)
        current = to
        return current
    }
}
