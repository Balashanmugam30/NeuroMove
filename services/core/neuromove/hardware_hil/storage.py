"""SQLite Persistence layer for Migration 014 Hardware-in-the-Loop records."""

from __future__ import annotations

import json
import logging
from typing import Any

from neuromove.database.connection import DatabaseManager
from neuromove.hardware_hil.models import (
    Esp32DeviceInfo,
    HardwareDiagnostic,
    HardwareSession,
    HILExperiment,
)

logger = logging.getLogger(__name__)


class HardwareHilStorage:
    """Persistence interface for hardware devices, sessions, events, and HIL experiments."""

    def __init__(self, db_manager: DatabaseManager | None = None) -> None:
        self.db = db_manager or DatabaseManager()

    def record_device(self, device: Esp32DeviceInfo) -> None:
        """Upsert a discovered/registered hardware device."""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO hardware_devices (
                        device_id, device_mode, friendly_name, manufacturer,
                        hardware_revision, firmware_version, protocol_version,
                        capabilities_json, hashed_serial_identifier, last_seen, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(device_id) DO UPDATE SET
                        device_mode = excluded.device_mode,
                        firmware_version = excluded.firmware_version,
                        protocol_version = excluded.protocol_version,
                        capabilities_json = excluded.capabilities_json,
                        last_seen = excluded.last_seen,
                        status = excluded.status;
                    """,
                    (
                        device.device_id,
                        device.device_mode,
                        f"ESP32 ({device.device_mode})",
                        "Espressif / NeuroMove",
                        device.hardware_revision,
                        device.firmware_version,
                        device.protocol_version,
                        json.dumps([str(c) for c in device.capabilities]),
                        device.hashed_serial_identifier,
                        device.last_seen,
                        "ACTIVE",
                    ),
                )
                conn.commit()
        except Exception as exc:
            logger.error("Failed to record hardware device %s: %s", device.device_id, exc)

    def list_devices(self) -> list[dict[str, Any]]:
        """List all registered hardware devices."""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM hardware_devices ORDER BY last_seen DESC;")
                rows = cursor.fetchall()
                return [dict(r) for r in rows]
        except Exception as exc:
            logger.error("Failed to list hardware devices: %s", exc)
            return []

    def record_session(self, session: HardwareSession) -> None:
        """Record an active hardware connection session."""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO hardware_sessions (
                        session_id, device_id, boot_id, device_mode,
                        protocol_version, firmware_version, connected_at,
                        disconnected_at, status, sequence_base
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(session_id) DO UPDATE SET
                        disconnected_at = excluded.disconnected_at,
                        status = excluded.status;
                    """,
                    (
                        session.session_id,
                        session.device_id,
                        session.boot_id,
                        session.device_mode,
                        session.protocol_version,
                        session.firmware_version,
                        session.connected_at,
                        session.disconnected_at,
                        session.status,
                        session.sequence_base,
                    ),
                )
                conn.commit()
        except Exception as exc:
            logger.error("Failed to record hardware session %s: %s", session.session_id, exc)

    def record_connection_event(
        self,
        event_id: str,
        device_id: str,
        from_state: str,
        to_state: str,
        timestamp: str,
        session_id: str | None = None,
        reason: str | None = None,
    ) -> None:
        """Record a connection state transition event."""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO hardware_connection_events (
                        event_id, session_id, device_id, from_state, to_state, reason, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?);
                    """,
                    (event_id, session_id, device_id, from_state, to_state, reason, timestamp),
                )
                conn.commit()
        except Exception as exc:
            logger.error("Failed to record connection event %s: %s", event_id, exc)

    def record_diagnostic(self, diag: HardwareDiagnostic) -> None:
        """Persist a diagnostic entry."""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO hardware_diagnostics (
                        diag_id, device_id, session_id, category, severity, message, timestamp, details_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        diag.diag_id,
                        diag.device_id,
                        diag.session_id,
                        diag.category,
                        diag.severity,
                        diag.message,
                        diag.timestamp,
                        json.dumps(diag.details),
                    ),
                )
                conn.commit()
        except Exception as exc:
            logger.error("Failed to record diagnostic %s: %s", diag.diag_id, exc)

    def list_diagnostics(self, limit: int = 50) -> list[dict[str, Any]]:
        """Retrieve recent diagnostic events."""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM hardware_diagnostics ORDER BY timestamp DESC LIMIT ?;",
                    (limit,),
                )
                rows = cursor.fetchall()
                return [dict(r) for r in rows]
        except Exception as exc:
            logger.error("Failed to list diagnostics: %s", exc)
            return []

    def record_experiment(self, exp: HILExperiment) -> None:
        """Persist an executed HIL experiment."""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO hardware_hil_experiments (
                        experiment_id, scenario_id, name, device_mode, device_id,
                        firmware_version, protocol_version, seed, manifest_hash,
                        passed, verdict, started_at, completed_at, details_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(experiment_id) DO UPDATE SET
                        passed = excluded.passed,
                        verdict = excluded.verdict,
                        completed_at = excluded.completed_at;
                    """,
                    (
                        exp.experiment_id,
                        exp.scenario_id,
                        exp.name,
                        exp.device_mode,
                        exp.device_id,
                        exp.firmware_version,
                        exp.protocol_version,
                        exp.seed,
                        exp.manifest_hash,
                        1 if exp.passed else 0,
                        exp.verdict,
                        exp.started_at,
                        exp.completed_at,
                        json.dumps(exp.details),
                    ),
                )
                conn.commit()
        except Exception as exc:
            logger.error("Failed to record HIL experiment %s: %s", exp.experiment_id, exc)

    def list_experiments(self, limit: int = 50) -> list[dict[str, Any]]:
        """List historical HIL experiments."""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM hardware_hil_experiments ORDER BY started_at DESC LIMIT ?;",
                    (limit,),
                )
                rows = cursor.fetchall()
                return [dict(r) for r in rows]
        except Exception as exc:
            logger.error("Failed to list experiments: %s", exc)
            return []
