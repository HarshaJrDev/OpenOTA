package com.openota.runtime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RuntimeStateMachineTest {

    @Test
    fun `follows the full happy path in order`() {
        val holder = RuntimeStateHolder(RuntimeState.EMBEDDED)

        assertEquals(RuntimeState.DOWNLOADED, holder.transition(RuntimeState.DOWNLOADED))
        assertEquals(RuntimeState.VERIFIED, holder.transition(RuntimeState.VERIFIED))
        assertEquals(RuntimeState.EXTRACTED, holder.transition(RuntimeState.EXTRACTED))
        assertEquals(RuntimeState.INSTALLED, holder.transition(RuntimeState.INSTALLED))
        assertEquals(RuntimeState.ACTIVATED, holder.transition(RuntimeState.ACTIVATED))
    }

    @Test
    fun `rejects skipping a state`() {
        val holder = RuntimeStateHolder(RuntimeState.EMBEDDED)

        assertThrows(IllegalStateTransitionException::class.java) {
            holder.transition(RuntimeState.VERIFIED)
        }
    }

    @Test
    fun `rejects moving backwards`() {
        val holder = RuntimeStateHolder(RuntimeState.EMBEDDED)
        holder.transition(RuntimeState.DOWNLOADED)
        holder.transition(RuntimeState.VERIFIED)

        assertThrows(IllegalStateTransitionException::class.java) {
            holder.transition(RuntimeState.DOWNLOADED)
        }
    }

    @Test
    fun `allows failure from every non-terminal state`() {
        val nonTerminal = listOf(
            RuntimeState.DOWNLOADED,
            RuntimeState.VERIFIED,
            RuntimeState.EXTRACTED,
            RuntimeState.INSTALLED,
            RuntimeState.ACTIVATED,
        )

        for (state in nonTerminal) {
            RuntimeStateMachine.assertTransition(state, RuntimeState.FAILED)
        }
    }

    @Test
    fun `allows rollback only from activated or failed`() {
        RuntimeStateMachine.assertTransition(RuntimeState.ACTIVATED, RuntimeState.ROLLBACK)
        RuntimeStateMachine.assertTransition(RuntimeState.FAILED, RuntimeState.ROLLBACK)

        assertThrows(IllegalStateTransitionException::class.java) {
            RuntimeStateMachine.assertTransition(RuntimeState.VERIFIED, RuntimeState.ROLLBACK)
        }
    }

    @Test
    fun `clearBundle can reset from any non-embedded state`() {
        for (state in RuntimeState.entries.filter { it != RuntimeState.EMBEDDED }) {
            RuntimeStateMachine.assertTransition(state, RuntimeState.EMBEDDED)
        }
    }

    @Test
    fun `rollback can recover into activated, failed, reset to embedded, or re-enter the install pipeline`() {
        RuntimeStateMachine.assertTransition(RuntimeState.ROLLBACK, RuntimeState.ACTIVATED)
        RuntimeStateMachine.assertTransition(RuntimeState.ROLLBACK, RuntimeState.EMBEDDED)
        RuntimeStateMachine.assertTransition(RuntimeState.ROLLBACK, RuntimeState.DOWNLOADED)
        RuntimeStateMachine.assertTransition(RuntimeState.ROLLBACK, RuntimeState.FAILED)
    }

    /**
     * Regression test for a second, separate pre-existing bug found the same way: this failed
     * even before the ROLLBACK -> DOWNLOADED fix above, independent of it.
     * BundleManager.rollbackBundle() transitions to ROLLBACK, and on a failed restore (e.g.
     * NoRollbackAvailableException — nothing to restore) catches the error and transitions to
     * FAILED before rethrowing it. ROLLBACK -> FAILED not being a legal edge meant that recovery
     * transition itself threw IllegalStateTransitionException from inside the catch block,
     * silently replacing the real, actionable exception the caller was supposed to see.
     */
    @Test
    fun `a failed rollback can transition to FAILED without masking the real error`() {
        RuntimeStateMachine.assertTransition(RuntimeState.ROLLBACK, RuntimeState.FAILED)
    }

    /**
     * Regression test for a real bug found via on-device testing: `stateHolder` is constructed
     * from the *persisted* root manifest state (see BundleManager's constructor), so a process
     * kill between `rollbackBundle()` writing ROLLBACK and it reaching ACTIVATED durably strands a
     * device at ROLLBACK. Before this fix, that device could never legally call `setBundlePath()`
     * (which requires transitioning to DOWNLOADED) again — permanently blocking every future OTA
     * install without a full app reinstall. Confirmed live against a real APK.
     */
    @Test
    fun `a device stranded at ROLLBACK (say, from a killed process) can still accept a new OTA install`() {
        val holder = RuntimeStateHolder(RuntimeState.ROLLBACK)

        assertEquals(RuntimeState.DOWNLOADED, holder.transition(RuntimeState.DOWNLOADED))
        assertEquals(RuntimeState.VERIFIED, holder.transition(RuntimeState.VERIFIED))
        assertEquals(RuntimeState.EXTRACTED, holder.transition(RuntimeState.EXTRACTED))
        assertEquals(RuntimeState.INSTALLED, holder.transition(RuntimeState.INSTALLED))
        assertEquals(RuntimeState.ACTIVATED, holder.transition(RuntimeState.ACTIVATED))
    }
}
