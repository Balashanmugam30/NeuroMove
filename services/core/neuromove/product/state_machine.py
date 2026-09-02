"""Demo State Machine with strict transition validations."""

from __future__ import annotations

import logging

from neuromove.domain.enums import DemoState

logger = logging.getLogger(__name__)


class DemoStateMachineError(Exception):
    """Raised when an illegal demo state transition is attempted."""


class DemoStateMachine:
    """Finite state machine governing deterministic demo pipeline execution."""

    ALLOWED_TRANSITIONS: dict[DemoState, set[DemoState]] = {
        DemoState.IDLE: {DemoState.SOURCE_READY, DemoState.FAILED, DemoState.IDLE},
        DemoState.SOURCE_READY: {DemoState.ACQUIRING, DemoState.FAILED, DemoState.IDLE},
        DemoState.ACQUIRING: {
            DemoState.CONTEXT_READY,
            DemoState.FAILED,
            DemoState.IDLE,
            DemoState.RECOVERING,
        },
        DemoState.CONTEXT_READY: {
            DemoState.DECODING,
            DemoState.HELD,
            DemoState.FAILED,
            DemoState.IDLE,
        },
        DemoState.DECODING: {
            DemoState.CONFIRMING,
            DemoState.HELD,
            DemoState.FAILED,
            DemoState.IDLE,
        },
        DemoState.CONFIRMING: {
            DemoState.INTENT_READY,
            DemoState.HELD,
            DemoState.FAILED,
            DemoState.IDLE,
        },
        DemoState.INTENT_READY: {
            DemoState.SAFETY_CHECK,
            DemoState.HELD,
            DemoState.DENIED,
            DemoState.FAILED,
            DemoState.IDLE,
        },
        DemoState.SAFETY_CHECK: {
            DemoState.AUTHORIZED,
            DemoState.HELD,
            DemoState.DENIED,
            DemoState.FAILED,
            DemoState.IDLE,
        },
        DemoState.AUTHORIZED: {
            DemoState.HIL_EXECUTING,
            DemoState.COMPLETED,
            DemoState.FAILED,
            DemoState.IDLE,
        },
        DemoState.HIL_EXECUTING: {
            DemoState.COMPLETED,
            DemoState.FAILED,
            DemoState.IDLE,
        },
        DemoState.COMPLETED: {DemoState.IDLE, DemoState.SOURCE_READY},
        DemoState.HELD: {DemoState.IDLE, DemoState.RECOVERING, DemoState.SOURCE_READY},
        DemoState.DENIED: {DemoState.IDLE, DemoState.SOURCE_READY},
        DemoState.FAILED: {DemoState.IDLE, DemoState.RECOVERING, DemoState.SOURCE_READY},
        DemoState.RECOVERING: {
            DemoState.SOURCE_READY,
            DemoState.ACQUIRING,
            DemoState.IDLE,
            DemoState.COMPLETED,
        },
    }

    def __init__(self, initial_state: DemoState = DemoState.IDLE) -> None:
        self._current_state = initial_state

    @property
    def state(self) -> DemoState:
        """Get current state."""
        return self._current_state

    def can_transition_to(self, target: DemoState) -> bool:
        """Check if transition from current to target state is allowed."""
        if target == self._current_state:
            return True
        allowed = self.ALLOWED_TRANSITIONS.get(self._current_state, set())
        return target in allowed

    def transition_to(self, target: DemoState) -> DemoState:
        """Transition to target state or raise DemoStateMachineError."""
        if target == self._current_state:
            return self._current_state

        if not self.can_transition_to(target):
            msg = f"Illegal demo state transition from {self._current_state} to {target}"
            logger.error(msg)
            raise DemoStateMachineError(msg)

        logger.debug(
            "Demo state transitioned: %s -> %s", self._current_state, target
        )
        self._current_state = target
        return self._current_state

    def reset(self) -> DemoState:
        """Reset state machine to IDLE."""
        self._current_state = DemoState.IDLE
        return self._current_state
