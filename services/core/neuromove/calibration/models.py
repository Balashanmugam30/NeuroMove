"""Pydantic Domain Models for Personalized Motor-Imagery Calibration (Phase 13)."""

import hashlib
import json
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..decoding.models import CSPConfig
from ..epoching.models import NormalizedLabel
from ..experiments.models import (
    FeatureRepresentation,
    ModelFamily,
    SearchConfig,
)


class SubjectProfileStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ARCHIVED = "ARCHIVED"


class CalibrationProfileState(StrEnum):
    NOT_CALIBRATED = "NOT_CALIBRATED"
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    QUALITY_REVIEW = "QUALITY_REVIEW"
    READY = "READY"
    STALE = "STALE"
    INVALID = "INVALID"
    ARCHIVED = "ARCHIVED"


class CalibrationSessionStatus(StrEnum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    QUALITY_REVIEW = "QUALITY_REVIEW"
    READY = "READY"
    ABORTED = "ABORTED"
    INVALID = "INVALID"
    ARCHIVED = "ARCHIVED"


class CalibrationTrialStatus(StrEnum):
    PLANNED = "PLANNED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    SKIPPED = "SKIPPED"
    ABORTED = "ABORTED"


class CalibrationQCStatus(StrEnum):
    PASS = "PASS"
    WARN = "WARN"
    REJECT = "REJECT"


class CalibrationRejectionReason(StrEnum):
    INCOMPLETE_EPOCH = "INCOMPLETE_EPOCH"
    BAD_ANNOTATION = "BAD_ANNOTATION"
    CHANNEL_FAILURE = "CHANNEL_FAILURE"
    DROPOUT = "DROPOUT"
    NONFINITE_DATA = "NONFINITE_DATA"
    OUT_OF_BOUNDS = "OUT_OF_BOUNDS"
    SIGNAL_QUALITY_LOW = "SIGNAL_QUALITY_LOW"
    MANUAL_REJECT = "MANUAL_REJECT"


class CueType(StrEnum):
    REST = "REST"
    FIXATION = "FIXATION"
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    FEET = "FEET"
    FISTS = "FISTS"


class CalibrationSourceMode(StrEnum):
    SIMULATION = "SIMULATION"
    REPLAY = "REPLAY"
    LIVE = "LIVE"


class PersonalizedModelStatus(StrEnum):
    CALIBRATING = "CALIBRATING"
    RESEARCH_READY = "RESEARCH_READY"
    STALE = "STALE"
    INVALID = "INVALID"
    ARCHIVED = "ARCHIVED"


class AdaptationStrategy(StrEnum):
    TRAIN_FROM_SCRATCH = "TRAIN_FROM_SCRATCH"
    WARM_START_FINE_TUNE = "WARM_START_FINE_TUNE"


class HeldOutSplitStrategy(StrEnum):
    TEMPORAL_BLOCK_SPLIT = "TEMPORAL_BLOCK_SPLIT"
    STRATIFIED_SHUFFLE_SPLIT = "STRATIFIED_SHUFFLE_SPLIT"


# 1. Subject Profile
class SubjectProfile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    subject_id: str
    profile_id: str
    profile_version: str = "SUBJECT_PROFILE_V1"
    status: SubjectProfileStatus = SubjectProfileStatus.ACTIVE
    preferred_hand: str = "RIGHT"
    display_name: str | None = None
    notes: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class CreateSubjectProfileRequest(BaseModel):
    subject_id: str
    preferred_hand: str = "RIGHT"
    display_name: str | None = None
    notes: str | None = None


# 2. Calibration Profile
class CalibrationProfile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    profile_id: str
    subject_id: str
    profile_version: str = "CALIBRATION_PROFILE_V1"
    state: CalibrationProfileState = CalibrationProfileState.NOT_CALIBRATED
    preferred_task: str = "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1"
    target_classes: list[NormalizedLabel] = Field(
        default_factory=lambda: [NormalizedLabel.LEFT_IMAGERY, NormalizedLabel.RIGHT_IMAGERY]
    )
    channel_set: list[str] = Field(default_factory=lambda: ["C3", "Cz", "C4"])
    preprocessing_config: dict[str, Any] = Field(default_factory=dict)
    epoching_config: dict[str, Any] = Field(default_factory=dict)
    feature_config: dict[str, Any] = Field(default_factory=dict)
    decoder_config: dict[str, Any] = Field(default_factory=dict)
    last_calibration_id: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


# 3. Calibration Protocol
class CalibrationProtocol(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    protocol_id: str = "CALIBRATION_PROTOCOL_V1"
    protocol_version: str = "CALIBRATION_PROTOCOL_V1"
    name: str = "Standard Graz Visual Cue Protocol"
    target_classes: list[NormalizedLabel] = Field(
        default_factory=lambda: [NormalizedLabel.LEFT_IMAGERY, NormalizedLabel.RIGHT_IMAGERY]
    )
    trials_per_class: int = 10
    rest_duration_sec: float = 2.0
    fixation_duration_sec: float = 2.0
    cue_duration_sec: float = 1.25
    imagery_duration_sec: float = 4.0
    iti_min_sec: float = 1.5
    iti_max_sec: float = 2.5
    break_policy: str = "EVERY_20_TRIALS"
    random_state: int = 42
    min_valid_trials_per_class: int = 5
    max_rejection_ratio: float = 0.4
    qc_rules: dict[str, Any] = Field(default_factory=dict)
    timing_hash: str = ""

    def model_post_init(self, __context: Any) -> None:
        if not self.timing_hash:
            data = f"{self.protocol_version}_{self.trials_per_class}_{self.rest_duration_sec}_{self.fixation_duration_sec}_{self.cue_duration_sec}_{self.imagery_duration_sec}_{self.random_state}"
            self.timing_hash = hashlib.sha256(data.encode("utf-8")).hexdigest()[:16]


# 4. Calibration Trial
class CalibrationTrial(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    trial_id: str
    calibration_id: str
    sequence_index: int
    target_label: NormalizedLabel
    cue: CueType
    planned_onset: float
    actual_onset: float | None = None
    imagery_start: float | None = None
    imagery_end: float | None = None
    status: CalibrationTrialStatus = CalibrationTrialStatus.PLANNED
    quality_status: CalibrationQCStatus = CalibrationQCStatus.PASS
    quality_reasons: list[CalibrationRejectionReason] = Field(default_factory=list)
    epoch_id: str | None = None
    notes: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


# 5. Calibration Quality Summary
class CalibrationQualitySummary(BaseModel):
    total_trials: int
    valid_trials: int
    rejected_trials: int
    warn_trials: int
    valid_ratio: float
    rejection_ratio: float
    class_balance: dict[str, float]
    rejection_breakdown: dict[str, int]
    is_sufficient: bool
    sufficiency_warnings: list[str] = Field(default_factory=list)


# 6. Calibration Session
class CalibrationSession(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    calibration_id: str
    profile_id: str
    subject_id: str
    session_number: int = 1
    protocol_version: str = "CALIBRATION_PROTOCOL_V1"
    task_id: str = "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1"
    source_mode: CalibrationSourceMode = CalibrationSourceMode.SIMULATION
    status: CalibrationSessionStatus = CalibrationSessionStatus.PLANNED
    started_at: str | None = None
    completed_at: str | None = None
    trial_count: int = 0
    valid_trial_count: int = 0
    rejected_trial_count: int = 0
    class_distribution: dict[str, int] = Field(default_factory=dict)
    quality_summary: CalibrationQualitySummary | None = None
    pause_intervals: list[dict[str, Any]] = Field(default_factory=list)
    active_trial_index: int = 0
    active_phase: str = "IDLE"
    phase_time_remaining_sec: float = 0.0
    config_hash: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class StartCalibrationSessionRequest(BaseModel):
    profile_id: str
    subject_id: str
    protocol: CalibrationProtocol | None = None
    source_mode: CalibrationSourceMode = CalibrationSourceMode.SIMULATION
    scenario_id: str | None = None


# 7. Personalization Models
class PersonalizationConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    calibration_id: str
    profile_id: str
    subject_id: str
    task_id: str = "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1"
    model_family: ModelFamily = ModelFamily.LDA
    representation: FeatureRepresentation = FeatureRepresentation.CSP_LOG_POWER
    csp_config: CSPConfig = Field(default_factory=CSPConfig)
    adaptation_strategy: AdaptationStrategy = AdaptationStrategy.TRAIN_FROM_SCRATCH
    split_strategy: HeldOutSplitStrategy = HeldOutSplitStrategy.TEMPORAL_BLOCK_SPLIT
    train_ratio: float = 0.6
    scale_features: bool = False
    search_config: SearchConfig = Field(default_factory=SearchConfig)
    random_state: int = 42

    def compute_hash(self) -> str:
        d = {
            "calibration_id": self.calibration_id,
            "subject_id": self.subject_id,
            "task_id": self.task_id,
            "model_family": self.model_family.value,
            "representation": self.representation.value,
            "split_strategy": self.split_strategy.value,
            "train_ratio": self.train_ratio,
            "random_state": self.random_state,
        }
        serialized = json.dumps(d, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]


class GenericVsPersonalizedComparison(BaseModel):
    generic_model_id: str
    personalized_model_id: str
    task_id: str
    heldout_trial_count: int
    generic_balanced_accuracy: float
    personalized_balanced_accuracy: float
    delta_balanced_accuracy: float
    generic_f1: float
    personalized_f1: float
    delta_f1: float
    chance_level: float = 0.5


class PersonalizedExperimentResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    experiment_id: str
    calibration_id: str
    profile_id: str
    subject_id: str
    model_id: str
    generic_base_model_id: str | None = None
    train_trial_count: int
    heldout_trial_count: int
    train_trial_ids: list[str]
    heldout_trial_ids: list[str]
    train_metrics: dict[str, float]
    heldout_metrics: dict[str, Any]
    comparison_with_generic: GenericVsPersonalizedComparison | None = None
    config: PersonalizationConfig
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class PersonalizedModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    model_id: str  # pmdl_<hash>
    calibration_id: str
    profile_id: str
    subject_id: str
    experiment_id: str
    generic_base_model_id: str | None = None
    model_family: ModelFamily
    representation: FeatureRepresentation
    status: PersonalizedModelStatus = PersonalizedModelStatus.RESEARCH_READY
    is_stale: bool = False
    staleness_reasons: list[str] = Field(default_factory=list)
    heldout_balanced_accuracy: float
    heldout_f1: float
    artifact_file_path: str
    artifact_checksum_sha256: str
    model_card_json: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


# 8. Calibration Report & Manifest
class CalibrationReport(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    report_id: str
    calibration_id: str
    subject_id: str
    profile_id: str
    protocol_summary: dict[str, Any]
    source_mode: CalibrationSourceMode
    quality_summary: CalibrationQualitySummary
    split_summary: dict[str, Any]
    personalized_model_summary: dict[str, Any] | None = None
    generic_comparison: GenericVsPersonalizedComparison | None = None
    known_limitations: list[str] = Field(default_factory=list)
    provenance_chain: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class CalibrationHistoryItem(BaseModel):
    calibration_id: str
    session_number: int
    protocol_version: str
    source_mode: CalibrationSourceMode
    status: CalibrationSessionStatus
    trial_count: int
    valid_trial_count: int
    model_id: str | None = None
    heldout_balanced_accuracy: float | None = None
    created_at: str


class CalibrationManifest(BaseModel):
    manifest_version: str = "CALIBRATION_MANIFEST_V1"
    calibration_id: str
    subject_id: str
    profile_id: str
    protocol_id: str
    random_state: int
    trial_count: int
    valid_trial_count: int
    rejected_trial_count: int
    trial_sequence_hashes: list[str]
    epoch_set_id: str | None = None
    feature_set_id: str | None = None
    experiment_id: str | None = None
    model_id: str | None = None
    model_artifact_checksum_sha256: str | None = None
    software_versions: dict[str, str] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
