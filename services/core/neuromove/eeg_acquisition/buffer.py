"""NeuroMove — Phase 21 Bounded Ring Buffer & Sample Ingestion."""

from __future__ import annotations

import logging
import threading
from collections import deque
from typing import Any

import numpy as np

from neuromove.eeg_acquisition.models import EegSamplePacket

logger = logging.getLogger(__name__)


class BoundedEegBuffer:
    """Thread-safe bounded ring buffer for multi-channel EEG sample stream.

    Ensures zero unbounded RAM growth, accounts for dropped samples/chunks on overflow,
    and provides windowed extractions for DSP and feature extraction.
    """

    def __init__(
        self,
        channel_names: list[str],
        sampling_rate: int = 250,
        max_duration_sec: float = 10.0,
    ):
        self.channel_names = channel_names
        self.n_channels = len(channel_names)
        self.sampling_rate = sampling_rate
        self.max_capacity_samples = int(sampling_rate * max_duration_sec)

        self._lock = threading.RLock()
        self._packets: deque[EegSamplePacket] = deque()
        self._current_sample_count = 0

        # Diagnostics & counters
        self.total_samples_ingested = 0
        self.total_samples_dropped = 0
        self.total_packets_ingested = 0
        self.total_packets_dropped = 0
        self.overflow_events = 0

    def reset(self) -> None:
        """Clear buffer and reset all accounting metrics."""
        with self._lock:
            self._packets.clear()
            self._current_sample_count = 0
            self.total_samples_ingested = 0
            self.total_samples_dropped = 0
            self.total_packets_ingested = 0
            self.total_packets_dropped = 0
            self.overflow_events = 0

    def push_packet(self, packet: EegSamplePacket) -> bool:
        """Push an incoming sample packet into the bounded buffer.

        If capacity is exceeded, older packets are dropped and accounted for.
        """
        with self._lock:
            self.total_packets_ingested += 1
            self.total_samples_ingested += packet.sample_count

            # Check capacity and pop oldest if needed
            while (
                self._current_sample_count + packet.sample_count > self.max_capacity_samples
                and len(self._packets) > 0
            ):
                dropped = self._packets.popleft()
                self._current_sample_count -= dropped.sample_count
                self.total_samples_dropped += dropped.sample_count
                self.total_packets_dropped += 1
                self.overflow_events += 1

            self._packets.append(packet)
            self._current_sample_count += packet.sample_count
            return True

    def get_fill_percentage(self) -> float:
        """Return current buffer fill percentage [0.0 - 100.0]."""
        with self._lock:
            if self.max_capacity_samples == 0:
                return 0.0
            return min(100.0, (self._current_sample_count / self.max_capacity_samples) * 100.0)

    def get_sample_count(self) -> int:
        """Return current number of buffered samples."""
        with self._lock:
            return self._current_sample_count

    def extract_recent_window(
        self, window_samples: int | None = None
    ) -> tuple[np.ndarray, list[str]]:
        """Extract the most recent window of EEG data as a numpy array.

        Returns:
            (data_array of shape [n_channels, window_samples], channel_names)
        """
        with self._lock:
            if len(self._packets) == 0 or self._current_sample_count == 0:
                return np.zeros((self.n_channels, 0), dtype=np.float64), self.channel_names

            # Concatenate packets
            chunk_arrays = []
            for pkt in self._packets:
                arr = np.array(pkt.data, dtype=np.float64)
                if pkt.layout == "SAMPLE_MAJOR":
                    arr = arr.T
                chunk_arrays.append(arr)

            full_data = np.concatenate(chunk_arrays, axis=1)

            if window_samples is not None and window_samples > 0:
                if full_data.shape[1] > window_samples:
                    full_data = full_data[:, -window_samples:]

            return full_data, self.channel_names

    def get_telemetry(self) -> dict[str, Any]:
        """Return diagnostic counters and health telemetry."""
        with self._lock:
            return {
                "buffered_samples": self._current_sample_count,
                "max_capacity_samples": self.max_capacity_samples,
                "fill_percentage": round(self.get_fill_percentage(), 2),
                "total_ingested_samples": self.total_samples_ingested,
                "total_dropped_samples": self.total_samples_dropped,
                "total_packets": self.total_packets_ingested,
                "overflow_events": self.overflow_events,
            }
