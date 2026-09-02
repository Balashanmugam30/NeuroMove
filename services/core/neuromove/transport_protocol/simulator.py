"""Deterministic in-memory Simulated ESP32 endpoint.

Provides pure software simulation of an embedded ESP32 microcontroller running
NeuroMove protocol firmware. Zero real hardware actuation, motor commands, or GPIO.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from neuromove.transport_protocol.ack import create_ack, create_nack
from neuromove.transport_protocol.framing import FramingError, unpack_frame
from neuromove.transport_protocol.models import (
    CommandAck,
    CommandAckStatus,
    CommandEnvelope,
    CommandNack,
    DeviceCapability,
    DeviceIdentity,
    DeviceType,
    TransportConnectionState,
)
from neuromove.transport_protocol.protocol import negotiate_protocol_version
from neuromove.transport_protocol.sequence import SequenceTracker

logger = logging.getLogger(__name__)


class Esp32Simulator:
    """In-memory simulated ESP32 endpoint implementing the protocol."""

    def __init__(
        self,
        device_id: str = "esp32_sim_01",
        firmware_version: str = "esp32-neuromove-v0.1.0",
        protocol_version: str = "1.0",
    ) -> None:
        self.device_id = device_id
        self.device_type = DeviceType.ESP32_SIMULATOR
        self.firmware_version = firmware_version
        self.protocol_version = protocol_version
        self.boot_id = f"boot_{uuid.uuid4().hex[:8]}"

        self.capabilities: list[DeviceCapability] = [
            DeviceCapability.COMMAND_RECEIVE,
            DeviceCapability.COMMAND_ACK,
            DeviceCapability.COMMAND_NACK,
            DeviceCapability.HEARTBEAT,
            DeviceCapability.STATUS_REPORT,
            DeviceCapability.SAFE_STOP,
            DeviceCapability.SIMULATION,
        ]

        self.connection_state = TransportConnectionState.DISCONNECTED
        self.active_session_id: str | None = None
        self.sequence_tracker = SequenceTracker()

        # Bounded audit registries
        self.received_commands: dict[str, CommandEnvelope] = {}
        self.duplicate_commands: list[str] = []
        self.rejected_commands: list[dict[str, Any]] = []

        # Fault simulation hooks
        self._fault_drop_next: bool = False
        self._fault_delay_ms: float = 0.0
        self._fault_corrupt_crc: bool = False
        self._fault_drop_ack: bool = False
        self._fault_disconnect: bool = False
        self._fault_skew_seconds: float = 0.0

    def get_identity(self) -> DeviceIdentity:
        """Return the device identity descriptor."""
        return DeviceIdentity(
            device_id=self.device_id,
            device_type=self.device_type,
            firmware_version=self.firmware_version,
            protocol_version=self.protocol_version,
            capabilities=self.capabilities,
            boot_id=self.boot_id,
            session_id=self.active_session_id,
        )

    def negotiate(self, client_protocol_version: str, session_id: str) -> tuple[bool, str, str]:
        """Perform protocol handshake and connection negotiation."""
        if self._fault_disconnect:
            self.connection_state = TransportConnectionState.DISCONNECTED
            return False, "", "Connection forcibly refused by simulator fault"

        compatible, version, reason = negotiate_protocol_version(client_protocol_version)
        if not compatible:
            self.connection_state = TransportConnectionState.DISCONNECTED
            return False, "", reason

        self.active_session_id = session_id
        self.connection_state = TransportConnectionState.CONNECTED
        self.sequence_tracker.reset(baseline=0)
        logger.info(
            "Simulated ESP32 %s negotiated version %s for session %s",
            self.device_id,
            version,
            session_id,
        )
        return True, version, "Negotiation successful"

    def disconnect(self) -> None:
        """Disconnect the simulated endpoint."""
        self.connection_state = TransportConnectionState.DISCONNECTED
        self.active_session_id = None
        logger.info("Simulated ESP32 %s disconnected", self.device_id)

    def reboot(self) -> str:
        """Simulate microcontroller cold restart, generating a new boot_id."""
        self.boot_id = f"boot_{uuid.uuid4().hex[:8]}"
        self.connection_state = TransportConnectionState.DISCONNECTED
        self.active_session_id = None
        self.sequence_tracker.reset(baseline=0)
        self.received_commands.clear()
        self.duplicate_commands.clear()
        self.rejected_commands.clear()
        logger.info("Simulated ESP32 rebooted. New boot_id: %s", self.boot_id)
        return self.boot_id

    def process_incoming_frame(
        self,
        frame_bytes: bytes,
        receive_time: datetime | None = None,
    ) -> CommandAck | CommandNack:
        """Process raw framed bytes received from transport adapter."""
        now = receive_time or datetime.now(UTC)

        # Injected fault: transport disconnect
        if self._fault_disconnect or self.connection_state != TransportConnectionState.CONNECTED:
            return create_nack(
                message_id="msg_drop",
                error_code="CONNECTION_CLOSED",
                reason="Simulated ESP32 connection is closed or offline",
                retryable=True,
                current_time=now,
            )

        # Injected fault: frame drop
        if self._fault_drop_next:
            self._fault_drop_next = False
            logger.info("Simulated ESP32 dropped frame due to active fault")
            return create_nack(
                message_id="msg_drop",
                error_code="TRANSPORT_DROP",
                reason="Frame silently dropped by simulation fault",
                retryable=True,
                current_time=now,
            )

        # Injected fault: simulated network latency
        if self._fault_delay_ms > 0:
            time.sleep(self._fault_delay_ms / 1000.0)

        # 1. Unpack frame and verify boundaries & CRC-32
        try:
            envelope, raw_meta = unpack_frame(frame_bytes)
        except FramingError as exc:
            logger.warning("Simulated ESP32 failed to unpack frame: %s", exc)
            return create_nack(
                message_id="msg_invalid_frame",
                error_code=exc.code,
                reason=str(exc),
                retryable=False,
                current_time=now,
            )

        # Injected fault: corrupt ACK CRC or drop ACK
        if self._fault_drop_ack:
            self._fault_drop_ack = False
            self.sequence_tracker.record_rx(envelope.sequence_number)
            self.received_commands[envelope.command_id] = envelope
            logger.info("Simulated ESP32 dropping outgoing ACK due to active fault")
            return create_nack(
                message_id=envelope.message_id,
                command_id=envelope.command_id,
                sequence_number=envelope.sequence_number,
                error_code="ACK_DROPPED",
                reason="Simulated ACK loss",
                retryable=True,
                current_time=now,
            )

        # 2. Session boundary verification
        if (
            self.active_session_id
            and envelope.session_id
            and envelope.session_id != self.active_session_id
        ):
            msg = f"Session mismatch: device expected {self.active_session_id}, got {envelope.session_id}"
            self._record_rejection(envelope, "SESSION_MISMATCH", msg)
            return create_nack(
                message_id=envelope.message_id,
                command_id=envelope.command_id,
                sequence_number=envelope.sequence_number,
                error_code="SESSION_MISMATCH",
                reason=msg,
                retryable=False,
                current_time=now,
            )

        # 3. Expiration verification
        try:
            expires_dt = datetime.fromisoformat(envelope.expires_at)
            if expires_dt.tzinfo is None:
                expires_dt = expires_dt.replace(tzinfo=UTC)
            effective_now = now
            if self._fault_skew_seconds != 0:
                effective_now = datetime.fromtimestamp(
                    now.timestamp() + self._fault_skew_seconds, tz=UTC
                )

            if effective_now >= expires_dt:
                msg = f"Command expired at {envelope.expires_at}"
                self._record_rejection(envelope, "AUTHORIZATION_EXPIRED", msg)
                return create_ack(
                    message_id=envelope.message_id,
                    command_id=envelope.command_id,
                    sequence_number=envelope.sequence_number,
                    status=CommandAckStatus.COMMAND_EXPIRED,
                    reason=msg,
                    current_time=now,
                )
        except Exception as exc:
            msg = f"Malformed expiration timestamp: {exc}"
            self._record_rejection(envelope, "MALFORMED_TIMESTAMP", msg)
            return create_nack(
                message_id=envelope.message_id,
                command_id=envelope.command_id,
                sequence_number=envelope.sequence_number,
                error_code="MALFORMED_TIMESTAMP",
                reason=msg,
                retryable=False,
                current_time=now,
            )

        # 4. Idempotency Check: Duplicate command detection by command_id
        if envelope.command_id in self.received_commands:
            self.duplicate_commands.append(envelope.command_id)
            logger.info(
                "Simulated ESP32 recognized duplicate command_id: %s (idempotent ACK)",
                envelope.command_id,
            )
            return create_ack(
                message_id=envelope.message_id,
                command_id=envelope.command_id,
                sequence_number=envelope.sequence_number,
                status=CommandAckStatus.COMMAND_DUPLICATE,
                reason="Command already processed (idempotent duplicate recognition)",
                current_time=now,
            )

        # 5. Monotonic Sequence Verification
        seq_result = self.sequence_tracker.validate_incoming_rx(envelope.sequence_number)
        if not seq_result.is_valid:
            if seq_result.status == "DUPLICATE":
                msg = f"Duplicate sequence number received: {envelope.sequence_number}"
                return create_ack(
                    message_id=envelope.message_id,
                    command_id=envelope.command_id,
                    sequence_number=envelope.sequence_number,
                    status=CommandAckStatus.COMMAND_DUPLICATE,
                    reason=msg,
                    current_time=now,
                )
            elif seq_result.status == "GAP":
                msg = f"Sequence gap detected: expected {seq_result.expected_sequence}, received {envelope.sequence_number}"
                self._record_rejection(envelope, "SEQUENCE_GAP", msg)
                return create_nack(
                    message_id=envelope.message_id,
                    command_id=envelope.command_id,
                    sequence_number=envelope.sequence_number,
                    error_code="SEQUENCE_GAP",
                    reason=msg,
                    retryable=False,
                    current_time=now,
                )
            else:
                msg = f"Out of order sequence: expected {seq_result.expected_sequence}, received {envelope.sequence_number}"
                self._record_rejection(envelope, "OUT_OF_ORDER", msg)
                return create_nack(
                    message_id=envelope.message_id,
                    command_id=envelope.command_id,
                    sequence_number=envelope.sequence_number,
                    error_code="OUT_OF_ORDER",
                    reason=msg,
                    retryable=False,
                    current_time=now,
                )

        # Sequence is valid: record sequence
        self.sequence_tracker.record_rx(envelope.sequence_number)

        # 6. Record command in simulated storage (capped at 1000 items)
        self.received_commands[envelope.command_id] = envelope
        if len(self.received_commands) > 1000:
            first_key = next(iter(self.received_commands))
            del self.received_commands[first_key]

        logger.info(
            "Simulated ESP32 accepted command %s (intent: %s, seq: %d)",
            envelope.command_id,
            envelope.payload.intent_class,
            envelope.sequence_number,
        )

        return create_ack(
            message_id=envelope.message_id,
            command_id=envelope.command_id,
            sequence_number=envelope.sequence_number,
            status=CommandAckStatus.COMMAND_ACCEPTED,
            reason="SIMULATED_EXECUTED",  # Software simulation acceptance only
            current_time=now,
        )

    def process_heartbeat_ping(self, ping_time: datetime | None = None) -> float:
        """Respond to a heartbeat ping and return simulated round-trip time."""
        if self._fault_disconnect or self.connection_state != TransportConnectionState.CONNECTED:
            raise ConnectionError("Simulated ESP32 is offline or disconnected")
        return 2.5 + self._fault_delay_ms  # Fast simulated RTT

    def set_faults(
        self,
        drop_next: bool = False,
        delay_ms: float = 0.0,
        corrupt_crc: bool = False,
        drop_ack: bool = False,
        disconnect: bool = False,
        skew_seconds: float = 0.0,
    ) -> None:
        """Configure simulation fault injection parameters."""
        self._fault_drop_next = drop_next
        self._fault_delay_ms = delay_ms
        self._fault_corrupt_crc = corrupt_crc
        self._fault_drop_ack = drop_ack
        self._fault_disconnect = disconnect
        self._fault_skew_seconds = skew_seconds

    def clear_faults(self) -> None:
        """Clear all simulation fault injection overrides."""
        self._fault_drop_next = False
        self._fault_delay_ms = 0.0
        self._fault_corrupt_crc = False
        self._fault_drop_ack = False
        self._fault_disconnect = False
        self._fault_skew_seconds = 0.0

    def _record_rejection(self, envelope: CommandEnvelope, reason_code: str, message: str) -> None:
        self.rejected_commands.append(
            {
                "command_id": envelope.command_id,
                "message_id": envelope.message_id,
                "sequence_number": envelope.sequence_number,
                "reason_code": reason_code,
                "message": message,
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
        if len(self.rejected_commands) > 500:
            self.rejected_commands.pop(0)
