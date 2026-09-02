"""NeuroMove — Phase 21 Acquisition Adapter Abstract Base Class."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from neuromove.eeg_acquisition.models import (
    EegAcquisitionConfig,
    EegAcquisitionState,
    EegDeviceDescriptor,
    EegSamplePacket,
)


class EegAcquisitionAdapter(ABC):
    """Abstract interface isolating physical/virtual/recorded EEG sources from downstream DSP & safety."""

    @abstractmethod
    def discover(self) -> list[EegDeviceDescriptor]:
        """Safely discover available acquisition devices."""
        pass

    @abstractmethod
    def connect(self, device_id: str | None = None) -> bool:
        """Establish connection with target device."""
        pass

    @abstractmethod
    def configure(self, config: EegAcquisitionConfig) -> bool:
        """Apply acquisition settings (sampling rate, channels, chunk size)."""
        pass

    @abstractmethod
    def start_stream(self) -> bool:
        """Begin streaming EEG sample packets."""
        pass

    @abstractmethod
    def read_chunk(self) -> EegSamplePacket | None:
        """Read the next available sample packet."""
        pass

    @abstractmethod
    def pause(self) -> bool:
        """Pause active streaming."""
        pass

    @abstractmethod
    def resume(self) -> bool:
        """Resume paused stream."""
        pass

    @abstractmethod
    def stop_stream(self) -> bool:
        """Stop streaming sample packets."""
        pass

    @abstractmethod
    def disconnect(self) -> bool:
        """Cleanly close connection and free device resources."""
        pass

    @abstractmethod
    def get_status(self) -> EegAcquisitionState:
        """Return current lifecycle state."""
        pass

    @abstractmethod
    def get_device_descriptor(self) -> EegDeviceDescriptor:
        """Return device metadata."""
        pass

    @abstractmethod
    def inject_fault(self, fault_type: str, params: dict[str, Any] | None = None) -> bool:
        """Inject a simulated hardware/stream fault for resilience testing."""
        pass
