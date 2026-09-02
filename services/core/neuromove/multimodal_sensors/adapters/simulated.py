"""NeuroMove — Phase 23 Deterministic Multimodal Sensor Simulator Adapter."""

from __future__ import annotations

import hashlib
import math
import random
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


class SimulatedSensorAdapter(SensorAcquisitionAdapter):
    """Deterministic, seeded synthetic sensor signal generator.

    Produces mathematically well-defined test signals for EEG, IMU, EMG, EOG, PPG, Pressure, and Aux.
    Explicitly labeled as software simulation, never real human physiology.
    """

    def __init__(
        self,
        device_descriptor: SensorDeviceDescriptor,
        seed: int = 42,
        sampling_rate: int | None = None,
    ):
        super().__init__(device_descriptor)
        self.seed = seed
        self.sampling_rate = sampling_rate or device_descriptor.default_sampling_rate
        self.rng = random.Random(seed)
        self._sample_index = 0
        self._is_paused = False
        self._motion_active = False
        self._emg_burst_active = False
        self._eog_blink_active = False
        self._fault_dropout = False
        self._fault_flatline = False
        self._fault_saturation = False
        self._fault_noise_std = 0.0
        self._timestamp_offset_s = 0.0

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
            f"sim_calib_{self.sensor_id}_{self.modality}_{self.seed}".encode()
        ).hexdigest()[:16]

        params: dict[str, Any] = {}
        if self.modality == SensorModality.IMU:
            params = {"accel_bias": [0.0, 0.0, 0.0], "gyro_bias": [0.0, 0.0, 0.0]}
        elif self.modality == SensorModality.EMG:
            params = {"baseline_noise_uv": 5.0, "activation_threshold_uv": 50.0}
        elif self.modality == SensorModality.EOG:
            params = {"blink_threshold_uv": 150.0}
        elif self.modality == SensorModality.PPG:
            params = {"baseline_hr_bpm": 72.0}
        else:
            params = {"baseline_offset": 0.0}

        snapshot = SensorCalibrationSnapshot(
            calibration_id=f"calib_{self.sensor_id}_{self._sample_index}",
            sensor_id=self.sensor_id,
            modality=self.modality,
            timestamp=datetime.now(UTC).isoformat(),
            parameters=params,
            quality_metrics={"r2_fit": 0.99, "residual_noise": 0.01},
            manifest_hash=manifest_hash,
            is_calibrated=True,
            is_ready=True,
        )
        self.state = SensorState.STREAMING
        return snapshot

    def start_stream(self, session_id: str) -> bool:
        self._session_id = session_id
        self._sample_index = 0
        self._sequence_number = 0
        self._is_paused = False
        self.state = SensorState.STREAMING
        return True

    def set_motion_active(self, active: bool) -> None:
        """Inject active movement context for IMU / EEG motion coupling."""
        self._motion_active = active

    def set_emg_burst(self, active: bool) -> None:
        """Inject muscle contraction burst for EMG."""
        self._emg_burst_active = active

    def set_eog_blink(self, active: bool) -> None:
        """Inject ocular artifact blink for EOG."""
        self._eog_blink_active = active

    def inject_fault(
        self,
        dropout: bool = False,
        flatline: bool = False,
        saturation: bool = False,
        noise_std: float = 0.0,
    ) -> None:
        """Inject signal quality anomalies."""
        self._fault_dropout = dropout
        self._fault_flatline = flatline
        self._fault_saturation = saturation
        self._fault_noise_std = noise_std

    def inject_timestamp_offset(self, offset_s: float) -> None:
        """Inject timestamp offset for desynchronization testing."""
        self._timestamp_offset_s = offset_s

    def read_chunk(self, chunk_size: int = 10) -> SensorStreamPacket | None:
        if self.state != SensorState.STREAMING or self._is_paused:
            return None

        channel_count = self.descriptor.channel_count
        channel_names = self.descriptor.channel_names or [f"CH_{i+1}" for i in range(channel_count)]

        data: list[list[float]] = [[] for _ in range(channel_count)]
        dt = 1.0 / self.sampling_rate

        for i in range(chunk_size):
            t = (self._sample_index + i) * dt

            if self._fault_dropout:
                for ch in range(channel_count):
                    data[ch].append(0.0)
            elif self._fault_flatline:
                for ch in range(channel_count):
                    data[ch].append(42.0)
            elif self._fault_saturation:
                for ch in range(channel_count):
                    data[ch].append(10000.0)
            else:
                samples = self._generate_sample_vector(t, channel_count)
                for ch in range(channel_count):
                    val = samples[ch]
                    if self._fault_noise_std > 0.0:
                        val += self.rng.gauss(0.0, self._fault_noise_std)
                    data[ch].append(val)

        self._sample_index += chunk_size
        self._sequence_number += 1

        host_ts = datetime.now(UTC).isoformat()
        device_ts = self._sample_index * dt + self._timestamp_offset_s

        # Compute checksum
        chk = hashlib.sha256(f"{self.sensor_id}_{self._sequence_number}_{device_ts}".encode()).hexdigest()[:12]

        units_map = {
            SensorModality.EEG: "uV",
            SensorModality.IMU: "m/s^2,deg/s",
            SensorModality.EMG: "uV",
            SensorModality.EOG: "uV",
            SensorModality.PPG: "mV",
            SensorModality.PRESSURE: "kPa",
            SensorModality.AUXILIARY: "raw",
        }

        return SensorStreamPacket(
            sensor_id=self.sensor_id,
            modality=self.modality,
            source=self.source,
            session_id=self._session_id,
            sequence_number=self._sequence_number,
            device_timestamp=device_ts,
            host_receive_timestamp=host_ts,
            normalized_timestamp=host_ts,
            sample_count=chunk_size,
            channel_count=channel_count,
            channel_names=channel_names,
            data=data,
            units=units_map.get(self.modality, "uV"),
            quality_flags=["SIMULATED_DATA"],
            checksum=chk,
            configuration_hash=hashlib.sha256(f"{self.sampling_rate}_{channel_count}".encode()).hexdigest()[:8],
        )

    def _generate_sample_vector(self, t: float, channel_count: int) -> list[float]:
        """Generate deterministic sample values for the given modality."""
        if self.modality == SensorModality.EEG:
            # 8-ch EEG: 10 Hz mu + 20 Hz beta + pink/alpha background
            res = []
            for ch in range(channel_count):
                mu = 10.0 * math.sin(2.0 * math.pi * 10.0 * t + ch * 0.5)
                beta = 5.0 * math.sin(2.0 * math.pi * 20.0 * t + ch * 0.2)
                noise = self.rng.gauss(0.0, 1.5)
                res.append(mu + beta + noise)
            return res

        elif self.modality == SensorModality.IMU:
            # Accel (X, Y, Z), Gyro (X, Y, Z)
            accel_x = 0.05 * math.sin(2.0 * math.pi * 0.5 * t)
            accel_y = 0.05 * math.cos(2.0 * math.pi * 0.5 * t)
            accel_z = 9.81 + 0.02 * math.sin(2.0 * math.pi * 1.0 * t)
            gyro_x = 0.1 * math.sin(2.0 * math.pi * 0.2 * t)
            gyro_y = 0.1 * math.cos(2.0 * math.pi * 0.2 * t)
            gyro_z = 0.05 * math.sin(2.0 * math.pi * 0.1 * t)

            if self._motion_active:
                accel_x += 20.0 * math.sin(2.0 * math.pi * 2.0 * t)
                accel_y += 15.0 * math.cos(2.0 * math.pi * 2.0 * t)
                gyro_z += 250.0 * math.sin(2.0 * math.pi * 1.5 * t)

            imu_vals = [accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z]
            return imu_vals[:channel_count] if channel_count <= 6 else (imu_vals + [0.0] * (channel_count - 6))

        elif self.modality == SensorModality.EMG:
            # EMG: baseline noise + bursts
            res = []
            for ch in range(channel_count):
                base = self.rng.gauss(0.0, 3.0)
                if self._emg_burst_active:
                    burst = 80.0 * math.sin(2.0 * math.pi * 65.0 * t) * (0.8 + 0.4 * self.rng.random())
                    base += burst
                res.append(base)
            return res

        elif self.modality == SensorModality.EOG:
            # EOG: low freq baseline + blink pulses
            res = []
            for ch in range(channel_count):
                base = 5.0 * math.sin(2.0 * math.pi * 0.3 * t) + self.rng.gauss(0.0, 2.0)
                if self._eog_blink_active:
                    # Periodic blink pulse every 2 seconds
                    phase = (t % 2.0)
                    if 0.0 <= phase <= 0.2:
                        blink_pulse = 200.0 * math.sin(math.pi * phase / 0.2)
                        base += blink_pulse
                res.append(base)
            return res

        elif self.modality == SensorModality.PPG:
            # PPG: ~1.2 Hz cardiac pulse (72 bpm)
            cardiac = 50.0 * math.sin(2.0 * math.pi * 1.2 * t) + 15.0 * math.sin(2.0 * math.pi * 2.4 * t)
            res = [100.0 + cardiac + self.rng.gauss(0.0, 1.0) for _ in range(channel_count)]
            return res

        elif self.modality == SensorModality.PRESSURE:
            # Pressure: contact force in kPa
            res = [25.0 + 2.0 * math.sin(2.0 * math.pi * 0.1 * t + ch) for ch in range(channel_count)]
            return res

        else:
            return [1.0 + 0.1 * math.sin(t + ch) for ch in range(channel_count)]

    def pause(self) -> bool:
        self._is_paused = True
        self.state = SensorState.PAUSED
        return True

    def resume(self) -> bool:
        self._is_paused = False
        self.state = SensorState.STREAMING
        return True

    def stop_stream(self) -> bool:
        self.state = SensorState.STOPPING
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
                qc_status=TrialQuality.VALID if not (self._fault_dropout or self._fault_flatline or self._fault_saturation) else TrialQuality.REJECTED,
                mean_amplitude=15.0,
                snr_db=24.5 if not self._fault_dropout else 0.0,
                flatline_rate=1.0 if self._fault_flatline else 0.0,
                saturation_rate=1.0 if self._fault_saturation else 0.0,
                dropout_rate=1.0 if self._fault_dropout else 0.0,
                is_usable=not (self._fault_dropout or self._fault_flatline or self._fault_saturation),
            )
            for name in channel_names
        ]

        is_healthy = self.state in (SensorState.STREAMING, SensorState.CONFIGURING) and not (
            self._fault_dropout or self._fault_flatline or self._fault_saturation
        )

        return SensorHealthSnapshot(
            sensor_id=self.sensor_id,
            modality=self.modality,
            state=self.state,
            buffer_occupancy_pct=12.5,
            packet_loss_rate=0.0,
            jitter_ms=0.4,
            drift_ppm=1.2,
            channels=ch_health,
            last_seen=datetime.now(UTC).isoformat(),
            is_healthy=is_healthy,
        )
