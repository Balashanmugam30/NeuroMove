"""Transport Adapter abstraction and Simulated ESP32 Adapter implementation."""

from __future__ import annotations

import abc
import logging

from neuromove.transport_protocol.models import (
    CommandAck,
    CommandNack,
    DeviceCapability,
    DeviceIdentity,
    TransportConnectionState,
)
from neuromove.transport_protocol.simulator import Esp32Simulator

logger = logging.getLogger(__name__)


class TransportAdapter(abc.ABC):
    """Abstract interface for embedded command transport adapters.

    Phase 19 provides SimulatedEsp32Adapter.
    Phase 20 introduces RealEsp32Adapter under Hardware-in-the-Loop.
    """

    @abc.abstractmethod
    def connect(self) -> bool:
        """Establish physical/simulated link."""
        pass

    @abc.abstractmethod
    def disconnect(self) -> None:
        """Tear down physical/simulated link."""
        pass

    @abc.abstractmethod
    def negotiate(self, client_version: str, session_id: str) -> tuple[bool, str, str]:
        """Perform protocol handshake and version negotiation."""
        pass

    @abc.abstractmethod
    def send_frame(self, frame_bytes: bytes) -> CommandAck | CommandNack:
        """Transmit framed bytes to the endpoint and await ACK/NACK."""
        pass

    @abc.abstractmethod
    def ping(self) -> float:
        """Dispatch heartbeat ping and return round-trip time in milliseconds."""
        pass

    @abc.abstractmethod
    def health(self) -> TransportConnectionState:
        """Return current link connectivity state."""
        pass

    @abc.abstractmethod
    def capabilities(self) -> list[DeviceCapability]:
        """Return advertised device capabilities."""
        pass

    @abc.abstractmethod
    def identity(self) -> DeviceIdentity:
        """Return device identification metadata."""
        pass

    @abc.abstractmethod
    def close(self) -> None:
        """Cleanly release resources."""
        pass


class SimulatedEsp32Adapter(TransportAdapter):
    """Software-only simulation adapter delegating to Esp32Simulator."""

    def __init__(self, simulator: Esp32Simulator | None = None) -> None:
        self.simulator = simulator or Esp32Simulator()

    def connect(self) -> bool:
        # Simulator connect transitions to CONNECTING until negotiation completes
        self.simulator.connection_state = TransportConnectionState.CONNECTING
        return True

    def disconnect(self) -> None:
        self.simulator.disconnect()

    def negotiate(self, client_version: str, session_id: str) -> tuple[bool, str, str]:
        return self.simulator.negotiate(client_version, session_id)

    def send_frame(self, frame_bytes: bytes) -> CommandAck | CommandNack:
        return self.simulator.process_incoming_frame(frame_bytes)

    def ping(self) -> float:
        return self.simulator.process_heartbeat_ping()

    def health(self) -> TransportConnectionState:
        return self.simulator.connection_state

    def capabilities(self) -> list[DeviceCapability]:
        return self.simulator.capabilities

    def identity(self) -> DeviceIdentity:
        return self.simulator.get_identity()

    def close(self) -> None:
        self.simulator.disconnect()
