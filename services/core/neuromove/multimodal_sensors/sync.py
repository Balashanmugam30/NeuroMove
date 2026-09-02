"""NeuroMove — Phase 23 Multimodal Sensor Synchronization Coordinator."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from neuromove.domain.enums import SynchronizationStatus
from neuromove.multimodal_sensors.clock import MultimodalClockNormalizer
from neuromove.multimodal_sensors.models import MultimodalSyncState

logger = logging.getLogger(__name__)


class MultimodalSyncCoordinator:
    """Coordinates clock synchronization across multiple active sensor streams."""

    def __init__(self, session_id: str, primary_sensor_id: str = "sensor_eeg_sim"):
        self.session_id = session_id
        self.primary_sensor_id = primary_sensor_id
        self._clock_normalizers: dict[str, MultimodalClockNormalizer] = {}
        self._last_normalized_timestamps: dict[str, str] = {}
        self._offsets_ms: dict[str, float] = {}
        self._drifts_ppm: dict[str, float] = {}
        self._max_jitter_ms: float = 0.0
        self._alignment_quality_pct: float = 100.0
        self._status: SynchronizationStatus = SynchronizationStatus.SYNCHRONIZED

    def register_sensor(self, sensor_id: str, sampling_rate: int = 250) -> None:
        """Register a sensor for synchronization tracking."""
        self._clock_normalizers[sensor_id] = MultimodalClockNormalizer(
            sensor_id=sensor_id, sampling_rate=sampling_rate
        )
        self._offsets_ms[sensor_id] = 0.0
        self._drifts_ppm[sensor_id] = 0.0

    def reset(self) -> None:
        """Reset sync state for session restart or post-reconnect."""
        for norm in self._clock_normalizers.values():
            norm.reset()
        self._last_normalized_timestamps.clear()
        self._offsets_ms = {s: 0.0 for s in self._clock_normalizers}
        self._drifts_ppm = {s: 0.0 for s in self._clock_normalizers}
        self._max_jitter_ms = 0.0
        self._alignment_quality_pct = 100.0
        self._status = SynchronizationStatus.SYNCHRONIZED

    def update_packet(
        self,
        sensor_id: str,
        host_receive_dt: datetime | None = None,
        device_timestamp: float | None = None,
        sample_count: int = 1,
    ) -> tuple[str, bool]:
        """Normalize packet timestamp and update global sync metrics.

        Returns:
            (normalized_iso_timestamp, is_valid_monotonic)
        """
        if sensor_id not in self._clock_normalizers:
            self.register_sensor(sensor_id)

        norm = self._clock_normalizers[sensor_id]
        ts_iso, is_mono, offset_ms, drift_ppm = norm.normalize(
            host_receive_dt=host_receive_dt,
            device_timestamp=device_timestamp,
            sample_count=sample_count,
        )

        self._last_normalized_timestamps[sensor_id] = ts_iso
        self._offsets_ms[sensor_id] = offset_ms
        self._drifts_ppm[sensor_id] = drift_ppm

        self._recalculate_sync_status()
        return ts_iso, is_mono

    def _recalculate_sync_status(self) -> None:
        """Evaluate inter-sensor sync quality, offset disparity, and drift."""
        if not self._offsets_ms:
            self._status = SynchronizationStatus.SYNCHRONIZED
            self._alignment_quality_pct = 100.0
            return

        # Calculate max offset difference from primary clock
        primary_offset = self._offsets_ms.get(self.primary_sensor_id, 0.0)
        max_disparity_ms = max(
            abs(offset - primary_offset) for offset in self._offsets_ms.values()
        )
        max_drift_ppm = max(abs(drift) for drift in self._drifts_ppm.values())

        self._max_jitter_ms = max_disparity_ms

        if max_disparity_ms > 100.0 or max_drift_ppm > 500.0:
            self._status = SynchronizationStatus.UNSYNCHRONIZED
            self._alignment_quality_pct = max(0.0, 100.0 - max_disparity_ms)
        elif max_disparity_ms > 30.0 or max_drift_ppm > 150.0:
            self._status = SynchronizationStatus.DEGRADED
            self._alignment_quality_pct = max(30.0, 100.0 - max_disparity_ms * 0.7)
        elif max_drift_ppm > 50.0:
            self._status = SynchronizationStatus.DRIFT_DETECTED
            self._alignment_quality_pct = 90.0
        else:
            self._status = SynchronizationStatus.SYNCHRONIZED
            self._alignment_quality_pct = 100.0

    def get_sync_state(self) -> MultimodalSyncState:
        """Produce the current multimodal synchronization telemetry snapshot."""
        is_aligned = self._status in (
            SynchronizationStatus.SYNCHRONIZED,
            SynchronizationStatus.DRIFT_DETECTED,
        )

        return MultimodalSyncState(
            session_id=self.session_id,
            global_session_time_iso=datetime.now(UTC).isoformat(),
            status=self._status,
            primary_clock_sensor_id=self.primary_sensor_id,
            estimated_offsets_ms=dict(self._offsets_ms),
            estimated_drifts_ppm=dict(self._drifts_ppm),
            max_jitter_ms=self._max_jitter_ms,
            alignment_quality_pct=self._alignment_quality_pct,
            is_aligned=is_aligned,
        )
