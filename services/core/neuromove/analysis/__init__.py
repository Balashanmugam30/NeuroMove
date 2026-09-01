"""NeuroMove EEG Analysis Package.

Provides research-grade MNE-based spectral analysis, band power estimation,
and time-frequency decomposition.
"""

from neuromove.analysis.models import (
    BandPowerItem,
    BandPowerRequest,
    BandPowerResponse,
    EEGAnalysisMetadata,
    EEGChannelSummary,
    PSDRequest,
    PSDResponse,
    TFRRequest,
    TFRResponse,
)
from neuromove.analysis.service import analysis_service

__all__ = [
    "PSDRequest",
    "PSDResponse",
    "BandPowerItem",
    "BandPowerRequest",
    "BandPowerResponse",
    "TFRRequest",
    "TFRResponse",
    "EEGAnalysisMetadata",
    "EEGChannelSummary",
    "analysis_service",
]
