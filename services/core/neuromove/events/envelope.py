"""NeuroMove Canonical Event Model Envelope.

Defines the universal event schema envelope across the NeuroMove ecosystem,
ensuring strict parity between local core streaming, WebSocket distribution,
database persistence, research logging, and competition replay.
"""

import uuid
from datetime import UTC, datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

from ..domain.enums import (
    EventType,
    Intent,
    OperatingMode,
    RiskLevel,
    RuntimeState,
    SafetyDecision,
)


def generate_event_id() -> str:
    """Generate a prefixed unique event identifier."""
    return f"evt_{uuid.uuid4().hex[:16]}"


def generate_correlation_id() -> str:
    """Generate a prefixed correlation / trace identifier."""
    return f"corr_{uuid.uuid4().hex[:12]}"


def utc_now() -> datetime:
    """Generate timezone-aware UTC datetime."""
    return datetime.now(UTC)


class DecisionPayload(BaseModel):
    """Payload for intent resolution and safety arbitration events."""

    intent: Intent = Intent.NONE
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    signal_quality: float = Field(default=0.0, ge=0.0, le=1.0)
    risk: RiskLevel = RiskLevel.SAFE
    decision: SafetyDecision = SafetyDecision.STOP
    runtime_state: RuntimeState = RuntimeState.IDLE
    rationale: str = ""

    model_config = {"frozen": True}


class StateTransitionPayload(BaseModel):
    """Payload for safety state machine transition audits."""

    previous_state: RuntimeState
    target_state: RuntimeState
    trigger_event: str
    is_valid: bool = True
    reason: str = ""

    model_config = {"frozen": True}


class SafetyAlertPayload(BaseModel):
    """Payload for emergency halts, sensor blocks, and safety breaches."""

    severity: RiskLevel = RiskLevel.CRITICAL
    alert_code: str
    message: str
    requires_acknowledgement: bool = True
    telemetry_snapshot: dict[str, Any] = Field(default_factory=dict)

    model_config = {"frozen": True}


class RobotCommandPayload(BaseModel):
    """Payload for physical or simulated mobility dispatch."""

    command_id: str = Field(default_factory=lambda: f"cmd_{uuid.uuid4().hex[:10]}")
    intent: Intent
    linear_velocity: float = 0.0
    angular_velocity: float = 0.0
    duration_ms: int = 500
    safety_decision: SafetyDecision = SafetyDecision.APPROVED

    model_config = {"frozen": True}


T_Payload = TypeVar("T_Payload", bound=BaseModel | dict[str, Any])


class EventEnvelope(BaseModel, Generic[T_Payload]):
    """Universal Canonical Event Envelope.

    The single contract for all streaming, persisted, and audited events.
    """

    event_id: str = Field(default_factory=generate_event_id)
    version: str = Field(default="1.0.0", description="Event schema version")
    timestamp: datetime = Field(default_factory=utc_now)
    session_id: str = Field(default="SESS_DEFAULT", description="Active session ID")
    user_id: str = Field(default="USER_DEFAULT", description="Operator or subject ID")
    mode: OperatingMode = Field(
        default=OperatingMode.SIMULATION,
        description="Operating mode: SIMULATION | REPLAY | LIVE",
    )
    event_type: EventType = Field(description="Canonical event classification")
    correlation_id: str = Field(default_factory=generate_correlation_id)
    source_component: str = Field(default="neuromove-core")
    payload: T_Payload = Field(description="Strongly typed event payload")

    model_config = {"frozen": True}
