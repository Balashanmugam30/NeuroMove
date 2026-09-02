"""NeuroMove — Phase 21 Signal Quality Control & Channel QC Engine."""

from __future__ import annotations

import logging

import numpy as np

from neuromove.eeg_acquisition.models import (
    ChannelQcStatus,
    EegChannelHealthSnapshot,
)

logger = logging.getLogger(__name__)


class EegSignalQcEngine:
    """Evaluates multi-channel EEG signal quality on rolling sample windows.

    Detects flatlines, saturations, dropouts, non-finite values, and variance anomalies.
    """

    def __init__(
        self,
        flatline_std_threshold_uv: float = 0.1,
        saturation_amp_threshold_uv: float = 450.0,
        max_variance_threshold_uv2: float = 25000.0,
        min_variance_threshold_uv2: float = 0.01,
    ):
        self.flatline_std_threshold_uv = flatline_std_threshold_uv
        self.saturation_amp_threshold_uv = saturation_amp_threshold_uv
        self.max_variance_threshold_uv2 = max_variance_threshold_uv2
        self.min_variance_threshold_uv2 = min_variance_threshold_uv2

    def evaluate_window(
        self,
        data_uv: np.ndarray,
        channel_names: list[str],
    ) -> tuple[dict[str, EegChannelHealthSnapshot], bool, int]:
        """Evaluate signal quality metrics per channel across the provided window.

        Args:
            data_uv: Numpy array of shape (n_channels, n_samples) in microvolts (uV)
            channel_names: List of channel names

        Returns:
            (channel_snapshots_map, is_overall_nominal, degraded_channel_count)
        """
        snapshots: dict[str, EegChannelHealthSnapshot] = {}
        degraded_count = 0

        n_channels, n_samples = data_uv.shape if len(data_uv.shape) == 2 else (0, 0)

        for idx, ch_name in enumerate(channel_names):
            if idx >= n_channels or n_samples == 0:
                snapshots[ch_name] = EegChannelHealthSnapshot(
                    channel_name=ch_name,
                    qc_status=ChannelQcStatus.CHANNEL_MISSING,
                    mean_amp_uv=0.0,
                    std_amp_uv=0.0,
                    min_amp_uv=0.0,
                    max_amp_uv=0.0,
                    variance=0.0,
                    packet_loss_rate=0.0,
                    is_healthy=False,
                )
                degraded_count += 1
                continue

            ch_data = data_uv[idx, :]

            # Check for non-finite values (NaN / Inf)
            nan_count = int(np.isnan(ch_data).sum())
            inf_count = int(np.isinf(ch_data).sum())
            if nan_count > 0 or inf_count > 0:
                snapshots[ch_name] = EegChannelHealthSnapshot(
                    channel_name=ch_name,
                    qc_status=ChannelQcStatus.NONFINITE,
                    mean_amp_uv=0.0,
                    std_amp_uv=0.0,
                    min_amp_uv=0.0,
                    max_amp_uv=0.0,
                    variance=0.0,
                    packet_loss_rate=0.0,
                    is_healthy=False,
                )
                degraded_count += 1
                continue

            mean_amp = float(np.mean(ch_data))
            std_amp = float(np.std(ch_data))
            min_amp = float(np.min(ch_data))
            max_amp = float(np.max(ch_data))
            var_amp = float(np.var(ch_data))
            max_abs_amp = max(abs(min_amp), abs(max_amp))

            # Quality classification
            status = ChannelQcStatus.HEALTHY

            if max_abs_amp >= self.saturation_amp_threshold_uv:
                status = ChannelQcStatus.SATURATION
            elif std_amp < self.flatline_std_threshold_uv:
                status = ChannelQcStatus.FLATLINE
            elif var_amp > self.max_variance_threshold_uv2:
                status = ChannelQcStatus.EXCESSIVE_VARIANCE
            elif var_amp < self.min_variance_threshold_uv2:
                status = ChannelQcStatus.LOW_VARIANCE
            elif max_abs_amp > 500.0:
                status = ChannelQcStatus.RANGE_VIOLATION

            is_healthy = status == ChannelQcStatus.HEALTHY
            if not is_healthy:
                degraded_count += 1

            snapshots[ch_name] = EegChannelHealthSnapshot(
                channel_name=ch_name,
                qc_status=status,
                mean_amp_uv=round(mean_amp, 2),
                std_amp_uv=round(std_amp, 2),
                min_amp_uv=round(min_amp, 2),
                max_amp_uv=round(max_amp, 2),
                variance=round(var_amp, 2),
                packet_loss_rate=0.0,
                is_healthy=is_healthy,
            )

        is_overall_nominal = degraded_count == 0
        return snapshots, is_overall_nominal, degraded_count
