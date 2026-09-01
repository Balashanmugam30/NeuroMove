"""NeuroMove Analysis Domain Models & Contracts.

Pydantic models governing MNE-based spectral analysis, band power estimation,
and time-frequency analysis.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from neuromove.domain.enums import OperatingMode


class EEGSourceKind(StrEnum):
    """Electrophysiological signal source kind."""

    SYNTHETIC = "SYNTHETIC"
    RECORDED = "RECORDED"
    HARDWARE = "HARDWARE"


class PSDMethod(StrEnum):
    """Spectral density estimation algorithm."""

    WELCH = "welch"
    MULTITAPER = "multitaper"


class AnalysisStatus(StrEnum):
    """Lifecycle status of scientific computation."""

    NOT_STARTED = "NOT_STARTED"
    RUNNING = "RUNNING"
    READY = "READY"
    FAILED = "FAILED"
    STALE = "STALE"


class EEGAnalysisMetadata(BaseModel):
    """Analysis provenance and configuration metadata."""

    analysis_id: str
    analysis_version: str = "EEG_ANALYSIS_V1"
    session_id: str | None = None
    trial_id: str | None = None
    source_kind: EEGSourceKind = EEGSourceKind.SYNTHETIC
    mode: OperatingMode = OperatingMode.SIMULATION
    channels: list[str] = Field(default_factory=lambda: ["C3", "Cz", "C4"])
    sampling_rate_hz: int = 250
    method: str = "welch"
    frequency_range_hz: tuple[float, float] = (1.0, 40.0)
    window_seconds: tuple[float, float] = (0.0, 4.0)
    engine: str = "MNE-Python 1.12.1"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class PSDRequest(BaseModel):
    """Request payload for Power Spectral Density analysis."""

    session_id: str | None = None
    trial_id: str | None = None
    channels: list[str] = Field(default_factory=lambda: ["C3", "Cz", "C4"])
    method: PSDMethod = PSDMethod.WELCH
    fmin: float = Field(default=1.0, ge=0.5, le=120.0)
    fmax: float = Field(default=40.0, ge=1.0, le=125.0)
    window_duration_seconds: float = Field(default=4.0, ge=1.0, le=16.0)


class PSDResponse(BaseModel):
    """Computed Power Spectral Density response."""

    frequencies: list[float]
    psd_by_channel: dict[str, list[float]]  # channel -> spectral power in uV^2/Hz
    units: str = "uV^2/Hz"
    peak_frequencies: dict[str, float] = Field(default_factory=dict)
    metadata: EEGAnalysisMetadata


class BandPowerItem(BaseModel):
    """Calculated power metrics for a discrete frequency band."""

    band: str
    frequency_range: tuple[float, float]
    absolute_power: float
    relative_power: float


class BandPowerRequest(BaseModel):
    """Request payload for frequency band power analysis."""

    session_id: str | None = None
    trial_id: str | None = None
    channels: list[str] = Field(default_factory=lambda: ["C3", "Cz", "C4"])
    method: PSDMethod = PSDMethod.WELCH
    window_duration_seconds: float = Field(default=4.0, ge=1.0, le=16.0)


class BandPowerResponse(BaseModel):
    """Computed frequency band powers across channels."""

    bands_by_channel: dict[str, dict[str, BandPowerItem]]
    mu_erd_lateralization_index: float = 0.0
    units: str = "uV^2"
    metadata: EEGAnalysisMetadata


class TFRRequest(BaseModel):
    """Request payload for Morlet wavelet time-frequency analysis."""

    session_id: str | None = None
    trial_id: str | None = None
    channel: str = "C3"
    fmin: float = Field(default=4.0, ge=1.0, le=60.0)
    fmax: float = Field(default=40.0, ge=5.0, le=100.0)
    window_duration_seconds: float = Field(default=4.0, ge=1.0, le=10.0)


class TFRResponse(BaseModel):
    """Computed Time-Frequency Representation (spectrogram)."""

    times: list[float]
    frequencies: list[float]
    power_matrix: list[list[float]]  # freqs x times
    channel: str = "C3"
    units: str = "uV^2"
    metadata: EEGAnalysisMetadata


class ChannelPosition(BaseModel):
    """2D Cartesian projection of standard 10-20 electrode coordinate."""

    x: float
    y: float


class EEGChannelSummary(BaseModel):
    """Informational channel status and 10-20 topology coordinates."""

    channel: str
    label: str
    position: ChannelPosition
    cortical_area: str
    quality_score: float = 0.95
    snr_db: float = 18.0
    status: str = "NOMINAL"
