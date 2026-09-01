"""Public EEG Dataset Ingestion & Research Dataset Workspace package for NeuroMove."""

from .models import (
    DatasetCacheStatus,
    DatasetChecksumRecord,
    DatasetDefinition,
    DatasetEvent,
    DatasetManifest,
    DatasetRecording,
    DatasetSubject,
    EventMappingStatus,
    IngestionQualityReport,
)
from .provider import DatasetProvider, PhysioNetEEGBCIProvider
from .registry import DatasetRegistry, get_dataset_registry
from .service import DatasetService, get_dataset_service

__all__ = [
    "DatasetCacheStatus",
    "DatasetChecksumRecord",
    "DatasetDefinition",
    "DatasetEvent",
    "DatasetManifest",
    "DatasetRecording",
    "DatasetSubject",
    "EventMappingStatus",
    "IngestionQualityReport",
    "DatasetProvider",
    "PhysioNetEEGBCIProvider",
    "DatasetRegistry",
    "get_dataset_registry",
    "DatasetService",
    "get_dataset_service",
]
