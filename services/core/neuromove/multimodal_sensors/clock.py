"""NeuroMove — Phase 23 Multimodal Clock Normalization & Drift Tracking Layer."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

logger = logging.getLogger(__name__)


class MultimodalClockNormalizer:
    """Normalizes device and host timestamps into a monotonic session timeline per sensor.

    Tracks clock offset, estimated drift (ppm), detects discontinuities and backwards jumps.
    """

    def __init__(self, sensor_id: str, sampling_rate: int = 250, max_jitter_ms: float = 50.0):
        self.sensor_id = sensor_id
        self.sampling_rate = sampling_rate
        self.nominal_interval_s = 1.0 / max(1, sampling_rate)
        self.nominal_interval_ms = self.nominal_interval_s * 1000.0
        self.max_jitter_ms = max_jitter_ms

        self._session_start_host_dt: datetime | None = None
        self._session_start_device_ts: float | None = None
        self._last_normalized_dt: datetime | None = None
        self._last_device_ts: float | None = None
        self._sample_index = 0
        self._discontinuity_count = 0
        self._clock_drift_ppm = 0.0
        self._clock_offset_ms = 0.0

    def reset(self) -> None:
        """Reset normalizer state for a new session or post-reconnection."""
        self._session_start_host_dt = None
        self._session_start_device_ts = None
        self._last_normalized_dt = None
        self._last_device_ts = None
        self._sample_index = 0
        self._discontinuity_count = 0
        self._clock_drift_ppm = 0.0
        self._clock_offset_ms = 0.0

    def normalize(
        self,
        host_receive_dt: datetime | None = None,
        device_timestamp: float | None = None,
        sample_count: int = 1,
    ) -> tuple[str, bool, float, float]:
        """Normalize a packet timestamp.

        Returns:
            (normalized_iso_timestamp, is_valid_monotonic, offset_ms, drift_ppm)
        """
        now = host_receive_dt or datetime.now(UTC)

        if self._session_start_host_dt is None:
            self._session_start_host_dt = now
            self._last_normalized_dt = now
            if device_timestamp is not None:
                self._session_start_device_ts = device_timestamp
                self._last_device_ts = device_timestamp

        is_monotonic = True

        if device_timestamp is not None and self._session_start_device_ts is not None:
            # Check backwards jump in device clock
            if self._last_device_ts is not None and device_timestamp < self._last_device_ts:
                self._discontinuity_count += 1
                is_monotonic = False
                logger.warning(
                    "Backwards device timestamp detected for sensor %s: %f < %f",
                    self.sensor_id,
                    device_timestamp,
                    self._last_device_ts,
                )

            # Compute device elapsed time
            elapsed_device_s = device_timestamp - self._session_start_device_ts
            elapsed_host_s = (now - self._session_start_host_dt).total_seconds()

            self._clock_offset_ms = (elapsed_device_s - elapsed_host_s) * 1000.0
            if elapsed_host_s > 0.05:
                self._clock_drift_ppm = ((elapsed_device_s - elapsed_host_s) / elapsed_host_s) * 1e6

            self._last_device_ts = device_timestamp

        # Monotonic timeline progression
        nominal_step_s = sample_count * self.nominal_interval_s
        if self._last_normalized_dt is not None:
            target_dt = datetime.fromtimestamp(
                self._last_normalized_dt.timestamp() + nominal_step_s, tz=UTC
            )
        else:
            target_dt = now

        self._last_normalized_dt = target_dt
        self._sample_index += sample_count

        return target_dt.isoformat(), is_monotonic, self._clock_offset_ms, self._clock_drift_ppm
