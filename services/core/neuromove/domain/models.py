"""NeuroMove Canonical Domain Models.

Strongly-typed Pydantic domain representations for safety, telemetry,
robot status, and session tracking.
"""

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

from .enums import (
    ComponentStatus,
    ConnectionState,
    Intent,
    OperatingMode,
    RiskLevel,
    RuntimeState,
    SafetyDecision,
)


def utc_now() -> datetime:
    """Generate timezone-aware UTC datetime."""
    return datetime.now(UTC)


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


class SignalQuality(BaseModel):
    """Electrode signal quality and contact impedance metrics."""

    overall_score: float = Field(default=0.0, ge=0.0, le=1.0)
    c3_impedance_kohm: float = Field(default=0.0, ge=0.0)
    c4_impedance_kohm: float = Field(default=0.0, ge=0.0)
    cz_impedance_kohm: float = Field(default=0.0, ge=0.0)
    is_acceptable: bool = False

    model_config = {"frozen": True}


class SafetyState(BaseModel):
    """Active safety state and arbitration context."""

    runtime_state: RuntimeState = RuntimeState.IDLE
    last_decision: SafetyDecision = SafetyDecision.STOP
    risk_level: RiskLevel = RiskLevel.SAFE
    emergency_active: bool = False
    fault_code: str | None = None
    reason: str = "System in safe default idle state."
    updated_at: datetime = Field(default_factory=utc_now)

    model_config = {"frozen": True}


class RobotState(BaseModel):
    """Physical or simulated mobility platform status."""

    connection: ConnectionState = ConnectionState.DISCONNECTED
    battery_percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    linear_velocity_mps: float = 0.0
    angular_velocity_radps: float = 0.0
    emergency_stop_triggered: bool = False
    last_heartbeat: datetime | None = None
    mode: OperatingMode = OperatingMode.SIMULATION

    model_config = {"frozen": True}


class UserProfile(BaseModel):
    """Operator / subject profile metadata."""

    user_id: str = "U001"
    name: str = "Researcher / Subject"
    experience_level: str = "novice"
    total_sessions: int = 0
    created_at: datetime = Field(default_factory=utc_now)

    model_config = {"frozen": True}


class CalibrationTarget(BaseModel):
    """Calibration trial target configuration."""

    intent: Intent
    duration_seconds: float = 4.0
    cue_onset_seconds: float = 1.5
    rest_seconds: float = 2.0


class CommandPayload(BaseModel):
    """Direct or test mobility command dispatch."""

    intent: Intent
    linear_velocity_mps: float = Field(default=0.0, ge=-0.5, le=0.5)
    angular_velocity_radps: float = Field(default=0.0, ge=-1.5, le=1.5)
    duration_ms: int = Field(default=500, ge=50, le=2000)
    override_safety: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)
