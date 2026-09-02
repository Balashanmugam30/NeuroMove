"""Domain models and contracts for Canonical Intent State Machine & Intent Lifecycle Engine (Phase 16)."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from neuromove.confidence.models import ConfidenceBand, ConfidenceEligibility


class IntentLifecycleState(StrEnum):
    """Canonical finite state machine states for intent lifecycle."""

    NO_INTENT = "NO_INTENT"
    CANDIDATE = "CANDIDATE"
    CONFIRMED = "CONFIRMED"
    ACTIVE = "ACTIVE"
    REPLACEMENT_PENDING = "REPLACEMENT_PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    INTERRUPTED = "INTERRUPTED"


TERMINAL_STATES = frozenset(
    {
        IntentLifecycleState.COMPLETED,
        IntentLifecycleState.CANCELLED,
        IntentLifecycleState.EXPIRED,
        IntentLifecycleState.INTERRUPTED,
    }
)


class IntentTransitionTrigger(StrEnum):
    """Triggers that cause state transitions."""

    HANDOFF_CANDIDATE = "HANDOFF_CANDIDATE"
    HANDOFF_CONFIRMED = "HANDOFF_CONFIRMED"
    ACCEPT_ACTIVE = "ACCEPT_ACTIVE"
    TIMEOUT = "TIMEOUT"
    EXPLICIT_CANCEL = "EXPLICIT_CANCEL"
    EXPLICIT_COMPLETE = "EXPLICIT_COMPLETE"
    INTERRUPTION = "INTERRUPTION"
    REPLACEMENT_REQUEST = "REPLACEMENT_REQUEST"
    REPLACEMENT_RESOLVE = "REPLACEMENT_RESOLVE"
    CONTEXT_RESET = "CONTEXT_RESET"


class IntentTransitionReason(StrEnum):
    """Deterministic, machine-readable reason for state transition."""

    TEMPORAL_CONFIRMATION_ACCEPTED = "TEMPORAL_CONFIRMATION_ACCEPTED"
    CANDIDATE_CREATED = "CANDIDATE_CREATED"
    CANDIDATE_TIMEOUT = "CANDIDATE_TIMEOUT"
    CONFIRMATION_TIMEOUT = "CONFIRMATION_TIMEOUT"
    ACTIVE_TIMEOUT = "ACTIVE_TIMEOUT"
    INVALID_HANDOFF = "INVALID_HANDOFF"
    SUBJECT_CHANGED = "SUBJECT_CHANGED"
    SESSION_CHANGED = "SESSION_CHANGED"
    MODEL_CHANGED = "MODEL_CHANGED"
    EXPLICIT_CANCEL = "EXPLICIT_CANCEL"
    EXPLICIT_COMPLETE = "EXPLICIT_COMPLETE"
    INTERRUPTION = "INTERRUPTION"
    REPLACEMENT_REQUESTED = "REPLACEMENT_REQUESTED"
    REPLACEMENT_ACCEPTED = "REPLACEMENT_ACCEPTED"
    REPLACEMENT_REJECTED = "REPLACEMENT_REJECTED"
    CONTEXT_LOST = "CONTEXT_LOST"
    REST_PREDICTION = "REST_PREDICTION"
    STATE_RESTORE = "STATE_RESTORE"
    MANUAL_RESET = "MANUAL_RESET"


class IntentPolicy(BaseModel):
    """Configuration governing intent lifecycle transitions and policies."""

    model_config = ConfigDict(frozen=True)

    policy_id: str = "default_intent_policy"
    version: str = "v1.0.0"
    candidate_timeout_ms: float = Field(
        default=1000.0, description="Max time candidate may wait for confirmation"
    )
    confirmation_acceptance_window_ms: float = Field(
        default=500.0, description="Max time confirmed intent waits for activation"
    )
    active_intent_timeout_ms: float = Field(
        default=2000.0, description="Max time an intent may remain active before expiring"
    )
    allow_replacement: bool = Field(
        default=True, description="Allow a new confirmed intent to replace current active"
    )
    replacement_requires_confirmation: bool = Field(
        default=True, description="Replacement requires confirmed temporal evidence"
    )
    same_class_reconfirmation_cooldown_ms: float = Field(
        default=1000.0, description="Cooldown for reconfirming identical class"
    )
    cross_class_replacement_policy: str = Field(default="REQUIRE_CONFIRMATION")
    subject_change_policy: str = Field(default="INTERRUPT_AND_RESET")
    session_change_policy: str = Field(default="INTERRUPT_AND_RESET")
    model_change_policy: str = Field(default="INTERRUPT_AND_RESET")
    rest_handling_policy: str = Field(default="CANCEL_CANDIDATE")
    parameters: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    checksum: str = ""

    def compute_checksum(self) -> str:
        data = {
            "policy_id": self.policy_id,
            "version": self.version,
            "candidate_timeout_ms": self.candidate_timeout_ms,
            "active_intent_timeout_ms": self.active_intent_timeout_ms,
            "allow_replacement": self.allow_replacement,
            "cross_class_replacement_policy": self.cross_class_replacement_policy,
        }
        raw = json.dumps(data, sort_keys=True)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class IntentRecord(BaseModel):
    """Persistent entity representing an intent throughout its lifecycle."""

    model_config = ConfigDict(frozen=True)

    intent_id: str
    intent_class: str
    current_state: IntentLifecycleState
    subject_id: str | None = None
    session_id: str | None = None
    model_version_id: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    confidence_band: ConfidenceBand
    eligibility: ConfidenceEligibility
    source_event_id: str | None = None
    confidence_evaluation_id: str | None = None
    temporal_confirmation_id: str | None = None
    created_at: str
    updated_at: str
    state_deadline: float | None = None
    is_terminal: bool = False
    terminal_reason: IntentTransitionReason | None = None
    policy_version: str = "v1.0.0"


class IntentStateTransition(BaseModel):
    """Immutable transition audit log entry."""

    model_config = ConfigDict(frozen=True)

    transition_id: str
    sequence_number: int
    intent_id: str | None = None
    intent_class: str | None = None
    previous_state: IntentLifecycleState
    next_state: IntentLifecycleState
    trigger: IntentTransitionTrigger
    reason: IntentTransitionReason
    subject_id: str | None = None
    session_id: str | None = None
    model_version_id: str | None = None
    source_event_id: str | None = None
    confidence_score: float | None = None
    policy_version: str = "v1.0.0"
    timestamp: str
    details: str | None = None


class IntentStateSnapshot(BaseModel):
    """Authoritative snapshot consumed by Phase 17 Safety Arbitration."""

    model_config = ConfigDict(frozen=True)

    snapshot_id: str
    active_intent_id: str | None = None
    current_state: IntentLifecycleState = IntentLifecycleState.NO_INTENT
    intent_class: str | None = None
    subject_id: str | None = None
    session_id: str | None = None
    model_version_id: str | None = None
    confidence_score: float | None = None
    confidence_evaluation_id: str | None = None
    temporal_confirmation_id: str | None = None
    created_at: str
    updated_at: str
    state_deadline: float | None = None
    transition_reason: IntentTransitionReason = IntentTransitionReason.STATE_RESTORE
    policy_version: str = "v1.0.0"
    transition_count: int = 0


class IntentIngestRequest(BaseModel):
    """Payload consumed from Phase 15 handoff."""

    prediction: str
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_band: ConfidenceBand
    eligibility: ConfidenceEligibility
    temporal_status: str
    temporally_confirmed: bool
    confirmation_timestamp: float | None = None
    confirmation_reason: str
    model_version_id: str
    subject_id: str | None = None
    session_id: str | None = None
    evidence_window_count: int = 0
    evidence_duration_ms: float = 0.0
    source_event_id: str | None = None


class IntentCancelRequest(BaseModel):
    intent_id: str | None = None
    reason: IntentTransitionReason = IntentTransitionReason.EXPLICIT_CANCEL
    details: str | None = None


class IntentCompleteRequest(BaseModel):
    intent_id: str | None = None
    reason: IntentTransitionReason = IntentTransitionReason.EXPLICIT_COMPLETE
    details: str | None = None


class IntentResetRequest(BaseModel):
    reason: IntentTransitionReason = IntentTransitionReason.MANUAL_RESET
    details: str | None = None


class IntentScenarioStep(BaseModel):
    step: int
    action: str
    previous_state: IntentLifecycleState
    next_state: IntentLifecycleState
    intent_id: str | None = None
    intent_class: str | None = None
    reason: IntentTransitionReason
    note: str | None = None


class IntentScenarioResponse(BaseModel):
    scenario_id: str
    executed_at: str
    passed: bool
    results: list[IntentScenarioStep]
    final_snapshot: IntentStateSnapshot
