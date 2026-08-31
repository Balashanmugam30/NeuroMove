"""API Request and Response Pydantic Schemas for NeuroMove."""

from datetime import datetime

from pydantic import BaseModel, Field

from ..domain.enums import (
    Intent,
    OperatingMode,
    RuntimeState,
)
from ..domain.models import (
    SignalQuality,
    utc_now,
)


class EEGLatestResponse(BaseModel):
    """Latest time-series EEG epoch snapshot."""

    timestamp: datetime = Field(default_factory=utc_now)
    channels: list[str] = ["C3", "Cz", "C4"]
    sampling_rate_hz: int = 250
    samples: list[list[float]] = Field(default_factory=list)
    signal_quality: SignalQuality = Field(default_factory=SignalQuality)
    is_live_stream: bool = False
    mode: OperatingMode = OperatingMode.SIMULATION


class EEGSpectrumResponse(BaseModel):
    """Power Spectral Density (PSD) band power metrics."""

    timestamp: datetime = Field(default_factory=utc_now)
    frequencies_hz: list[float] = Field(default_factory=list)
    mu_band_power: dict[str, float] = Field(
        default_factory=lambda: {"C3": 0.0, "Cz": 0.0, "C4": 0.0}
    )
    beta_band_power: dict[str, float] = Field(
        default_factory=lambda: {"C3": 0.0, "Cz": 0.0, "C4": 0.0}
    )
    erd_ers_percent: dict[str, float] = Field(default_factory=lambda: {"C3": 0.0, "C4": 0.0})


class CalibrationStartRequest(BaseModel):
    """Payload to initiate structured calibration run."""

    session_name: str = "Calibration_01"
    trials_per_class: int = Field(default=20, ge=5, le=100)
    intents: list[Intent] = [Intent.LEFT, Intent.RIGHT, Intent.STOP]
    trial_duration_sec: float = 4.0


class CalibrationStartResponse(BaseModel):
    """Acknowledgment of calibration initialization."""

    session_id: str
    status: str = "initiated"
    message: str = "Calibration session ready."
    started_at: datetime = Field(default_factory=utc_now)


class EmergencyStopResponse(BaseModel):
    """Emergency halt confirmation receipt."""

    success: bool
    state: RuntimeState
    timestamp: datetime = Field(default_factory=utc_now)
    message: str
