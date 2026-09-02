"""Domain models, enumerations, and schemas for Phase 17 Safety Arbitration."""

from __future__ import annotations

from enum import IntEnum, StrEnum
from typing import Any

from pydantic import BaseModel, Field

from ..domain.enums import SafetyDecision


class SafetyArbitrationState(StrEnum):
    """Authoritative finite states of the Safety Arbitration State Machine."""

    SAFE_IDLE = "SAFE_IDLE"
    EVALUATING = "EVALUATING"
    AUTHORIZED = "AUTHORIZED"
    HELD = "HELD"
    DENIED = "DENIED"
    EMERGENCY_STOP = "EMERGENCY_STOP"
    LOCKED_OUT = "LOCKED_OUT"
    RESET_PENDING = "RESET_PENDING"


class RuleStatus(StrEnum):
    """Execution status of an individual safety rule."""

    PASS = "PASS"
    WARN = "WARN"
    HOLD = "HOLD"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"


class RuleSeverity(StrEnum):
    """Severity tier of rule violation or warning."""

    INFO = "INFO"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class PrecedenceRank(IntEnum):
    """Deterministic precedence ranking (Rank 1 is the most restrictive)."""

    EMERGENCY_STOP = 1
    LOCKED_OUT = 2
    INVALID_INPUT = 3
    CRITICAL_HEALTH = 4
    HARD_CONSTRAINT = 5
    CONTEXT_STALE = 6
    OPERATOR_HOLD = 7
    TEMPORARY_HOLD = 8
    AUTHORIZED = 9


class SafetyRuleResult(BaseModel):
    """Audit outcome of a single evaluated safety rule."""

    rule_id: str
    category: str
    status: RuleStatus
    severity: RuleSeverity
    reason_code: str
    message: str
    evidence: dict[str, Any] = Field(default_factory=dict)
    evaluated_at: str


class SafetyEvaluation(BaseModel):
    """Complete auditable record of an execution authorization decision."""

    evaluation_id: str
    decision: SafetyDecision
    state: SafetyArbitrationState
    primary_reason: str
    precedence_rank: int
    all_reasons: list[str] = Field(default_factory=list)
    violated_rules: list[SafetyRuleResult] = Field(default_factory=list)
    passed_rules: list[SafetyRuleResult] = Field(default_factory=list)
    policy_version: str
    intent_id: str | None = None
    intent_class: str | None = None
    subject_id: str | None = None
    session_id: str | None = None
    model_version_id: str | None = None
    confidence_score: float | None = None
    confidence_evaluation_id: str | None = None
    temporal_confirmation_id: str | None = None
    evaluated_at: str
    duration_ms: float = 0.0


class SafetyStateSnapshot(BaseModel):
    """Authoritative singleton snapshot of the current safety gate state."""

    snapshot_id: str
    current_state: SafetyArbitrationState
    last_decision: SafetyDecision
    active_intent_id: str | None = None
    intent_class: str | None = None
    primary_reason: str
    active_policy_version: str
    emergency_stop: bool = False
    emergency_stop_reason: str | None = None
    operator_hold: bool = False
    operator_id: str | None = None
    lockout: bool = False
    lockout_reason: str | None = None
    system_healthy: bool = True
    stream_healthy: bool = True
    last_evaluation_id: str | None = None
    state_deadline: float | None = None
    transition_count: int = 0
    created_at: str
    updated_at: str


class SafetyStateTransition(BaseModel):
    """Immutable transition record in the safety state transition audit log."""

    transition_id: str
    sequence_number: int
    previous_state: SafetyArbitrationState
    next_state: SafetyArbitrationState
    trigger_name: str
    reason: str
    evaluation_id: str | None = None
    intent_id: str | None = None
    policy_version: str
    timestamp: str
    details: dict[str, Any] | None = None


class SafetyDiagnostics(BaseModel):
    """Operational metrics and diagnostic counters for safety arbitration."""

    evaluation_count: int = 0
    authorized_count: int = 0
    held_count: int = 0
    denied_count: int = 0
    emergency_stop_count: int = 0
    lockout_count: int = 0
    top_denial_reasons: dict[str, int] = Field(default_factory=dict)
    current_state_duration_ms: float = 0.0
    health_failures: int = 0
    rate_limit_violations: int = 0


class SafetyScenarioResult(BaseModel):
    """Outcome of a deterministic simulation scenario run."""

    scenario_id: str
    name: str
    description: str
    expected_decision: SafetyDecision
    actual_decision: SafetyDecision
    expected_state: SafetyArbitrationState
    actual_state: SafetyArbitrationState
    passed: bool
    steps_audit: list[dict[str, Any]] = Field(default_factory=list)
    evaluation: SafetyEvaluation | None = None
