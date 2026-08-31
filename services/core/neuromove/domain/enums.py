"""NeuroMove Canonical Domain Enumerations.

Defines the single source of truth for runtime modes, intents, states,
and safety categories across the NeuroMove platform.
"""

from enum import StrEnum


class OperatingMode(StrEnum):
    """Runtime operational mode for data and control routing."""

    LIVE = "LIVE"
    REPLAY = "REPLAY"
    SIMULATION = "SIMULATION"


class Intent(StrEnum):
    """Decoded or candidate motor-imagery neural intents."""

    NONE = "NONE"
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    FORWARD = "FORWARD"
    BACKWARD = "BACKWARD"
    STOP = "STOP"
    UNCERTAIN = "UNCERTAIN"


class RuntimeState(StrEnum):
    """Deterministic system runtime and safety lifecycle states."""

    IDLE = "IDLE"
    CALIBRATING = "CALIBRATING"
    READY = "READY"
    CANDIDATE = "CANDIDATE"
    CONFIRMED = "CONFIRMED"
    EXECUTING = "EXECUTING"
    BLOCKED = "BLOCKED"
    EMERGENCY = "EMERGENCY"
    FAULT = "FAULT"
    UNCERTAIN = "UNCERTAIN"


class SafetyDecision(StrEnum):
    """Safety arbitration verdicts."""

    APPROVED = "APPROVED"
    BLOCKED = "BLOCKED"
    STOP = "STOP"


class RiskLevel(StrEnum):
    """Environmental and intent risk classifications."""

    SAFE = "SAFE"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class ConnectionState(StrEnum):
    """Hardware and network subsystem connection statuses."""

    CONNECTED = "CONNECTED"
    DEGRADED = "DEGRADED"
    DISCONNECTED = "DISCONNECTED"


class ComponentStatus(StrEnum):
    """Granular health status of individual subsystems."""

    HEALTHY = "healthy"
    READY = "ready"
    DEGRADED = "degraded"
    NOT_CONNECTED = "not_connected"
    NOT_INITIALIZED = "not_initialized"
    UNAVAILABLE = "unavailable"
    ERROR = "error"


class EventType(StrEnum):
    """Classification of canonical envelope event payloads."""

    SYSTEM_STATUS = "SYSTEM_STATUS"
    STATE_TRANSITION = "STATE_TRANSITION"
    INTENT_CANDIDATE = "INTENT_CANDIDATE"
    INTENT_CONFIRMED = "INTENT_CONFIRMED"
    DECISION = "DECISION"
    SAFETY_ALERT = "SAFETY_ALERT"
    EMERGENCY_STOP = "EMERGENCY_STOP"
    ROBOT_COMMAND = "ROBOT_COMMAND"
    TELEMETRY = "TELEMETRY"
    CALIBRATION = "CALIBRATION"
