"""Full-fidelity ESP32 Protocol Emulator for Hardware-in-the-Loop integration.

Consumes actual Phase 19 binary wire frames, decodes and verifies CRC-32, enforces
monotonic sequence ordering, verifies Phase 17 authorization expiry, detects duplicate
commands idempotently, and packs response wire frames for virtual and hardware channels.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from neuromove.hardware_hil.models import (
    Esp32DeviceInfo,
    FirmwareIdentity,
    HardwareConnectionState,
    HardwareEndpointMode,
)
from neuromove.transport_protocol.ack import create_ack, create_nack
from neuromove.transport_protocol.checksum import compute_crc32
from neuromove.transport_protocol.framing import (
    FrameChecksumMismatchError,
    FrameDelimiterError,
    FramePayloadSizeError,
    FrameTruncatedError,
    FramingError,
    pack_frame,
    unpack_frame,
)
from neuromove.transport_protocol.models import (
    CommandAck,
    CommandAckStatus,
    CommandEnvelope,
    CommandNack,
    CommandType,
    DeviceCapability,
    MessageType,
    TransportConnectionState,
)
from neuromove.transport_protocol.protocol import negotiate_protocol_version
from neuromove.transport_protocol.sequence import SequenceTracker

logger = logging.getLogger(__name__)


class Esp32ProtocolEmulator:
    """Microcontroller firmware emulator for the NeuroMove ESP32 protocol."""

    def __init__(
        self,
        device_id: str = "esp32_hil_endpoint_01",
        firmware_version: str = "0.1.0",
        protocol_version: str = "1.0",
        device_mode: HardwareEndpointMode = HardwareEndpointMode.VIRTUAL_SERIAL,
    ) -> None:
        self.device_id = device_id
        self.device_mode = device_mode
        self.firmware_version = firmware_version
        self.protocol_version = protocol_version
        self.boot_id = f"boot_{uuid.uuid4().hex[:8]}"
        self.firmware_identity = FirmwareIdentity(
            firmware_name="esp32-neuromove-hil",
            firmware_version=self.firmware_version,
            build_hash=f"bld_{uuid.uuid4().hex[:8]}",
            compiled_at=datetime.now(UTC).isoformat(),
            target_mcu="ESP32-S3",
            is_hil_only=True,
        )

        self.capabilities: list[DeviceCapability] = [
            DeviceCapability.COMMAND_RECEIVE,
            DeviceCapability.COMMAND_ACK,
            DeviceCapability.COMMAND_NACK,
            DeviceCapability.HEARTBEAT,
            DeviceCapability.STATUS_REPORT,
            DeviceCapability.SAFE_STOP,
            DeviceCapability.SIMULATION,
        ]

        self.connection_state = HardwareConnectionState.DISCONNECTED
        self.active_session_id: str | None = None
        self.sequence_tracker = SequenceTracker()

        # Bounded audit registries
        self.received_commands: dict[str, CommandEnvelope] = {}
        self.duplicate_commands: list[str] = []
        self.rejected_commands: list[dict[str, Any]] = []

        # Fault injection hooks
        self._fault_drop_next: bool = False
        self._fault_delay_ms: float = 0.0
        self._fault_corrupt_crc: bool = False
        self._fault_drop_ack: bool = False
        self._fault_disconnect: bool = False
        self._fault_reboot: bool = False
        self._fault_skew_seconds: float = 0.0

    def get_device_info(self) -> Esp32DeviceInfo:
        """Return full negotiated device descriptor."""
        return Esp32DeviceInfo(
            device_id=self.device_id,
            device_type="ESP32_HIL_ENDPOINT",
            device_mode=self.device_mode,
            firmware_version=self.firmware_version,
            firmware_build=self.firmware_identity.build_hash,
            protocol_version=self.protocol_version,
            boot_id=self.boot_id,
            hardware_revision="ESP32-DevKitC-v4",
            capabilities=self.capabilities,
            uptime_ms=1000,
            hashed_serial_identifier=f"hash_{self.device_id}",
            last_seen=datetime.now(UTC).isoformat(),
        )

    def reboot(self) -> str:
        """Perform a simulated cold reboot of the microcontroller."""
        old_boot = self.boot_id
        self.boot_id = f"boot_{uuid.uuid4().hex[:8]}"
        self.connection_state = HardwareConnectionState.DISCONNECTED
        self.active_session_id = None
        self.sequence_tracker.reset()
        self.received_commands.clear()
        self.duplicate_commands.clear()
        self.rejected_commands.clear()
        logger.info(
            "ESP32 Protocol Emulator rebooted: old_boot=%s -> new_boot=%s",
            old_boot,
            self.boot_id,
        )
        return self.boot_id

    def negotiate(self, client_protocol_version: str, session_id: str) -> tuple[bool, str, str]:
        """Perform protocol handshake and connection negotiation."""
        if self._fault_disconnect:
            self.connection_state = HardwareConnectionState.DISCONNECTED
            return False, self.protocol_version, "Simulated hardware link disconnected"

        success, negotiated_version, reason = negotiate_protocol_version(
            client_protocol_version
        )
        if success:
            self.connection_state = HardwareConnectionState.READY
            self.active_session_id = session_id
            self.sequence_tracker.reset()
        else:
            self.connection_state = HardwareConnectionState.ERROR
        return success, negotiated_version, reason

    def process_incoming_frame(self, frame_bytes: bytes) -> CommandAck | CommandNack:
        """Process raw framed bytes, validate framing & semantics, and return typed response."""
        # Handle fault: disconnect
        if self._fault_disconnect or self.connection_state == HardwareConnectionState.DISCONNECTED:
            return create_nack(
                message_id="msg_err_disconnect",
                sequence_number=0,
                error_code="DISCONNECTED",
                reason="ESP32 hardware link is in DISCONNECTED state",
                retryable=True,
            )

        # Handle fault: reboot
        if self._fault_reboot:
            self._fault_reboot = False
            self.reboot()
            return create_nack(
                message_id="msg_err_reboot",
                sequence_number=0,
                error_code="DEVICE_REBOOT",
                reason="ESP32 endpoint performed a cold reboot",
                retryable=True,
            )

        # Handle fault: drop next frame
        if self._fault_drop_next:
            self._fault_drop_next = False
            logger.warning("Simulated fault: dropping incoming frame (%d bytes)", len(frame_bytes))
            return create_nack(
                message_id="msg_err_drop",
                sequence_number=0,
                error_code="FRAME_DROPPED",
                reason="Simulated hardware transport fault: frame dropped",
                retryable=True,
            )

        # Handle fault: delay
        if self._fault_delay_ms > 0:
            time.sleep(self._fault_delay_ms / 1000.0)

        # Corrupt frame if fault enabled
        if self._fault_corrupt_crc and len(frame_bytes) > 10:
            self._fault_corrupt_crc = False
            ba = bytearray(frame_bytes)
            ba[8] ^= 0xFF
            frame_bytes = bytes(ba)

        # 1. Unpack binary frame
        try:
            envelope, meta = unpack_frame(frame_bytes)
        except FrameDelimiterError as exc:
            return create_nack(
                message_id="msg_err_delim",
                sequence_number=0,
                error_code="DELIMITER_ERROR",
                reason=str(exc),
                retryable=False,
            )
        except FrameTruncatedError as exc:
            return create_nack(
                message_id="msg_err_trunc",
                sequence_number=0,
                error_code="FRAME_TRUNCATED",
                reason=str(exc),
                retryable=True,
            )
        except FrameChecksumMismatchError as exc:
            return create_nack(
                message_id="msg_err_crc",
                sequence_number=0,
                error_code="CHECKSUM_MISMATCH",
                reason=str(exc),
                retryable=True,
            )
        except FramePayloadSizeError as exc:
            return create_nack(
                message_id="msg_err_size",
                sequence_number=0,
                error_code="PAYLOAD_SIZE_EXCEEDED",
                reason=str(exc),
                retryable=False,
            )
        except FramingError as exc:
            return create_nack(
                message_id="msg_err_frame",
                sequence_number=0,
                error_code="FRAMING_ERROR",
                reason=str(exc),
                retryable=False,
            )
        except Exception as exc:
            return create_nack(
                message_id="msg_err_corrupt",
                sequence_number=0,
                error_code="CHECKSUM_MISMATCH",
                reason=f"Corrupted frame payload or checksum: {exc}",
                retryable=False,
            )

        # 2. Check session boundary
        if self.active_session_id and envelope.session_id and envelope.session_id != self.active_session_id:
            return create_nack(
                message_id=f"nack_{envelope.message_id}",
                command_id=envelope.command_id,
                sequence_number=envelope.sequence_number,
                error_code="SESSION_MISMATCH",
                reason=f"Envelope session {envelope.session_id} does not match active {self.active_session_id}",
                retryable=False,
            )

        # 3. Check sequence ordering & duplicates
        val_result = self.sequence_tracker.validate_incoming_rx(envelope.sequence_number)
        if not val_result.is_valid:
            if val_result.status == "DUPLICATE":
                # Check if this exact command was already received
                if envelope.command_id in self.received_commands:
                    self.duplicate_commands.append(envelope.command_id)
                    logger.info("Idempotent duplicate command %s received; returning COMMAND_DUPLICATE ACK", envelope.command_id)
                    return create_ack(
                        message_id=f"ack_dup_{envelope.message_id}",
                        command_id=envelope.command_id,
                        sequence_number=envelope.sequence_number,
                        status=CommandAckStatus.COMMAND_DUPLICATE,
                    )
            elif val_result.status == "GAP":
                return create_nack(
                    message_id=f"nack_seq_{envelope.message_id}",
                    command_id=envelope.command_id,
                    sequence_number=envelope.sequence_number,
                    error_code="SEQUENCE_GAP",
                    reason=f"Sequence gap detected: received {envelope.sequence_number}, expected {val_result.expected_sequence}",
                    retryable=True,
                )
            return create_nack(
                message_id=f"nack_seq_{envelope.message_id}",
                command_id=envelope.command_id,
                sequence_number=envelope.sequence_number,
                error_code=val_result.status,
                reason=f"Sequence validation failed: {val_result.status}",
                retryable=True,
            )
        self.sequence_tracker.record_rx(envelope.sequence_number)

        # 4. Check device-side authorization expiry
        now_dt = datetime.now(UTC)
        if self._fault_skew_seconds != 0.0:
            now_dt = datetime.fromtimestamp(now_dt.timestamp() + self._fault_skew_seconds, tz=UTC)

        expires_at_dt = datetime.fromisoformat(envelope.expires_at)
        if expires_at_dt.tzinfo is None:
            expires_at_dt = expires_at_dt.replace(tzinfo=UTC)

        if now_dt >= expires_at_dt:
            self.rejected_commands.append({
                "command_id": envelope.command_id,
                "reason": "EXPIRED_AUTHORIZATION",
                "timestamp": now_dt.isoformat(),
            })
            return create_nack(
                message_id=f"nack_exp_{envelope.message_id}",
                command_id=envelope.command_id,
                sequence_number=envelope.sequence_number,
                error_code="EXPIRED_AUTHORIZATION",
                reason=f"Authorization expired at {envelope.expires_at}",
                retryable=False,
            )

        # 5. Handle fault: drop ACK
        if self._fault_drop_ack:
            self._fault_drop_ack = False
            self.received_commands[envelope.command_id] = envelope
            logger.warning("Simulated fault: dropping outgoing ACK for command %s", envelope.command_id)
            return create_nack(
                message_id=f"nack_dropack_{envelope.message_id}",
                command_id=envelope.command_id,
                sequence_number=envelope.sequence_number,
                error_code="ACK_DROPPED",
                reason="Simulated hardware transport fault: ACK dropped",
                retryable=True,
            )

        # 6. Execute simulated command
        self.received_commands[envelope.command_id] = envelope
        ack_status = CommandAckStatus.COMMAND_ACCEPTED
        if envelope.payload and envelope.payload.intent_class in ("STOP", "SAFE_STOP"):
            logger.info("ESP32 Emulator SAFE_STOP executed: halting simulated subsystems")
        elif envelope.payload and envelope.payload.intent_class == "CANCEL_INTENT":
            logger.info("ESP32 Emulator CANCEL_INTENT executed: clearing pending command %s", envelope.command_id)

        return create_ack(
            message_id=f"ack_{envelope.message_id}",
            command_id=envelope.command_id,
            sequence_number=envelope.sequence_number,
            status=ack_status,
        )

    def process_incoming_frame_to_bytes(self, frame_bytes: bytes) -> bytes:
        """Process incoming frame and serialize the ACK/NACK response to wire bytes."""
        response = self.process_incoming_frame(frame_bytes)
        # Construct envelope for ACK/NACK
        meta_checksum = compute_crc32(response.model_dump_json().encode("utf-8"))
        # Frame ACK payload directly using pack_frame
        envelope = CommandEnvelope(
            message_id=response.message_id,
            command_id=response.command_id or "cmd_ack",
            sequence_number=response.sequence_number,
            message_type=MessageType.ACK if isinstance(response, CommandAck) else MessageType.NACK,
            checksum=meta_checksum,
            payload=response.model_dump(),
        )
        return pack_frame(envelope)

    def process_heartbeat_ping(self) -> float:
        """Process heartbeat ping, verify health, and return RTT."""
        if self._fault_disconnect or self.connection_state == HardwareConnectionState.DISCONNECTED:
            raise ConnectionError("ESP32 hardware link is disconnected")
        return 2.5
