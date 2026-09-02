"""NeuroMove — Phase 23 Recorded Multimodal Sensor Replay Adapter."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

from neuromove.domain.enums import SensorModality, SensorSource, SensorState, TrialQuality
from neuromove.multimodal_sensors.adapters.base import SensorAcquisitionAdapter
from neuromove.multimodal_sensors.models import (
    SensorCalibrationSnapshot,
    SensorChannelHealth,
    SensorDeviceDescriptor,
    SensorHealthSnapshot,
    SensorStreamPacket,
)


class RecordedSensorAdapter(SensorAcquisitionAdapter):
    """Adapter for replaying pre-recorded or synthetic multimodal test fixtures."""

    def __init__(
        self,
        device_descriptor: SensorDeviceDescriptor,
        recorded_data: list[list[float]] | None = None,
        sampling_rate: int = 250,
    ):
        super().__init__(device_descriptor)
        self.sampling_rate = sampling_rate
        # [channels][samples]
        self._recorded_data = recorded_data or [
            [0.0] * 1000 for _ in range(device_descriptor.channel_count)
        ]
        self._playback_index = 0
        self._loop = True
        self._is_paused = False

    def discover(self) -> list[SensorDeviceDescriptor]:
        return [self.descriptor]

    def connect(self) -> bool:
        self.state = SensorState.CONFIGURING
        self.descriptor.is_connected = True
        return True

    def configure(self, sampling_rate: int | None = None, channel_names: list[str] | None = None) -> bool:
        if sampling_rate:
            self.sampling_rate = sampling_rate
        if channel_names:
            self.descriptor.channel_names = channel_names
            self.descriptor.channel_count = len(channel_names)
        self.state = SensorState.STREAMING
        return True

    def calibrate(self) -> SensorCalibrationSnapshot:
        self.state = SensorState.CALIBRATING
        manifest_hash = hashlib.sha256(
            f"rec_calib_{self.sensor_id}_{self.modality}".encode()
        ).hexdigest()[:16]
        snapshot = SensorCalibrationSnapshot(
            calibration_id=f"calib_rec_{self.sensor_id}",
            sensor_id=self.sensor_id,
            modality=self.modality,
            timestamp=datetime.now(UTC).isoformat(),
            parameters={"replay_offset": 0.0},
            quality_metrics={"integrity_pct": 100.0},
            manifest_hash=manifest_hash,
            is_calibrated=True,
            is_ready=True,
        )
        self.state = SensorState.STREAMING
        return snapshot

    def start_stream(self, session_id: str) -> bool:
        self._session_id = session_id
        self._playback_index = 0
        self._sequence_number = 0
        self._is_paused = False
        self.state = SensorState.STREAMING
        return True

    def read_chunk(self, chunk_size: int = 10) -> SensorStreamPacket | None:
        if self.state != SensorState.STREAMING or self._is_paused:
            return None

        total_samples = len(self._recorded_data[0]) if self._recorded_data else 0
        if total_samples == 0:
            return None

        channel_count = self.descriptor.channel_count
        channel_names = self.descriptor.channel_names or [f"CH_{i+1}" for i in range(channel_count)]

        data: list[list[float]] = [[] for _ in range(channel_count)]
        for i in range(chunk_size):
            idx = (self._playback_index + i) % total_samples
            for ch in range(channel_count):
                ch_idx = ch % len(self._recorded_data)
                data[ch].append(self._recorded_data[ch_idx][idx])

        self._playback_index = (self._playback_index + chunk_size) % total_samples
        self._sequence_number += 1

        dt = 1.0 / self.sampling_rate
        host_ts = datetime.now(UTC).isoformat()
        device_ts = self._playback_index * dt
        chk = hashlib.sha256(f"{self.sensor_id}_{self._sequence_number}_{device_ts}".encode()).hexdigest()[:12]

        return SensorStreamPacket(
            sensor_id=self.sensor_id,
            modality=self.modality,
            source=SensorSource.RECORDED,
            session_id=self._session_id,
            sequence_number=self._sequence_number,
            device_timestamp=device_ts,
            host_receive_timestamp=host_ts,
            normalized_timestamp=host_ts,
            sample_count=chunk_size,
            channel_count=channel_count,
            channel_names=channel_names,
            data=data,
            units="uV",
            quality_flags=["RECORDED_FIXTURE"],
            checksum=chk,
            configuration_hash=hashlib.sha256(f"{self.sampling_rate}_{channel_count}".encode()).hexdigest()[:8],
        )

    def pause(self) -> bool:
        self._is_paused = True
        self.state = SensorState.PAUSED
        return True

    def resume(self) -> bool:
        self._is_paused = False
        self.state = SensorState.STREAMING
        return True

    def stop_stream(self) -> bool:
        self.state = SensorState.CONFIGURING
        return True

    def disconnect(self) -> bool:
        self.state = SensorState.DISCONNECTED
        self.descriptor.is_connected = False
        return True

    def get_health(self) -> SensorHealthSnapshot:
        channel_count = self.descriptor.channel_count
        channel_names = self.descriptor.channel_names or [f"CH_{i+1}" for i in range(channel_count)]
        ch_health = [
            SensorChannelHealth(
                channel_name=name,
                modality=self.modality,
                qc_status=TrialQuality.VALID,
                mean_amplitude=12.0,
                snr_db=26.0,
                flatline_rate=0.0,
                saturation_rate=0.0,
                dropout_rate=0.0,
                is_usable=True,
            )
            for name in channel_names
        ]

        return SensorHealthSnapshot(
            sensor_id=self.sensor_id,
            modality=self.modality,
            state=self.state,
            buffer_occupancy_pct=5.0,
            packet_loss_rate=0.0,
            jitter_ms=0.2,
            drift_ppm=0.0,
            channels=ch_health,
            last_seen=datetime.now(UTC).isoformat(),
            is_healthy=self.state == SensorState.STREAMING,
        )
