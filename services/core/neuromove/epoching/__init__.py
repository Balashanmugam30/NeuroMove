"""NeuroMove Motor-Imagery Epoching & Event Segmentation Module (Phase 10)."""

from neuromove.epoching.engine import (
    apply_epoch_segmentation,
    generate_epoching_preview,
)
from neuromove.epoching.events import (
    discover_raw_events,
    get_default_event_mapping_config,
    normalize_events,
    validate_event_timing,
)
from neuromove.epoching.models import (
    EpochEventMappingStatus,
    EpochingConfig,
    EpochingPreview,
    EpochingRequest,
    EpochManifest,
    EpochQC,
    EpochQCStatus,
    EpochRecord,
    EpochSignalResponse,
    EpochSummary,
    EventMappingConfig,
    EventMappingRule,
    NormalizedEvent,
    NormalizedLabel,
    TrialDefinition,
)
from neuromove.epoching.storage import EpochStorage

__all__ = [
    "EpochEventMappingStatus",
    "NormalizedLabel",
    "EventMappingRule",
    "EventMappingConfig",
    "NormalizedEvent",
    "TrialDefinition",
    "EpochQCStatus",
    "EpochQC",
    "EpochingConfig",
    "EpochRecord",
    "EpochSummary",
    "EpochingPreview",
    "EpochingRequest",
    "EpochSignalResponse",
    "EpochManifest",
    "EpochStorage",
    "discover_raw_events",
    "get_default_event_mapping_config",
    "normalize_events",
    "validate_event_timing",
    "apply_epoch_segmentation",
    "generate_epoching_preview",
]
