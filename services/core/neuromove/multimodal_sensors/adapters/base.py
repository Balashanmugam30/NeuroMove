"""NeuroMove — Phase 23 Multimodal Sensor Acquisition Adapter Abstract Base Class."""

from __future__ import annotations

from abc import ABC, abstractmethod

from neuromove.domain.enums import SensorModality, SensorSource, SensorState
from neuromove.multimodal_sensors.models import (
    SensorCalibrationSnapshot,
    SensorDeviceDescriptor,
    SensorHealthSnapshot,
    SensorStreamPacket,
)


class SensorAcquisitionAdapter(ABC):
    """Abstract hardware/simulation adapter boundary for a multimodal sensor."""

    def __init__(self, device_descriptor: SensorDeviceDescriptor):
        self.descriptor = device_descriptor
        self.state = SensorState.DISCONNECTED
        self._session_id: str = "default_session"
        self._sequence_number: int = 0

    @property
    def sensor_id(self) -> str:
        return self.descriptor.device_id

    @property
    def modality(self) -> SensorModality:
        return self.descriptor.modality

    @property
    def source(self) -> SensorSource:
        return self.descriptor.source

    @abstractmethod
    def discover(self) -> list[SensorDeviceDescriptor]:
        """Safely discover/inspect device availability."""
        pass

    @abstractmethod
    def connect(self) -> bool:
        """Connect to device or initialize virtual stream."""
        pass

    @abstractmethod
    def configure(self, sampling_rate: int | None = None, channel_names: list[str] | None = None) -> bool:
        """Configure stream parameters."""
        pass

    @abstractmethod
    def calibrate(self) -> SensorCalibrationSnapshot:
        """Execute baseline/zero-bias calibration."""
        pass

    @abstractmethod
    def start_stream(self, session_id: str) -> bool:
        """Start streaming packets."""
        pass

    @abstractmethod
    def read_chunk(self, chunk_size: int = 10) -> SensorStreamPacket | None:
        """Read next chunk of samples."""
        pass

    @abstractmethod
    def pause(self) -> bool:
        """Pause streaming."""
        pass

    @abstractmethod
    def resume(self) -> bool:
        """Resume streaming."""
        pass

    @abstractmethod
    def stop_stream(self) -> bool:
        """Stop streaming."""
        pass

    @abstractmethod
    def disconnect(self) -> bool:
        """Disconnect and release resources."""
        pass

    @abstractmethod
    def get_health(self) -> SensorHealthSnapshot:
        """Get live sensor health snapshot."""
        pass
