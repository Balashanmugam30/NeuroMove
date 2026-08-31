"""NeuroMove Universal Canonical Event Envelope and Payloads.

Defines the universal event schema envelope across the NeuroMove ecosystem,
ensuring strict cross-language parity, monotonic sequence tracking, and UTC traceability.
"""

import uuid
from datetime import UTC, datetime
from typing import Any, Generic, TypeVar

from pydantic import AliasChoices, BaseModel, Field

from ..domain.enums import (
    CommandStatus,
    ConnectionState,
    EventType,
    Intent,
    OperatingMode,
    RiskLevel,
    RuntimeState,
    SafetyDecision,
    SessionStatus,
    TrialQuality,
)


def generate_event_id() -> str:
    """Generate a prefixed unique event identifier."""
    return f"evt_{uuid.uuid4().hex[:16]}"


def generate_correlation_id() -> str:
    """Generate a prefixed correlation / trace identifier."""
    return f"cor_{uuid.uuid4().hex[:12]}"


def utc_now() -> datetime:
    """Generate timezone-aware UTC datetime."""
    return datetime.now(UTC)


# --- Specialized Canonical Event Payloads ---


class PredictionPayload(BaseModel):
    """Payload for real-time BCI inference classifications."""

    intent: Intent
    class_probabilities: dict[str, float] = Field(default_factory=dict)
    neural_confidence: float = Field(ge=0.0, le=1.0)
    raw_label: str = ""
    model_id: str = "mdl_baseline"
    model_version: str = "1.0.0"
    window_id: str = "win_001"

    model_config = {"frozen": True}


class IntentConfirmedPayload(BaseModel):
    """Payload for temporally confirmed and debounced intent decisions."""

    intent: Intent
    confidence: float = Field(ge=0.0, le=1.0)
    confirmation_window_ms: int = Field(default=350, ge=100)
    consecutive_epochs: int = Field(default=3, ge=1)

    model_config = {"frozen": True}


class SignalQualityPayload(BaseModel):
    """Payload for streaming electrode signal quality and contact metrics."""

    quality_score: float = Field(ge=0.0, le=1.0)
    channels: dict[str, float] = Field(default_factory=lambda: {"C3": 0.0, "Cz": 0.0, "C4": 0.0})
    dropped_samples: int = Field(default=0, ge=0)
    artifact_flags: list[str] = Field(default_factory=list)
    sampling_rate: int = Field(default=250, ge=100)

    model_config = {"frozen": True}


class SafetyDecisionPayload(BaseModel):
    """Payload for independent safety arbitration evaluations."""

    decision: SafetyDecision = SafetyDecision.APPROVED
    risk_level: RiskLevel = RiskLevel.SAFE
    reason_code: str = "DECISION_OK"
    reason: str = Field(
        default="",
        validation_alias=AliasChoices("reason", "rationale"),
    )
    evaluated_at: datetime = Field(default_factory=utc_now)
    intent: Intent = Intent.NONE
    neural_confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        validation_alias=AliasChoices("neural_confidence", "confidence"),
    )
    signal_quality: float = Field(default=0.0, ge=0.0, le=1.0)
    obstacle_state: str = "CLEAR"
    emergency_state: bool = False
    robot_state: str = "STOPPED"

    @property
    def confidence(self) -> float:
        """Alias for neural_confidence."""
        return self.neural_confidence

    model_config = {"frozen": True, "populate_by_name": True}


# Backwards compatibility alias
DecisionPayload = SafetyDecisionPayload


class StateTransitionPayload(BaseModel):
    """Payload for safety state machine lifecycle transition audits."""

    previous_state: RuntimeState
    target_state: RuntimeState
    trigger_event: str
    is_valid: bool = True
    reason: str = ""

    model_config = {"frozen": True}


class SafetyAlertPayload(BaseModel):
    """Payload for emergency halts, obstacle detections, and safety breaches."""

    severity: RiskLevel = RiskLevel.CRITICAL
    alert_code: str
    message: str
    requires_acknowledgement: bool = True
    telemetry_snapshot: dict[str, Any] = Field(default_factory=dict)

    model_config = {"frozen": True}


class RobotCommandPayload(BaseModel):
    """Payload for mobility dispatch commands."""

    command_id: str
    intent: Intent
    linear_velocity: float = 0.0
    angular_velocity: float = 0.0
    duration_ms: int = 500
    safety_decision: SafetyDecision = SafetyDecision.APPROVED
    status: CommandStatus = CommandStatus.REQUESTED

    model_config = {"frozen": True}


class RobotStatePayload(BaseModel):
    """Payload for physical or simulated mobility platform telemetry."""

    connection_state: ConnectionState = ConnectionState.DISCONNECTED
    motion_state: str = "STOPPED"
    heading: float = 0.0
    battery: float = 0.0
    left_motor: int = 0
    right_motor: int = 0
    linear_velocity: float = 0.0
    angular_velocity: float = 0.0

    model_config = {"frozen": True}


class SystemStatusPayload(BaseModel):
    """Payload for Control Station health broadcasts."""

    service: str = "neuromove-core"
    status: str = "ok"
    version: str = "0.1.0"
    mode: OperatingMode = OperatingMode.SIMULATION
    components: dict[str, str] = Field(default_factory=dict)

    model_config = {"frozen": True}


class SessionLifecyclePayload(BaseModel):
    """Payload for session creation, start, pause, and termination."""

    session_id: str
    user_id: str
    status: SessionStatus
    mode: OperatingMode = OperatingMode.SIMULATION

    model_config = {"frozen": True}


class TrialLifecyclePayload(BaseModel):
    """Payload for trial execution protocol events."""

    trial_id: str
    session_id: str
    trial_index: int
    label: Intent
    cue: str = "ARROW_RIGHT"
    status: TrialQuality = TrialQuality.VALID

    model_config = {"frozen": True}


class CalibrationPayload(BaseModel):
    """Payload for user calibration routine progress."""

    session_id: str
    trial_index: int
    target_intent: Intent
    status: str = "in_progress"

    model_config = {"frozen": True}


T_Payload = TypeVar("T_Payload", bound=BaseModel | dict[str, Any])


class EventEnvelope(BaseModel, Generic[T_Payload]):
    """Universal Canonical Event Envelope.

    The single immutable contract for all streaming, persisted, and audited events.
    """

    event_id: str = Field(default_factory=generate_event_id)
    schema_version: str = Field(default="1.0.0", description="Event schema version")
    timestamp: datetime = Field(default_factory=utc_now)
    occurred_at: datetime = Field(default_factory=utc_now)
    processed_at: datetime | None = None
    mode: OperatingMode = Field(
        default=OperatingMode.SIMULATION,
        description="Operating mode: SIMULATION | REPLAY | LIVE",
    )
    event_type: EventType = Field(description="Canonical event classification")
    session_id: str | None = Field(default=None, description="Active session ID")
    trial_id: str | None = Field(default=None, description="Active trial ID")
    user_id: str | None = Field(default=None, description="Operator or subject ID")
    correlation_id: str = Field(default_factory=generate_correlation_id)
    source: str = Field(default="neuromove.core", description="Originating subsystem")
    sequence: int = Field(default=0, ge=0, description="Monotonic sequence index")
    payload: T_Payload = Field(description="Strongly typed event payload")

    @property
    def version(self) -> str:
        """Alias for schema_version."""
        return self.schema_version

    model_config = {"frozen": True}
