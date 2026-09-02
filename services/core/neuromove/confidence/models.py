"""Canonical Domain Models and Schemas for Confidence Estimation & Temporal Confirmation."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


def generate_config_id() -> str:
    """Generate unique confidence configuration identifier."""
    return f"cfg_conf_{uuid.uuid4().hex[:12]}"


def generate_calibration_id() -> str:
    """Generate unique calibration profile identifier."""
    return f"calib_{uuid.uuid4().hex[:12]}"


def generate_decision_id() -> str:
    """Generate unique confidence decision identifier."""
    return f"dec_{uuid.uuid4().hex[:12]}"


def generate_event_id() -> str:
    """Generate unique temporal event identifier."""
    return f"evt_conf_{uuid.uuid4().hex[:12]}"


def generate_history_id() -> str:
    """Generate unique history record identifier."""
    return f"hist_{uuid.uuid4().hex[:12]}"


# ============================================================================
# 1. Enumerations
# ============================================================================


class ScoreType(StrEnum):
    """Underlying score format emitted by model."""

    PROBABILITY = "PROBABILITY"
    DECISION_MARGIN = "DECISION_MARGIN"
    CALIBRATED_PROBABILITY = "CALIBRATED_PROBABILITY"
    VOTE_RATIO = "VOTE_RATIO"


class ConfidenceEligibility(StrEnum):
    """Eligibility status of evaluated confidence score."""

    VALID = "VALID"
    LOW_SIGNAL = "LOW_SIGNAL"
    STALE = "STALE"
    MODEL_INVALID = "MODEL_INVALID"
    UNCALIBRATED = "UNCALIBRATED"
    INCOMPATIBLE = "INCOMPATIBLE"
    NO_PREDICTION = "NO_PREDICTION"
    INSUFFICIENT_MARGIN = "INSUFFICIENT_MARGIN"
    INSUFFICIENT_CONFIDENCE = "INSUFFICIENT_CONFIDENCE"


class ConfidenceBand(StrEnum):
    """Categorical confidence classification bands."""

    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"


class FreshnessStatus(StrEnum):
    """Temporal freshness flag for evaluated electrophysiological frame."""

    FRESH = "FRESH"
    AGING = "AGING"
    STALE = "STALE"
    UNKNOWN = "UNKNOWN"


class ModelValidityStatus(StrEnum):
    """Operational validation state of active decoding model."""

    ACTIVE = "ACTIVE"
    VALIDATED = "VALIDATED"
    NOT_EXPIRED = "NOT_EXPIRED"
    COMPATIBLE = "COMPATIBLE"
    NOT_ROLLED_BACK = "NOT_ROLLED_BACK"
    INACTIVE = "INACTIVE"
    INVALID = "INVALID"
    ROLLED_BACK = "ROLLED_BACK"


class CalibrationMethod(StrEnum):
    """Supported confidence calibration algorithms."""

    PLATT = "PLATT"
    ISOTONIC = "ISOTONIC"
    IDENTITY = "IDENTITY"
    MARGIN_SIGMOID = "MARGIN_SIGMOID"


class CalibrationScope(StrEnum):
    """Target scope of calibration parameters."""

    GLOBAL = "GLOBAL"
    MODEL = "MODEL"
    SUBJECT = "SUBJECT"
    SESSION = "SESSION"


class TemporalStatus(StrEnum):
    """Lifecycle state of temporal confirmation evidence tracking."""

    IDLE = "IDLE"
    TRACKING = "TRACKING"
    CONFIRMED = "CONFIRMED"
    COOLDOWN = "COOLDOWN"
    REFRACTORY = "REFRACTORY"
    STALE = "STALE"
    REJECTED = "REJECTED"
    RESET = "RESET"


class TemporalResetReason(StrEnum):
    """Deterministic machine-readable reason for temporal evidence reset."""

    CLASS_CHANGED = "CLASS_CHANGED"
    SIGNAL_INVALID = "SIGNAL_INVALID"
    STALE_DATA = "STALE_DATA"
    MODEL_CHANGED = "MODEL_CHANGED"
    SESSION_CHANGED = "SESSION_CHANGED"
    SUBJECT_CHANGED = "SUBJECT_CHANGED"
    MANUAL_RESET = "MANUAL_RESET"
    TIMEOUT = "TIMEOUT"
    STREAM_INTERRUPTION = "STREAM_INTERRUPTION"
    COOLDOWN_EXPIRED = "COOLDOWN_EXPIRED"


# ============================================================================
# 2. Configuration & Calibration Models
# ============================================================================


class ConfidenceConfig(BaseModel):
    """Deterministic configuration governing confidence estimation and confirmation gates."""

    model_config = ConfigDict(frozen=True)

    config_id: str = Field(default_factory=generate_config_id)
    version: str = "v1.0.0"
    scope: CalibrationScope = CalibrationScope.GLOBAL
    subject_id: str | None = None
    model_version_id: str | None = None
    high_threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    medium_threshold: float = Field(default=0.55, ge=0.0, le=1.0)
    min_eligible_confidence: float = Field(default=0.40, ge=0.0, le=1.0)
    min_consecutive_windows: int = Field(default=3, ge=1)
    min_duration_ms: float = Field(default=500.0, ge=0.0)
    max_gap_ms: float = Field(default=500.0, ge=0.0)
    cooldown_ms: float = Field(default=1000.0, ge=0.0)

    refractory_ms: float = Field(default=500.0, ge=0.0)
    hysteresis_enter: float = Field(default=0.75, ge=0.0, le=1.0)
    hysteresis_exit: float = Field(default=0.60, ge=0.0, le=1.0)
    max_age_ms: float = Field(default=400.0, ge=0.0)
    quality_floor: float = Field(default=0.50, ge=0.0, le=1.0)
    allow_same_class_reconfirmation: bool = False
    parameters: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    checksum: str = ""

    def model_post_init(self, __context: Any) -> None:
        if not self.checksum:
            content = f"{self.version}:{self.scope}:{self.high_threshold}:{self.medium_threshold}:{self.min_consecutive_windows}:{self.min_duration_ms}:{self.hysteresis_enter}:{self.hysteresis_exit}"
            digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
            object.__setattr__(self, "checksum", digest)


class ReliabilityBin(BaseModel):
    """Empirical reliability bin for calibration curve evaluation."""

    bin_center: float
    empirical_prob: float
    mean_confidence: float
    count: int


class CalibrationMetrics(BaseModel):
    """Statistical calibration and scoring metrics."""

    brier_score: float
    log_loss: float
    expected_calibration_error: float
    rejection_rate: float
    coverage: float
    precision_at_high_confidence: float
    reliability_curve: list[ReliabilityBin] = Field(default_factory=list)


class ConfidenceCalibrationProfile(BaseModel):
    """Fitted calibration parameter checkpoint with zero-leakage provenance."""

    calibration_id: str = Field(default_factory=generate_calibration_id)
    model_version_id: str
    scope: CalibrationScope = CalibrationScope.GLOBAL
    subject_id: str | None = None
    method: CalibrationMethod = CalibrationMethod.PLATT
    fit_dataset_reference: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    calibration_metrics: CalibrationMetrics
    status: str = "ACTIVE"
    checksum: str = ""
    fit_timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())

    def model_post_init(self, __context: Any) -> None:
        if not self.checksum:
            content = f"{self.model_version_id}:{self.method}:{self.fit_dataset_reference}:{json.dumps(self.parameters, sort_keys=True)}"
            digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
            object.__setattr__(self, "checksum", digest)


# ============================================================================
# 3. Inputs & Components
# ============================================================================


class ConfidenceInput(BaseModel):
    """Typed evaluation input for confidence estimation and temporal gating."""

    prediction: str
    raw_score: float
    score_type: ScoreType
    class_scores: dict[str, float] | None = None
    class_margin: float | None = None
    model_id: str
    model_version_id: str
    subject_id: str | None = None
    session_id: str | None = None
    window_id: str | None = None
    prediction_timestamp: float
    data_timestamp: float
    signal_quality: float = Field(default=1.0, ge=0.0, le=1.0)
    feature_compatibility: bool = True
    model_validity: ModelValidityStatus = ModelValidityStatus.ACTIVE
    calibration_status: str = "CALIBRATED"


class ConfidenceComponents(BaseModel):
    """Structured multi-factor confidence component breakdown."""

    model_score_component: float = Field(ge=0.0, le=1.0)
    class_margin_component: float = Field(ge=0.0, le=1.0)
    signal_quality_component: float = Field(ge=0.0, le=1.0)
    freshness_component: float = Field(ge=0.0, le=1.0)
    model_validity_component: float = Field(ge=0.0, le=1.0)
    calibration_component: float = Field(ge=0.0, le=1.0)


class ConfidenceDecision(BaseModel):
    """Authoritative normalized and gated confidence decision."""

    decision_id: str = Field(default_factory=generate_decision_id)
    prediction: str
    raw_score: float
    score_type: ScoreType
    normalized_score: float = Field(ge=0.0, le=1.0)
    calibrated_confidence: float = Field(ge=0.0, le=1.0)
    confidence_band: ConfidenceBand
    eligibility: ConfidenceEligibility
    class_margin: float
    runner_up_class: str | None = None
    signal_quality: float = Field(ge=0.0, le=1.0)
    freshness: FreshnessStatus
    model_validity: ModelValidityStatus
    components: ConfidenceComponents
    decision_reason: str
    timestamp: float
    model_version_id: str
    subject_id: str | None = None
    session_id: str | None = None


# ============================================================================
# 4. Temporal Confirmation Models
# ============================================================================


class TemporalConfirmationState(BaseModel):
    """State of consecutive evidence accumulation and confirmation tracking."""

    status: TemporalStatus = TemporalStatus.IDLE
    current_candidate: str | None = None
    candidate_started_at: float | None = None
    consecutive_count: int = 0
    accumulated_duration_ms: float = 0.0
    last_evidence_at: float | None = None
    confirmation_count: int = 0
    reset_count: int = 0
    cooldown_until: float | None = None
    refractory_until: float | None = None
    active_model_version_id: str | None = None
    active_subject_id: str | None = None
    active_session_id: str | None = None
    last_reset_reason: TemporalResetReason | None = None


class TemporalConfirmationDecision(BaseModel):
    """Authoritative temporal confirmation verdict for a given decision cycle."""

    temporally_confirmed: bool
    confirmed_prediction: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_band: ConfidenceBand
    eligibility: ConfidenceEligibility
    temporal_status: TemporalStatus
    consecutive_count: int
    accumulated_duration_ms: float
    required_count: int
    required_duration_ms: float
    confirmation_timestamp: float | None = None
    decision_reason: str
    model_version_id: str
    subject_id: str | None = None
    session_id: str | None = None


# ============================================================================
# 5. Phase 16 Intent Handoff Payload
# ============================================================================


class Phase16IntentHandoffPayload(BaseModel):
    """Immutable handoff record consumed by Phase 16 Intent State Machine."""

    prediction: str
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_band: ConfidenceBand
    eligibility: ConfidenceEligibility
    temporal_status: TemporalStatus
    temporally_confirmed: bool
    confirmation_timestamp: float | None = None
    confirmation_reason: str
    model_version_id: str
    subject_id: str | None = None
    session_id: str | None = None
    evidence_window_count: int
    evidence_duration_ms: float


# ============================================================================
# 6. Persistence & History Records
# ============================================================================


class ConfidenceHistoryRecord(BaseModel):
    """Persistent audit record for confidence telemetry stream."""

    history_id: str = Field(default_factory=generate_history_id)
    subject_id: str | None = None
    session_id: str | None = None
    model_version_id: str
    predicted_class: str
    confidence: float
    band: ConfidenceBand
    eligibility: ConfidenceEligibility
    temporal_status: TemporalStatus
    decision_reason: str
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class TemporalConfirmationEvent(BaseModel):
    """Persistent audit event for temporal confirmation lifecycle transitions."""

    event_id: str = Field(default_factory=generate_event_id)
    sequence_number: int
    event_type: str
    candidate_class: str | None = None
    consecutive_windows: int
    accumulated_duration_ms: float
    confidence_score: float
    decision_reason: str
    model_version_id: str
    subject_id: str | None = None
    session_id: str | None = None
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
