"""NeuroMove Motor-Imagery Feature Foundation & Covariance Representation (Phase 10)."""

from .extractor import (
    compute_covariance_representation,
    extract_epoch_feature_vector,
    extract_feature_set,
    generate_feature_preview,
    validate_covariance_matrix,
)
from .models import (
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
from .service import EpochingFeatureService, get_epoching_feature_service
from .storage import FeatureStorage

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
    "get_epoching_feature_service",
    "extract_epoch_feature_vector",
    "compute_covariance_representation",
    "validate_covariance_matrix",
    "extract_feature_set",
    "generate_feature_preview",
]
