"""NeuroMove MNE-Based Power Spectral Density & Band Power Estimation.

Implements research-grade spectral estimation using modern MNE compute_psd APIs
(Welch and Multitaper) and discrete motor-rhythm band power integration.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

import mne
import numpy as np

from neuromove.analysis.models import (
    BandPowerItem,
    BandPowerResponse,
    EEGAnalysisMetadata,
    EEGSourceKind,
    PSDMethod,
    PSDResponse,
)
from neuromove.domain.enums import OperatingMode

logger = logging.getLogger("neuromove.analysis.spectral")

# Canonical NeuroMove EEG Frequency Bands
FREQUENCY_BANDS: dict[str, tuple[float, float]] = {
    "delta": (1.0, 4.0),
    "theta": (4.0, 8.0),
    "mu": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 45.0),
}


def _integrate_power(freqs: np.ndarray, psd: np.ndarray, fmin: float, fmax: float) -> float:
    """Integrate power spectral density across a discrete frequency band."""
    mask = (freqs >= fmin) & (freqs <= fmax)
    if not np.any(mask):
        return 0.0
    band_freqs = freqs[mask]
    band_psd = psd[mask]
    if len(band_freqs) < 2:
        return float(band_psd[0]) if len(band_psd) > 0 else 0.0
    # Trapezoidal numerical integration
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(band_psd, band_freqs))
    return float(np.trapz(band_psd, band_freqs))


def compute_psd_analysis(
    data_uv: np.ndarray,
    channel_names: list[str],
    sample_rate_hz: int = 250,
    method: PSDMethod | str = PSDMethod.WELCH,
    fmin: float = 1.0,
    fmax: float = 40.0,
    session_id: str | None = None,
    trial_id: str | None = None,
    mode: OperatingMode = OperatingMode.SIMULATION,
    source_kind: EEGSourceKind = EEGSourceKind.SYNTHETIC,
) -> PSDResponse:
    """Compute Power Spectral Density using MNE modern compute_psd API."""
    nyquist = sample_rate_hz / 2.0
    if fmax >= nyquist:
        raise ValueError(
            f"Requested fmax ({fmax} Hz) exceeds or equals the Nyquist frequency ({nyquist} Hz) "
            f"for sampling rate {sample_rate_hz} Hz."
        )
    if fmin >= fmax:
        raise ValueError(f"fmin ({fmin} Hz) must be strictly less than fmax ({fmax} Hz).")

    n_channels, n_samples = data_uv.shape
    if n_channels != len(channel_names):
        raise ValueError(
            f"Data channel count ({n_channels}) does not match channel names ({len(channel_names)})."
        )

    # Convert microvolts (uV) to Volts (V) for MNE standard representation
    data_volts = data_uv * 1e-6

    info = mne.create_info(ch_names=channel_names, sfreq=sample_rate_hz, ch_types="eeg")
    raw = mne.io.RawArray(data_volts, info, verbose=False)

    mne_method = "welch" if str(method).lower() == "welch" else "multitaper"
    spectrum = raw.compute_psd(
        method=mne_method,
        fmin=fmin,
        fmax=fmax,
        verbose=False,
    )

    psds_volts, freqs = spectrum.get_data(return_freqs=True)
    # Convert V^2/Hz back to uV^2/Hz (1 V^2 = 1e12 uV^2)
    psds_uv = psds_volts * 1e12

    psd_by_channel: dict[str, list[float]] = {}
    peak_frequencies: dict[str, float] = {}

    for idx, ch in enumerate(channel_names):
        ch_psd = psds_uv[idx]
        psd_by_channel[ch] = [round(float(val), 4) for val in ch_psd]
        peak_idx = int(np.argmax(ch_psd))
        peak_frequencies[ch] = round(float(freqs[peak_idx]), 2)

    duration_sec = n_samples / sample_rate_hz
    metadata = EEGAnalysisMetadata(
        analysis_id=f"anl_psd_{uuid.uuid4().hex[:10]}",
        analysis_version="EEG_ANALYSIS_V1",
        session_id=session_id,
        trial_id=trial_id,
        source_kind=source_kind,
        mode=mode,
        channels=channel_names,
        sampling_rate_hz=sample_rate_hz,
        method=mne_method,
        frequency_range_hz=(float(fmin), float(fmax)),
        window_seconds=(0.0, round(duration_sec, 3)),
        engine=f"MNE-Python {mne.__version__}",
        created_at=datetime.now(UTC),
    )

    return PSDResponse(
        frequencies=[round(float(f), 2) for f in freqs],
        psd_by_channel=psd_by_channel,
        units="uV^2/Hz",
        peak_frequencies=peak_frequencies,
        metadata=metadata,
    )


def compute_band_power_analysis(
    data_uv: np.ndarray,
    channel_names: list[str],
    sample_rate_hz: int = 250,
    method: PSDMethod | str = PSDMethod.WELCH,
    session_id: str | None = None,
    trial_id: str | None = None,
    mode: OperatingMode = OperatingMode.SIMULATION,
    source_kind: EEGSourceKind = EEGSourceKind.SYNTHETIC,
) -> BandPowerResponse:
    """Compute integrated absolute and relative frequency band powers per channel."""
    # 1. Compute PSD from 1.0 to 45.0 Hz to encompass all standard bands (bounded by Nyquist)
    fmax = min(45.0, sample_rate_hz / 2.0 - 0.5)
    psd_res = compute_psd_analysis(
        data_uv=data_uv,
        channel_names=channel_names,
        sample_rate_hz=sample_rate_hz,
        method=method,
        fmin=1.0,
        fmax=fmax,
        session_id=session_id,
        trial_id=trial_id,
        mode=mode,
        source_kind=source_kind,
    )

    freqs = np.array(psd_res.frequencies)
    bands_by_channel: dict[str, dict[str, BandPowerItem]] = {}

    for ch in channel_names:
        ch_psd = np.array(psd_res.psd_by_channel[ch])
        ch_bands: dict[str, BandPowerItem] = {}
        total_band_power = 0.0

        # Pass 1: Compute absolute power per band
        temp_powers: dict[str, float] = {}
        for band_name, (b_min, b_max) in FREQUENCY_BANDS.items():
            power = _integrate_power(freqs, ch_psd, b_min, b_max)
            temp_powers[band_name] = power
            total_band_power += power

        # Pass 2: Normalize to relative power
        for band_name, (b_min, b_max) in FREQUENCY_BANDS.items():
            abs_p = temp_powers[band_name]
            rel_p = abs_p / (total_band_power + 1e-9)
            ch_bands[band_name] = BandPowerItem(
                band=band_name,
                frequency_range=(b_min, b_max),
                absolute_power=round(abs_p, 4),
                relative_power=round(rel_p, 4),
            )

        bands_by_channel[ch] = ch_bands

    # Calculate Mu Lateralization Index: (P_mu(C4) - P_mu(C3)) / (P_mu(C4) + P_mu(C3))
    lateralization_index = 0.0
    if "C3" in bands_by_channel and "C4" in bands_by_channel:
        mu_c3 = bands_by_channel["C3"]["mu"].absolute_power
        mu_c4 = bands_by_channel["C4"]["mu"].absolute_power
        denom = mu_c4 + mu_c3
        if denom > 0:
            lateralization_index = round((mu_c4 - mu_c3) / denom, 4)

    duration_sec = data_uv.shape[1] / sample_rate_hz
    metadata = EEGAnalysisMetadata(
        analysis_id=f"anl_bp_{uuid.uuid4().hex[:10]}",
        analysis_version="EEG_ANALYSIS_V1",
        session_id=session_id,
        trial_id=trial_id,
        source_kind=source_kind,
        mode=mode,
        channels=channel_names,
        sampling_rate_hz=sample_rate_hz,
        method=str(method).lower(),
        frequency_range_hz=(1.0, fmax),
        window_seconds=(0.0, round(duration_sec, 3)),
        engine=f"MNE-Python {mne.__version__}",
        created_at=datetime.now(UTC),
    )

    return BandPowerResponse(
        bands_by_channel=bands_by_channel,
        mu_erd_lateralization_index=lateralization_index,
        units="uV^2",
        metadata=metadata,
    )
