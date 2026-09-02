"""Hardware-in-the-Loop Integration, ESP32 Adapter & Verification Subsystem."""

from __future__ import annotations

from neuromove.hardware_hil.emulator import Esp32ProtocolEmulator
from neuromove.hardware_hil.models import (
    Esp32DeviceInfo,
    FirmwareIdentity,
    HardwareConnectionState,
    HardwareDiagnostic,
    HardwareEndpointMode,
    HardwareHealth,
    HardwareRecoveryResult,
    HardwareSession,
    HardwareStatus,
    HILExperiment,
    HILScenarioResult,
    SerialPortDescriptor,
)
from neuromove.hardware_hil.ports import discover_serial_ports, validate_port_settings
from neuromove.hardware_hil.scenarios import HILScenarioRegistry
from neuromove.hardware_hil.serial_adapter import SerialEsp32Adapter
from neuromove.hardware_hil.service import HardwareHilService, default_hardware_service
from neuromove.hardware_hil.state_machine import HardwareConnectionStateMachine
from neuromove.hardware_hil.storage import HardwareHilStorage
from neuromove.hardware_hil.virtual_adapter import VirtualSerialAdapter
from neuromove.hardware_hil.virtual_serial import VirtualSerialChannel, VirtualSerialPair

__all__ = [
    "Esp32DeviceInfo",
    "Esp32ProtocolEmulator",
    "FirmwareIdentity",
    "HILExperiment",
    "HILScenarioRegistry",
    "HILScenarioResult",
    "HardwareConnectionState",
    "HardwareConnectionStateMachine",
    "HardwareDiagnostic",
    "HardwareEndpointMode",
    "HardwareHealth",
    "HardwareHilService",
    "HardwareHilStorage",
    "HardwareRecoveryResult",
    "HardwareSession",
    "HardwareStatus",
    "SerialEsp32Adapter",
    "SerialPortDescriptor",
    "VirtualSerialAdapter",
    "VirtualSerialChannel",
    "VirtualSerialPair",
    "default_hardware_service",
    "discover_serial_ports",
    "validate_port_settings",
]
