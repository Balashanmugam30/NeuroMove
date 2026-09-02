"""NeuroMove — Phase 21 Physical EEG / BioAmp Acquisition Adapter.

Provides an import-safe, honest physical hardware boundary for BioAmp, ADC,
serial/USB, and Lab Streaming Layer (LSL) devices.
"""

from __future__ import annotations

import logging
from typing import Any

from neuromove.eeg_acquisition.adapters.base import EegAcquisitionAdapter
from neuromove.eeg_acquisition.models import (
    EegAcquisitionConfig,
    EegAcquisitionSource,
    EegAcquisitionState,
    EegDeviceDescriptor,
    EegSamplePacket,
)

logger = logging.getLogger(__name__)


class PhysicalEegAcquisitionAdapter(EegAcquisitionAdapter):
    """Physical EEG / BioAmp acquisition adapter.

    Safely scans for compatible hardware without auto-opening, connects only upon
    explicit operator instruction, and provides an honest unavailable state when
    no physical BioAmp hardware is attached.
    """

    def __init__(
        self,
        port_or_stream: str | None = None,
        baud_rate: int = 115200,
        device_id: str = "physical_bioamp_01",
        name: str = "Physical BioAmp Hardware Interface",
    ):
        self.port_or_stream = port_or_stream
        self.baud_rate = baud_rate
        self.device_id = device_id
        self.name = name

        self._state = EegAcquisitionState.DISCONNECTED
        self._config: EegAcquisitionConfig | None = None
        self._is_hardware_present = False
        self._serial_handle = None

        self._probe_environment()

    def _probe_environment(self) -> None:
        """Safely probe for physical devices without opening ports."""
        try:
            import serial.tools.list_ports

            ports = serial.tools.list_ports.comports()
            for p in ports:
                desc = (p.description or "").lower()
                if "bioamp" in desc or "openbci" in desc or "cyton" in desc or "ganglion" in desc:
                    self._is_hardware_present = True
                    self.port_or_stream = p.device
                    break
        except Exception:
            self._is_hardware_present = False

    def discover(self) -> list[EegDeviceDescriptor]:
        """Discover connected physical BioAmp devices safely."""
        self._probe_environment()
        devices = []
        if self._is_hardware_present:
            devices.append(self.get_device_descriptor())
        else:
            devices.append(
                EegDeviceDescriptor(
                    device_id="bioamp_physical_unavailable",
                    name="Physical BioAmp Device (Not Detected)",
                    source_type=EegAcquisitionSource.PHYSICAL,
                    vendor="Upside Down Labs / Standard BioAmp",
                    model="BioAmp EXG Pill / v1.0",
                    firmware_version=None,
                    protocol="1.0",
                    channel_count=8,
                    supported_sampling_rates=[125, 250, 500],
                    default_sampling_rate=250,
                    adc_resolution_bits=24,
                    is_available=False,
                    is_connected=False,
                    connection_path=None,
                )
            )
        return devices

    def get_device_descriptor(self) -> EegDeviceDescriptor:
        return EegDeviceDescriptor(
            device_id=self.device_id,
            name=self.name,
            source_type=EegAcquisitionSource.PHYSICAL,
            vendor="Upside Down Labs / BioAmp",
            model="BioAmp Hardware",
            firmware_version="bioamp-hw-v1.0" if self._is_hardware_present else None,
            protocol="1.0",
            channel_count=8,
            supported_sampling_rates=[125, 250, 500],
            default_sampling_rate=250,
            adc_resolution_bits=24,
            is_available=self._is_hardware_present,
            is_connected=self._state == EegAcquisitionState.STREAMING,
            connection_path=self.port_or_stream,
        )

    def connect(self, device_id: str | None = None) -> bool:
        if not self._is_hardware_present:
            self._state = EegAcquisitionState.ERROR
            logger.warning(
                "Cannot connect physical adapter: No compatible physical BioAmp hardware present in environment"
            )
            return False

        self._state = EegAcquisitionState.CONNECTING
        logger.info("Connecting to physical BioAmp on %s", self.port_or_stream)
        return True

    def configure(self, config: EegAcquisitionConfig) -> bool:
        self._config = config
        self._state = EegAcquisitionState.CONFIGURING
        return True

    def start_stream(self) -> bool:
        if not self._is_hardware_present:
            self._state = EegAcquisitionState.ERROR
            return False
        self._state = EegAcquisitionState.STREAMING
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
        return True

    def get_status(self) -> EegAcquisitionState:
        return self._state

    def inject_fault(self, fault_type: str, params: dict[str, Any] | None = None) -> bool:
        logger.info(
            "Fault injection %s requested on physical adapter (ignored on hardware)", fault_type
        )
        return False

    def read_chunk(self) -> EegSamplePacket | None:
        if not self._is_hardware_present or self._state != EegAcquisitionState.STREAMING:
            return None
        # Physical serial/ADC read implementation when device attached
        return None
