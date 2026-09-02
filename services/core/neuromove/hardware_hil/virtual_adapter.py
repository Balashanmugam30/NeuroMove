"""Virtual Serial Transport Adapter connecting to the ESP32 Protocol Emulator."""

from __future__ import annotations

import logging

from neuromove.hardware_hil.emulator import Esp32ProtocolEmulator
from neuromove.hardware_hil.virtual_serial import VirtualSerialPair
from neuromove.transport_protocol.adapters import TransportAdapter
from neuromove.transport_protocol.models import (
    CommandAck,
    CommandNack,
    DeviceCapability,
    DeviceIdentity,
    TransportConnectionState,
)

logger = logging.getLogger(__name__)


class VirtualSerialAdapter(TransportAdapter):
    """TransportAdapter implementation over a virtual serial byte channel.

    Transmits binary frames across a VirtualSerialPair to an Esp32ProtocolEmulator,
    ensuring 100% protocol parity with physical serial hardware without requiring
    physical COM ports in CI environments.
    """

    def __init__(
        self,
        emulator: Esp32ProtocolEmulator | None = None,
        port_name: str = "VIRTUAL_COM_01",
    ) -> None:
        self.port_name = port_name
        self.emulator = emulator or Esp32ProtocolEmulator(device_id="esp32_virtual_01")
        self.virtual_pair = VirtualSerialPair(port_name=port_name)

    def connect(self) -> bool:
        """Establish virtual serial connection."""
        if not self.virtual_pair.is_open:
            self.virtual_pair = VirtualSerialPair(port_name=self.port_name)
        return True

    def disconnect(self) -> None:
        """Tear down virtual serial connection."""
        self.virtual_pair.close()
        self.emulator.connection_state = "DISCONNECTED"

    def negotiate(self, client_version: str, session_id: str) -> tuple[bool, str, str]:
        """Perform protocol handshake and version negotiation over virtual channel."""
        return self.emulator.negotiate(client_version, session_id)

    def send_frame(self, frame_bytes: bytes) -> CommandAck | CommandNack:
        """Transmit framed bytes across virtual serial pair and read response."""
        if not self.virtual_pair.is_open:
            raise ConnectionError(f"Virtual serial port '{self.port_name}' is closed.")

        # 1. Write host -> device
        self.virtual_pair.host_to_device.write(frame_bytes)

        # 2. Read from stream on device side
        device_in = self.virtual_pair.host_to_device.read_all()

        # 3. Emulator processes incoming byte stream
        ack_or_nack = self.emulator.process_incoming_frame(device_in)
        return ack_or_nack

    def ping(self) -> float:
        """Dispatch heartbeat ping across virtual link."""
        if not self.virtual_pair.is_open:
            raise ConnectionError(f"Virtual serial port '{self.port_name}' is closed.")
        return self.emulator.process_heartbeat_ping()

    def health(self) -> TransportConnectionState:
        """Return current link connectivity state."""
        if getattr(self.emulator, "_fault_disconnect", False):
            return TransportConnectionState.DISCONNECTED
        state_str = str(self.emulator.connection_state)
        if state_str in ("READY", "CONNECTED"):
            return TransportConnectionState.CONNECTED
        elif state_str == "DEGRADED":
            return TransportConnectionState.DEGRADED
        elif state_str == "STALE":
            return TransportConnectionState.STALE
        return TransportConnectionState.DISCONNECTED

    def capabilities(self) -> list[DeviceCapability]:
        """Return advertised device capabilities."""
        return self.emulator.capabilities

    def identity(self) -> DeviceIdentity:
        """Return device identification metadata."""
        info = self.emulator.get_device_info()
        return DeviceIdentity(
            device_id=info.device_id,
            device_type="ESP32_VIRTUAL_SERIAL",
            firmware_version=info.firmware_version,
            protocol_version=info.protocol_version,
            capabilities=info.capabilities,
            boot_id=info.boot_id,
            session_id=self.emulator.active_session_id,
        )

    def close(self) -> None:
        """Cleanly release virtual serial resources."""
        self.disconnect()
