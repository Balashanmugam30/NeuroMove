"""NeuroMove Motor-Imagery Feature Foundation & Covariance Representation (Phase 10)."""

from neuromove.features.extractor import (
    compute_covariance_representation,
    extract_epoch_feature_vector,
    extract_feature_set,
    generate_feature_preview,
    validate_covariance_matrix,
)
from neuromove.features.models import (
    CovarianceMatrixRecord,
    CovarianceMethod,
    CovarianceSet,
    FeatureBand,
    FeatureConfig,
    FeatureExtractionRequest,
    FeatureManifest,
    FeaturePowerType,
    FeaturePreview,
    FeatureSet,
    FeatureVector,
)
from neuromove.features.service import EpochingFeatureService
from neuromove.features.storage import FeatureStorage

__all__ = [
    "FeaturePowerType",
    "CovarianceMethod",
    "FeatureBand",
    "FeatureConfig",
    "FeatureVector",
    "CovarianceMatrixRecord",
    "CovarianceSet",
    "FeatureSet",
    "FeaturePreview",
    "FeatureExtractionRequest",
    "FeatureManifest",
    "FeatureStorage",
    "EpochingFeatureService",
    "extract_epoch_feature_vector",
    "compute_covariance_representation",
    "validate_covariance_matrix",
    "extract_feature_set",
    "generate_feature_preview",
]
