"""Connection state machine enforcing deterministic hardware link transitions."""

from __future__ import annotations

import logging
from typing import ClassVar

from neuromove.hardware_hil.models import HardwareConnectionState

logger = logging.getLogger(__name__)


class HardwareConnectionStateMachine:
    """Finite state machine governing valid hardware connection state transitions."""

    VALID_TRANSITIONS: ClassVar[dict[HardwareConnectionState, set[HardwareConnectionState]]] = {
        HardwareConnectionState.DISCONNECTED: {
            HardwareConnectionState.DISCOVERING,
            HardwareConnectionState.CONNECTING,
            HardwareConnectionState.ERROR,
        },
        HardwareConnectionState.DISCOVERING: {
            HardwareConnectionState.CONNECTING,
            HardwareConnectionState.DISCONNECTED,
            HardwareConnectionState.ERROR,
        },
        HardwareConnectionState.CONNECTING: {
            HardwareConnectionState.NEGOTIATING,
            HardwareConnectionState.DISCONNECTED,
            HardwareConnectionState.ERROR,
        },
        HardwareConnectionState.NEGOTIATING: {
            HardwareConnectionState.READY,
            HardwareConnectionState.CONNECTED,
            HardwareConnectionState.DISCONNECTED,
            HardwareConnectionState.ERROR,
        },
        HardwareConnectionState.CONNECTED: {
            HardwareConnectionState.READY,
            HardwareConnectionState.DEGRADED,
            HardwareConnectionState.DISCONNECTED,
            HardwareConnectionState.ERROR,
        },
        HardwareConnectionState.READY: {
            HardwareConnectionState.DEGRADED,
            HardwareConnectionState.STALE,
            HardwareConnectionState.DISCONNECTED,
            HardwareConnectionState.RECONNECTING,
            HardwareConnectionState.ERROR,
        },
        HardwareConnectionState.DEGRADED: {
            HardwareConnectionState.READY,
            HardwareConnectionState.STALE,
            HardwareConnectionState.DISCONNECTED,
            HardwareConnectionState.RECONNECTING,
            HardwareConnectionState.ERROR,
        },
        HardwareConnectionState.STALE: {
            HardwareConnectionState.READY,
            HardwareConnectionState.RECONNECTING,
            HardwareConnectionState.DISCONNECTED,
            HardwareConnectionState.ERROR,
        },
        HardwareConnectionState.RECONNECTING: {
            HardwareConnectionState.NEGOTIATING,
            HardwareConnectionState.DISCONNECTED,
            HardwareConnectionState.ERROR,
        },
        HardwareConnectionState.ERROR: {
            HardwareConnectionState.DISCONNECTED,
            HardwareConnectionState.DISCOVERING,
            HardwareConnectionState.CONNECTING,
        },
    }

    def __init__(
        self,
        initial_state: HardwareConnectionState = HardwareConnectionState.DISCONNECTED,
    ) -> None:
        self._current_state = initial_state

    @property
    def current_state(self) -> HardwareConnectionState:
        """Return the current state."""
        return self._current_state

    def can_transition_to(self, target_state: HardwareConnectionState) -> bool:
        """Check if a transition to `target_state` is legal from current state."""
        valid_targets = self.VALID_TRANSITIONS.get(self._current_state, set())
        return target_state in valid_targets

    def transition_to(
        self,
        target_state: HardwareConnectionState,
        reason: str | None = None,
    ) -> HardwareConnectionState:
        """Attempt transition to `target_state`. Raises ValueError if illegal."""
        if not self.can_transition_to(target_state):
            msg = (
                f"Illegal hardware connection state transition: "
                f"'{self._current_state}' -> '{target_state}'. "
                f"Valid targets: {[s.value for s in self.VALID_TRANSITIONS.get(self._current_state, set())]}"
            )
            logger.error(msg)
            raise ValueError(msg)

        old_state = self._current_state
        self._current_state = target_state
        logger.info(
            "Hardware state transition: %s -> %s (reason: %s)",
            old_state,
            target_state,
            reason or "unspecified",
        )
        return self._current_state

    def reset(self) -> None:
        """Reset state directly to DISCONNECTED."""
        self._current_state = HardwareConnectionState.DISCONNECTED
