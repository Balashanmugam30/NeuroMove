"""NeuroMove — Phase 21 Acquisition Persistence & Storage Layer."""

from __future__ import annotations

import json
import logging
import sqlite3

from neuromove.database.connection import default_db_manager
from neuromove.eeg_acquisition.models import (
    EegAcquisitionDiagnostic,
    EegAcquisitionSession,
    EegDeviceDescriptor,
    EegE2EExperiment,
)

logger = logging.getLogger(__name__)


class EegAcquisitionStorage:
    """SQLite persistence layer for EEG acquisition sessions, diagnostics, and experiments."""

    def __init__(self, db_manager=default_db_manager):
        self.db_manager = db_manager
        try:
            self.db_manager.initialize_db()
        except Exception as exc:
            logger.debug("Database initialization notice in storage: %s", exc)

    def record_device(self, device: EegDeviceDescriptor) -> None:
        """Persist or update device metadata."""
        try:
            with sqlite3.connect(self.db_manager.get_db_path()) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO eeg_acquisition_devices (
                        device_id, name, source_type, vendor, model, firmware_version,
                        protocol, channel_count, supported_sampling_rates_json, default_sampling_rate,
                        adc_resolution_bits, is_available, is_connected, connection_path, last_seen
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
                    """,
                    (
                        device.device_id,
                        device.name,
                        device.source_type.value
                        if hasattr(device.source_type, "value")
                        else str(device.source_type),
                        device.vendor,
                        device.model,
                        device.firmware_version,
                        device.protocol,
                        device.channel_count,
                        json.dumps(device.supported_sampling_rates),
                        device.default_sampling_rate,
                        device.adc_resolution_bits,
                        1 if device.is_available else 0,
                        1 if device.is_connected else 0,
                        device.connection_path,
                    ),
                )
                conn.commit()
        except Exception as exc:
            logger.warning("Failed to record EEG acquisition device: %s", exc)

    def record_session(self, session: EegAcquisitionSession) -> None:
        """Persist acquisition session."""
        try:
            with sqlite3.connect(self.db_manager.get_db_path()) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO eeg_acquisition_sessions (
                        session_id, subject_id, source_type, device_id, state,
                        sampling_rate, channel_count, channel_names_json, started_at,
                        stopped_at, config_hash, provenance_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        session.session_id,
                        session.subject_id,
                        session.source_type.value
                        if hasattr(session.source_type, "value")
                        else str(session.source_type),
                        session.device_id,
                        session.state.value
                        if hasattr(session.state, "value")
                        else str(session.state),
                        session.sampling_rate,
                        session.channel_count,
                        json.dumps(session.channel_names),
                        session.started_at,
                        session.stopped_at,
                        session.config_hash,
                        session.provenance_hash,
                    ),
                )
                conn.commit()
        except Exception as exc:
            logger.warning("Failed to record EEG acquisition session: %s", exc)

    def record_diagnostic(self, diagnostic: EegAcquisitionDiagnostic) -> None:
        """Persist a diagnostic event."""
        try:
            with sqlite3.connect(self.db_manager.get_db_path()) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO eeg_acquisition_diagnostics (
                        diag_id, session_id, category, severity, code, message, timestamp, details_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        diagnostic.diag_id,
                        diagnostic.session_id,
                        diagnostic.category,
                        diagnostic.severity,
                        diagnostic.code,
                        diagnostic.message,
                        diagnostic.timestamp,
                        json.dumps(diagnostic.details or {}),
                    ),
                )
                conn.commit()
        except Exception as exc:
            logger.warning("Failed to record diagnostic: %s", exc)

    def get_diagnostics(self, limit: int = 50) -> list[EegAcquisitionDiagnostic]:
        """Retrieve recent diagnostics."""
        try:
            with sqlite3.connect(self.db_manager.get_db_path()) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT diag_id, session_id, category, severity, code, message, timestamp, details_json
                    FROM eeg_acquisition_diagnostics
                    ORDER BY timestamp DESC
                    LIMIT ?;
                    """,
                    (limit,),
                )
                rows = cursor.fetchall()
                results = []
                for r in rows:
                    results.append(
                        EegAcquisitionDiagnostic(
                            diag_id=r[0],
                            session_id=r[1],
                            category=r[2],
                            severity=r[3],
                            code=r[4],
                            message=r[5],
                            timestamp=r[6],
                            details=json.loads(r[7]) if r[7] else {},
                        )
                    )
                return results
        except Exception as exc:
            logger.warning("Failed to fetch diagnostics: %s", exc)
            return []

    def record_experiment(self, experiment: EegE2EExperiment) -> None:
        """Persist E2E scenario experiment result."""
        try:
            with sqlite3.connect(self.db_manager.get_db_path()) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO eeg_e2e_experiments (
                        experiment_id, scenario_id, name, source_type, session_id,
                        subject_id, passed, verdict, lineage_chain_json, manifest_hash,
                        started_at, completed_at, details_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        experiment.experiment_id,
                        experiment.scenario_id,
                        experiment.name,
                        experiment.source_type.value
                        if hasattr(experiment.source_type, "value")
                        else str(experiment.source_type),
                        experiment.session_id,
                        experiment.subject_id,
                        1 if experiment.passed else 0,
                        experiment.verdict,
                        json.dumps(experiment.lineage_chain),
                        experiment.manifest_hash,
                        experiment.started_at,
                        experiment.completed_at,
                        json.dumps(experiment.details),
                    ),
                )
                conn.commit()
        except Exception as exc:
            logger.warning("Failed to record experiment: %s", exc)

    def get_experiments(self, limit: int = 50) -> list[EegE2EExperiment]:
        """Retrieve recent experiments."""
        try:
            with sqlite3.connect(self.db_manager.get_db_path()) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT experiment_id, scenario_id, name, source_type, session_id,
                           subject_id, passed, verdict, lineage_chain_json, manifest_hash,
                           started_at, completed_at, details_json
                    FROM eeg_e2e_experiments
                    ORDER BY started_at DESC
                    LIMIT ?;
                    """,
                    (limit,),
                )
                rows = cursor.fetchall()
                results = []
                for r in rows:
                    results.append(
                        EegE2EExperiment(
                            experiment_id=r[0],
                            scenario_id=r[1],
                            name=r[2],
                            source_type=r[3],
                            session_id=r[4],
                            subject_id=r[5],
                            passed=bool(r[6]),
                            verdict=r[7],
                            lineage_chain=json.loads(r[8]) if r[8] else {},
                            manifest_hash=r[9],
                            started_at=r[10],
                            completed_at=r[11],
                            details=json.loads(r[12]) if r[12] else {},
                        )
                    )
                return results
        except Exception as exc:
            logger.warning("Failed to fetch experiments: %s", exc)
            return []
