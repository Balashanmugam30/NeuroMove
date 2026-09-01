"""NeuroMove Morlet Wavelet Time-Frequency Analysis.

Implements continuous spectrogram decomposition across time and frequency
using MNE tfr_array_morlet.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

import mne
import numpy as np

from neuromove.analysis.models import (
    EEGAnalysisMetadata,
    EEGSourceKind,
    TFRResponse,
)
from neuromove.domain.enums import OperatingMode

logger = logging.getLogger("neuromove.analysis.tfr")


def compute_morlet_tfr(
    data_uv: np.ndarray,
    channel_name: str = "C3",
    sample_rate_hz: int = 250,
    fmin: float = 4.0,
    fmax: float = 40.0,
    n_frequencies: int = 20,
    session_id: str | None = None,
    trial_id: str | None = None,
    mode: OperatingMode = OperatingMode.SIMULATION,
) -> TFRResponse:
    """Compute Morlet wavelet time-frequency power representation.

    Parameters:
    -----------
    data_uv: np.ndarray
        1D array of amplitudes for the selected channel in microvolts (uV).
    channel_name: str
        Target channel name (e.g. "C3").
    sample_rate_hz: int
        Sampling frequency in Hertz (default 250).
    fmin, fmax: float
        Frequency bounds in Hertz.
    n_frequencies: int
        Number of discrete frequency bins (default 20).
    session_id, trial_id: str | None
        Provenance context.

    Returns:
    --------
    TFRResponse: Times, frequencies, and 2D power matrix (freqs x times).
    """
    nyquist = sample_rate_hz / 2.0
    if fmax >= nyquist:
        raise ValueError(f"Requested fmax ({fmax} Hz) exceeds Nyquist frequency ({nyquist} Hz).")
    if fmin >= fmax:
        raise ValueError(f"fmin ({fmin} Hz) must be strictly less than fmax ({fmax} Hz).")

    # Ensure 1D array
    signal = np.asarray(data_uv, dtype=np.float64).flatten()
    n_samples = len(signal)
    if n_samples < 50:
        raise ValueError("Insufficient samples for Morlet time-frequency decomposition.")

    duration_sec = n_samples / sample_rate_hz
    times = np.linspace(0.0, duration_sec, n_samples)
    freqs = np.linspace(fmin, fmax, n_frequencies)
    n_cycles = freqs / 2.0  # Wavelet cycles proportional to frequency

    # Convert uV to V for MNE
    data_volts = signal * 1e-6
    # Reshape to (n_epochs=1, n_channels=1, n_times)
    reshaped_data = data_volts[np.newaxis, np.newaxis, :]

    # Compute MNE Morlet power
    tfr_power_v2 = mne.time_frequency.tfr_array_morlet(
        reshaped_data,
        sfreq=sample_rate_hz,
        freqs=freqs,
        n_cycles=n_cycles,
        output="power",
        verbose=False,
    )

    # Squeeze to (n_freqs, n_times) and convert V^2 to uV^2
    power_matrix_uv = tfr_power_v2[0, 0, :, :] * 1e12

    # Downsample time dimension to max 80 points for lightweight web transmission
    max_time_points = 80
    if n_samples > max_time_points:
        step = int(np.ceil(n_samples / max_time_points))
        sampled_times = times[::step]
        sampled_matrix = power_matrix_uv[:, ::step]
    else:
        sampled_times = times
        sampled_matrix = power_matrix_uv

    matrix_list = [[round(float(val), 4) for val in row] for row in sampled_matrix]

    metadata = EEGAnalysisMetadata(
        analysis_id=f"anl_tfr_{uuid.uuid4().hex[:10]}",
        analysis_version="EEG_ANALYSIS_V1",
        session_id=session_id,
        trial_id=trial_id,
        source_kind=EEGSourceKind.SYNTHETIC,
        mode=mode,
        channels=[channel_name],
        sampling_rate_hz=sample_rate_hz,
        method="morlet_wavelet",
        frequency_range_hz=(float(fmin), float(fmax)),
        window_seconds=(0.0, round(duration_sec, 3)),
        engine=f"MNE-Python {mne.__version__}",
        created_at=datetime.now(UTC),
    )

    return TFRResponse(
        times=[round(float(t), 3) for t in sampled_times],
        frequencies=[round(float(f), 2) for f in freqs],
        power_matrix=matrix_list,
        channel=channel_name,
        units="uV^2",
        metadata=metadata,
    )
