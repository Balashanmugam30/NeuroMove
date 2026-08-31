"""NeuroMove Simulation Configuration.

Holds explicit, serializable simulation parameters.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SimulationConfig(BaseModel):
    """Explicit parameters governing the deterministic simulation engine."""

    simulation_schema_version: int = Field(
        default=1, description="Schema version of simulation contracts"
    )
    simulation_config_version: int = Field(default=1, description="Config revision version")

    # Sampling & Channels
    sample_rate_hz: int = Field(
        default=250, description="EEG sampling rate in Hertz (default 250 Hz)"
    )
    channels: list[str] = Field(
        default=["C3", "Cz", "C4"], description="Active EEG channel topology"
    )

    # Signal & Noise Synthesis
    baseline_amplitude_uv: float = Field(
        default=20.0, description="Baseline continuous EEG amplitude in microvolts"
    )
    mu_frequency_hz: float = Field(default=10.0, description="Center mu rhythm frequency (8-12 Hz)")
    beta_frequency_hz: float = Field(
        default=20.0, description="Center beta rhythm frequency (16-24 Hz)"
    )
    noise_level_uv: float = Field(
        default=5.0, description="Standard deviation of additive Gaussian noise (uV)"
    )
    drift_frequency_hz: float = Field(default=0.2, description="Slow baseline drift frequency (Hz)")

    # Windowing & Decoders
    chunk_size_samples: int = Field(
        default=25, description="Number of samples emitted per streaming packet (100ms @ 250Hz)"
    )
    window_size_samples: int = Field(default=500, description="Sliding window size (2.0s @ 250Hz)")
    window_overlap_samples: int = Field(
        default=250, description="Sliding window overlap (1.0s @ 250Hz)"
    )
    prediction_interval_ms: int = Field(
        default=250, description="Inference evaluation interval (ms)"
    )

    # Behaviors & Seeds
    seed: int = Field(
        default=42, description="Pseudorandom generator seed for deterministic reproducibility"
    )
    time_scale: float = Field(default=1.0, description="Clock progression speed multiplier")
    enable_artifacts: bool = Field(
        default=True, description="Enable simulated ocular and transient artifacts"
    )

    # Metadata Note
    disclaimer: str = Field(
        default="Synthetic EEG signal for software integration testing. Not measured clinical EEG.",
        description="Scientific scope disclaimer",
    )
