"""NeuroMove — Phase 23 Multimodal Sensors & Context Engine Domain Models."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from pydantic import BaseModel, Field

from neuromove.domain.enums import (
    ContradictionOutcome,
    FusionStrategy,
    MotionContaminationState,
    SensorModality,
    SensorSource,
    SensorState,
    SynchronizationStatus,
    TrialQuality,
)


class SensorDeviceDescriptor(BaseModel):
    """Metadata describing a physical, simulated, or recorded sensor device."""

    device_id: str
    name: str
    modality: SensorModality
    source: SensorSource = SensorSource.SIMULATOR
    vendor: str = "NeuroMove Labs"
    model: str = "Generic"
    firmware_version: str = "1.0.0"
    protocol: str = "VIRTUAL_STREAM"
    channel_count: int = 1
    channel_names: list[str] = Field(default_factory=list)
    supported_sampling_rates: list[int] = Field(default_factory=lambda: [100, 250, 500])
    default_sampling_rate: int = 250
    adc_resolution_bits: int = 24
    is_available: bool = True
    is_connected: bool = False
    connection_path: str | None = None
    serial_hash: str | None = None
    imu_orientation: str | None = None  # e.g., "NED" or "ENU"


class SensorChannelHealth(BaseModel):
    """Quality indicators for an individual sensor channel."""

    channel_name: str
    modality: SensorModality
    qc_status: TrialQuality = TrialQuality.VALID
    mean_amplitude: float = 0.0
    snr_db: float = 20.0
    flatline_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    saturation_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    dropout_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    is_usable: bool = True


class SensorHealthSnapshot(BaseModel):
    """Health and telemetry report for a sensor device."""

    sensor_id: str
    modality: SensorModality
    state: SensorState = SensorState.DISCONNECTED
    buffer_occupancy_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    packet_loss_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    jitter_ms: float = 0.0
    drift_ppm: float = 0.0
    channels: list[SensorChannelHealth] = Field(default_factory=list)
    last_seen: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    is_healthy: bool = True


class SensorStreamPacket(BaseModel):
    """A bounded chunk of time-series samples from a sensor stream."""

    sensor_id: str
    modality: SensorModality
    source: SensorSource = SensorSource.SIMULATOR
    session_id: str
    sequence_number: int = 0
    device_timestamp: float | None = None
    host_receive_timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    normalized_timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    sample_count: int = 1
    channel_count: int = 1
    channel_names: list[str] = Field(default_factory=list)
    data: list[list[float]] = Field(default_factory=list)  # [channels][samples]
    units: str = "uV"
    quality_flags: list[str] = Field(default_factory=list)
    checksum: str = ""
    configuration_hash: str = ""


class MultimodalSyncState(BaseModel):
    """Inter-sensor synchronization telemetry."""

    session_id: str
    global_session_time_iso: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    status: SynchronizationStatus = SynchronizationStatus.SYNCHRONIZED
    primary_clock_sensor_id: str
    estimated_offsets_ms: dict[str, float] = Field(default_factory=dict)
    estimated_drifts_ppm: dict[str, float] = Field(default_factory=dict)
    max_jitter_ms: float = 0.0
    alignment_quality_pct: float = Field(default=100.0, ge=0.0, le=100.0)
    is_aligned: bool = True


class SensorCalibrationSnapshot(BaseModel):
    """Calibration record and baseline parameters for a sensor."""

    calibration_id: str
    sensor_id: str
    modality: SensorModality
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    parameters: dict[str, Any] = Field(default_factory=dict)
    quality_metrics: dict[str, float] = Field(default_factory=dict)
    manifest_hash: str = ""
    is_calibrated: bool = True
    is_ready: bool = True


class FusionEvidence(BaseModel):
    """An individual feature or observation contributing to multimodal fusion."""

    evidence_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    sensor_id: str
    modality: SensorModality
    feature_name: str
    feature_value: float
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    interpretation: str = ""


class ContradictionRecord(BaseModel):
    """Record of a contradiction detected between multimodal signals."""

    contradiction_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    rule_name: str
    conflicting_sensor_ids: list[str] = Field(default_factory=list)
    conflicting_modalities: list[SensorModality] = Field(default_factory=list)
    outcome: ContradictionOutcome = ContradictionOutcome.HOLD
    reason: str
    severity: str = "MEDIUM"


class FusionResult(BaseModel):
    """Result of deterministic multimodal sensor fusion."""

    fusion_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    strategy: FusionStrategy = FusionStrategy.RULE_BASED_CONTEXT
    participating_sensor_ids: list[str] = Field(default_factory=list)
    participating_modalities: list[SensorModality] = Field(default_factory=list)
    evidence: list[FusionEvidence] = Field(default_factory=list)
    alignment_quality: float = Field(default=1.0, ge=0.0, le=1.0)
    has_contradiction: bool = False
    contradiction_outcome: ContradictionOutcome = ContradictionOutcome.INFORMATIONAL
    contradiction_reason: str | None = None
    fused_context_score: float = Field(default=1.0, ge=0.0, le=1.0)
    context_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    is_valid: bool = True


class MultimodalContext(BaseModel):
    """Synthesized context state combining all active non-actuating modalities."""

    context_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    session_id: str
    motion_state: str = "STATIONARY"  # "STATIONARY" | "MOVING" | "UNKNOWN"
    motion_contamination_state: MotionContaminationState = MotionContaminationState.MOTION_QUIET
    peripheral_activation: bool = False
    ocular_artifact_detected: bool = False
    contact_present: bool = True
    pulse_bpm: float | None = None
    context_confidence: float = Field(default=0.95, ge=0.0, le=1.0)
    is_movement_valid: bool = True
    is_eeg_contaminated: bool = False
    is_stale: bool = False
    participating_sensors: list[str] = Field(default_factory=list)
    active_contradictions: list[ContradictionRecord] = Field(default_factory=list)


class MultimodalSession(BaseModel):
    """Metadata and state for an active or recorded multimodal session."""

    session_id: str
    subject_id: str = "SUBJ_ANONYMOUS"
    start_time: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    end_time: str | None = None
    active_sensors: list[str] = Field(default_factory=list)
    sync_state: MultimodalSyncState | None = None
    global_state: SensorState = SensorState.STREAMING
    calibration_state: dict[str, bool] = Field(default_factory=dict)
    analysis_profile: str = "STANDARD_MI_FUSION"
    config_hash: str = ""


class MultimodalReplayFixture(BaseModel):
    """Deterministic recorded or synthetic multimodal fixture metadata."""

    fixture_id: str
    name: str
    description: str
    modalities: list[SensorModality] = Field(default_factory=list)
    sample_rates: dict[str, int] = Field(default_factory=dict)
    channel_maps: dict[str, list[str]] = Field(default_factory=dict)
    duration_sec: float = 10.0
    checksum: str
    privacy_level: str = "PUBLIC_SYNTHETIC"
    expected_context: str = "REST_AND_IMAGERY"


class MultimodalAnalyticsSummary(BaseModel):
    """Aggregate statistics for multimodal sensor operations."""

    session_count: int = 0
    sensor_availability_pct: float = Field(default=100.0, ge=0.0, le=100.0)
    sync_coverage_pct: float = Field(default=100.0, ge=0.0, le=100.0)
    modality_dropout_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    fusion_agreement_rate: float = Field(default=1.0, ge=0.0, le=1.0)
    contradiction_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    context_invalidation_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    confidence_delta: float = 0.0
    intent_confirmation_delta: float = 0.0
    safety_hold_delta: float = 0.0
    mean_sync_latency_ms: float = 0.5
    mean_fusion_latency_ms: float = 0.8
