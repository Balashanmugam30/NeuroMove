"""Domain models, enums, and cryptographic identifiers for Phase 14 Adaptive Learning."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from neuromove.decoding.models import ConfusionMatrixData
from neuromove.experiments.models import FeatureRepresentation, ModelFamily

# ============================================================================
# 1. Enums
# ============================================================================


class AdaptationMode(StrEnum):
    """Adaptation operational modes."""

    BATCH_ADAPTATION = "BATCH_ADAPTATION"
    CALIBRATION_REFRESH = "CALIBRATION_REFRESH"
    PERSONALIZED_REFRESH = "PERSONALIZED_REFRESH"


class AdaptationScope(StrEnum):
    """Adaptation target scope."""

    SUBJECT = "SUBJECT"
    POPULATION = "POPULATION"


class ModelLifecycleStatus(StrEnum):
    """Lifecycle status for versioned research models."""

    ACTIVE_RESEARCH = "ACTIVE_RESEARCH"
    CANDIDATE = "CANDIDATE"
    VALIDATED = "VALIDATED"
    REJECTED = "REJECTED"
    ROLLED_BACK = "ROLLED_BACK"
    ARCHIVED = "ARCHIVED"
    STALE = "STALE"
    INVALID = "INVALID"


class AdaptationRunStatus(StrEnum):
    """Execution status for an adaptation pipeline run."""

    PLANNED = "PLANNED"
    VALIDATING_DATA = "VALIDATING_DATA"
    BUILDING_TRAINING_SET = "BUILDING_TRAINING_SET"
    TRAINING = "TRAINING"
    VALIDATING = "VALIDATING"
    COMPARING = "COMPARING"
    APPROVAL_PENDING = "APPROVAL_PENDING"
    PROMOTED = "PROMOTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"


class DataRetentionStrategy(StrEnum):
    """Data retention strategy during candidate adaptation."""

    NEW_DATA_ONLY = "NEW_DATA_ONLY"
    NEW_PLUS_RETAINED_DATA = "NEW_PLUS_RETAINED_DATA"
    BASELINE_PLUS_NEW = "BASELINE_PLUS_NEW"


class ClassImbalancePolicy(StrEnum):
    """Policy when encountering class distribution imbalance in new data."""

    REJECT = "REJECT"
    WARN = "WARN"
    ALLOW = "ALLOW"


class PromotionDecisionStatus(StrEnum):
    """Promotion decision state."""

    PROMOTED = "PROMOTED"
    REJECTED = "REJECTED"
    PENDING_REVIEW = "PENDING_REVIEW"


class DriftStatus(StrEnum):
    """Research distribution shift diagnostic state."""

    STABLE = "STABLE"
    MONITOR = "MONITOR"
    SHIFT_DETECTED = "SHIFT_DETECTED"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    NOT_EVALUATED = "NOT_EVALUATED"


# ============================================================================
# 2. Hash & Identifier Helper Functions
# ============================================================================


def generate_batch_id(source_fingerprint: str, timestamp_str: str) -> str:
    """Generate deterministic batch ID."""
    content = f"{source_fingerprint}_{timestamp_str}"
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    return f"adb_{digest}"


def generate_adaptation_id(base_model_id: str, batch_ids: list[str], policy_id: str) -> str:
    """Generate deterministic adaptation run ID."""
    content = f"{base_model_id}_{sorted(batch_ids)}_{policy_id}"
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    return f"adapt_{digest}"


def generate_version_id(model_id: str, version_number: int) -> str:
    """Generate deterministic model version ID."""
    content = f"{model_id}_v{version_number}"
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    return f"ver_{digest}"


def generate_decision_id(adaptation_id: str, decision: str) -> str:
    """Generate deterministic promotion decision ID."""
    content = f"{adaptation_id}_{decision}"
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    return f"dec_{digest}"


def generate_rollback_id(from_model_id: str, to_model_id: str) -> str:
    """Generate deterministic rollback event ID."""
    content = f"{from_model_id}_{to_model_id}_{datetime.now(UTC).isoformat()}"
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    return f"rbk_{digest}"


def generate_drift_id(subject_id: str | None, dataset_id: str | None, window: str) -> str:
    """Generate deterministic drift observation ID."""
    content = f"{subject_id}_{dataset_id}_{window}_{datetime.now(UTC).isoformat()}"
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    return f"drf_{digest}"


# ============================================================================
# 3. Domain Models
# ============================================================================


class AdaptationPolicy(BaseModel):
    """Declarative adaptation policy governing eligibility and promotion."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    policy_id: str
    policy_version: str = "ADAPTATION_POLICY_V1"
    name: str
    description: str | None = None
    mode: AdaptationMode = AdaptationMode.BATCH_ADAPTATION
    scope: AdaptationScope = AdaptationScope.SUBJECT
    min_new_trials: int = Field(default=10, ge=1)
    min_trials_per_class: int = Field(default=4, ge=1)
    max_rejection_ratio: float = Field(default=0.4, ge=0.0, le=1.0)
    retention_strategy: DataRetentionStrategy = DataRetentionStrategy.BASELINE_PLUS_NEW
    imbalance_policy: ClassImbalancePolicy = ClassImbalancePolicy.WARN
    max_allowed_regression: float = Field(default=0.05, ge=0.0, le=1.0)
    min_promoted_balanced_accuracy: float = Field(default=0.60, ge=0.0, le=1.0)
    min_validation_samples: int = Field(default=6, ge=1)
    validation_strategy: str = "PROTECTED_HOLDOUT"
    random_state: int = 42
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class CreateAdaptationPolicyRequest(BaseModel):
    """Request payload to create a new adaptation policy."""

    model_config = ConfigDict(extra="forbid")

    name: str
    description: str | None = None
    mode: AdaptationMode = AdaptationMode.BATCH_ADAPTATION
    scope: AdaptationScope = AdaptationScope.SUBJECT
    min_new_trials: int = 10
    min_trials_per_class: int = 4
    max_rejection_ratio: float = 0.4
    retention_strategy: DataRetentionStrategy = DataRetentionStrategy.BASELINE_PLUS_NEW
    imbalance_policy: ClassImbalancePolicy = ClassImbalancePolicy.WARN
    max_allowed_regression: float = 0.05
    min_promoted_balanced_accuracy: float = 0.60
    min_validation_samples: int = 6
    random_state: int = 42


class AdaptationDataBatch(BaseModel):
    """Immutable batch of candidate trials/epochs for adaptation."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    batch_id: str
    name: str
    subject_id: str | None = None
    source_mode: str = "SIMULATION"  # "SIMULATION" or "REPLAY"
    dataset_id: str | None = None
    recording_id: str | None = None
    epoch_set_id: str | None = None
    feature_set_id: str | None = None
    trial_count: int
    class_distribution: dict[str, int]
    quality_summary: dict[str, Any]
    source_fingerprint: str
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ModelVersion(BaseModel):
    """Version node in the parent-linked model registry graph."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    version_id: str
    model_id: str
    parent_model_id: str | None = None
    version_number: int
    scope: AdaptationScope
    subject_id: str | None = None
    status: ModelLifecycleStatus
    is_active: bool = False
    adaptation_id: str | None = None
    model_family: ModelFamily
    representation: FeatureRepresentation
    task_id: str
    metrics: dict[str, float]
    artifact_checksum_sha256: str
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class AdaptationPreviewRequest(BaseModel):
    """Request payload to compute a pre-flight adaptation preview."""

    model_config = ConfigDict(extra="forbid")

    base_model_id: str
    data_batch_ids: list[str]
    policy_id: str
    scope: AdaptationScope = AdaptationScope.SUBJECT
    subject_id: str | None = None


class AdaptationPreview(BaseModel):
    """Pre-flight preview of compatibility, composition, and promotion requirements."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    base_model_id: str
    base_model_version: int
    scope: AdaptationScope
    subject_id: str | None = None
    policy_id: str
    policy_name: str
    compatibility_status: str  # "COMPATIBLE", "INCOMPATIBLE", "WARNING"
    compatibility_issues: list[str]
    duplicate_epoch_count: int
    data_composition: dict[str, int]
    class_balance: dict[str, float]
    promotion_requirements: list[str]
    can_proceed: bool


class StartAdaptationRunRequest(BaseModel):
    """Request payload to initiate a controlled adaptation run."""

    model_config = ConfigDict(extra="forbid")

    base_model_id: str
    data_batch_ids: list[str]
    policy_id: str
    scope: AdaptationScope = AdaptationScope.SUBJECT
    subject_id: str | None = None
    notes: str | None = None


class CandidateComparison(BaseModel):
    """Direct comparison between incumbent base model and candidate adapted model."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    incumbent_model_id: str
    candidate_model_id: str
    task_id: str
    validation_sample_count: int
    incumbent_balanced_accuracy: float
    candidate_balanced_accuracy: float
    delta_balanced_accuracy: float
    incumbent_f1: float
    candidate_f1: float
    delta_f1: float
    incumbent_accuracy: float
    candidate_accuracy: float
    delta_accuracy: float
    chance_level: float = 0.5
    incumbent_confusion_matrix: ConfusionMatrixData
    candidate_confusion_matrix: ConfusionMatrixData
    error_analysis: dict[str, int]
    is_regression: bool
    regression_amount: float


class PolicyCriterionResult(BaseModel):
    """Individual policy rule evaluation."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    criterion_name: str
    expected_rule: str
    observed_value: Any
    passed: bool


class PromotionEligibility(BaseModel):
    """Structured evaluation of promotion policy compliance."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    is_eligible: bool
    criteria_results: list[PolicyCriterionResult]
    failure_reasons: list[str]


class AdaptationRun(BaseModel):
    """Execution state and results of a controlled adaptation run."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    adaptation_id: str
    base_model_id: str
    candidate_model_id: str | None = None
    policy_id: str
    scope: AdaptationScope
    subject_id: str | None = None
    data_batch_ids: list[str]
    status: AdaptationRunStatus
    training_composition: dict[str, Any]
    validation_composition: dict[str, Any]
    leakage_check: dict[str, Any]
    incumbent_metrics: dict[str, float]
    candidate_metrics: dict[str, float] | None = None
    comparison: CandidateComparison | None = None
    promotion_eligibility: PromotionEligibility | None = None
    promotion_decision: dict[str, Any] | None = None
    started_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    completed_at: str | None = None


class PromoteCandidateRequest(BaseModel):
    """Request payload for explicit candidate promotion."""

    model_config = ConfigDict(extra="forbid")

    adaptation_id: str
    operator_notes: str | None = None


class RejectCandidateRequest(BaseModel):
    """Request payload for explicit candidate rejection."""

    model_config = ConfigDict(extra="forbid")

    adaptation_id: str
    rejection_reason: str


class PromotionDecision(BaseModel):
    """Immutable audit record of candidate promotion or rejection."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    decision_id: str
    adaptation_id: str
    base_model_id: str
    candidate_model_id: str
    decision: PromotionDecisionStatus
    decision_rule_version: str = "PROMOTION_RULE_V1"
    operator_action: str
    reasons: list[str]
    metrics_summary: dict[str, Any]
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class RollbackRequest(BaseModel):
    """Request payload for model rollback."""

    model_config = ConfigDict(extra="forbid")

    target_model_id: str
    reason: str


class RollbackEvent(BaseModel):
    """Immutable audit record of a model rollback event."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    rollback_id: str
    from_model_id: str
    to_model_id: str
    reason: str
    operator_action: str = "MANUAL_ROLLBACK"
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class DriftObservation(BaseModel):
    """Research diagnostic record of distribution shift."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    observation_id: str
    subject_id: str | None = None
    dataset_id: str | None = None
    window_label: str
    feature_shift_score: float
    class_distribution_shift: float
    signal_quality_score: float
    prediction_entropy: float | None = None
    status: DriftStatus
    thresholds: dict[str, float]
    details: dict[str, Any]
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class AdaptationManifest(BaseModel):
    """Comprehensive cryptographic provenance manifest for an adaptation run."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    manifest_version: str = "ADAPTATION_MANIFEST_V1"
    adaptation_id: str
    base_model_id: str
    candidate_model_id: str | None = None
    scope: AdaptationScope
    subject_id: str | None = None
    policy: AdaptationPolicy
    data_batch_ids: list[str]
    training_fingerprint: str
    validation_fingerprint: str
    comparison_summary: CandidateComparison | None = None
    promotion_decision: PromotionDecision | None = None
    software_versions: dict[str, str]
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
