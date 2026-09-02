"""NeuroMove — Phase 21 Clock and Timestamp Normalization Layer."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from neuromove.eeg_acquisition.models import EegClockInfo

logger = logging.getLogger(__name__)


class EegClockNormalizer:
    """Normalizes device and host timestamps into a monotonic session timeline.

    Tracks clock offset, estimated drift, detects discontinuities and backwards jumps.
    """

    def __init__(self, sampling_rate: int = 250, max_jitter_ms: float = 50.0):
        self.sampling_rate = sampling_rate
        self.nominal_interval_s = 1.0 / sampling_rate
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
    ) -> tuple[str, bool, EegClockInfo]:
        """Normalize a packet timestamp.

        Returns:
            (normalized_iso_timestamp, is_valid_monotonic, clock_info)
        """
        now = host_receive_dt or datetime.now(UTC)

        if self._session_start_host_dt is None:
            self._session_start_host_dt = now
            self._last_normalized_dt = now
            if device_timestamp is not None:
                self._session_start_device_ts = device_timestamp
                self._last_device_ts = device_timestamp

        # Check for backwards or discontinuous device timestamps
        is_monotonic = True
        if device_timestamp is not None and self._last_device_ts is not None:
            delta_device_s = device_timestamp - self._last_device_ts
            if delta_device_s < 0:
                logger.warning(
                    "Device clock backwards jump detected: %f -> %f",
                    self._last_device_ts,
                    device_timestamp,
                )
                self._discontinuity_count += 1
                is_monotonic = False
            elif delta_device_s > (self.nominal_interval_s * sample_count * 10.0):
                logger.warning(
                    "Device clock gap discontinuity detected: delta=%f s", delta_device_s
                )
                self._discontinuity_count += 1

            self._last_device_ts = device_timestamp

        # Calculate monotonic normalized timestamp based on sample sequence and host time
        session_elapsed_s = self._sample_index * self.nominal_interval_s
        expected_host_ts = self._session_start_host_dt.timestamp() + session_elapsed_s
        actual_host_ts = now.timestamp()

        # Compute offset and drift
        self._clock_offset_ms = (actual_host_ts - expected_host_ts) * 1000.0
        if session_elapsed_s > 1.0:
            self._clock_drift_ppm = (self._clock_offset_ms / (session_elapsed_s * 1000.0)) * 1e6

        # Ensure normalized timestamp strictly increases monotonically
        normalized_dt = datetime.fromtimestamp(expected_host_ts, tz=UTC)
        if self._last_normalized_dt is not None and normalized_dt <= self._last_normalized_dt:
            # Guard against sub-millisecond truncation
            expected_host_ts = self._last_normalized_dt.timestamp() + (
                self.nominal_interval_s * 0.1
            )
            normalized_dt = datetime.fromtimestamp(expected_host_ts, tz=UTC)

        self._last_normalized_dt = normalized_dt
        self._sample_index += sample_count

        normalized_iso = normalized_dt.isoformat()
        info = EegClockInfo(
            host_timestamp=now.isoformat(),
            device_timestamp=str(device_timestamp) if device_timestamp is not None else None,
            normalized_timestamp=normalized_iso,
            clock_offset_ms=round(self._clock_offset_ms, 2),
            clock_drift_ppm=round(self._clock_drift_ppm, 2),
            discontinuity_count=self._discontinuity_count,
            monotonicity_verified=is_monotonic,
        )

        return normalized_iso, is_monotonic, info
