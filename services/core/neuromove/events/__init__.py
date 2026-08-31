"""Event handling and streaming for NeuroMove."""

from .dispatcher import EventDispatcher, EventListener, default_event_dispatcher
from .envelope import (
    CalibrationPayload,
    EventEnvelope,
    IntentConfirmedPayload,
    PredictionPayload,
    RobotCommandPayload,
    RobotStatePayload,
    SafetyAlertPayload,
    SafetyDecisionPayload,
    SessionLifecyclePayload,
    SignalQualityPayload,
    StateTransitionPayload,
    SystemStatusPayload,
    TrialLifecyclePayload,
    generate_correlation_id,
    generate_event_id,
    utc_now,
)

__all__ = [
    "CalibrationPayload",
    "EventDispatcher",
    "EventEnvelope",
    "EventListener",
    "IntentConfirmedPayload",
    "PredictionPayload",
    "RobotCommandPayload",
    "RobotStatePayload",
    "SafetyAlertPayload",
    "SafetyDecisionPayload",
    "SessionLifecyclePayload",
    "SignalQualityPayload",
    "StateTransitionPayload",
    "SystemStatusPayload",
    "TrialLifecyclePayload",
    "default_event_dispatcher",
    "generate_correlation_id",
    "generate_event_id",
    "utc_now",
]
