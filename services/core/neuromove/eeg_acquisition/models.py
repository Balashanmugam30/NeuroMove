"""NeuroMove — Phase 21 Pydantic Domain Models for EEG Acquisition & Ingestion."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from neuromove.domain.enums import SafetyDecision


class EegAcquisitionSource(StrEnum):
    PHYSICAL = "PHYSICAL"
    SIMULATOR = "SIMULATOR"
    RECORDED = "RECORDED"


class EegAcquisitionState(StrEnum):
    DISCONNECTED = "DISCONNECTED"
    DISCOVERING = "DISCOVERING"
    CONNECTING = "CONNECTING"
    CONFIGURING = "CONFIGURING"
    CALIBRATING = "CALIBRATING"
    STREAMING = "STREAMING"
    PAUSED = "PAUSED"
    DEGRADED = "DEGRADED"
    STALE = "STALE"
    RECONNECTING = "RECONNECTING"
    STOPPING = "STOPPING"
    ERROR = "ERROR"


class ChannelQcStatus(StrEnum):
    HEALTHY = "HEALTHY"
    FLATLINE = "FLATLINE"
    SATURATION = "SATURATION"
    DROPOUT = "DROPOUT"
    NONFINITE = "NONFINITE"
    EXCESSIVE_VARIANCE = "EXCESSIVE_VARIANCE"
    LOW_VARIANCE = "LOW_VARIANCE"
    RANGE_VIOLATION = "RANGE_VIOLATION"
    TIMESTAMP_INVALID = "TIMESTAMP_INVALID"
    CHANNEL_MISSING = "CHANNEL_MISSING"
    CHANNEL_DISABLED = "CHANNEL_DISABLED"


class EegChannelDescriptor(BaseModel):
    channel_id: str
    name: str
    canonical_name: str
    index: int
    enabled: bool = True
    reference: str = "COMMON_AVERAGE"
    unit: str = "uV"
    range_uv: tuple[float, float] = (-500.0, 500.0)
    qc_status: ChannelQcStatus = ChannelQcStatus.HEALTHY
    impedance_kohm: float | None = None


class EegDeviceDescriptor(BaseModel):
    device_id: str
    name: str
    source_type: EegAcquisitionSource
    vendor: str | None = None
    model: str | None = None
    firmware_version: str | None = None
    protocol: str = "1.0"
    channel_count: int
    supported_sampling_rates: list[int] = Field(default_factory=lambda: [125, 250, 500, 1000])
    default_sampling_rate: int = 250
    adc_resolution_bits: int = 24
    is_available: bool = True
    is_connected: bool = False
    connection_path: str | None = None


class EegAcquisitionConfig(BaseModel):
    session_id: str
    subject_id: str = "sub-01"
    source_type: EegAcquisitionSource = EegAcquisitionSource.SIMULATOR
    device_id: str = "sim_bioamp_01"
    sampling_rate: int = 250
    channels: list[EegChannelDescriptor]
    chunk_size_samples: int = 25
    buffer_duration_sec: float = 10.0
    normalization_enabled: bool = True
    qc_enabled: bool = True
    qc_flatline_std_uv: float = 0.1
    qc_saturation_amp_uv: float = 450.0
    recording_enabled: bool = False
    seed: int | None = None


class EegClockInfo(BaseModel):
    host_timestamp: str
    device_timestamp: str | None = None
    normalized_timestamp: str
    clock_offset_ms: float = 0.0
    clock_drift_ppm: float = 0.0
    discontinuity_count: int = 0
    monotonicity_verified: bool = True


class EegSamplePacket(BaseModel):
    packet_id: str
    session_id: str
    sequence_number: int
    device_timestamp: str | None = None
    host_receive_timestamp: str
    normalized_timestamp: str
    sample_count: int
    channel_count: int
    channels: list[str]
    layout: str = "CHANNEL_MAJOR"  # "SAMPLE_MAJOR" or "CHANNEL_MAJOR"
    data: list[list[float]]
    quality_flags: dict[str, str] = Field(default_factory=dict)
    checksum: str | None = None
    is_valid: bool = True


class EegChannelHealthSnapshot(BaseModel):
    channel_name: str
    qc_status: ChannelQcStatus
    mean_amp_uv: float
    std_amp_uv: float
    min_amp_uv: float
    max_amp_uv: float
    variance: float
    packet_loss_rate: float = 0.0
    is_healthy: bool


class EegStreamHealthSnapshot(BaseModel):
    session_id: str
    state: EegAcquisitionState
    source_type: EegAcquisitionSource
    sample_rate: int
    samples_received: int
    samples_dropped: int
    buffer_fill_pct: float
    packet_loss_pct: float
    mean_latency_ms: float
    clock_drift_ms: float = 0.0
    degraded_channel_count: int
    is_nominal: bool
    timestamp: str


class EegCalibrationSnapshot(BaseModel):
    calibration_id: str
    session_id: str
    subject_id: str
    state: str = "NOT_CALIBRATED"  # "NOT_CALIBRATED", "CALIBRATING", "CALIBRATED", "FAILED"
    baseline_duration_sec: float = 0.0
    baseline_mean_uv: dict[str, float] = Field(default_factory=dict)
    baseline_std_uv: dict[str, float] = Field(default_factory=dict)
    channel_health: dict[str, ChannelQcStatus] = Field(default_factory=dict)
    manifest_hash: str
    is_ready: bool = False
    created_at: str


class EegAcquisitionSession(BaseModel):
    session_id: str
    subject_id: str
    source_type: EegAcquisitionSource
    device_id: str
    state: EegAcquisitionState
    sampling_rate: int
    channel_count: int
    channel_names: list[str]
    started_at: str
    stopped_at: str | None = None
    config_hash: str
    provenance_hash: str


class EegAcquisitionDiagnostic(BaseModel):
    diag_id: str
    session_id: str | None = None
    category: str  # "DEVICE", "STREAM", "CLOCK", "BUFFER", "QC", "CALIBRATION", "PIPELINE"
    severity: str  # "INFO", "WARNING", "ERROR", "CRITICAL"
    code: str
    message: str
    timestamp: str
    details: dict[str, Any] = Field(default_factory=dict)


class EegRecordingManifest(BaseModel):
    recording_id: str
    session_id: str
    subject_id: str
    source_type: EegAcquisitionSource
    device_id: str
    total_samples: int
    duration_sec: float
    sampling_rate: int
    channel_count: int
    channel_names: list[str]
    storage_path: str
    checksum: str
    created_at: str


class EegReplayState(BaseModel):
    fixture_id: str
    name: str
    total_samples: int
    current_sample: int
    progress_pct: float
    playback_speed: float = 1.0
    is_paused: bool = False
    is_looping: bool = False
    fixture_hash: str


class EegLiveInferenceSummary(BaseModel):
    inference_id: str
    timestamp: str
    predicted_class: str
    predicted_probability: float
    calibrated_confidence: float
    confidence_policy: str
    temporal_confirmation_state: str
    intent_state: str
    safety_decision: SafetyDecision
    will_transmit: bool
    transport_status: str
    lineage_hash: str


class EegE2EExperiment(BaseModel):
    experiment_id: str
    scenario_id: str
    name: str
    source_type: EegAcquisitionSource
    session_id: str
    subject_id: str
    passed: bool
    verdict: str
    lineage_chain: dict[str, str]
    manifest_hash: str
    started_at: str
    completed_at: str
    details: dict[str, Any] = Field(default_factory=dict)


class EegE2EResult(BaseModel):
    result_id: str
    experiment_id: str
    scenario_id: str
    stage_results: dict[str, bool]
    predicted_intent: str
    confidence_score: float
    safety_decision: SafetyDecision
    hil_status: str
    latency_breakdown_ms: dict[str, float]
    passed: bool
    failure_reason: str | None = None
    timestamp: str
