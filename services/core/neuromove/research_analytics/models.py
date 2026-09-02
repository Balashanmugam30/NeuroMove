"""NeuroMove — Phase 22 Research Analytics Domain Models."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ResearchExperimentStatus(StrEnum):
    DRAFT = "DRAFT"
    READY = "READY"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    REPLAYED = "REPLAYED"
    REPRODUCIBILITY_FAILED = "REPRODUCIBILITY_FAILED"


class AnalysisType(StrEnum):
    BENCHMARK = "BENCHMARK"
    ABLATION = "ABLATION"
    ROBUSTNESS = "ROBUSTNESS"
    COMPARISON = "COMPARISON"
    REPRODUCIBILITY = "REPRODUCIBILITY"
    COUNTERFACTUAL = "COUNTERFACTUAL"


class ReplayMode(StrEnum):
    STRICT = "STRICT"
    DETERMINISTIC_ACCELERATED = "DETERMINISTIC_ACCELERATED"
    STEP = "STEP"
    COUNTERFACTUAL = "COUNTERFACTUAL"


class GroupingStrategy(StrEnum):
    GROUP_BY_SUBJECT = "GROUP_BY_SUBJECT"
    GROUP_BY_SESSION = "GROUP_BY_SESSION"


class ReproducibilityStatus(StrEnum):
    PASS = "PASS"
    APPROXIMATE = "APPROXIMATE"
    FAIL = "FAIL"
    NOT_CHECKED = "NOT_CHECKED"


class ArtifactType(StrEnum):
    MANIFEST_JSON = "MANIFEST_JSON"
    RESULT_JSON = "RESULT_JSON"
    METRICS_CSV = "METRICS_CSV"
    LATENCY_CSV = "LATENCY_CSV"
    CONFUSION_MATRIX_JSON = "CONFUSION_MATRIX_JSON"
    REPRODUCIBILITY_REPORT_JSON = "REPRODUCIBILITY_REPORT_JSON"
    MODEL_COMPARISON_JSON = "MODEL_COMPARISON_JSON"
    ROBUSTNESS_SWEEP_JSON = "ROBUSTNESS_SWEEP_JSON"
    EXPERIMENT_SUMMARY_MD = "EXPERIMENT_SUMMARY_MD"


class PipelineStage(StrEnum):
    SOURCE = "SOURCE"
    ACQUISITION = "ACQUISITION"
    CLOCK = "CLOCK"
    QC = "QC"
    DSP = "DSP"
    EPOCH = "EPOCH"
    FEATURES = "FEATURES"
    CSP = "CSP"
    MODEL = "MODEL"
    PERSONALIZATION = "PERSONALIZATION"
    ADAPTATION = "ADAPTATION"
    CONFIDENCE = "CONFIDENCE"
    INTENT = "INTENT"
    SAFETY = "SAFETY"
    HIL = "HIL"


class ExperimentManifest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    manifest_id: str
    experiment_id: str
    app_version: str = "0.1.0"
    git_commit: str = "63c8584"
    source_session_ids: list[str] = Field(default_factory=list)
    source_checksums: dict[str, str] = Field(default_factory=dict)
    channel_names: list[str] = Field(
        default_factory=lambda: ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]
    )
    sampling_rate: float = 250.0
    montage: str = "10-20 International"
    clock_config: dict[str, Any] = Field(default_factory=dict)
    qc_config: dict[str, Any] = Field(default_factory=dict)
    dsp_config: dict[str, Any] = Field(
        default_factory=lambda: {"filter_type": "butterworth", "lowcut": 8.0, "highcut": 30.0, "order": 4}
    )
    epoch_config: dict[str, Any] = Field(
        default_factory=lambda: {"window_sec": 1.0, "step_sec": 0.1, "baseline_sec": 0.5}
    )
    feature_config: dict[str, Any] = Field(
        default_factory=lambda: {"bands": {"mu": [8, 12], "beta": [16, 24]}}
    )
    csp_config: dict[str, Any] = Field(
        default_factory=lambda: {"n_components": 4, "log_power": True}
    )
    model_id: str = "lda_csp_mi_v1"
    model_version: str = "1.0.0"
    personalization_profile: dict[str, Any] = Field(default_factory=dict)
    adaptation_state: dict[str, Any] = Field(default_factory=dict)
    confidence_policy: dict[str, Any] = Field(
        default_factory=lambda: {"type": "TEMPORAL_CONFIRMATION", "threshold": 0.80, "window_samples": 3}
    )
    intent_policy: dict[str, Any] = Field(
        default_factory=lambda: {"persistence_ms": 300, "expiration_ms": 2000}
    )
    safety_policy: dict[str, Any] = Field(
        default_factory=lambda: {"pre_flight_authorization": True, "strict_non_actuation": True}
    )
    hil_profile: dict[str, Any] = Field(
        default_factory=lambda: {"target": "ESP32_EMULATOR_VIRTUAL", "timeout_ms": 250}
    )
    seed: int = 42
    numerical_tolerances: dict[str, float] = Field(
        default_factory=lambda: {"abs_tol": 1e-5, "rel_tol": 1e-4}
    )
    analysis_parameters: dict[str, Any] = Field(default_factory=dict)
    export_version: str = "1.0.0"
    is_sealed: bool = False
    manifest_hash: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    sealed_at: str | None = None


class StageResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    stage: PipelineStage
    status: str = "PASSED"  # "PASSED", "WARNING", "FAILED", "SKIPPED"
    input_count: int = 0
    output_count: int = 0
    rejected_count: int = 0
    latency_ms: float = 0.0
    configuration_hash: str = ""
    stage_checksum: str = ""
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ConfusionMatrix(BaseModel):
    model_config = ConfigDict(extra="ignore")

    classes: list[str]
    matrix: list[list[int]]
    normalized_matrix: list[list[float]]
    total_samples: int


class MetricResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    experiment_id: str
    accuracy: float | None = None
    balanced_accuracy: float | None = None
    precision_macro: float | None = None
    recall_macro: float | None = None
    f1_macro: float | None = None
    per_class_precision: dict[str, float | None] = Field(default_factory=dict)
    per_class_recall: dict[str, float | None] = Field(default_factory=dict)
    per_class_f1: dict[str, float | None] = Field(default_factory=dict)
    confusion_matrix: ConfusionMatrix | None = None
    expected_calibration_error: float | None = None
    brier_score: float | None = None
    roc_auc_macro: float | None = None
    pr_auc_macro: float | None = None
    total_trials: int = 0
    evaluated_trials: int = 0
    rejected_trials: int = 0
    rejection_rate: float = 0.0
    unsupported_metrics: list[str] = Field(default_factory=list)
    evaluated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ConfidenceAnalytics(BaseModel):
    model_config = ConfigDict(extra="ignore")

    distribution_bins: list[float] = Field(default_factory=list)
    bin_counts: list[int] = Field(default_factory=list)
    mean_confidence: float = 0.0
    median_confidence: float = 0.0
    low_confidence_rate: float = 0.0
    confirmation_rate: float = 0.0
    stale_data_rate: float = 0.0
    confidence_vs_accuracy_bins: list[dict[str, Any]] = Field(default_factory=list)


class IntentAnalytics(BaseModel):
    model_config = ConfigDict(extra="ignore")

    candidate_count: int = 0
    confirmed_count: int = 0
    active_count: int = 0
    cancelled_count: int = 0
    expired_count: int = 0
    interrupted_count: int = 0
    candidate_to_confirmed_rate: float = 0.0
    confirmed_to_active_rate: float = 0.0
    mean_confirmation_latency_ms: float = 0.0


class SafetyAnalytics(BaseModel):
    model_config = ConfigDict(extra="ignore")

    authorized_count: int = 0
    denied_count: int = 0
    held_count: int = 0
    emergency_stop_count: int = 0
    locked_out_count: int = 0
    invalid_count: int = 0
    expired_count: int = 0
    rule_violations: dict[str, int] = Field(default_factory=dict)
    zero_transmission_proof_count: int = 0
    mean_safety_latency_ms: float = 0.0


class HilAnalytics(BaseModel):
    model_config = ConfigDict(extra="ignore")

    candidates: int = 0
    authorized_dispatches: int = 0
    transmitted_frames: int = 0
    ack_count: int = 0
    nack_count: int = 0
    retry_count: int = 0
    crc_failures: int = 0
    sequence_failures: int = 0
    disconnects: int = 0
    mean_roundtrip_latency_ms: float = 0.0


class LatencyPercentiles(BaseModel):
    model_config = ConfigDict(extra="ignore")

    min_ms: float = 0.0
    max_ms: float = 0.0
    mean_ms: float = 0.0
    median_ms: float = 0.0
    p50_ms: float = 0.0
    p90_ms: float = 0.0
    p95_ms: float = 0.0
    p99_ms: float = 0.0
    sample_count: int = 0


class LatencyAnalytics(BaseModel):
    model_config = ConfigDict(extra="ignore")

    per_stage: dict[str, LatencyPercentiles] = Field(default_factory=dict)
    total_pipeline: LatencyPercentiles = Field(default_factory=LatencyPercentiles)


class SignalQualityAnalytics(BaseModel):
    model_config = ConfigDict(extra="ignore")

    healthy_channel_proportion: float = 1.0
    flatline_events: int = 0
    saturation_events: int = 0
    dropout_events: int = 0
    packet_loss_pct: float = 0.0
    buffer_overflow_events: int = 0
    timestamp_discontinuities: int = 0
    per_channel_snr_db: dict[str, float] = Field(default_factory=dict)
    session_quality_trend: list[dict[str, Any]] = Field(default_factory=list)


class AblationRun(BaseModel):
    model_config = ConfigDict(extra="ignore")

    ablation_id: str
    parent_experiment_id: str
    child_experiment_id: str
    ablation_type: str
    parameter_delta: dict[str, Any] = Field(default_factory=dict)
    baseline_accuracy: float = 0.0
    ablated_accuracy: float = 0.0
    accuracy_delta: float = 0.0
    baseline_f1: float = 0.0
    ablated_f1: float = 0.0
    f1_delta: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class RobustnessRun(BaseModel):
    model_config = ConfigDict(extra="ignore")

    robustness_id: str
    parent_experiment_id: str
    perturbation_type: str
    perturbation_level: float = 0.0
    seed: int = 42
    resulting_accuracy: float = 0.0
    resulting_f1: float = 0.0
    qc_degraded_rate: float = 0.0
    rejection_rate: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ComparisonResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    comparison_id: str
    comparison_type: str
    baseline_experiment_id: str
    candidate_experiment_id: str
    metric_deltas: dict[str, float] = Field(default_factory=dict)
    effect_size: float | None = None
    p_value: float | None = None
    confidence_interval: tuple[float, float] | None = None
    statistical_method: str = "PAIRED_TTEST"
    sample_size: int = 0
    is_statistically_significant: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class StatisticalResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    metric_name: str
    sample_count: int = 0
    mean: float = 0.0
    median: float = 0.0
    std: float = 0.0
    variance: float = 0.0
    min: float = 0.0
    max: float = 0.0
    p25: float = 0.0
    p75: float = 0.0
    ci_lower_95: float | None = None
    ci_upper_95: float | None = None
    bootstrap_iterations: int | None = None


class ReproducibilityResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    audit_id: str
    baseline_experiment_id: str
    reproduced_experiment_id: str
    status: ReproducibilityStatus = ReproducibilityStatus.NOT_CHECKED
    source_hash_match: bool = True
    manifest_hash_match: bool = True
    stage_hashes_match: bool = True
    metrics_match: bool = True
    result_hash_match: bool = True
    max_metric_deviation: float = 0.0
    deviations: dict[str, float] = Field(default_factory=dict)
    tamper_detected: bool = False
    explanation: str = ""
    audited_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ReplayCheckpoint(BaseModel):
    model_config = ConfigDict(extra="ignore")

    checkpoint_id: str
    experiment_id: str
    stage: PipelineStage
    source_offset: int = 0
    epoch_index: int = 0
    manifest_hash: str = ""
    intermediate_checksum: str = ""
    model_version: str = "1.0.0"
    state_payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ResearchArtifact(BaseModel):
    model_config = ConfigDict(extra="ignore")

    artifact_id: str
    experiment_id: str
    artifact_type: ArtifactType
    checksum: str
    file_name: str
    content_json: str | None = None
    generated_time: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    generator_version: str = "1.0.0"


class ResearchDataset(BaseModel):
    model_config = ConfigDict(extra="ignore")

    dataset_id: str
    name: str
    description: str
    session_ids: list[str] = Field(default_factory=list)
    subjects: list[str] = Field(default_factory=list)
    classes: list[str] = Field(default_factory=list)
    grouping_strategy: GroupingStrategy = GroupingStrategy.GROUP_BY_SUBJECT
    channel_count: int = 8
    sampling_rate: float = 250.0
    dataset_checksum: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ResearchExperiment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    experiment_id: str
    title: str
    description: str
    analysis_type: AnalysisType = AnalysisType.BENCHMARK
    status: ResearchExperimentStatus = ResearchExperimentStatus.DRAFT
    replay_mode: ReplayMode = ReplayMode.DETERMINISTIC_ACCELERATED
    parent_experiment_id: str | None = None
    source_session_ids: list[str] = Field(default_factory=list)
    dataset_id: str | None = None
    grouping_strategy: GroupingStrategy = GroupingStrategy.GROUP_BY_SUBJECT
    manifest: ExperimentManifest
    stages: list[StageResult] = Field(default_factory=list)
    metrics: MetricResult | None = None
    confidence_analytics: ConfidenceAnalytics | None = None
    intent_analytics: IntentAnalytics | None = None
    safety_analytics: SafetyAnalytics | None = None
    hil_analytics: HilAnalytics | None = None
    latency_analytics: LatencyAnalytics | None = None
    signal_quality_analytics: SignalQualityAnalytics | None = None
    reproducibility: ReproducibilityResult | None = None
    result_hash: str | None = None
    is_sealed: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    completed_at: str | None = None
