"""NeuroMove EEG Preprocessing & DSP Pipeline Module.

Provides reproducible, configurable, research-grade signal conditioning
conforming to EEG_PREPROCESSING_V1 specification.
"""

from neuromove.preprocessing.models import (
    ArtifactMethod,
    ICAFitConfig,
    NotchConfig,
    PreprocessingConfig,
    PreprocessingManifest,
    PreprocessingPreview,
    PreprocessingRequest,
    PreprocessingResult,
    PreprocessingSignalResponse,
    PreprocessingStage,
    PreprocessingStageAudit,
    ReferenceType,
    ResampleConfig,
    SignalIntegrityReport,
    StageStatus,
)
from neuromove.preprocessing.pipeline import (
    apply_preprocessing_pipeline,
    compute_signal_integrity,
    fit_ica_decomposition,
    generate_pipeline_preview,
)
from neuromove.preprocessing.service import PreprocessingService
from neuromove.preprocessing.storage import PreprocessingStorage

__all__ = [
    "ArtifactMethod",
    "ICAFitConfig",
    "NotchConfig",
    "PreprocessingConfig",
    "PreprocessingManifest",
    "PreprocessingPreview",
    "PreprocessingRequest",
    "PreprocessingResult",
    "PreprocessingSignalResponse",
    "PreprocessingStage",
    "PreprocessingStageAudit",
    "PreprocessingService",
    "PreprocessingStorage",
    "ReferenceType",
    "ResampleConfig",
    "SignalIntegrityReport",
    "StageStatus",
    "apply_preprocessing_pipeline",
    "compute_signal_integrity",
    "fit_ica_decomposition",
    "generate_pipeline_preview",
]
