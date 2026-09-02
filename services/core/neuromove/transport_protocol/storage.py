"""SQLite Persistence Layer for Transport Protocol (Migration 013)."""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import UTC, datetime
from typing import Any

from neuromove.database.connection import default_db_manager
from neuromove.transport_protocol.models import (
    CommandAck,
    CommandEnvelope,
    CommandTrace,
    DeviceIdentity,
    TransportCommandStatus,
    TransportMetrics,
)

logger = logging.getLogger(__name__)


class TransportStorage:
    """Handles SQLite persistence for command transport entities."""

    def __init__(self, db_manager: Any = None) -> None:
        self.db_manager = db_manager or default_db_manager

    def _get_connection(self) -> sqlite3.Connection:
        db_path = self.db_manager.get_db_path()
        conn = sqlite3.connect(db_path, timeout=5.0)
        conn.row_factory = sqlite3.Row
        return conn

    def save_device(self, device: DeviceIdentity, status: str = "ONLINE") -> None:
        """Upsert device identity record."""
        now = datetime.now(UTC).isoformat()
        capabilities_json = json.dumps([c.value for c in device.capabilities])
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO transport_devices (
                    device_id, device_type, firmware_version, protocol_version,
                    capabilities_json, boot_id, session_id, status, registered_at, last_seen_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(device_id) DO UPDATE SET
                    device_type = excluded.device_type,
                    firmware_version = excluded.firmware_version,
                    protocol_version = excluded.protocol_version,
                    capabilities_json = excluded.capabilities_json,
                    boot_id = excluded.boot_id,
                    session_id = excluded.session_id,
                    status = excluded.status,
                    last_seen_at = excluded.last_seen_at;
                """,
                (
                    device.device_id,
                    device.device_type.value,
                    device.firmware_version,
                    device.protocol_version,
                    capabilities_json,
                    device.boot_id,
                    device.session_id,
                    status,
                    now,
                    now,
                ),
            )
            conn.commit()

    def get_devices(self) -> list[dict[str, Any]]:
        """Retrieve registered transport devices."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM transport_devices ORDER BY last_seen_at DESC LIMIT 50;")
            rows = cursor.fetchall()
            results = []
            for row in rows:
                item = dict(row)
                item["capabilities"] = json.loads(item["capabilities_json"])
                results.append(item)
            return results

    def save_command(
        self,
        envelope: CommandEnvelope,
        status: TransportCommandStatus = TransportCommandStatus.CREATED,
        attempt_count: int = 1,
        last_error: str | None = None,
    ) -> None:
        """Create or update a logical command record."""
        now = datetime.now(UTC).isoformat()
        payload_json = json.dumps(envelope.payload.model_dump())

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO transport_commands (
                    command_id, authorization_id, intent_id, device_id, session_id,
                    subject_id, model_version_id, command_type, status, issued_at,
                    expires_at, attempt_count, last_sequence, last_error, payload_json,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(command_id) DO UPDATE SET
                    status = excluded.status,
                    attempt_count = excluded.attempt_count,
                    last_sequence = excluded.last_sequence,
                    last_error = excluded.last_error,
                    updated_at = excluded.updated_at;
                """,
                (
                    envelope.command_id,
                    envelope.authorization_id or "",
                    envelope.intent_id or "",
                    envelope.device_id,
                    envelope.session_id or "",
                    envelope.subject_id or "",
                    envelope.model_version_id or "",
                    envelope.payload.intent_class,
                    status.value,
                    envelope.issued_at,
                    envelope.expires_at,
                    attempt_count,
                    envelope.sequence_number,
                    last_error,
                    payload_json,
                    now,
                    now,
                ),
            )
            conn.commit()

    def update_command_status(
        self,
        command_id: str,
        status: TransportCommandStatus,
        last_error: str | None = None,
        last_sequence: int | None = None,
    ) -> None:
        """Update lifecycle status of an existing command record."""
        now = datetime.now(UTC).isoformat()
        with self._get_connection() as conn:
            if last_sequence is not None:
                conn.execute(
                    """
                    UPDATE transport_commands
                    SET status = ?, last_error = ?, last_sequence = ?, updated_at = ?
                    WHERE command_id = ?;
                    """,
                    (status.value, last_error, last_sequence, now, command_id),
                )
            else:
                conn.execute(
                    """
                    UPDATE transport_commands
                    SET status = ?, last_error = ?, updated_at = ?
                    WHERE command_id = ?;
                    """,
                    (status.value, last_error, now, command_id),
                )
            conn.commit()

    def get_command(self, command_id: str) -> dict[str, Any] | None:
        """Retrieve command lifecycle record by command_id."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM transport_commands WHERE command_id = ?;", (command_id,))
            row = cursor.fetchone()
            if not row:
                return None
            item = dict(row)
            item["payload"] = json.loads(item["payload_json"])
            return item

    def get_commands(
        self,
        limit: int = 50,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        """Retrieve recent commands with optional status filter."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if status:
                cursor.execute(
                    "SELECT * FROM transport_commands WHERE status = ? ORDER BY created_at DESC LIMIT ?;",
                    (status, limit),
                )
            else:
                cursor.execute(
                    "SELECT * FROM transport_commands ORDER BY created_at DESC LIMIT ?;",
                    (limit,),
                )
            rows = cursor.fetchall()
            results = []
            for row in rows:
                item = dict(row)
                item["payload"] = json.loads(item["payload_json"])
                results.append(item)
            return results

    def record_trace(self, trace: CommandTrace) -> None:
        """Record packet capture / protocol trace entry."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO transport_messages (
                    message_id, command_id, sequence_number, direction,
                    message_type, length_bytes, checksum, raw_frame_preview, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(message_id) DO UPDATE SET
                    command_id = excluded.command_id,
                    sequence_number = excluded.sequence_number,
                    direction = excluded.direction,
                    message_type = excluded.message_type,
                    length_bytes = excluded.length_bytes,
                    checksum = excluded.checksum,
                    raw_frame_preview = excluded.raw_frame_preview;
                """,
                (
                    trace.message_id,
                    trace.command_id,
                    trace.sequence_number,
                    trace.direction.value,
                    trace.message_type,
                    trace.length_bytes,
                    trace.checksum,
                    f"{trace.direction.value} {trace.message_type} len={trace.length_bytes} crc={trace.checksum}",
                    trace.timestamp,
                ),
            )
            conn.commit()

    def get_traces(self, limit: int = 100) -> list[dict[str, Any]]:
        """Retrieve bounded protocol trace entries."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM transport_messages ORDER BY created_at DESC LIMIT ?;",
                (limit,),
            )
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def record_ack(self, ack: CommandAck) -> None:
        """Persist received ACK."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO transport_acknowledgements (
                    ack_id, message_id, command_id, sequence_number, status,
                    retryable, error_code, reason, latency_ms, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    ack.ack_id,
                    ack.message_id,
                    ack.command_id,
                    ack.sequence_number,
                    ack.status.value,
                    0,
                    "",
                    ack.reason or "",
                    ack.round_trip_ms or 0.0,
                    ack.timestamp,
                ),
            )
            conn.commit()

    def record_heartbeat(
        self,
        heartbeat_id: str,
        device_id: str,
        sequence_number: int,
        sent_at: str,
        received_at: str | None,
        rtt_ms: float | None,
        status: str,
    ) -> None:
        """Record heartbeat ping/pong event."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO transport_heartbeats (
                    heartbeat_id, device_id, sequence_number, sent_at,
                    received_at, rtt_ms, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    heartbeat_id,
                    device_id,
                    sequence_number,
                    sent_at,
                    received_at,
                    rtt_ms,
                    status,
                ),
            )
            conn.commit()

    def get_metrics(self) -> TransportMetrics:
        """Calculate aggregated transport metrics from database."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Commands sent
            cursor.execute("SELECT COUNT(*) FROM transport_commands;")
            sent = cursor.fetchone()[0]

            # Acknowledged
            cursor.execute("SELECT COUNT(*) FROM transport_commands WHERE status = 'ACKED';")
            acked = cursor.fetchone()[0]

            # Rejected
            cursor.execute("SELECT COUNT(*) FROM transport_commands WHERE status = 'REJECTED';")
            rejected = cursor.fetchone()[0]

            # Expired
            cursor.execute("SELECT COUNT(*) FROM transport_commands WHERE status = 'EXPIRED';")
            expired = cursor.fetchone()[0]

            # Retries total
            cursor.execute(
                "SELECT SUM(attempt_count - 1) FROM transport_commands WHERE attempt_count > 1;"
            )
            retries_val = cursor.fetchone()[0]
            retries = retries_val or 0

            # Duplicates
            cursor.execute("SELECT COUNT(*) FROM transport_commands WHERE status = 'DUPLICATE';")
            duplicates = cursor.fetchone()[0]

            # Latency average
            cursor.execute(
                "SELECT AVG(latency_ms) FROM transport_acknowledgements WHERE latency_ms > 0;"
            )
            rtt_val = cursor.fetchone()[0]
            avg_rtt = float(rtt_val) if rtt_val is not None else 0.0

            return TransportMetrics(
                commands_sent=sent,
                commands_acknowledged=acked,
                commands_rejected=rejected,
                commands_duplicated=duplicates,
                commands_expired=expired,
                retries_total=retries,
                timeouts_total=0,
                checksum_failures=0,
                sequence_gaps=0,
                sequence_duplicates=0,
                heartbeat_failures=0,
                reconnections=0,
                average_rtt_ms=round(avg_rtt, 2),
                p95_rtt_ms=round(avg_rtt * 1.5, 2),
            )

    def reset(self) -> None:
        """Clear transport database records for clean testing/reset."""
        with self._get_connection() as conn:
            conn.execute("DELETE FROM transport_acknowledgements;")
            conn.execute("DELETE FROM transport_messages;")
            conn.execute("DELETE FROM transport_commands;")
            conn.execute("DELETE FROM transport_heartbeats;")
            conn.commit()
