"""Pydantic domain models for Motor-Imagery Feature Extraction & Covariance Representations."""

import hashlib
import json
from enum import StrEnum

from pydantic import BaseModel, Field

from neuromove.epoching.models import NormalizedLabel


class FeaturePowerType(StrEnum):
    """Types of spectral power representations."""

    ABSOLUTE = "ABSOLUTE"
    RELATIVE = "RELATIVE"
    LOG = "LOG"
    ALL = "ALL"


class CovarianceMethod(StrEnum):
    """Covariance estimation and normalization methods."""

    NORMALIZED = "NORMALIZED"
    EMPIRICAL = "EMPIRICAL"
    SHRINKAGE = "SHRINKAGE"


class FeatureBand(BaseModel):
    """Frequency band specification for feature extraction."""

    name: str
    fmin_hz: float
    fmax_hz: float


class FeatureConfig(BaseModel):
    """Versioned configuration for EEG feature extraction."""

    feature_version: str = Field(default="EEG_FEATURES_V1")
    channels: list[str] = Field(default_factory=lambda: ["C3", "Cz", "C4"])
    bands: list[FeatureBand] = Field(
        default_factory=lambda: [
            FeatureBand(name="mu", fmin_hz=8.0, fmax_hz=13.0),
            FeatureBand(name="beta", fmin_hz=13.0, fmax_hz=30.0),
        ]
    )
    power_type: FeaturePowerType = Field(default=FeaturePowerType.ALL)
    include_lateralization: bool = Field(default=True)
    lateralization_pairs: list[tuple[str, str]] = Field(default_factory=lambda: [("C3", "C4")])
    epsilon: float = Field(default=1e-12, ge=1e-18, le=1e-3)
    covariance_method: CovarianceMethod = Field(default=CovarianceMethod.NORMALIZED)

    def compute_config_hash(self) -> str:
        """Deterministic configuration fingerprint."""
        raw_dict = {
            "feature_version": self.feature_version,
            "channels": sorted(self.channels),
            "bands": [
                {"name": b.name, "fmin_hz": round(b.fmin_hz, 4), "fmax_hz": round(b.fmax_hz, 4)}
                for b in sorted(self.bands, key=lambda x: x.name)
            ],
            "power_type": self.power_type.value,
            "include_lateralization": self.include_lateralization,
            "lateralization_pairs": sorted([sorted(pair) for pair in self.lateralization_pairs]),
            "epsilon": self.epsilon,
            "covariance_method": self.covariance_method.value,
        }
        encoded = json.dumps(raw_dict, sort_keys=True).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()[:16]


class FeatureVector(BaseModel):
    """Named, typed feature values for a single motor-imagery trial."""

    epoch_id: str
    trial_id: str
    subject_id: str
    session_id: str | None = None
    run_id: str | None = None
    recording_id: str | None = None
    label: NormalizedLabel
    values: dict[str, float]


class CovarianceMatrixRecord(BaseModel):
    """Covariance representation for a single epoch."""

    epoch_id: str
    label: NormalizedLabel
    channels: list[str]
    matrix: list[list[float]]
    trace: float
    is_symmetric: bool
    is_positive_semi_definite: bool


class CovarianceSet(BaseModel):
    """Collection of CSP-ready spatial covariance matrices."""

    covariance_set_id: str
    epoch_set_id: str
    channels: list[str]
    shape: tuple[int, int, int]
    regularization: CovarianceMethod
    matrices: list[CovarianceMatrixRecord]
    artifact_file_path: str
    artifact_checksum_sha256: str
    created_at: str


class FeatureSet(BaseModel):
    """Complete extracted feature dataset for machine learning and research."""

    feature_set_id: str
    feature_version: str
    config_hash: str
    source_epoch_set_id: str
    subject_ids: list[str]
    session_ids: list[str]
    run_ids: list[str]
    trial_ids: list[str]
    labels: list[NormalizedLabel]
    feature_names: list[str]
    row_count: int
    feature_count: int
    label_distribution: dict[str, int]
    artifact_file_path: str
    artifact_checksum_sha256: str
    created_at: str
    software_versions: dict[str, str] = Field(default_factory=dict)


class FeaturePreview(BaseModel):
    """Validation preview for feature extraction configuration."""

    valid: bool
    epoch_count: int
    channels: list[str]
    bands: list[FeatureBand]
    feature_names: list[str]
    expected_matrix_shape: tuple[int, int]
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class FeatureExtractionRequest(BaseModel):
    """Request to extract features from an existing epoch set."""

    epoch_set_id: str
    config: FeatureConfig = Field(default_factory=FeatureConfig)


class FeatureManifest(BaseModel):
    """Scientific reproducibility manifest for extracted features."""

    feature_set_id: str
    feature_version: str
    config_hash: str
    source_epoch_set_id: str
    source_dataset_id: str | None = None
    subject_ids: list[str]
    session_ids: list[str]
    run_ids: list[str]
    recording_ids: list[str]
    preprocessing_result_ids: list[str]
    feature_config: FeatureConfig
    feature_names: list[str]
    feature_count: int
    row_count: int
    label_distribution: dict[str, int]
    artifact_file_path: str
    artifact_checksum_sha256: str
    created_at: str
    software_versions: dict[str, str] = Field(default_factory=dict)
