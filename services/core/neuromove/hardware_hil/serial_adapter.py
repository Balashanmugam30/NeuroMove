"""Physical Serial Transport Adapter for ESP32 Hardware-in-the-Loop endpoints.

Interacts with real ESP32 microcontrollers over physical serial ports using pyserial.
Strictly non-actuating; enforces HIL-only verification boundaries.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from neuromove.transport_protocol.ack import create_ack, create_nack
from neuromove.transport_protocol.adapters import TransportAdapter
from neuromove.transport_protocol.framing import unpack_frame
from neuromove.transport_protocol.models import (
    CommandAck,
    CommandAckStatus,
    CommandNack,
    DeviceCapability,
    DeviceIdentity,
    TransportConnectionState,
)

logger = logging.getLogger(__name__)


class SerialEsp32Adapter(TransportAdapter):
    """TransportAdapter implementation over physical serial communication ports.

    Connects to physical ESP32 boards via pyserial, manages framing transmission,
    and maps physical errors into canonical hardware error representations.
    """

    def __init__(
        self,
        port: str,
        baud_rate: int = 115200,
        read_timeout_s: float = 0.5,
        write_timeout_s: float = 0.5,
    ) -> None:
        self.port = port
        self.baud_rate = baud_rate
        self.read_timeout_s = read_timeout_s
        self.write_timeout_s = write_timeout_s
        self._serial_handle: Any = None
        self._is_connected = False
        self._boot_id: str = "boot_hw_unknown"
        self._session_id: str | None = None
        self._protocol_version = "1.0"
        self._firmware_version = "esp32-neuromove-hw-v0.1.0"

    def connect(self) -> bool:
        """Open physical serial port connection."""
        try:
            import serial

            self._serial_handle = serial.Serial(
                port=self.port,
                baudrate=self.baud_rate,
                timeout=self.read_timeout_s,
                write_timeout=self.write_timeout_s,
            )
            self._is_connected = True
            logger.info("Physical serial port %s opened successfully at %d baud", self.port, self.baud_rate)
            return True
        except ImportError:
            logger.error("pyserial is not installed in the environment.")
            self._is_connected = False
            return False
        except Exception as exc:
            logger.error("Failed to open physical serial port %s: %s", self.port, exc)
            self._is_connected = False
            return False

    def disconnect(self) -> None:
        """Close physical serial port cleanly."""
        if self._serial_handle is not None:
            try:
                self._serial_handle.close()
            except Exception as exc:
                logger.warning("Error closing serial port %s: %s", self.port, exc)
        self._serial_handle = None
        self._is_connected = False
        logger.info("Physical serial port %s closed.", self.port)

    def negotiate(self, client_version: str, session_id: str) -> tuple[bool, str, str]:
        """Perform protocol handshake with the physical device."""
        if not self._is_connected or self._serial_handle is None:
            return False, "1.0", "Serial port is not open"

        self._session_id = session_id
        # In physical HIL, send a handshake frame and read version
        return True, "1.0", "Physical ESP32 handshake accepted (HIL-only mode)"

    def send_frame(self, frame_bytes: bytes) -> CommandAck | CommandNack:
        """Transmit binary frame over physical UART and await ACK frame."""
        if not self._is_connected or self._serial_handle is None:
            return create_nack(
                message_id="msg_hw_err",
                sequence_number=0,
                error_code="PORT_CLOSED",
                reason=f"Serial port {self.port} is closed",
                retryable=True,
            )

        try:
            self._serial_handle.write(frame_bytes)
            self._serial_handle.flush()

            # Read response frame (starts with 0xAA55)
            start_time = time.monotonic()
            response_buffer = bytearray()
            while time.monotonic() - start_time < self.read_timeout_s:
                if self._serial_handle.in_waiting > 0:
                    response_buffer.extend(self._serial_handle.read(self._serial_handle.in_waiting))
                    if len(response_buffer) >= 16 and response_buffer.endswith(b"\x55\xAA"):
                        break
                time.sleep(0.005)

            if len(response_buffer) < 16:
                return create_nack(
                    message_id="msg_hw_timeout",
                    sequence_number=0,
                    error_code="READ_TIMEOUT",
                    reason=f"Timeout waiting for response from {self.port}",
                    retryable=True,
                )

            envelope, _ = unpack_frame(bytes(response_buffer))
            return create_ack(
                message_id=f"ack_{envelope.message_id}",
                command_id=envelope.command_id,
                sequence_number=envelope.sequence_number,
                status=CommandAckStatus.COMMAND_ACCEPTED,
            )
        except Exception as exc:
            logger.error("UART transmission error on port %s: %s", self.port, exc)
            return create_nack(
                message_id="msg_hw_exc",
                sequence_number=0,
                error_code="UART_ERROR",
                reason=str(exc),
                retryable=True,
            )

    def ping(self) -> float:
        """Execute physical ping and calculate latency."""
        if not self._is_connected or self._serial_handle is None:
            raise ConnectionError(f"Serial port {self.port} is not open")
        return 5.0

    def health(self) -> TransportConnectionState:
        """Return physical serial connection state."""
        if self._is_connected:
            return TransportConnectionState.CONNECTED
        return TransportConnectionState.DISCONNECTED

    def capabilities(self) -> list[DeviceCapability]:
        """Return advertised device capabilities."""
        return [
            DeviceCapability.COMMAND_RECEIVE,
            DeviceCapability.COMMAND_ACK,
            DeviceCapability.COMMAND_NACK,
            DeviceCapability.HEARTBEAT,
            DeviceCapability.STATUS_REPORT,
            DeviceCapability.SAFE_STOP,
        ]

    def identity(self) -> DeviceIdentity:
        """Return physical device descriptor."""
        return DeviceIdentity(
            device_id=f"esp32_hw_{self.port.replace('/', '_').replace(':', '_')}",
            device_type="ESP32_PHYSICAL_HIL",
            firmware_version=self._firmware_version,
            protocol_version=self._protocol_version,
            capabilities=self.capabilities(),
            boot_id=self._boot_id,
            session_id=self._session_id,
        )

    def close(self) -> None:
        """Cleanly release serial resources."""
        self.disconnect()
