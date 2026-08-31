"""Canonical event schemas and dispatcher for NeuroMove."""

from .dispatcher import (
    EventDispatcher,
    EventListener,
    default_event_dispatcher,
)
from .envelope import (
    DecisionPayload,
    EventEnvelope,
    RobotCommandPayload,
    SafetyAlertPayload,
    StateTransitionPayload,
    generate_correlation_id,
    generate_event_id,
    utc_now,
)

__all__ = [
    "DecisionPayload",
    "EventDispatcher",
    "EventEnvelope",
    "EventListener",
    "RobotCommandPayload",
    "SafetyAlertPayload",
    "StateTransitionPayload",
    "default_event_dispatcher",
    "generate_correlation_id",
    "generate_event_id",
    "utc_now",
]
