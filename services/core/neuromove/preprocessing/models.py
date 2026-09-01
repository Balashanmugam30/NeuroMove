"""Domain models for EEG Preprocessing & DSP Pipeline.

Matches @neuromove/contracts schema definitions with strict validation.
"""

from __future__ import annotations

import hashlib
import json
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from neuromove.analysis.models import EEGSourceKind


class ReferenceType(StrEnum):
    AVERAGE = "average"
    NONE = "none"
    CHANNEL = "channel"


class ArtifactMethod(StrEnum):
    NONE = "NONE"
    ICA = "ICA"


class PreprocessingStage(StrEnum):
    VALIDATE = "VALIDATE"
    REFERENCE = "REFERENCE"
    FILTER = "FILTER"
    NOTCH = "NOTCH"
    RESAMPLE = "RESAMPLE"
    ARTIFACT = "ARTIFACT"
    FINAL_VALIDATE = "FINAL_VALIDATE"


class StageStatus(StrEnum):
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"


class NotchConfig(BaseModel):
    enabled: bool = False
    frequencies_hz: list[float] = Field(default_factory=lambda: [50.0])
    notch_width_hz: float = 2.0


class ResampleConfig(BaseModel):
    enabled: bool = False
    target_hz: float | None = None
    anti_aliasing: bool = True


class ICAFitConfig(BaseModel):
    enabled: bool = False
    n_components: int = Field(default=15, ge=2, le=64)
    method: str = "fastica"
    random_state: int = 42
    fit_channels: list[str] = Field(default_factory=list)
    excluded_components: list[int] = Field(default_factory=list)


class PreprocessingConfig(BaseModel):
    pipeline_version: str = "EEG_PREPROCESSING_V1"
    reference_type: ReferenceType = ReferenceType.AVERAGE
    reference_channels: list[str] = Field(default_factory=list)
    highpass_hz: float = Field(default=0.5, ge=0.01, le=20.0)
    lowpass_hz: float = Field(default=40.0, ge=1.0, le=120.0)
    notch: NotchConfig = Field(default_factory=NotchConfig)
    resample: ResampleConfig = Field(default_factory=ResampleConfig)
    bad_channels: list[str] = Field(default_factory=list)
    artifact_method: ArtifactMethod = ArtifactMethod.NONE
    ica_config: ICAFitConfig = Field(default_factory=ICAFitConfig)

    def compute_config_hash(self) -> str:
        """Compute stable SHA-256 fingerprint of the preprocessing configuration."""
        data = {
            "pipeline_version": self.pipeline_version,
            "reference_type": self.reference_type.value,
            "reference_channels": sorted(self.reference_channels),
            "highpass_hz": round(self.highpass_hz, 4),
            "lowpass_hz": round(self.lowpass_hz, 4),
            "notch": {
                "enabled": self.notch.enabled,
                "frequencies_hz": sorted(self.notch.frequencies_hz),
                "notch_width_hz": round(self.notch.notch_width_hz, 4),
            },
            "resample": {
                "enabled": self.resample.enabled,
                "target_hz": round(self.resample.target_hz, 2) if self.resample.target_hz else None,
                "anti_aliasing": self.resample.anti_aliasing,
            },
            "bad_channels": sorted(self.bad_channels),
            "artifact_method": self.artifact_method.value,
            "ica_config": {
                "enabled": self.ica_config.enabled,
                "n_components": self.ica_config.n_components,
                "method": self.ica_config.method,
                "random_state": self.ica_config.random_state,
                "fit_channels": sorted(self.ica_config.fit_channels),
                "excluded_components": sorted(self.ica_config.excluded_components),
            },
        }
        serialized = json.dumps(data, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]


class PreprocessingRequest(BaseModel):
    source_kind: EEGSourceKind = EEGSourceKind.SYNTHETIC
    dataset_id: str | None = None
    recording_id: str | None = None
    scenario_id: str | None = None
    parent_result_id: str | None = None
    config: PreprocessingConfig = Field(default_factory=PreprocessingConfig)


class PreprocessingStageAudit(BaseModel):
    stage: PreprocessingStage
    status: StageStatus
    started_at: str
    completed_at: str
    duration_ms: float
    parameters: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class SignalIntegrityReport(BaseModel):
    sample_count: int
    channel_count: int
    nan_count: int
    inf_count: int
    min_amplitude_uv: float
    max_amplitude_uv: float
    flatline_channels: list[str] = Field(default_factory=list)
    amplitude_outlier_candidates: int = 0
    status: str = "HEALTHY"


class PreprocessingResult(BaseModel):
    result_id: str
    pipeline_version: str = "EEG_PREPROCESSING_V1"
    config_hash: str
    source_kind: EEGSourceKind
    dataset_id: str | None = None
    recording_id: str | None = None
    scenario_id: str | None = None
    parent_result_id: str | None = None
    input_sample_rate_hz: float
    output_sample_rate_hz: float
    input_channels: list[str]
    output_channels: list[str]
    duration_seconds: float
    event_count: int = 0
    artifact_file_path: str
    artifact_checksum_sha256: str
    integrity_report: SignalIntegrityReport
    stage_audit: list[PreprocessingStageAudit]
    warnings: list[str] = Field(default_factory=list)
    software_versions: dict[str, str] = Field(default_factory=dict)
    created_at: str


class PreprocessingPreview(BaseModel):
    valid: bool
    effective_config: PreprocessingConfig
    input_sample_rate_hz: float
    estimated_output_sample_rate_hz: float
    input_channels: list[str]
    estimated_output_channels: list[str]
    stage_plan: list[str]
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class PreprocessingManifest(BaseModel):
    manifest_version: str = "EEG_PREPROCESSING_V1"
    result_id: str
    pipeline_version: str
    config: PreprocessingConfig
    source: dict[str, Any]
    input_summary: dict[str, Any]
    output_summary: dict[str, Any]
    stage_audit: list[PreprocessingStageAudit]
    integrity_report: SignalIntegrityReport
    software_versions: dict[str, str]
    artifact_checksum_sha256: str
    created_at: str


class PreprocessingSignalResponse(BaseModel):
    result_id: str
    sampling_rate_hz: float
    channels: list[str]
    timestamps: list[float]
    signals: dict[str, list[float]]
    events: list[dict[str, Any]] = Field(default_factory=list)
