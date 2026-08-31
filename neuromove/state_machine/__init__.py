"""State Machine subpackage alias."""

from services.core.neuromove.safety.state_machine import (
    ALLOWED_TRANSITIONS,
    InvalidStateTransitionError,
    SafetyStateMachine,
    TransitionHook,
    default_safety_state_machine,
)

__all__ = [
    "ALLOWED_TRANSITIONS",
    "InvalidStateTransitionError",
    "SafetyStateMachine",
    "TransitionHook",
    "default_safety_state_machine",
]
