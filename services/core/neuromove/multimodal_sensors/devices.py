"""NeuroMove — Phase 23 Sensor Device Registry and Discovery Coordinator."""

from __future__ import annotations

import logging
from typing import Any

from neuromove.domain.enums import SensorModality, SensorSource, SensorState
from neuromove.multimodal_sensors.adapters.base import SensorAcquisitionAdapter
from neuromove.multimodal_sensors.adapters.physical import PhysicalSensorAdapter
from neuromove.multimodal_sensors.adapters.recorded import RecordedSensorAdapter
from neuromove.multimodal_sensors.adapters.simulated import SimulatedSensorAdapter
from neuromove.multimodal_sensors.models import SensorDeviceDescriptor

logger = logging.getLogger(__name__)


class SensorDeviceRegistry:
    """Central registry and lifecycle manager for all multimodal sensor devices."""

    def __init__(self):
        self._adapters: dict[str, SensorAcquisitionAdapter] = {}
        self._descriptors: dict[str, SensorDeviceDescriptor] = {}
        self._initialize_default_catalog()

    def _initialize_default_catalog(self) -> None:
        """Populate the canonical device catalog."""
        default_devices = [
            SensorDeviceDescriptor(
                device_id="sensor_eeg_sim",
                name="Virtual 8-Channel Motor Imagery EEG",
                modality=SensorModality.EEG,
                source=SensorSource.SIMULATOR,
                vendor="NeuroMove Virtual Lab",
                model="EEG-Synthetic-v1",
                firmware_version="1.0.0",
                protocol="VIRTUAL_STREAM",
                channel_count=8,
                channel_names=["F3", "F4", "C3", "Cz", "C4", "P3", "Pz", "P4"],
                supported_sampling_rates=[125, 250, 500, 1000],
                default_sampling_rate=250,
                adc_resolution_bits=24,
                is_available=True,
                is_connected=False,
            ),
            SensorDeviceDescriptor(
                device_id="sensor_imu_sim",
                name="Virtual 6-DOF Inertial Measurement Unit",
                modality=SensorModality.IMU,
                source=SensorSource.SIMULATOR,
                vendor="NeuroMove Virtual Lab",
                model="IMU-6DOF-v1",
                firmware_version="1.0.0",
                protocol="VIRTUAL_STREAM",
                channel_count=6,
                channel_names=["Accel_X", "Accel_Y", "Accel_Z", "Gyro_X", "Gyro_Y", "Gyro_Z"],
                supported_sampling_rates=[50, 100, 200],
                default_sampling_rate=100,
                adc_resolution_bits=16,
                is_available=True,
                is_connected=False,
                imu_orientation="NED",
            ),
            SensorDeviceDescriptor(
                device_id="sensor_emg_sim",
                name="Virtual 2-Channel Peripheral EMG",
                modality=SensorModality.EMG,
                source=SensorSource.SIMULATOR,
                vendor="NeuroMove Virtual Lab",
                model="EMG-Dual-v1",
                firmware_version="1.0.0",
                protocol="VIRTUAL_STREAM",
                channel_count=2,
                channel_names=["EMG_Biceps", "EMG_Forearm"],
                supported_sampling_rates=[250, 500, 1000],
                default_sampling_rate=500,
                adc_resolution_bits=16,
                is_available=True,
                is_connected=False,
            ),
            SensorDeviceDescriptor(
                device_id="sensor_eog_sim",
                name="Virtual 2-Channel Ocular EOG",
                modality=SensorModality.EOG,
                source=SensorSource.SIMULATOR,
                vendor="NeuroMove Virtual Lab",
                model="EOG-Dual-v1",
                firmware_version="1.0.0",
                protocol="VIRTUAL_STREAM",
                channel_count=2,
                channel_names=["EOG_Vertical", "EOG_Horizontal"],
                supported_sampling_rates=[100, 250],
                default_sampling_rate=250,
                adc_resolution_bits=16,
                is_available=True,
                is_connected=False,
            ),
            SensorDeviceDescriptor(
                device_id="sensor_ppg_sim",
                name="Virtual Photoplethysmography Pulse Sensor",
                modality=SensorModality.PPG,
                source=SensorSource.SIMULATOR,
                vendor="NeuroMove Virtual Lab",
                model="PPG-Pulse-v1",
                firmware_version="1.0.0",
                protocol="VIRTUAL_STREAM",
                channel_count=1,
                channel_names=["PPG_Raw"],
                supported_sampling_rates=[50, 100],
                default_sampling_rate=100,
                adc_resolution_bits=16,
                is_available=True,
                is_connected=False,
            ),
            SensorDeviceDescriptor(
                device_id="sensor_press_sim",
                name="Virtual 4-Zone Seating & Grip Pressure Matrix",
                modality=SensorModality.PRESSURE,
                source=SensorSource.SIMULATOR,
                vendor="NeuroMove Virtual Lab",
                model="Pressure-Mat-v1",
                firmware_version="1.0.0",
                protocol="VIRTUAL_STREAM",
                channel_count=4,
                channel_names=["P_Left_Thigh", "P_Right_Thigh", "P_Lumbar", "P_Armrest"],
                supported_sampling_rates=[20, 50],
                default_sampling_rate=50,
                adc_resolution_bits=12,
                is_available=True,
                is_connected=False,
            ),
            SensorDeviceDescriptor(
                device_id="sensor_aux_sim",
                name="Virtual Auxiliary Telemetry Sensor",
                modality=SensorModality.AUXILIARY,
                source=SensorSource.SIMULATOR,
                vendor="NeuroMove Virtual Lab",
                model="Aux-v1",
                firmware_version="1.0.0",
                protocol="VIRTUAL_STREAM",
                channel_count=1,
                channel_names=["Aux_Channel"],
                supported_sampling_rates=[50, 100],
                default_sampling_rate=100,
                adc_resolution_bits=12,
                is_available=True,
                is_connected=False,
            ),
            # Physical Device Entries (Honest Availability)
            SensorDeviceDescriptor(
                device_id="sensor_eeg_phys",
                name="Physical OpenBCI Cyton / Ganglion (USB)",
                modality=SensorModality.EEG,
                source=SensorSource.PHYSICAL,
                vendor="OpenBCI",
                model="Cyton-8ch",
                firmware_version="3.1.2",
                protocol="SERIAL_FTDI",
                channel_count=8,
                channel_names=["F3", "F4", "C3", "Cz", "C4", "P3", "Pz", "P4"],
                supported_sampling_rates=[250],
                default_sampling_rate=250,
                adc_resolution_bits=24,
                is_available=False,
                is_connected=False,
                connection_path="COM3",
            ),
            SensorDeviceDescriptor(
                device_id="sensor_imu_phys",
                name="Physical 9-Axis IMU (MPU9250 / BNO055)",
                modality=SensorModality.IMU,
                source=SensorSource.PHYSICAL,
                vendor="InvenSense",
                model="MPU-9250",
                firmware_version="2.0.0",
                protocol="SERIAL_UART",
                channel_count=6,
                channel_names=["Accel_X", "Accel_Y", "Accel_Z", "Gyro_X", "Gyro_Y", "Gyro_Z"],
                supported_sampling_rates=[100],
                default_sampling_rate=100,
                adc_resolution_bits=16,
                is_available=False,
                is_connected=False,
                connection_path="COM4",
            ),
        ]

        for desc in default_devices:
            self.register_device(desc)

    def register_device(self, descriptor: SensorDeviceDescriptor) -> None:
        """Register a device descriptor and instantiate its appropriate adapter."""
        self._descriptors[descriptor.device_id] = descriptor

        if descriptor.source == SensorSource.SIMULATOR:
            adapter = SimulatedSensorAdapter(descriptor)
        elif descriptor.source == SensorSource.RECORDED:
            adapter = RecordedSensorAdapter(descriptor)
        else:
            adapter = PhysicalSensorAdapter(descriptor)

        self._adapters[descriptor.device_id] = adapter

    def get_descriptor(self, device_id: str) -> SensorDeviceDescriptor | None:
        return self._descriptors.get(device_id)

    def get_adapter(self, device_id: str) -> SensorAcquisitionAdapter | None:
        return self._adapters.get(device_id)

    def list_devices(self, modality: SensorModality | None = None) -> list[SensorDeviceDescriptor]:
        """List all registered device descriptors, optionally filtered by modality."""
        devices = []
        for dev_id, adapter in self._adapters.items():
            discovered = adapter.discover()
            for d in discovered:
                if modality is None or d.modality == modality:
                    devices.append(d)
        return devices

    def connect_device(self, device_id: str) -> bool:
        """Explicitly connect a target device."""
        adapter = self._adapters.get(device_id)
        if not adapter:
            logger.warning("Device %s not found in registry.", device_id)
            return False
        success = adapter.connect()
        if success and device_id in self._descriptors:
            self._descriptors[device_id].is_connected = True
        return success

    def disconnect_device(self, device_id: str) -> bool:
        """Disconnect target device and update registry."""
        adapter = self._adapters.get(device_id)
        if not adapter:
            return False
        success = adapter.disconnect()
        if device_id in self._descriptors:
            self._descriptors[device_id].is_connected = False
        return success
