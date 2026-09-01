"""Domain models and schemas for CSP spatial filtering and classical decoders."""

import hashlib
import json
from enum import StrEnum

from pydantic import BaseModel, Field

from ..epoching.models import NormalizedLabel


class ClassifierType(StrEnum):
    """Supported classical classifier algorithms."""

    LDA = "LDA"
    SVM_LINEAR = "SVM_LINEAR"
    SVM_RBF = "SVM_RBF"
    DUMMY = "DUMMY"


class EvaluationProtocol(StrEnum):
    """Cross-validation and evaluation protocols."""

    LEAVE_ONE_SUBJECT_OUT = "LEAVE_ONE_SUBJECT_OUT"
    GROUP_K_FOLD = "GROUP_K_FOLD"
    STRATIFIED_GROUP_K_FOLD = "STRATIFIED_GROUP_K_FOLD"
    WITHIN_SUBJECT_K_FOLD = "WITHIN_SUBJECT_K_FOLD"


class EvaluationMode(StrEnum):
    """Scope of evaluation across subjects/sessions."""

    INTER_SUBJECT = "INTER_SUBJECT"
    INTRA_SUBJECT = "INTRA_SUBJECT"
    CROSS_SESSION = "CROSS_SESSION"


class ModelStatus(StrEnum):
    """Lifecycle status of trained models."""

    ACTIVE_RESEARCH = "ACTIVE_RESEARCH"
    ARCHIVED = "ARCHIVED"
    INVALID = "INVALID"


class DecoderRunStatus(StrEnum):
    """Execution status of a benchmark decoding run."""

    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ClassificationTask(BaseModel):
    """Specification of a motor-imagery classification task."""

    task_id: str
    task_name: str
    description: str
    class_labels: list[NormalizedLabel]
    label_mapping: dict[NormalizedLabel, int]
    version: str = "1.0.0"


class CSPConfig(BaseModel):
    """Configuration for Common Spatial Patterns spatial filter."""

    csp_version: str = "MNE_CSP_V1"
    n_components: int = Field(default=4, ge=2, le=32)
    cov_est: str = "concat"  # 'concat' | 'epoch'
    log: bool = True
    norm_trace: bool = False
    regularization: float | str | None = None  # None | 'empirical' | float
    component_order: str = "mutual_info"  # 'mutual_info' | 'alternate'
    transform_into: str = "average_power"  # 'average_power' | 'csp_space'


class ClassifierConfig(BaseModel):
    """Configuration for classical classifier."""

    classifier_id: str
    classifier_type: ClassifierType
    solver: str = "svd"  # for LDA: 'svd' | 'lsqr' | 'eigen'
    shrinkage: float | str | None = None  # for LDA
    kernel: str = "linear"  # for SVM: 'linear' | 'rbf'
    c_param: float = 1.0  # for SVM
    gamma: float | str = "scale"  # for SVM
    dummy_strategy: str = "prior"  # for DUMMY
    random_state: int | None = 42
    version: str = "1.0.0"


class DecoderPipelineConfig(BaseModel):
    """Complete specification of a classical decoding pipeline."""

    pipeline_version: str = "DECODER_PIPELINE_V1"
    task_id: str
    epoch_set_id: str
    channels: list[str] = Field(default_factory=list)
    csp_config: CSPConfig = Field(default_factory=CSPConfig)
    classifier_config: ClassifierConfig
    evaluation_protocol: EvaluationProtocol = EvaluationProtocol.LEAVE_ONE_SUBJECT_OUT
    evaluation_mode: EvaluationMode = EvaluationMode.INTER_SUBJECT
    n_splits: int = Field(default=5, ge=2, le=50)
    scale_features: bool = False
    random_state: int = 42
    config_hash: str | None = None

    def compute_hash(self) -> str:
        """Compute stable SHA-256 fingerprint excluding volatile fields."""
        payload = {
            "pipeline_version": self.pipeline_version,
            "task_id": self.task_id,
            "epoch_set_id": self.epoch_set_id,
            "channels": sorted(self.channels),
            "csp_config": self.csp_config.model_dump(),
            "classifier_config": self.classifier_config.model_dump(),
            "evaluation_protocol": self.evaluation_protocol.value,
            "evaluation_mode": self.evaluation_mode.value,
            "n_splits": self.n_splits,
            "scale_features": self.scale_features,
            "random_state": self.random_state,
        }
        serialized = json.dumps(payload, sort_keys=True)
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        self.config_hash = digest[:16]
        return self.config_hash


class ConfusionMatrixData(BaseModel):
    """Confusion matrix with raw and normalized percentages."""

    labels: list[str]
    matrix: list[list[int]]
    normalized_matrix: list[list[float]]


class CVFoldResult(BaseModel):
    """Results for an individual cross-validation fold."""

    fold_id: int
    train_subjects: list[str]
    test_subjects: list[str]
    train_epochs: int
    test_epochs: int
    accuracy: float
    balanced_accuracy: float
    precision: float
    recall: float
    f1: float
    confusion_matrix: ConfusionMatrixData


class PerSubjectMetric(BaseModel):
    """Decoded performance breakdown for a single subject."""

    subject_id: str
    epoch_count: int
    accuracy: float
    balanced_accuracy: float
    f1: float


class MetricStats(BaseModel):
    """Statistical summary across cross-validation folds."""

    mean: float
    std: float
    median: float
    min: float
    max: float


class ClassificationMetrics(BaseModel):
    """Aggregate cross-validation performance metrics."""

    accuracy: MetricStats
    balanced_accuracy: MetricStats
    precision: MetricStats
    recall: MetricStats
    f1: MetricStats
    chance_level: float = 0.5
    class_distribution: dict[str, int]
    confusion_matrix: ConfusionMatrixData
    per_subject_metrics: list[PerSubjectMetric]
    per_fold_results: list[CVFoldResult]


class CSPPatternData(BaseModel):
    """Spatial filter and pattern weights for CSP visualization."""

    channels: list[str]
    n_components: int
    patterns: list[list[float]]  # (n_components x n_channels)
    filters: list[list[float]]  # (n_components x n_channels)
    eigenvalues: list[float] | None = None


class ModelManifest(BaseModel):
    """Complete provenance manifest for a trained classical decoder."""

    model_id: str
    pipeline_version: str = "DECODER_PIPELINE_V1"
    task: ClassificationTask
    dataset_id: str | None = None
    source_epoch_set_id: str
    subjects: list[str]
    channels: list[str]
    sampling_rate_hz: float
    csp_config: CSPConfig
    classifier_config: ClassifierConfig
    evaluation_protocol: EvaluationProtocol
    evaluation_mode: EvaluationMode
    metrics: ClassificationMetrics
    csp_patterns: CSPPatternData | None = None
    artifact_file_path: str
    artifact_checksum_sha256: str
    config_hash: str
    status: ModelStatus = ModelStatus.ACTIVE_RESEARCH
    software_versions: dict[str, str] = Field(default_factory=dict)
    created_at: str


class ModelSummary(BaseModel):
    """Compact summary of a registered model."""

    model_id: str
    task_id: str
    dataset_id: str | None = None
    source_epoch_set_id: str
    classifier_type: ClassifierType
    n_components: int
    evaluation_protocol: EvaluationProtocol
    accuracy_mean: float
    balanced_accuracy_mean: float
    f1_mean: float
    status: ModelStatus
    artifact_file_path: str
    artifact_checksum_sha256: str
    created_at: str


class DecoderRun(BaseModel):
    """Record of a benchmark training execution."""

    run_id: str
    model_id: str | None = None
    task_id: str
    epoch_set_id: str
    config: DecoderPipelineConfig
    status: DecoderRunStatus
    started_at: str
    finished_at: str | None = None
    metrics: ClassificationMetrics | None = None
    error_message: str | None = None


class BenchmarkPreview(BaseModel):
    """Pre-execution validation of a decoder pipeline configuration."""

    valid: bool
    task_id: str
    epoch_set_id: str
    total_epochs: int
    eligible_epochs: int
    excluded_epochs: int
    class_distribution: dict[str, int]
    subjects_found: list[str]
    subject_count: int
    channels: list[str]
    sampling_rate_hz: float
    protocol: EvaluationProtocol
    expected_folds: int
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class PredictionRequest(BaseModel):
    """Offline/replay prediction request."""

    model_id: str
    epoch_set_id: str | None = None
    epoch_id: str | None = None
    trial_data: list[list[float]] | None = None  # (channels x times)


class PredictionResponse(BaseModel):
    """Offline/replay prediction output."""

    prediction_id: str
    model_id: str
    task_id: str
    predicted_label: NormalizedLabel
    predicted_class_index: int
    decision_score: dict[str, float] | None = None
    probabilities: dict[str, float] | None = None
    source_epoch_id: str | None = None
    source_subject_id: str | None = None
    true_label: NormalizedLabel | None = None
    operating_mode: str = "RESEARCH"
    created_at: str
