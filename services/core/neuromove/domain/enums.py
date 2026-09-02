"""NeuroMove Canonical Domain Enumerations.

Defines the single source of truth for runtime modes, intents, states,
safety categories, command statuses, and the universal event taxonomy.
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


class CommandStatus(StrEnum):
    """Mobility command dispatch lifecycle states."""

    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    BLOCKED = "BLOCKED"
    SENT = "SENT"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class SessionStatus(StrEnum):
    """Research and trial recording session states."""

    CREATED = "CREATED"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    ABORTED = "ABORTED"


class TrialQuality(StrEnum):
    """Electrophysiological trial data quality validation flag."""

    VALID = "VALID"
    DEGRADED = "DEGRADED"
    REJECTED = "REJECTED"


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
    """Universal classification of canonical envelope event payloads."""

    # System Lifecycle & Health
    SYSTEM_STARTED = "SYSTEM_STARTED"
    SYSTEM_STOPPED = "SYSTEM_STOPPED"
    SYSTEM_STATUS = "SYSTEM_STATUS"

    # Session Lifecycle
    SESSION_CREATED = "SESSION_CREATED"
    SESSION_STARTED = "SESSION_STARTED"
    SESSION_PAUSED = "SESSION_PAUSED"
    SESSION_RESUMED = "SESSION_RESUMED"
    SESSION_ENDED = "SESSION_ENDED"

    # Trial Protocol
    TRIAL_STARTED = "TRIAL_STARTED"
    TRIAL_CUE = "TRIAL_CUE"
    TRIAL_IMAGERY_STARTED = "TRIAL_IMAGERY_STARTED"
    TRIAL_ENDED = "TRIAL_ENDED"

    # EEG Stream & Signal Quality
    EEG_PACKET = "EEG_PACKET"
    EEG_WINDOW = "EEG_WINDOW"
    EEG_SIGNAL_QUALITY = "EEG_SIGNAL_QUALITY"
    EEG_DISCONNECTED = "EEG_DISCONNECTED"
    TELEMETRY = "TELEMETRY"

    # BCI Prediction & Intent Lifecycle (Phase 16)
    PREDICTION = "PREDICTION"
    INTENT_CANDIDATE = "INTENT_CANDIDATE"
    INTENT_CONFIRMED = "INTENT_CONFIRMED"
    INTENT_ACTIVATED = "INTENT_ACTIVATED"
    INTENT_CANCELLED = "INTENT_CANCELLED"
    INTENT_EXPIRED = "INTENT_EXPIRED"
    INTENT_INTERRUPTED = "INTENT_INTERRUPTED"
    INTENT_COMPLETED = "INTENT_COMPLETED"
    INTENT_REPLACEMENT_REQUESTED = "INTENT_REPLACEMENT_REQUESTED"
    INTENT_STATE_CHANGED = "INTENT_STATE_CHANGED"
    INTENT_CONTEXT_RESET = "INTENT_CONTEXT_RESET"
    INTENT_REJECTED = "INTENT_REJECTED"

    # Confidence & Temporal Confirmation (Phase 15)
    CONFIDENCE_EVALUATED = "CONFIDENCE_EVALUATED"
    CONFIDENCE_REJECTED = "CONFIDENCE_REJECTED"
    TEMPORAL_EVIDENCE_UPDATED = "TEMPORAL_EVIDENCE_UPDATED"
    TEMPORAL_CONFIRMATION_REACHED = "TEMPORAL_CONFIRMATION_REACHED"
    TEMPORAL_CONFIRMATION_RESET = "TEMPORAL_CONFIRMATION_RESET"
    CONFIDENCE_STATE_EXPIRED = "CONFIDENCE_STATE_EXPIRED"
    CONFIDENCE_CONFIG_CHANGED = "CONFIDENCE_CONFIG_CHANGED"

    # Safety State Machine & Arbitration
    STATE_TRANSITION = "STATE_TRANSITION"
    SAFETY_CHECK = "SAFETY_CHECK"
    SAFETY_APPROVED = "SAFETY_APPROVED"
    SAFETY_BLOCKED = "SAFETY_BLOCKED"
    SAFETY_STOP = "SAFETY_STOP"
    EMERGENCY_STOP = "EMERGENCY_STOP"
    SAFETY_ALERT = "SAFETY_ALERT"
    DECISION = "DECISION"
    FAULT = "FAULT"

    # Robot Mobility & Command Protocol
    ROBOT_STATE = "ROBOT_STATE"
    ROBOT_COMMAND_REQUESTED = "ROBOT_COMMAND_REQUESTED"
    ROBOT_COMMAND_APPROVED = "ROBOT_COMMAND_APPROVED"
    ROBOT_COMMAND_BLOCKED = "ROBOT_COMMAND_BLOCKED"
    ROBOT_COMMAND_SENT = "ROBOT_COMMAND_SENT"
    ROBOT_COMMAND_ACK = "ROBOT_COMMAND_ACK"
    ROBOT_COMMAND_FAILED = "ROBOT_COMMAND_FAILED"
    ROBOT_COMMAND = "ROBOT_COMMAND"

    # Calibration Protocols
    CALIBRATION_STARTED = "CALIBRATION_STARTED"
    CALIBRATION_TRIAL = "CALIBRATION_TRIAL"
    CALIBRATION_COMPLETED = "CALIBRATION_COMPLETED"
    CALIBRATION_FAILED = "CALIBRATION_FAILED"
    CALIBRATION = "CALIBRATION"

    # Experiment Management
    EXPERIMENT_CREATED = "EXPERIMENT_CREATED"
    EXPERIMENT_STARTED = "EXPERIMENT_STARTED"
    EXPERIMENT_COMPLETED = "EXPERIMENT_COMPLETED"
