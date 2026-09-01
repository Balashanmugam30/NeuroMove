"""Canonical Pydantic domain models for Public EEG Dataset Ingestion."""

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class DatasetCacheStatus(StrEnum):
    """Local caching and verification state for dataset records."""

    NOT_DOWNLOADED = "NOT_DOWNLOADED"
    DOWNLOADING = "DOWNLOADING"
    DOWNLOADED = "DOWNLOADED"
    VERIFYING = "VERIFYING"
    VERIFIED = "VERIFIED"
    PARTIAL = "PARTIAL"
    CORRUPT = "CORRUPT"
    MISSING = "MISSING"


class EventMappingStatus(StrEnum):
    """Confidence and fidelity status of event code mapping."""

    EXACT = "EXACT"
    NORMALIZED = "NORMALIZED"
    AMBIGUOUS = "AMBIGUOUS"
    UNMAPPED = "UNMAPPED"


class DatasetDefinition(BaseModel):
    """Formal dataset definition model."""

    dataset_id: str
    name: str
    version: str = "1.0.0"
    provider: str
    source_reference: str
    official_reference: str
    license: str
    description: str
    modality: str = "EEG (64-channel 10-10)"
    tasks: list[str] = Field(default_factory=list)
    default_loader: str = "MNE_EEGBCI_EDF_LOADER"
    supported: bool = True
    schema_version: str = "EEG_DATASET_INGESTION_V1"
    cache_status: DatasetCacheStatus = DatasetCacheStatus.NOT_DOWNLOADED
    subjects_count: int = 0
    recordings_count: int = 0
    total_size_bytes: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class DatasetSubject(BaseModel):
    """Subject/Participant record preserving upstream identity boundaries."""

    dataset_id: str
    subject_id: str
    source_subject_id: str
    recording_count: int = 0
    runs: list[int] = Field(default_factory=list)
    available_tasks: list[str] = Field(default_factory=list)


class DatasetEvent(BaseModel):
    """Experimental event marker / annotation preserved from source data."""

    event_id: str
    recording_id: str
    source_event_code: str
    source_label: str
    neuromove_event_type: str
    onset_samples: int
    onset_seconds: float
    duration_seconds: float
    description: str
    mapping_status: EventMappingStatus = EventMappingStatus.NORMALIZED


class DatasetRecording(BaseModel):
    """Canonical recording model for an ingested EEG recording run."""

    recording_id: str
    dataset_id: str
    dataset_version: str = "1.0.0"
    subject_id: str
    source_subject_id: str
    session_id: str
    run_id: str
    file_reference: str
    checksum_sha256: str
    sample_rate_hz: int
    channel_count: int
    channel_names: list[str] = Field(default_factory=list)
    duration_seconds: float
    task: str
    normalized_task_label: str
    event_count: int = 0
    source_kind: str = "RECORDED"
    ingestion_version: str = "EEG_DATASET_INGESTION_V1"
    loader_version: str = "MNE-1.12.1"
    cache_status: DatasetCacheStatus = DatasetCacheStatus.NOT_DOWNLOADED
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    events: list[DatasetEvent] = Field(default_factory=list)


class DatasetChecksumRecord(BaseModel):
    """Checksum and storage validation record for a single dataset file."""

    relative_path: str
    size_bytes: int
    sha256: str
    verification_status: str = "PENDING"
    retrieved_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class DatasetManifest(BaseModel):
    """Reproducibility manifest describing dataset origin, version, and checksums."""

    dataset_id: str
    dataset_version: str
    ingestion_version: str = "EEG_DATASET_INGESTION_V1"
    source: dict[str, str]
    retrieved_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    records_count: int = 0
    checksums: list[DatasetChecksumRecord] = Field(default_factory=list)
    environment: dict[str, str] = Field(
        default_factory=lambda: {
            "python_version": "3.13.6",
            "mne_version": "1.12.1",
            "neuromove_version": "0.1.0",
        }
    )


class IngestionQualityReport(BaseModel):
    """Ingestion and metadata extraction quality report."""

    dataset_id: str
    generated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    files_discovered: int = 0
    files_downloaded: int = 0
    files_verified: int = 0
    files_failed: int = 0
    recordings_indexed: int = 0
    recordings_failed: int = 0
    metadata_missing: int = 0
    channel_anomalies: int = 0
    event_anomalies: int = 0
    overall_status: str = "EXCELLENT"


class DatasetDownloadRequest(BaseModel):
    """Download request for specific subjects and runs."""

    subject_ids: list[str] | None = None
    run_ids: list[str] | None = None
    force_recheck: bool = False


class DatasetVerifyRequest(BaseModel):
    """Integrity verification request."""

    dataset_id: str


class DatasetSignalResponse(BaseModel):
    """Signal snippet response for interactive EEG Lab replay."""

    recording_id: str
    dataset_id: str
    subject_id: str
    run_id: str
    sampling_rate_hz: int
    channels: list[str]
    timestamps: list[float]
    signals: dict[str, list[float]]
    events: list[DatasetEvent]
    duration_seconds: float
    total_samples: int
    window_start_sec: float = 0.0
    window_duration_sec: float = 4.0
