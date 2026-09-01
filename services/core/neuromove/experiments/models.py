"""Pydantic Domain Models for Phase 12 AI Model Laboratory."""

from __future__ import annotations

import hashlib
import json
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from neuromove.decoding.models import (
    ClassificationMetrics,
    ClassificationTask,
    CSPConfig,
    EvaluationMode,
    EvaluationProtocol,
)


class ModelFamily(StrEnum):
    DUMMY = "DUMMY"
    LDA = "LDA"
    SVM_LINEAR = "SVM_LINEAR"
    SVM_RBF = "SVM_RBF"
    LOGISTIC_REGRESSION = "LOGISTIC_REGRESSION"
    RANDOM_FOREST = "RANDOM_FOREST"


class FeatureRepresentation(StrEnum):
    CSP_LOG_POWER = "CSP_LOG_POWER"
    BAND_POWER = "BAND_POWER"
    LOG_BAND_POWER = "LOG_BAND_POWER"
    COVARIANCE = "COVARIANCE"


class SearchType(StrEnum):
    NONE = "NONE"
    GRID = "GRID"
    RANDOM = "RANDOM"


class ExperimentStatus(StrEnum):
    DRAFT = "DRAFT"
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    ARCHIVED = "ARCHIVED"


class ExperimentStage(StrEnum):
    VALIDATING_DATA = "VALIDATING_DATA"
    BUILDING_FOLDS = "BUILDING_FOLDS"
    SEARCHING = "SEARCHING"
    FITTING = "FITTING"
    EVALUATING = "EVALUATING"
    ANALYZING = "ANALYZING"
    PERSISTING = "PERSISTING"

    COMPLETE = "COMPLETE"


class SearchConfig(BaseModel):
    search_type: SearchType = SearchType.NONE
    n_iter: int = Field(default=10, ge=1)
    param_grid: dict[str, list[Any]] = Field(default_factory=dict)
    scoring: str = "balanced_accuracy"
    inner_cv_splits: int = Field(default=3, ge=2)


class SearchCandidateResult(BaseModel):
    candidate_id: str
    parameters: dict[str, Any]
    mean_inner_score: float
    std_inner_score: float
    rank: int


class SearchResult(BaseModel):
    search_type: SearchType
    total_candidates: int
    best_parameters: dict[str, Any]
    best_inner_score: float
    candidates: list[SearchCandidateResult]


class FoldAssignment(BaseModel):
    fold_id: int
    train_subjects: list[str]
    test_subjects: list[str]
    train_epoch_count: int
    test_epoch_count: int
    train_class_counts: dict[str, int]
    test_class_counts: dict[str, int]
    fold_hash: str
    inner_search_result: SearchResult | None = None


class OutOfFoldPredictionRecord(BaseModel):
    epoch_id: str
    subject_id: str
    session_id: str = "session_01"
    run_id: str = "run_01"
    true_label: str
    predicted_label: str
    is_correct: bool
    decision_score: float | None = None
    probability_vector: dict[str, float] | None = None
    fold_id: int
    model_id: str
    experiment_id: str


class OutOfFoldPredictionSet(BaseModel):
    experiment_id: str
    total_predictions: int
    coverage_percentage: float
    predictions: list[OutOfFoldPredictionRecord]


class PerSessionMetric(BaseModel):
    subject_id: str
    session_id: str
    epoch_count: int
    accuracy: float
    balanced_accuracy: float
    f1: float


class ConfusedClassPair(BaseModel):
    true_label: str
    predicted_label: str
    count: int


class DifficultSubject(BaseModel):
    subject_id: str
    error_rate: float
    total_samples: int
    z_score: float


class DifficultSession(BaseModel):
    subject_id: str
    session_id: str
    error_rate: float
    total_samples: int


class ErrorAnalysisResult(BaseModel):
    total_errors: int
    overall_error_rate: float
    most_confused_pairs: list[ConfusedClassPair]
    difficult_subjects: list[DifficultSubject]
    difficult_sessions: list[DifficultSession]
    misclassified_epoch_ids: list[str]


class ExperimentConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    experiment_version: Literal["AI_EXPERIMENT_V1"] = "AI_EXPERIMENT_V1"
    dataset_id: str
    epoch_set_id: str
    task_id: str = "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1"
    representation: FeatureRepresentation = FeatureRepresentation.CSP_LOG_POWER
    model_family: ModelFamily = ModelFamily.LDA
    model_params: dict[str, Any] = Field(default_factory=dict, alias="model_config")
    csp_config: CSPConfig = Field(default_factory=CSPConfig)
    evaluation_protocol: EvaluationProtocol = EvaluationProtocol.LEAVE_ONE_SUBJECT_OUT
    evaluation_mode: EvaluationMode = EvaluationMode.INTER_SUBJECT
    n_splits: int = Field(default=5, ge=2)
    scale_features: bool = False
    search_config: SearchConfig = Field(default_factory=SearchConfig)
    channels: list[str] = Field(default_factory=list)
    random_state: int = 42

    def compute_deterministic_hash(self) -> str:
        """Compute stable deterministic SHA-256 hash excluding volatile fields."""
        payload = {
            "experiment_version": self.experiment_version,
            "dataset_id": self.dataset_id,
            "epoch_set_id": self.epoch_set_id,
            "task_id": self.task_id,
            "representation": self.representation.value,
            "model_family": self.model_family.value,
            "model_config": self.model_params,
            "csp_config": self.csp_config.model_dump(),
            "evaluation_protocol": self.evaluation_protocol.value,
            "evaluation_mode": self.evaluation_mode.value,
            "n_splits": self.n_splits,
            "scale_features": self.scale_features,
            "search_config": self.search_config.model_dump(),
            "channels": sorted(self.channels),
            "random_state": self.random_state,
        }
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]

    @property
    def experiment_id(self) -> str:
        return f"exp_{self.compute_deterministic_hash()}"


class AblationVariantConfig(BaseModel):
    variant_name: str
    param_value: Any
    config: ExperimentConfig


class AblationConfig(BaseModel):
    ablation_id: str
    name: str
    description: str
    baseline_experiment_config: ExperimentConfig
    ablation_variable: str
    variants: list[AblationVariantConfig]


class AblationVariantResult(BaseModel):
    variant_name: str
    param_value: Any
    metrics: ClassificationMetrics
    delta_balanced_accuracy: float
    delta_f1: float
    experiment_id: str


class AblationStudyResult(BaseModel):
    ablation_id: str
    name: str
    ablation_variable: str
    baseline_experiment_id: str
    baseline_metrics: ClassificationMetrics
    variants: list[AblationVariantResult]
    created_at: str


class ModelCard(BaseModel):
    model_id: str
    experiment_id: str
    intended_use: str
    training_data_summary: str
    task: ClassificationTask
    feature_representation: FeatureRepresentation
    model_family: ModelFamily
    validation_protocol: str
    metrics_summary: dict[str, float]
    known_limitations: list[str]
    failure_modes: list[str]
    provenance_chain: dict[str, Any]
    software_versions: dict[str, str]
    artifact_checksum_sha256: str
    markdown_content: str
    created_at: str


class ModelComparisonEntry(BaseModel):
    experiment_id: str
    model_family: ModelFamily
    representation: FeatureRepresentation
    parameters: dict[str, Any]
    metrics: ClassificationMetrics


class ModelComparisonResult(BaseModel):
    comparison_id: str
    comparison_name: str
    common_task_id: str
    common_protocol: str
    common_dataset_id: str
    entries: list[ModelComparisonEntry]
    created_at: str


class ExperimentRun(BaseModel):
    run_id: str
    experiment_id: str
    stage: ExperimentStage
    progress: float
    status: ExperimentStatus
    error_message: str | None = None
    started_at: str
    completed_at: str | None = None


class ExperimentSummary(BaseModel):
    experiment_id: str
    dataset_id: str
    epoch_set_id: str
    task_id: str
    model_family: ModelFamily
    representation: FeatureRepresentation
    evaluation_protocol: EvaluationProtocol
    balanced_accuracy_mean: float
    f1_mean: float
    accuracy_mean: float
    status: ExperimentStatus
    has_search: bool
    created_at: str


class ExperimentPreview(BaseModel):
    valid: bool
    experiment_id: str
    dataset_id: str
    epoch_set_id: str
    task_id: str
    representation: FeatureRepresentation
    model_family: ModelFamily
    total_epochs: int
    eligible_epochs: int
    excluded_epochs: int
    class_distribution: dict[str, int]
    subjects: list[str]
    subject_count: int
    channels: list[str]
    expected_outer_folds: int
    search_candidate_count: int
    warnings: list[str]
    errors: list[str]


class ExperimentDetail(BaseModel):
    experiment_id: str
    config: ExperimentConfig
    config_hash: str
    status: ExperimentStatus
    task: ClassificationTask
    dataset_id: str
    epoch_set_id: str
    subjects: list[str]
    channels: list[str]
    sampling_rate_hz: float
    folds: list[FoldAssignment]
    metrics: ClassificationMetrics
    per_session_metrics: list[PerSessionMetric]
    error_analysis: ErrorAnalysisResult
    model_id: str
    artifact_file_path: str
    artifact_checksum_sha256: str
    software_versions: dict[str, str]
    created_at: str
