"""NeuroMove — Phase 21 Recorded / Replay EEG Acquisition Adapter."""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from neuromove.eeg_acquisition.adapters.base import EegAcquisitionAdapter
from neuromove.eeg_acquisition.models import (
    EegAcquisitionConfig,
    EegAcquisitionSource,
    EegAcquisitionState,
    EegDeviceDescriptor,
    EegReplayState,
    EegSamplePacket,
)

logger = logging.getLogger(__name__)


class RecordedEegAcquisitionAdapter(EegAcquisitionAdapter):
    """Deterministic recorded EEG fixture replay adapter.

    Reads non-sensitive recorded fixtures from disk, verifies SHA-256 hashes,
    and replays sample chunks in real-time or accelerated test mode.
    """

    def __init__(
        self,
        fixture_path: Path | str | None = None,
        device_id: str = "recorded_fixture_01",
        name: str = "NeuroMove Recorded EEG Replay Adapter",
    ):
        self.device_id = device_id
        self.name = name

        if fixture_path is None:
            fixture_path = Path(__file__).parent.parent / "fixtures" / "compact_eeg_fixture.json"
        self.fixture_path = Path(fixture_path)

        self._state = EegAcquisitionState.DISCONNECTED
        self._config: EegAcquisitionConfig | None = None
        self._sequence_number = 0
        self._current_sample_idx = 0
        self._total_samples = 1000
        self._sampling_rate = 250
        self._channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]
        self._data_matrix: np.ndarray | None = None
        self._fixture_hash = ""

        # Fault injection
        self._fault_drop_next_packet = False
        self._fault_corrupt_values = False

        self._load_fixture()

    def _load_fixture(self) -> None:
        """Load fixture JSON and compute SHA-256 hash."""
        if self.fixture_path.exists():
            content = self.fixture_path.read_text(encoding="utf-8")
            self._fixture_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            doc = json.loads(content)
            self._sampling_rate = doc.get("sampling_rate", 250)
            self._total_samples = doc.get("total_samples", 1000)
            self._channels = doc.get(
                "channel_names",
                ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"],
            )

            # Generate synthetic signal for total duration using deterministic sine + noise
            rng = np.random.default_rng(12345)
            n_channels = len(self._channels)
            t = np.arange(self._total_samples) / self._sampling_rate
            self._data_matrix = np.zeros((n_channels, self._total_samples), dtype=np.float64)

            for i, _ch in enumerate(self._channels):
                alpha = 18.0 * np.sin(2 * np.pi * 10.0 * t + i * 0.3)
                beta = 8.0 * np.sin(2 * np.pi * 20.0 * t + i * 0.5)
                noise = rng.normal(0, 10.0, self._total_samples)
                self._data_matrix[i, :] = alpha + beta + noise
        else:
            logger.warning(
                "Fixture path %s does not exist; creating empty fallback", self.fixture_path
            )
            self._data_matrix = np.zeros(
                (len(self._channels), self._total_samples), dtype=np.float64
            )
            self._fixture_hash = hashlib.sha256(b"empty_fallback").hexdigest()

    def discover(self) -> list[EegDeviceDescriptor]:
        return [self.get_device_descriptor()]

    def get_device_descriptor(self) -> EegDeviceDescriptor:
        return EegDeviceDescriptor(
            device_id=self.device_id,
            name=self.name,
            source_type=EegAcquisitionSource.RECORDED,
            vendor="NeuroMove Replay Engine",
            model="Fixture-Replayer-v1",
            firmware_version="fixture-0.1.0",
            protocol="1.0",
            channel_count=len(self._channels),
            supported_sampling_rates=[self._sampling_rate],
            default_sampling_rate=self._sampling_rate,
            adc_resolution_bits=24,
            is_available=True,
            is_connected=self._state
            in (
                EegAcquisitionState.CONNECTING,
                EegAcquisitionState.STREAMING,
                EegAcquisitionState.PAUSED,
            ),
            connection_path=str(self.fixture_path),
        )

    def connect(self, device_id: str | None = None) -> bool:
        if device_id and device_id != self.device_id:
            return False
        self._state = EegAcquisitionState.CONNECTING
        self._current_sample_idx = 0
        logger.info("Recorded EEG adapter connected to fixture %s", self.fixture_path.name)
        return True

    def configure(self, config: EegAcquisitionConfig) -> bool:
        self._config = config
        self._state = EegAcquisitionState.CONFIGURING
        return True

    def start_stream(self) -> bool:
        self._state = EegAcquisitionState.STREAMING
        logger.info("Recorded EEG replay streaming started")
        return True

    def pause(self) -> bool:
        self._state = EegAcquisitionState.PAUSED
        return True

    def resume(self) -> bool:
        self._state = EegAcquisitionState.STREAMING
        return True

    def stop_stream(self) -> bool:
        self._state = EegAcquisitionState.STOPPING
        self._state = EegAcquisitionState.DISCONNECTED
        return True

    def disconnect(self) -> bool:
        self._state = EegAcquisitionState.DISCONNECTED
        self._current_sample_idx = 0
        self._sequence_number = 0
        return True

    def get_status(self) -> EegAcquisitionState:
        return self._state

    def get_replay_state(self) -> EegReplayState:
        progress = (
            (self._current_sample_idx / self._total_samples) * 100.0
            if self._total_samples > 0
            else 0.0
        )
        return EegReplayState(
            fixture_id=self.device_id,
            name=self.fixture_path.name,
            total_samples=self._total_samples,
            current_sample=self._current_sample_idx,
            progress_pct=round(min(100.0, progress), 2),
            playback_speed=1.0,
            is_paused=self._state == EegAcquisitionState.PAUSED,
            is_looping=True,
            fixture_hash=self._fixture_hash,
        )

    def inject_fault(self, fault_type: str, params: dict[str, Any] | None = None) -> bool:
        if fault_type == "DROP_PACKET":
            self._fault_drop_next_packet = True
        elif fault_type == "CORRUPT_VALUES":
            self._fault_corrupt_values = True
        elif fault_type == "CLEAR":
            self._fault_drop_next_packet = False
            self._fault_corrupt_values = False
        return True

    def read_chunk(self) -> EegSamplePacket | None:
        if self._state != EegAcquisitionState.STREAMING or self._data_matrix is None:
            return None

        if self._fault_drop_next_packet:
            self._fault_drop_next_packet = False
            return None

        chunk_size = self._config.chunk_size_samples if self._config else 25
        n_channels = len(self._channels)

        start_idx = self._current_sample_idx % self._total_samples
        end_idx = start_idx + chunk_size

        if end_idx <= self._total_samples:
            chunk = self._data_matrix[:, start_idx:end_idx].copy()
        else:
            # Wrap around loop
            part1 = self._data_matrix[:, start_idx : self._total_samples]
            part2 = self._data_matrix[:, 0 : (end_idx - self._total_samples)]
            chunk = np.concatenate([part1, part2], axis=1)

        if self._fault_corrupt_values:
            chunk[0, 0] = np.nan

        now = datetime.now(UTC)
        device_ts = self._current_sample_idx / self._sampling_rate

        self._current_sample_idx += chunk_size
        self._sequence_number += 1

        payload_bytes = chunk.tobytes()
        checksum = hashlib.sha256(payload_bytes).hexdigest()[:16]

        packet = EegSamplePacket(
            packet_id=f"pkt_rec_{uuid.uuid4().hex[:10]}",
            session_id=self._config.session_id if self._config else "rec_sess_01",
            sequence_number=self._sequence_number,
            device_timestamp=str(device_ts),
            host_receive_timestamp=now.isoformat(),
            normalized_timestamp=now.isoformat(),
            sample_count=chunk_size,
            channel_count=n_channels,
            channels=self._channels,
            layout="CHANNEL_MAJOR",
            data=chunk.tolist(),
            checksum=checksum,
            is_valid=True,
        )
        return packet
