"""Safety State Machine and Transition Guardrails for NeuroMove.

Ensures fail-closed deterministic state management where no actuation or command
can be processed unless explicitly confirmed, validated, and approved.
"""

import logging
from collections.abc import Callable
from datetime import UTC, datetime

from ..domain.enums import (
    EventType,
    OperatingMode,
    RiskLevel,
    RuntimeState,
    SafetyDecision,
)
from ..domain.models import SafetyState
from ..events.dispatcher import default_event_dispatcher
from ..events.envelope import EventEnvelope, StateTransitionPayload

logger = logging.getLogger("neuromove.safety")

# Transition matrix: Allowed target states from a given source state
ALLOWED_TRANSITIONS: dict[RuntimeState, set[RuntimeState]] = {
    RuntimeState.IDLE: {
        RuntimeState.CALIBRATING,
        RuntimeState.READY,
        RuntimeState.EMERGENCY,
        RuntimeState.FAULT,
    },
    RuntimeState.CALIBRATING: {
        RuntimeState.IDLE,
        RuntimeState.READY,
        RuntimeState.EMERGENCY,
        RuntimeState.FAULT,
    },
    RuntimeState.READY: {
        RuntimeState.IDLE,
        RuntimeState.CALIBRATING,
        RuntimeState.CANDIDATE,
        RuntimeState.EMERGENCY,
        RuntimeState.FAULT,
    },
    RuntimeState.CANDIDATE: {
        RuntimeState.READY,
        RuntimeState.CONFIRMED,
        RuntimeState.BLOCKED,
        RuntimeState.IDLE,
        RuntimeState.EMERGENCY,
        RuntimeState.FAULT,
    },
    RuntimeState.CONFIRMED: {
        RuntimeState.EXECUTING,
        RuntimeState.BLOCKED,
        RuntimeState.READY,
        RuntimeState.IDLE,
        RuntimeState.EMERGENCY,
        RuntimeState.FAULT,
    },
    RuntimeState.EXECUTING: {
        RuntimeState.READY,
        RuntimeState.IDLE,
        RuntimeState.BLOCKED,
        RuntimeState.EMERGENCY,
        RuntimeState.FAULT,
    },
    RuntimeState.BLOCKED: {
        RuntimeState.READY,
        RuntimeState.IDLE,
        RuntimeState.EMERGENCY,
        RuntimeState.FAULT,
    },
    RuntimeState.EMERGENCY: {
        RuntimeState.IDLE,  # Requires explicit manual reset to IDLE
    },
    RuntimeState.FAULT: {
        RuntimeState.IDLE,  # Requires explicit diagnostics clear to IDLE
    },
    RuntimeState.UNCERTAIN: {
        RuntimeState.IDLE,
        RuntimeState.READY,
        RuntimeState.EMERGENCY,
        RuntimeState.FAULT,
    },
}


class InvalidStateTransitionError(Exception):
    """Raised when a state transition violates deterministic safety matrix."""

    def __init__(self, current: RuntimeState, target: RuntimeState, reason: str = "") -> None:
        self.current = current
        self.target = target
        self.reason = reason
        super().__init__(
            f"Invalid safety transition: {current.value} -> {target.value}. {reason}".strip()
        )


TransitionHook = Callable[[RuntimeState, RuntimeState, str], None]


class SafetyStateMachine:
    """Deterministic Safety-Critical State Machine Container."""

    def __init__(self, mode: OperatingMode = OperatingMode.SIMULATION) -> None:
        self._mode = mode
        # Safe default state is ALWAYS IDLE
        self._current_state = RuntimeState.IDLE
        self._last_decision = SafetyDecision.STOP
        self._risk_level = RiskLevel.SAFE
        self._emergency_active = False
        self._fault_code: str | None = None
        self._last_transition_time = datetime.now(UTC)
        self._hooks: list[TransitionHook] = []

    @property
    def current_state(self) -> RuntimeState:
        """Get current validated runtime state."""
        return self._current_state

    @property
    def is_safe_to_actuate(self) -> bool:
        """Determines if the system is in an active, validated execution state."""
        return (
            self._current_state == RuntimeState.EXECUTING
            and not self._emergency_active
            and self._fault_code is None
            and self._last_decision == SafetyDecision.APPROVED
        )

    def register_hook(self, hook: TransitionHook) -> None:
        """Register a callback hook invoked on valid state transitions."""
        self._hooks.append(hook)

    def can_transition_to(self, target_state: RuntimeState) -> bool:
        """Check if transition from current state to target is permissible."""
        if target_state == self._current_state:
            return True
        allowed = ALLOWED_TRANSITIONS.get(self._current_state, set())
        return target_state in allowed

    def transition_to(
        self,
        target_state: RuntimeState,
        trigger: str = "internal",
        reason: str = "",
    ) -> RuntimeState:
        """Execute a state transition with deterministic boundary checking."""
        if target_state == self._current_state:
            return self._current_state

        if not self.can_transition_to(target_state):
            err_msg = f"Transition from {self._current_state.value} to {target_state.value} is disallowed."
            logger.error("State transition denied: %s", err_msg)
            raise InvalidStateTransitionError(self._current_state, target_state, reason=err_msg)

        prev = self._current_state
        self._current_state = target_state
        self._last_transition_time = datetime.now(UTC)

        # Update emergency/fault status flags
        if target_state == RuntimeState.EMERGENCY:
            self._emergency_active = True
            self._last_decision = SafetyDecision.STOP
            self._risk_level = RiskLevel.CRITICAL
        elif target_state == RuntimeState.FAULT:
            self._last_decision = SafetyDecision.STOP
            self._risk_level = RiskLevel.CRITICAL
        elif target_state == RuntimeState.IDLE:
            self._emergency_active = False
            self._fault_code = None
            self._last_decision = SafetyDecision.STOP
            self._risk_level = RiskLevel.SAFE

        logger.info(
            "State transition: %s -> %s [trigger=%s, reason=%s]",
            prev.value,
            target_state.value,
            trigger,
            reason,
        )

        # Emit audit event to universal event envelope
        event = EventEnvelope[StateTransitionPayload](
            event_type=EventType.STATE_TRANSITION,
            mode=self._mode,
            payload=StateTransitionPayload(
                previous_state=prev,
                target_state=target_state,
                trigger_event=trigger,
                is_valid=True,
                reason=reason,
            ),
        )
        default_event_dispatcher.publish(event)

        # Execute registered hooks
        for hook in self._hooks:
            try:
                hook(prev, target_state, trigger)
            except Exception as exc:
                logger.error("Error in safety transition hook: %s", exc)

        return self._current_state

    def trigger_emergency_stop(self, reason: str = "Manual emergency stop") -> None:
        """Immediately force emergency stop from ANY state."""
        prev = self._current_state
        self._current_state = RuntimeState.EMERGENCY
        self._emergency_active = True
        self._last_decision = SafetyDecision.STOP
        self._risk_level = RiskLevel.CRITICAL
        self._last_transition_time = datetime.now(UTC)

        logger.critical("EMERGENCY STOP TRIGGERED: %s (from %s)", reason, prev.value)

        event = EventEnvelope[StateTransitionPayload](
            event_type=EventType.EMERGENCY_STOP,
            mode=self._mode,
            payload=StateTransitionPayload(
                previous_state=prev,
                target_state=RuntimeState.EMERGENCY,
                trigger_event="EMERGENCY_STOP",
                is_valid=True,
                reason=reason,
            ),
        )
        default_event_dispatcher.publish(event)

    def trigger_fault(self, fault_code: str, reason: str) -> None:
        """Force system into FAULT state."""
        self._fault_code = fault_code
        self.transition_to(
            RuntimeState.FAULT,
            trigger=f"FAULT:{fault_code}",
            reason=reason,
        )

    def reset_to_idle(self, reason: str = "Operator manual reset") -> None:
        """Reset from Emergency or Fault state back to safe IDLE."""
        if self._current_state in (RuntimeState.EMERGENCY, RuntimeState.FAULT):
            prev = self._current_state
            self._current_state = RuntimeState.IDLE
            self._emergency_active = False
            self._fault_code = None
            self._last_decision = SafetyDecision.STOP
            self._risk_level = RiskLevel.SAFE
            self._last_transition_time = datetime.now(UTC)

            logger.info("Safety reset: %s -> IDLE (%s)", prev.value, reason)

            event = EventEnvelope[StateTransitionPayload](
                event_type=EventType.STATE_TRANSITION,
                mode=self._mode,
                payload=StateTransitionPayload(
                    previous_state=prev,
                    target_state=RuntimeState.IDLE,
                    trigger_event="RESET",
                    is_valid=True,
                    reason=reason,
                ),
            )
            default_event_dispatcher.publish(event)
        else:
            self.transition_to(RuntimeState.IDLE, trigger="RESET", reason=reason)

    def get_safety_state(self) -> SafetyState:
        """Export snapshot of current safety state."""
        return SafetyState(
            runtime_state=self._current_state,
            last_decision=self._last_decision,
            risk_level=self._risk_level,
            emergency_active=self._emergency_active,
            fault_code=self._fault_code,
            reason=f"Current state: {self._current_state.value}",
            updated_at=self._last_transition_time,
        )


# Global singleton instance for local core runtime
default_safety_state_machine = SafetyStateMachine()
