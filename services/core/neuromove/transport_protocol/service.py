"""Authoritative Transport Protocol Service (Phase 19).

Coordinates safety authorization validation, framing, sequencing, retries,
heartbeat, persistence, and WebSocket telemetry broadcasting.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from neuromove.domain.enums import EventType
from neuromove.events.envelope import EventEnvelope
from neuromove.transport.models import TransportStream
from neuromove.transport.stream_router import stream_router
from neuromove.transport_protocol.adapters import SimulatedEsp32Adapter, TransportAdapter
from neuromove.transport_protocol.commands import (
    create_cancel_command,
    create_command_envelope,
    validate_authorization,
)
from neuromove.transport_protocol.framing import pack_frame
from neuromove.transport_protocol.heartbeat import HeartbeatMonitor
from neuromove.transport_protocol.models import (
    CommandAck,
    CommandAckStatus,
    CommandNack,
    CommandTrace,
    CommandTraceDecodeStatus,
    CommandTraceDirection,
    ExecutionAuthorization,
    RetryPolicy,
    TransportCommandStatus,
    TransportConnectionState,
    TransportLabStatus,
)
from neuromove.transport_protocol.protocol import PROTOCOL_VERSION
from neuromove.transport_protocol.reliability import RetryManager
from neuromove.transport_protocol.scenarios import ScenarioRegistry
from neuromove.transport_protocol.sequence import SequenceTracker
from neuromove.transport_protocol.storage import TransportStorage

logger = logging.getLogger(__name__)


class TransportProtocolService:
    """Authoritative singleton managing protocol transport and simulated ESP32 communication."""

    def __init__(
        self,
        adapter: TransportAdapter | None = None,
        storage: TransportStorage | None = None,
        retry_policy: RetryPolicy | None = None,
    ) -> None:
        self.adapter = adapter or SimulatedEsp32Adapter()
        self.storage = storage or TransportStorage()
        self.retry_manager = RetryManager(policy=retry_policy)
        self.sequence_tracker = SequenceTracker()
        self.heartbeat_monitor = HeartbeatMonitor()
        self.scenario_registry = ScenarioRegistry(service=self)

        self.session_id: str = "sess-01"
        self.active_commands_count: int = 0

        # Auto-connect and negotiate default simulated link
        self._initialize_connection()

    def _initialize_connection(self) -> None:
        """Establish initial connection and handshake with adapter."""
        try:
            self.adapter.connect()
            compat, ver, reason = self.adapter.negotiate(PROTOCOL_VERSION, self.session_id)
            if compat:
                self.heartbeat_monitor.set_connection_state(TransportConnectionState.CONNECTED)
                self.storage.save_device(self.adapter.identity(), status="ONLINE")
                logger.info(
                    "TransportProtocolService connected to %s", self.adapter.identity().device_id
                )
            else:
                self.heartbeat_monitor.set_connection_state(TransportConnectionState.DISCONNECTED)
                logger.warning("Initial protocol negotiation failed: %s", reason)
        except Exception as exc:
            logger.error("Failed to initialize transport adapter: %s", exc)
            self.heartbeat_monitor.set_connection_state(TransportConnectionState.DISCONNECTED)

    @property
    def connection_state(self) -> TransportConnectionState:
        return self.heartbeat_monitor.get_status().link_state

    def get_status(self) -> TransportLabStatus:
        """Return authoritative status snapshot of transport layer."""
        device_id_obj = self.adapter.identity()
        metrics = self.storage.get_metrics()
        heartbeat = self.heartbeat_monitor.get_status()

        return TransportLabStatus(
            connection_state=self.connection_state,
            device=device_id_obj,
            negotiated_capabilities=self.adapter.capabilities(),
            heartbeat=heartbeat,
            metrics=metrics,
            active_commands_count=self.active_commands_count,
            simulated_mode=True,
            updated_at=datetime.now(UTC).isoformat(),
        )

    def negotiate(
        self,
        client_version: str = PROTOCOL_VERSION,
        session_id: str = "sess-01",
    ) -> tuple[bool, str, str]:
        """Perform 3-way protocol negotiation with the endpoint."""
        self.session_id = session_id
        self.heartbeat_monitor.set_connection_state(TransportConnectionState.NEGOTIATING)
        self._broadcast_event(
            EventType.TRANSPORT_NEGOTIATING, {"session_id": session_id, "version": client_version}
        )

        compat, ver, reason = self.adapter.negotiate(client_version, session_id)
        if compat:
            self.sequence_tracker.reset(baseline=0)
            self.heartbeat_monitor.set_connection_state(TransportConnectionState.CONNECTED)
            self.storage.save_device(self.adapter.identity(), status="ONLINE")
            self._broadcast_event(
                EventType.TRANSPORT_NEGOTIATED,
                {
                    "session_id": session_id,
                    "version": ver,
                    "device_id": self.adapter.identity().device_id,
                },
            )
            return True, ver, reason

        self.heartbeat_monitor.set_connection_state(TransportConnectionState.DISCONNECTED)
        self._broadcast_event(EventType.TRANSPORT_DISCONNECTED, {"reason": reason})
        return False, "", reason

    def reconnect(self) -> bool:
        """Tear down and cleanly re-establish link with simulated endpoint."""
        self.adapter.disconnect()
        self.heartbeat_monitor.reset()
        self._initialize_connection()
        return self.connection_state == TransportConnectionState.CONNECTED

    def disconnect(self) -> None:
        """Disconnect transport link."""
        self.adapter.disconnect()
        self.heartbeat_monitor.set_connection_state(TransportConnectionState.DISCONNECTED)
        self._broadcast_event(
            EventType.TRANSPORT_DISCONNECTED, {"reason": "Explicit operator disconnect"}
        )

    def validate_command_authorization(
        self,
        auth: ExecutionAuthorization,
    ) -> tuple[bool, str, str]:
        """Validate an upstream Phase 17 ExecutionAuthorization."""
        return validate_authorization(auth)

    def send_authorized_command(
        self,
        auth: ExecutionAuthorization,
        forced_command_id: str | None = None,
        forced_sequence: int | None = None,
        corrupt_crc: bool = False,
    ) -> dict[str, Any]:
        """Validate upstream authorization, build frame, transmit, and process ACK/NACK."""
        now = datetime.now(UTC)

        # 1. UPSTREAM SAFETY GATE VALIDATION
        # An invalid or non-AUTHORIZED decision guarantees ZERO frame transmissions!
        is_valid, reason_code, message = validate_authorization(auth, current_time=now)
        if not is_valid:
            logger.warning("Rejected command transmission: %s (%s)", message, reason_code)
            self._broadcast_event(
                EventType.TRANSPORT_COMMAND_REJECTED,
                {"reason_code": reason_code, "message": message, "decision": auth.decision.value},
            )
            return {
                "transmitted": False,
                "status": "REJECTED",
                "reason_code": reason_code,
                "message": message,
                "command_id": None,
                "timestamp": now.isoformat(),
            }

        # 2. Check transport link health
        if not self.heartbeat_monitor.is_link_healthy():
            logger.warning(
                "Refused command transmission: Transport link is %s", self.connection_state.value
            )
            return {
                "transmitted": False,
                "status": "TRANSPORT_UNAVAILABLE",
                "reason_code": "LINK_NOT_CONNECTED",
                "message": f"Transport link is {self.connection_state.value}",
                "command_id": None,
                "timestamp": now.isoformat(),
            }

        # 3. Monotonic sequence allocation
        seq = (
            forced_sequence
            if forced_sequence is not None
            else self.sequence_tracker.allocate_next_tx()
        )

        # 4. Construct CommandEnvelope
        envelope = create_command_envelope(
            auth=auth,
            device_id=self.adapter.identity().device_id,
            sequence_number=seq,
            command_id=forced_command_id,
            current_time=now,
        )

        # Save initial command state in database
        self.storage.save_command(
            envelope,
            status=TransportCommandStatus.CREATED,
            attempt_count=1,
        )
        self._broadcast_event(
            EventType.TRANSPORT_COMMAND_CREATED,
            {"command_id": envelope.command_id, "sequence": seq, "intent": auth.intent_class},
        )

        # 5. Pack Frame
        frame_bytes = pack_frame(envelope)

        # Simulated fault injection: CRC corruption
        if corrupt_crc:
            # Modify single byte in payload
            frame_list = bytearray(frame_bytes)
            frame_list[15] = (frame_list[15] + 1) % 256
            frame_bytes = bytes(frame_list)

        # Record outgoing TX trace
        tx_trace = CommandTrace(
            trace_id=f"tr_{uuid.uuid4().hex[:8]}",
            timestamp=now.isoformat(),
            direction=CommandTraceDirection.TX,
            device_id=envelope.device_id,
            message_id=envelope.message_id,
            command_id=envelope.command_id,
            sequence_number=seq,
            message_type="COMMAND",
            length_bytes=len(frame_bytes),
            checksum=envelope.checksum or "N/A",
            decode_status=CommandTraceDecodeStatus.VALID,
        )
        self.storage.record_trace(tx_trace)
        self._broadcast_event(
            EventType.TRANSPORT_COMMAND_SENT,
            {"command_id": envelope.command_id, "sequence": seq, "bytes": len(frame_bytes)},
        )

        # 6. Transmit & Handle Retries
        attempt = 1
        start_time = time.perf_counter()
        ack_or_nack = self.adapter.send_frame(frame_bytes)
        rtt_ms = (time.perf_counter() - start_time) * 1000.0

        while isinstance(ack_or_nack, CommandNack) and self.retry_manager.should_retry(
            envelope, attempt, ack_or_nack.error_code
        ):
            attempt += 1
            delay_ms = self.retry_manager.calculate_delay_ms(attempt)
            logger.info(
                "Retrying command %s (attempt %d/%d) after %.1fms due to %s",
                envelope.command_id,
                attempt,
                self.retry_manager.policy.max_attempts,
                delay_ms,
                ack_or_nack.error_code,
            )
            time.sleep(delay_ms / 1000.0)

            # Fresh message_id for transmission, but SAME command_id and sequence_number!
            new_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
            envelope = self.retry_manager.prepare_retry_envelope(envelope, new_msg_id)
            frame_bytes = pack_frame(envelope)

            self.storage.update_command_status(
                envelope.command_id,
                status=TransportCommandStatus.RETRYING,
                last_error=ack_or_nack.reason,
                last_sequence=envelope.sequence_number,
            )
            self._broadcast_event(
                EventType.TRANSPORT_COMMAND_RETRIED,
                {
                    "command_id": envelope.command_id,
                    "attempt": attempt,
                    "sequence": envelope.sequence_number,
                },
            )

            start_time = time.perf_counter()
            ack_or_nack = self.adapter.send_frame(frame_bytes)
            rtt_ms = (time.perf_counter() - start_time) * 1000.0

        # 7. Evaluate Final Result
        if isinstance(ack_or_nack, CommandAck):
            status = (
                TransportCommandStatus.ACKED
                if ack_or_nack.status
                in (CommandAckStatus.COMMAND_ACCEPTED, CommandAckStatus.COMMAND_DUPLICATE)
                else TransportCommandStatus.REJECTED
            )

            self.storage.update_command_status(
                envelope.command_id,
                status=status,
                last_error=ack_or_nack.reason,
                last_sequence=envelope.sequence_number,
            )
            self.storage.record_ack(ack_or_nack)

            # Record incoming RX trace
            rx_trace = CommandTrace(
                trace_id=f"tr_{uuid.uuid4().hex[:8]}",
                timestamp=datetime.now(UTC).isoformat(),
                direction=CommandTraceDirection.RX,
                device_id=envelope.device_id,
                message_id=f"rx_{ack_or_nack.message_id}_{uuid.uuid4().hex[:6]}",
                command_id=ack_or_nack.command_id,
                sequence_number=ack_or_nack.sequence_number,
                message_type="ACK",
                length_bytes=len(str(ack_or_nack.model_dump())),
                checksum="N/A",
                decode_status=CommandTraceDecodeStatus.VALID,
                ack_status=ack_or_nack.status.value,
                latency_ms=rtt_ms,
            )
            self.storage.record_trace(rx_trace)
            self._broadcast_event(
                EventType.TRANSPORT_COMMAND_ACKED,
                {
                    "command_id": envelope.command_id,
                    "status": ack_or_nack.status.value,
                    "rtt_ms": rtt_ms,
                    "attempt_count": attempt,
                },
            )

            return {
                "transmitted": True,
                "status": status.value,
                "command_id": envelope.command_id,
                "sequence_number": envelope.sequence_number,
                "ack_status": ack_or_nack.status.value,
                "reason": ack_or_nack.reason,
                "attempt_count": attempt,
                "rtt_ms": round(rtt_ms, 2),
                "timestamp": datetime.now(UTC).isoformat(),
            }
        else:
            # NACK or failed retries
            self.storage.update_command_status(
                envelope.command_id,
                status=TransportCommandStatus.FAILED,
                last_error=ack_or_nack.reason,
                last_sequence=envelope.sequence_number,
            )
            self._broadcast_event(
                EventType.TRANSPORT_COMMAND_REJECTED,
                {
                    "command_id": envelope.command_id,
                    "error_code": ack_or_nack.error_code,
                    "reason": ack_or_nack.reason,
                },
            )
            return {
                "transmitted": True,
                "status": "REJECTED",
                "command_id": envelope.command_id,
                "sequence_number": envelope.sequence_number,
                "error": f"{ack_or_nack.error_code}: {ack_or_nack.reason}",
                "attempt_count": attempt,
                "timestamp": datetime.now(UTC).isoformat(),
            }

    def ping_heartbeat(self) -> dict[str, Any]:
        """Dispatch periodic heartbeat ping and update monitor."""
        self.heartbeat_monitor.record_ping_sent()
        try:
            rtt_ms = self.adapter.ping()
            self.heartbeat_monitor.record_pong_received()
            self.storage.record_heartbeat(
                heartbeat_id=f"hb_{uuid.uuid4().hex[:8]}",
                device_id=self.adapter.identity().device_id,
                sequence_number=self.sequence_tracker.get_current_tx(),
                sent_at=datetime.now(UTC).isoformat(),
                received_at=datetime.now(UTC).isoformat(),
                rtt_ms=rtt_ms,
                status="HEALTHY",
            )
            self._broadcast_event(
                EventType.TRANSPORT_HEARTBEAT, {"status": "HEALTHY", "rtt_ms": rtt_ms}
            )
            return {"status": "HEALTHY", "rtt_ms": round(rtt_ms, 2)}
        except Exception as exc:
            state = self.heartbeat_monitor.record_missed_heartbeat()
            self._broadcast_event(
                EventType.TRANSPORT_DEGRADED, {"state": state.value, "error": str(exc)}
            )
            return {"status": state.value, "error": str(exc)}

    def cancel_command(self, command_id: str) -> dict[str, Any]:
        """Request cancellation of an in-flight command."""
        cmd = self.storage.get_command(command_id)
        if not cmd:
            return {"success": False, "error": f"Command '{command_id}' not found"}

        seq = self.sequence_tracker.allocate_next_tx()
        cancel_env = create_cancel_command(
            device_id=self.adapter.identity().device_id,
            sequence_number=seq,
            target_command_id=command_id,
            target_intent_id=cmd.get("intent_id", ""),
        )
        frame = pack_frame(cancel_env)
        ack = self.adapter.send_frame(frame)

        self.storage.update_command_status(command_id, status=TransportCommandStatus.CANCELLED)
        return {"success": True, "command_id": command_id, "ack": ack.model_dump()}

    def reset_simulation(self) -> None:
        """Reset the transport simulator and clear storage."""
        self.adapter.disconnect()
        if hasattr(self.adapter, "simulator"):
            self.adapter.simulator.clear_faults()
            self.adapter.simulator.reboot()
        self.sequence_tracker.reset(baseline=0)
        self.heartbeat_monitor.reset()
        self.storage.reset()
        self._initialize_connection()
        logger.info("Transport laboratory reset to clean initial baseline")

    def _broadcast_event(self, event_type: EventType, details: dict[str, Any]) -> None:
        """Broadcast real-time transport event over WebSocket."""
        try:
            envelope = EventEnvelope(
                stream=TransportStream.TRANSPORT,
                event_type=event_type,
                payload=details,
                session_id=self.session_id,
                timestamp=datetime.now(UTC),
            )
            stream_router.broadcast(TransportStream.TRANSPORT, envelope.model_dump(mode="json"))
        except Exception as exc:
            logger.debug("Failed to broadcast transport event: %s", exc)


default_transport_service = TransportProtocolService()
