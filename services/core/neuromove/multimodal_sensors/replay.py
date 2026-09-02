"""NeuroMove — Phase 23 Synchronized Multimodal Replay Engine."""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any

from neuromove.domain.enums import SensorModality
from neuromove.multimodal_sensors.adapters.recorded import RecordedSensorAdapter
from neuromove.multimodal_sensors.models import (
    MultimodalReplayFixture,
    SensorDeviceDescriptor,
    SensorStreamPacket,
)


class MultimodalReplayEngine:
    """Synchronized multimodal test fixture replay coordinator."""

    def __init__(self):
        self._fixtures: dict[str, MultimodalReplayFixture] = {}
        self._fixture_data: dict[str, dict[str, list[list[float]]]] = {}
        self._initialize_default_fixtures()

    def _initialize_default_fixtures(self) -> None:
        # Fixture 1: EEG + IMU Healthy Baseline (10 sec, 250 Hz EEG, 100 Hz IMU)
        eeg_samples = 2500
        imu_samples = 1000

        eeg_data = [
            [10.0 * math.sin(2.0 * math.pi * 10.0 * (i / 250.0) + ch) for i in range(eeg_samples)]
            for ch in range(8)
        ]
        imu_data = [
            [0.05 * math.sin(2.0 * math.pi * 0.5 * (i / 100.0)) for i in range(imu_samples)],  # Accel X
            [0.05 * math.cos(2.0 * math.pi * 0.5 * (i / 100.0)) for i in range(imu_samples)],  # Accel Y
            [9.81 + 0.01 * math.sin(2.0 * math.pi * 1.0 * (i / 100.0)) for i in range(imu_samples)],  # Accel Z
            [0.02 * math.sin(i / 100.0) for i in range(imu_samples)],  # Gyro X
            [0.02 * math.cos(i / 100.0) for i in range(imu_samples)],  # Gyro Y
            [0.01 * math.sin(i / 100.0) for i in range(imu_samples)],  # Gyro Z
        ]

        chk_1 = hashlib.sha256(b"fixture_eeg_imu_healthy_v1").hexdigest()[:16]

        self._fixtures["fixture_eeg_imu_healthy"] = MultimodalReplayFixture(
            fixture_id="fixture_eeg_imu_healthy",
            name="EEG + IMU Synchronized Healthy Baseline",
            description="8-channel synthetic EEG paired with 6-DOF quiet IMU baseline",
            modalities=[SensorModality.EEG, SensorModality.IMU],
            sample_rates={"sensor_eeg_sim": 250, "sensor_imu_sim": 100},
            channel_maps={
                "sensor_eeg_sim": ["F3", "F4", "C3", "Cz", "C4", "P3", "Pz", "P4"],
                "sensor_imu_sim": ["Accel_X", "Accel_Y", "Accel_Z", "Gyro_X", "Gyro_Y", "Gyro_Z"],
            },
            duration_sec=10.0,
            checksum=chk_1,
            privacy_level="PUBLIC_SYNTHETIC",
            expected_context="STATIONARY_QUIET",
        )
        self._fixture_data["fixture_eeg_imu_healthy"] = {
            "sensor_eeg_sim": eeg_data,
            "sensor_imu_sim": imu_data,
        }

        # Fixture 2: EEG + EMG Contraction Burst
        emg_samples = 5000
        emg_data = [
            [
                (80.0 * math.sin(2.0 * math.pi * 65.0 * (i / 500.0)) if 1500 <= i <= 2500 else 2.0 * math.sin(i))
                for i in range(emg_samples)
            ]
            for _ in range(2)
        ]
        chk_2 = hashlib.sha256(b"fixture_eeg_emg_burst_v1").hexdigest()[:16]

        self._fixtures["fixture_eeg_emg_burst"] = MultimodalReplayFixture(
            fixture_id="fixture_eeg_emg_burst",
            name="EEG + EMG Peripheral Burst Activation",
            description="8-channel EEG paired with 2-channel peripheral muscle contraction burst",
            modalities=[SensorModality.EEG, SensorModality.EMG],
            sample_rates={"sensor_eeg_sim": 250, "sensor_emg_sim": 500},
            channel_maps={
                "sensor_eeg_sim": ["F3", "F4", "C3", "Cz", "C4", "P3", "Pz", "P4"],
                "sensor_emg_sim": ["EMG_Biceps", "EMG_Forearm"],
            },
            duration_sec=10.0,
            checksum=chk_2,
            privacy_level="PUBLIC_SYNTHETIC",
            expected_context="PERIPHERAL_ACTIVE",
        )
        self._fixture_data["fixture_eeg_emg_burst"] = {
            "sensor_eeg_sim": eeg_data,
            "sensor_emg_sim": emg_data,
        }

    def list_fixtures(self) -> list[MultimodalReplayFixture]:
        return list(self._fixtures.values())

    def get_fixture(self, fixture_id: str) -> MultimodalReplayFixture | None:
        return self._fixtures.get(fixture_id)

    def get_fixture_data(self, fixture_id: str) -> dict[str, list[list[float]]] | None:
        return self._fixture_data.get(fixture_id)
