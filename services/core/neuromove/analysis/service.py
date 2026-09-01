"""NeuroMove EEG Analysis Coordination Service.

Coordinates data extraction, MNE spectral analysis, caching, and export generation.
"""

from __future__ import annotations

import csv
import io
import logging
from typing import Any

import numpy as np

from neuromove.analysis.cache import analysis_cache
from neuromove.analysis.models import (
    BandPowerRequest,
    BandPowerResponse,
    ChannelPosition,
    EEGChannelSummary,
    EEGSourceKind,
    PSDRequest,
    PSDResponse,
    TFRRequest,
    TFRResponse,
)
from neuromove.analysis.spectral import compute_band_power_analysis, compute_psd_analysis
from neuromove.analysis.time_frequency import compute_morlet_tfr
from neuromove.domain.enums import Intent, OperatingMode
from neuromove.simulation.config import SimulationConfig
from neuromove.simulation.eeg_generator import SyntheticEEGGenerator

logger = logging.getLogger("neuromove.analysis.service")


class EEGAnalysisService:
    """Service governing EEG spectral computations and channel metadata."""

    def __init__(self) -> None:
        self._generator = SyntheticEEGGenerator(SimulationConfig(seed=42))

    def _get_analysis_data(
        self,
        channels: list[str],
        duration_seconds: float,
        intent: Intent = Intent.NONE,
    ) -> np.ndarray:
        """Generate or retrieve continuous multi-channel synthetic EEG data in microvolts (uV)."""
        sample_rate = 250
        sample_count = int(duration_seconds * sample_rate)
        # Create a deterministic generator with seed 42 to ensure reproducibility
        gen = SyntheticEEGGenerator(SimulationConfig(seed=42))
        gen.set_intent(intent)
        chunk = gen.generate_samples(sample_count)

        # Assemble into shape (n_channels, n_samples)
        matrix = []
        for ch in channels:
            if ch in chunk.samples:
                matrix.append(chunk.samples[ch])
            else:
                # Default baseline zeros if channel unrecognized
                matrix.append([0.0] * sample_count)
        return np.array(matrix, dtype=np.float64)

    def get_channels_summary(self) -> list[EEGChannelSummary]:
        """Return 10-20 standard channel topology coordinates and statuses."""
        return [
            EEGChannelSummary(
                channel="C3",
                label="Left Primary Motor Cortex",
                position=ChannelPosition(x=-0.35, y=0.0),
                cortical_area="Brodmann Area 4 (Left Hand / Upper Limb Representation)",
                quality_score=0.96,
                snr_db=18.4,
                status="NOMINAL",
            ),
            EEGChannelSummary(
                channel="Cz",
                label="Vertex / Central Midline",
                position=ChannelPosition(x=0.0, y=0.0),
                cortical_area="Foot / Lower Limb Sensory-Motor Cortex Representation",
                quality_score=0.97,
                snr_db=19.1,
                status="NOMINAL",
            ),
            EEGChannelSummary(
                channel="C4",
                label="Right Primary Motor Cortex",
                position=ChannelPosition(x=0.35, y=0.0),
                cortical_area="Brodmann Area 4 (Right Hand / Upper Limb Representation)",
                quality_score=0.95,
                snr_db=17.6,
                status="NOMINAL",
            ),
        ]

    def compute_psd(self, request: PSDRequest) -> PSDResponse:
        """Compute or retrieve cached Power Spectral Density."""
        cache_key = f"psd:{request.recording_id}:{request.method}:{request.channels}:{request.fmin}:{request.fmax}:{request.window_duration_seconds}"
        cached = analysis_cache.get(cache_key)
        if cached:
            return cached

        if request.recording_id:
            from neuromove.datasets.service import get_dataset_service

            dataset_service = get_dataset_service()
            dataset_id = request.dataset_id or "physionet-eegbci"
            sig_res = dataset_service.get_signal(
                dataset_id=dataset_id,
                recording_id=request.recording_id,
                channels=request.channels,
                start_sec=0.0,
                duration_sec=request.window_duration_seconds,
            )
            sample_rate = sig_res.sampling_rate_hz
            matrix = [
                sig_res.signals.get(ch, [0.0] * len(sig_res.timestamps)) for ch in request.channels
            ]
            data = np.array(matrix, dtype=np.float64)
            mode = OperatingMode.REPLAY
            source_kind = EEGSourceKind.RECORDED
            fmax = min(request.fmax, sample_rate / 2.0 - 0.5)
        else:
            data = self._get_analysis_data(request.channels, request.window_duration_seconds)
            sample_rate = 250
            mode = OperatingMode.SIMULATION
            source_kind = EEGSourceKind.SYNTHETIC
            fmax = request.fmax

        response = compute_psd_analysis(
            data_uv=data,
            channel_names=request.channels,
            sample_rate_hz=sample_rate,
            method=request.method,
            fmin=request.fmin,
            fmax=fmax,
            session_id=request.session_id,
            trial_id=request.trial_id,
            mode=mode,
            source_kind=source_kind,
        )

        analysis_cache.set(cache_key, response)
        return response

    def compute_band_power(self, request: BandPowerRequest) -> BandPowerResponse:
        """Compute or retrieve cached frequency band powers."""
        cache_key = f"bp:{request.recording_id}:{request.method}:{request.channels}:{request.window_duration_seconds}"
        cached = analysis_cache.get(cache_key)
        if cached:
            return cached

        if request.recording_id:
            from neuromove.datasets.service import get_dataset_service

            dataset_service = get_dataset_service()
            dataset_id = request.dataset_id or "physionet-eegbci"
            sig_res = dataset_service.get_signal(
                dataset_id=dataset_id,
                recording_id=request.recording_id,
                channels=request.channels,
                start_sec=0.0,
                duration_sec=request.window_duration_seconds,
            )
            sample_rate = sig_res.sampling_rate_hz
            matrix = [
                sig_res.signals.get(ch, [0.0] * len(sig_res.timestamps)) for ch in request.channels
            ]
            data = np.array(matrix, dtype=np.float64)
            mode = OperatingMode.REPLAY
            source_kind = EEGSourceKind.RECORDED
        else:
            data = self._get_analysis_data(request.channels, request.window_duration_seconds)
            sample_rate = 250
            mode = OperatingMode.SIMULATION
            source_kind = EEGSourceKind.SYNTHETIC

        response = compute_band_power_analysis(
            data_uv=data,
            channel_names=request.channels,
            sample_rate_hz=sample_rate,
            method=request.method,
            session_id=request.session_id,
            trial_id=request.trial_id,
            mode=mode,
            source_kind=source_kind,
        )

        analysis_cache.set(cache_key, response)
        return response

    def compute_tfr(self, request: TFRRequest) -> TFRResponse:
        """Compute or retrieve cached Morlet wavelet Time-Frequency Representation."""
        cache_key = f"tfr:{request.recording_id}:{request.channel}:{request.fmin}:{request.fmax}:{request.window_duration_seconds}"
        cached = analysis_cache.get(cache_key)
        if cached:
            return cached

        if request.recording_id:
            from neuromove.datasets.service import get_dataset_service

            dataset_service = get_dataset_service()
            dataset_id = request.dataset_id or "physionet-eegbci"
            sig_res = dataset_service.get_signal(
                dataset_id=dataset_id,
                recording_id=request.recording_id,
                channels=[request.channel],
                start_sec=0.0,
                duration_sec=request.window_duration_seconds,
            )
            sample_rate = sig_res.sampling_rate_hz
            channel_signal = np.array(
                sig_res.signals.get(request.channel, [0.0] * len(sig_res.timestamps)),
                dtype=np.float64,
            )
            mode = OperatingMode.REPLAY
            source_kind = EEGSourceKind.RECORDED
            fmax = min(request.fmax, sample_rate / 2.0 - 0.5)
        else:
            data = self._get_analysis_data([request.channel], request.window_duration_seconds)
            channel_signal = data[0]
            sample_rate = 250
            mode = OperatingMode.SIMULATION
            source_kind = EEGSourceKind.SYNTHETIC
            fmax = request.fmax

        response = compute_morlet_tfr(
            data_uv=channel_signal,
            channel_name=request.channel,
            sample_rate_hz=sample_rate,
            fmin=request.fmin,
            fmax=fmax,
            n_frequencies=20,
            session_id=request.session_id,
            trial_id=request.trial_id,
            mode=mode,
            source_kind=source_kind,
        )

        analysis_cache.set(cache_key, response)
        return response

    def export_psd_csv(self, request: PSDRequest) -> str:
        """Generate research CSV export for Power Spectral Density with provenance."""
        psd_res = self.compute_psd(request)
        output = io.StringIO()
        writer = csv.writer(output)

        # Provenance Header
        writer.writerow(["# NEUROMOVE EEG LABORATORY — POWER SPECTRAL DENSITY EXPORT"])
        writer.writerow(["# Analysis ID", psd_res.metadata.analysis_id])
        writer.writerow(["# Version", psd_res.metadata.analysis_version])
        writer.writerow(["# Mode", psd_res.metadata.mode])
        writer.writerow(["# Source Kind", psd_res.metadata.source_kind])
        writer.writerow(["# Sampling Rate (Hz)", psd_res.metadata.sampling_rate_hz])
        writer.writerow(["# Estimation Method", psd_res.metadata.method])
        writer.writerow(["# Engine", psd_res.metadata.engine])
        writer.writerow(["# Units", psd_res.units])
        writer.writerow(["# Created At", psd_res.metadata.created_at.isoformat()])
        writer.writerow([])

        # Data Rows
        header = ["Frequency_Hz"] + request.channels
        writer.writerow(header)

        for idx, freq in enumerate(psd_res.frequencies):
            row = [freq]
            for ch in request.channels:
                row.append(psd_res.psd_by_channel[ch][idx])
            writer.writerow(row)

        return output.getvalue()

    def export_band_power_csv(self, request: BandPowerRequest) -> str:
        """Generate research CSV export for Band Powers with provenance."""
        bp_res = self.compute_band_power(request)
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["# NEUROMOVE EEG LABORATORY — BAND POWER EXPORT"])
        writer.writerow(["# Analysis ID", bp_res.metadata.analysis_id])
        writer.writerow(["# Version", bp_res.metadata.analysis_version])
        writer.writerow(["# Mode", bp_res.metadata.mode])
        writer.writerow(["# Source Kind", bp_res.metadata.source_kind])
        writer.writerow(["# Lateralization Index", bp_res.mu_erd_lateralization_index])
        writer.writerow(["# Units", bp_res.units])
        writer.writerow(["# Created At", bp_res.metadata.created_at.isoformat()])
        writer.writerow([])

        writer.writerow(
            ["Channel", "Band", "Freq_Min_Hz", "Freq_Max_Hz", "Absolute_Power", "Relative_Power"]
        )
        for ch, bands in bp_res.bands_by_channel.items():
            for b_name, item in bands.items():
                writer.writerow(
                    [
                        ch,
                        b_name,
                        item.frequency_range[0],
                        item.frequency_range[1],
                        item.absolute_power,
                        item.relative_power,
                    ]
                )

        return output.getvalue()

    def export_analysis_json(self, session_id: str | None = None) -> dict[str, Any]:
        """Generate complete JSON analysis snapshot with provenance."""
        psd = self.compute_psd(PSDRequest(session_id=session_id))
        bp = self.compute_band_power(BandPowerRequest(session_id=session_id))
        tfr = self.compute_tfr(TFRRequest(session_id=session_id))
        channels = self.get_channels_summary()

        return {
            "laboratory": "NeuroMove EEG Laboratory",
            "version": "EEG_ANALYSIS_V1",
            "mode": OperatingMode.SIMULATION,
            "source": "SYNTHETIC EEG",
            "channels_topology": [c.model_dump(mode="json") for c in channels],
            "psd": psd.model_dump(mode="json"),
            "band_power": bp.model_dump(mode="json"),
            "time_frequency": tfr.model_dump(mode="json"),
        }


analysis_service = EEGAnalysisService()
