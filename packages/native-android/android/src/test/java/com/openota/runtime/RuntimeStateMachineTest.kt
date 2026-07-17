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
    fun `rollback can recover into activated or reset to embedded`() {
        RuntimeStateMachine.assertTransition(RuntimeState.ROLLBACK, RuntimeState.ACTIVATED)
        RuntimeStateMachine.assertTransition(RuntimeState.ROLLBACK, RuntimeState.EMBEDDED)
    }
}
