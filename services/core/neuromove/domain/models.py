"""NeuroMove Canonical Domain Models.

Defines the single source of truth for research and runtime entities including
User, Session, Trial, Experiment, ModelArtifact, Safety, Robot, and System diagnostics.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from .enums import (
    CommandStatus,
    ComponentStatus,
    ConnectionState,
    Intent,
    OperatingMode,
    RiskLevel,
    RuntimeState,
    SafetyDecision,
    SessionStatus,
    TrialQuality,
)


def utc_now() -> datetime:
    """Generate timezone-aware UTC datetime."""
    return datetime.now(UTC)


def generate_user_id() -> str:
    """Generate pseudonymous user identifier."""
    return f"usr_{uuid.uuid4().hex[:10]}"


def generate_session_id() -> str:
    """Generate unique session identifier."""
    return f"ses_{uuid.uuid4().hex[:12]}"


def generate_trial_id() -> str:
    """Generate unique trial identifier."""
    return f"trl_{uuid.uuid4().hex[:12]}"


def generate_experiment_id() -> str:
    """Generate unique experiment identifier."""
    return f"exp_{uuid.uuid4().hex[:10]}"


def generate_model_id() -> str:
    """Generate unique model artifact identifier."""
    return f"mdl_{uuid.uuid4().hex[:10]}"


def generate_command_id() -> str:
    """Generate unique command identifier."""
    return f"cmd_{uuid.uuid4().hex[:12]}"


class User(BaseModel):
    """Pseudonymous research participant or operator profile."""

    user_id: str = Field(default_factory=generate_user_id)
    display_label: str = Field(default="Subject_001")
    created_at: datetime = Field(default_factory=utc_now)
    status: str = Field(default="active")
    profile_version: str = Field(default="1.0.0")

    model_config = {"frozen": True}


class Session(BaseModel):
    """Experimental or operational BCI session container."""

    session_id: str = Field(default_factory=generate_session_id)
    user_id: str = Field(default="usr_anonymous")
    mode: OperatingMode = Field(default=OperatingMode.SIMULATION)
    status: SessionStatus = Field(default=SessionStatus.CREATED)
    started_at: datetime = Field(default_factory=utc_now)
    ended_at: datetime | None = None
    source: str = Field(default="synthetic.generator")
    application_version: str = Field(default="0.1.0")
    model_version: str = Field(default="baseline_csp_lda_v1")
    notes: str = Field(default="")
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"frozen": True}


class Trial(BaseModel):
    """Single motor-imagery calibration or evaluation trial."""

    trial_id: str = Field(default_factory=generate_trial_id)
    session_id: str
    trial_index: int = Field(ge=0)
    label: Intent = Field(description="Ground truth or cue target intent")
    paradigm: str = Field(default="Graz_Visual_Cue")
    cue: str = Field(default="ARROW_RIGHT")
    started_at: datetime = Field(default_factory=utc_now)
    imagery_started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_ms: int = Field(default=4000, ge=500)
    quality_status: TrialQuality = Field(default=TrialQuality.VALID)

    model_config = {"frozen": True}


class Experiment(BaseModel):
    """Structured research experiment encompassing protocol and sessions."""

    experiment_id: str = Field(default_factory=generate_experiment_id)
    name: str = Field(default="Motor Imagery SMR Benchmark")
    description: str = Field(default="")
    protocol_version: str = Field(default="2.0.0")
    dataset_source: str = Field(default="local.research")
    model_id: str | None = None
    created_at: datetime = Field(default_factory=utc_now)

    model_config = {"frozen": True}


class ModelArtifact(BaseModel):
    """Trained BCI spatial filter and classifier artifact metadata."""

    model_id: str = Field(default_factory=generate_model_id)
    model_type: str = Field(default="CSP_LDA")
    version: str = Field(default="1.0.0")
    created_at: datetime = Field(default_factory=utc_now)
    training_dataset: str = Field(default="synthetic_sim_v1")
    feature_pipeline: str = Field(default="Butterworth_8_30Hz_CAR_CSP")
    classifier: str = Field(default="Shrinkage_LDA")
    metrics_reference: dict[str, float] = Field(default_factory=dict)
    artifact_path: str = Field(default="")
    status: str = Field(default="ready")

    model_config = {"frozen": True}


class SignalQualityMetrics(BaseModel):
    """Electrophysiological electrode contact and stream quality metrics."""

    overall_score: float = Field(default=0.0, ge=0.0, le=1.0)
    channels: dict[str, float] = Field(default_factory=lambda: {"C3": 0.0, "Cz": 0.0, "C4": 0.0})
    dropped_samples: int = Field(default=0, ge=0)
    artifact_flags: list[str] = Field(default_factory=list)
    sampling_rate_hz: int = Field(default=250, ge=100)
    is_acceptable: bool = False

    model_config = {"frozen": True}


class SafetyState(BaseModel):
    """Active safety state container and transition context."""

    runtime_state: RuntimeState = RuntimeState.IDLE
    last_decision: SafetyDecision = SafetyDecision.STOP
    risk_level: RiskLevel = RiskLevel.SAFE
    emergency_active: bool = False
    fault_code: str | None = None
    reason_code: str = "SYS_IDLE"
    reason: str = "System in safe default idle state."
    updated_at: datetime = Field(default_factory=utc_now)

    model_config = {"frozen": True}

    @model_validator(mode="after")
    def validate_safety_invariants(self) -> "SafetyState":
        """Enforce domain safety invariants."""
        if self.emergency_active and self.last_decision == SafetyDecision.APPROVED:
            raise ValueError("Emergency stop active cannot coexist with APPROVED safety decision.")
        if self.runtime_state == RuntimeState.EMERGENCY and not self.emergency_active:
            raise ValueError("RuntimeState EMERGENCY requires emergency_active=True.")
        return self


class RobotState(BaseModel):
    """Physical or simulated mobility platform status."""

    connection_state: ConnectionState = ConnectionState.DISCONNECTED
    motion_state: str = Field(default="STOPPED")
    heading_deg: float = Field(default=0.0, ge=0.0, le=360.0)
    battery_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    left_motor_pwm: int = Field(default=0, ge=-255, le=255)
    right_motor_pwm: int = Field(default=0, ge=-255, le=255)
    linear_velocity_mps: float = 0.0
    angular_velocity_radps: float = 0.0
    emergency_stop_triggered: bool = False
    last_heartbeat: datetime | None = None
    mode: OperatingMode = OperatingMode.SIMULATION

    model_config = {"frozen": True}


class RobotCommand(BaseModel):
    """Direct or test mobility command dispatch."""

    command_id: str = Field(default_factory=generate_command_id)
    intent: Intent = Intent.NONE
    source: str = Field(default="safety.arbitrator")
    session_id: str | None = None
    correlation_id: str | None = None
    requested_at: datetime = Field(default_factory=utc_now)
    safety_decision: SafetyDecision = SafetyDecision.STOP
    status: CommandStatus = CommandStatus.REQUESTED
    linear_velocity_mps: float = Field(default=0.0, ge=-0.5, le=0.5)
    angular_velocity_radps: float = Field(default=0.0, ge=-1.5, le=1.5)
    duration_ms: int = Field(default=500, ge=50, le=2000)

    model_config = {"frozen": True}

    @model_validator(mode="after")
    def validate_command_invariants(self) -> "RobotCommand":
        """Ensure non-directional or unapproved intents cannot be marked APPROVED."""
        if self.intent in (Intent.NONE, Intent.UNCERTAIN) and self.status == CommandStatus.APPROVED:
            raise ValueError(f"Intent {self.intent.value} cannot be approved for robot movement.")
        if (
            self.status == CommandStatus.APPROVED
            and self.safety_decision != SafetyDecision.APPROVED
        ):
            raise ValueError(
                "Command cannot be in APPROVED status without SafetyDecision.APPROVED."
            )
        return self


class ComponentHealth(BaseModel):
    """Component-level diagnostic health representation."""

    api: ComponentStatus = ComponentStatus.HEALTHY
    database: ComponentStatus = ComponentStatus.NOT_INITIALIZED
    eeg: ComponentStatus = ComponentStatus.NOT_CONNECTED
    robot: ComponentStatus = ComponentStatus.NOT_CONNECTED
    safety: ComponentStatus = ComponentStatus.READY

    model_config = {"frozen": True}


class SystemStatus(BaseModel):
    """Complete diagnostic health report for the local Control Station."""

    service: str = "neuromove-core"
    status: str = "ok"
    version: str = "0.1.0"
    mode: OperatingMode = OperatingMode.SIMULATION
    timestamp: datetime = Field(default_factory=utc_now)
    components: ComponentHealth = Field(default_factory=ComponentHealth)

    model_config = {"frozen": True}


class ErrorDetail(BaseModel):
    """Field-level error diagnostic detail."""

    field: str
    issue: str


class ErrorResponse(BaseModel):
    """Standardized Canonical Error Response."""

    code: str
    message: str
    request_id: str
    details: list[ErrorDetail] = Field(default_factory=list)


# Backwards compatibility aliases
SignalQuality = SignalQualityMetrics
CommandPayload = RobotCommand
UserProfile = User
