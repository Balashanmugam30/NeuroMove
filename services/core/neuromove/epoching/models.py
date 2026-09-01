"""Pydantic domain models for Motor-Imagery Epoching & Event Normalization."""

import hashlib
import json
from enum import StrEnum

from pydantic import BaseModel, Field

from neuromove.analysis.models import EEGSourceKind


class EpochEventMappingStatus(StrEnum):
    """Event mapping validation status."""

    MAPPED = "MAPPED"
    UNMAPPED = "UNMAPPED"
    AMBIGUOUS = "AMBIGUOUS"
    INVALID = "INVALID"


class NormalizedLabel(StrEnum):
    """Standardized NeuroMove motor-imagery event labels."""

    REST = "REST"
    LEFT_IMAGERY = "LEFT_IMAGERY"
    RIGHT_IMAGERY = "RIGHT_IMAGERY"
    FEET_IMAGERY = "FEET_IMAGERY"
    TONGUE_IMAGERY = "TONGUE_IMAGERY"
    BOTH_FISTS_IMAGERY = "BOTH_FISTS_IMAGERY"
    UNKNOWN = "UNKNOWN"


class EventMappingRule(BaseModel):
    """Mapping rule connecting source event code to normalized label."""

    source_code: str
    normalized_label: NormalizedLabel
    description: str | None = None


class EventMappingConfig(BaseModel):
    """Versioned event normalization rule catalog."""

    mapping_version: str = Field(default="EVENT_MAPPING_V1")
    dataset_id: str | None = None
    rules: list[EventMappingRule] = Field(default_factory=list)
    default_label: NormalizedLabel = Field(default=NormalizedLabel.UNKNOWN)

    def compute_mapping_hash(self) -> str:
        """Calculate deterministic SHA-256 hash of mapping rules."""
        raw_dict = {
            "mapping_version": self.mapping_version,
            "dataset_id": self.dataset_id,
            "default_label": self.default_label.value,
            "rules": [
                {"source_code": r.source_code, "normalized_label": r.normalized_label.value}
                for r in sorted(self.rules, key=lambda x: x.source_code)
            ],
        }
        encoded = json.dumps(raw_dict, sort_keys=True).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()[:16]


class NormalizedEvent(BaseModel):
    """Traceable, normalized event occurrence with source-to-processed timing."""

    event_id: str
    source_event_code: str
    source_label: str
    normalized_label: NormalizedLabel
    source_sample: int
    source_onset_seconds: float
    processed_sample: int
    processed_onset_seconds: float
    duration_seconds: float = 0.0
    session_id: str | None = None
    recording_id: str | None = None
    mapping_status: EpochEventMappingStatus


class TrialDefinition(BaseModel):
    """Canonical motor-imagery trial definition."""

    trial_id: str
    session_id: str | None = None
    recording_id: str | None = None
    event_id: str
    subject_id: str | None = None
    dataset_id: str | None = None
    label: NormalizedLabel
    cue_onset_seconds: float
    analysis_onset_seconds: float
    window_start_seconds: float
    window_end_seconds: float
    baseline_start_seconds: float | None = None
    baseline_end_seconds: float | None = None
    status: str = "ACTIVE"


class EpochQCStatus(StrEnum):
    """Quality control verdict for an individual epoch."""

    VALID = "VALID"
    REJECTED = "REJECTED"
    INCOMPLETE = "INCOMPLETE"
    BOUNDARY_ERROR = "BOUNDARY_ERROR"
    ARTIFACT_FLAGGED = "ARTIFACT_FLAGGED"
    UNKNOWN = "UNKNOWN"


class EpochQC(BaseModel):
    """Quality control record for an individual epoch."""

    epoch_id: str
    status: EpochQCStatus
    rejection_reason: str | None = None
    min_amplitude_uv: float = 0.0
    max_amplitude_uv: float = 0.0


class EpochingConfig(BaseModel):
    """Versioned epoching parameters."""

    epoching_version: str = Field(default="EEG_EPOCHING_V1")
    tmin: float = Field(default=-1.0, ge=-10.0, le=0.0)
    tmax: float = Field(default=4.0, ge=0.5, le=30.0)
    baseline: tuple[float, float] | None = Field(default=(-1.0, 0.0))
    baseline_mode: str = Field(default="APPLIED")
    analysis_window: tuple[float, float] = Field(default=(0.5, 4.0))
    reject_by_annotation: bool = Field(default=True)
    amplitude_rejection_uv: float | None = Field(default=None, ge=10.0, le=1000.0)

    def compute_config_hash(self) -> str:
        """Deterministic configuration fingerprint."""
        raw_dict = {
            "epoching_version": self.epoching_version,
            "tmin": round(self.tmin, 4),
            "tmax": round(self.tmax, 4),
            "baseline": [round(b, 4) for b in self.baseline] if self.baseline else None,
            "baseline_mode": self.baseline_mode,
            "analysis_window": [round(w, 4) for w in self.analysis_window],
            "reject_by_annotation": self.reject_by_annotation,
            "amplitude_rejection_uv": round(self.amplitude_rejection_uv, 2)
            if self.amplitude_rejection_uv
            else None,
        }
        encoded = json.dumps(raw_dict, sort_keys=True).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()[:16]


class EpochRecord(BaseModel):
    """Metadata record for an extracted epoch."""

    epoch_id: str
    epoch_set_id: str
    trial_id: str
    event_id: str
    subject_id: str
    session_id: str | None = None
    run_id: str | None = None
    label: NormalizedLabel
    onset_seconds: float
    qc_status: EpochQCStatus
    rejection_reason: str | None = None
    created_at: str


class EpochSummary(BaseModel):
    """Summary of an epoch extraction run."""

    epoch_set_id: str
    epoching_version: str
    config_hash: str
    source_kind: EEGSourceKind
    dataset_id: str | None = None
    recording_id: str | None = None
    scenario_id: str | None = None
    preprocessing_result_id: str | None = None
    subject_id: str | None = None
    session_id: str | None = None
    run_id: str | None = None
    sampling_rate_hz: float
    channel_names: list[str]
    tmin: float
    tmax: float
    total_events: int
    mapped_events: int
    valid_epochs: int
    rejected_epochs: int
    rejection_counts: dict[str, int] = Field(default_factory=dict)
    label_distribution: dict[str, int] = Field(default_factory=dict)
    artifact_file_path: str
    artifact_checksum_sha256: str
    created_at: str


class EpochingPreview(BaseModel):
    """Preview of epoching segmentation planning and validation."""

    valid: bool
    events_discovered: int
    mapped_events: int
    unmapped_events: int
    invalid_events: int
    expected_epochs: int
    sampling_rate_hz: float
    tmin: float
    tmax: float
    baseline: tuple[float, float] | None
    analysis_window: tuple[float, float]
    labels_found: list[str]
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class EpochingRequest(BaseModel):
    """Request to preview or execute motor-imagery epoching."""

    source_kind: EEGSourceKind
    dataset_id: str | None = None
    recording_id: str | None = None
    scenario_id: str | None = None
    preprocessing_result_id: str | None = None
    mapping_config: EventMappingConfig | None = None
    epoch_config: EpochingConfig = Field(default_factory=EpochingConfig)


class EpochSignalResponse(BaseModel):
    """Sliced time-series waveform for visual inspection of an epoch."""

    epoch_id: str
    trial_id: str
    label: NormalizedLabel
    sampling_rate_hz: float
    channels: list[str]
    time_points: list[float]
    signals: dict[str, list[float]]
    cue_onset_relative_seconds: float = 0.0
    baseline_window: tuple[float, float] | None = None
    analysis_window: tuple[float, float]
    qc_status: EpochQCStatus


class EpochManifest(BaseModel):
    """Complete scientific provenance manifest for an epoch set."""

    epoch_set_id: str
    epoching_version: str
    config_hash: str
    source_kind: EEGSourceKind
    dataset_id: str | None = None
    recording_id: str | None = None
    scenario_id: str | None = None
    preprocessing_result_id: str | None = None
    subject_id: str | None = None
    session_id: str | None = None
    run_id: str | None = None
    mapping_config: EventMappingConfig
    epoch_config: EpochingConfig
    sampling_rate_hz: float
    channels: list[str]
    tmin: float
    tmax: float
    total_events: int
    valid_epochs: int
    rejected_epochs: int
    rejection_counts: dict[str, int]
    label_distribution: dict[str, int]
    artifact_file_path: str
    artifact_checksum_sha256: str
    created_at: str
    software_versions: dict[str, str] = Field(default_factory=dict)
