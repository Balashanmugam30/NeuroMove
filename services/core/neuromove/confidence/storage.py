"""SQLite Persistence Repository for Confidence Configuration, Calibration, and Audit Logs."""

from __future__ import annotations

import json
import logging
from typing import Any

from neuromove.confidence.models import (
    CalibrationMethod,
    CalibrationMetrics,
    CalibrationScope,
    ConfidenceBand,
    ConfidenceCalibrationProfile,
    ConfidenceConfig,
    ConfidenceEligibility,
    ConfidenceHistoryRecord,
    ReliabilityBin,
    TemporalConfirmationEvent,
    TemporalStatus,
)
from neuromove.database.connection import default_db_manager

logger = logging.getLogger("neuromove.confidence.storage")


class ConfidenceStorage:
    """Provides atomic persistence and retrieval for confidence records and configuration."""

    def __init__(self) -> None:
        self.db = default_db_manager
        try:
            self.db.initialize_db()
        except Exception as exc:
            logger.warning("DB initialization note in ConfidenceStorage: %s", exc)

    def save_config(self, config: ConfidenceConfig) -> None:
        """Persist or update a confidence configuration."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO confidence_configurations (
                    config_id, version, scope, subject_id, model_version_id,
                    high_threshold, medium_threshold, min_eligible_confidence,
                    min_consecutive_windows, min_duration_ms, max_gap_ms,
                    cooldown_ms, refractory_ms, hysteresis_enter, hysteresis_exit,
                    max_age_ms, quality_floor, allow_same_class_reconfirmation,
                    parameters_json, created_at, checksum
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    config.config_id,
                    config.version,
                    config.scope.value,
                    config.subject_id,
                    config.model_version_id,
                    config.high_threshold,
                    config.medium_threshold,
                    config.min_eligible_confidence,
                    config.min_consecutive_windows,
                    config.min_duration_ms,
                    config.max_gap_ms,
                    config.cooldown_ms,
                    config.refractory_ms,
                    config.hysteresis_enter,
                    config.hysteresis_exit,
                    config.max_age_ms,
                    config.quality_floor,
                    1 if config.allow_same_class_reconfirmation else 0,
                    json.dumps(config.parameters),
                    config.created_at,
                    config.checksum,
                ),
            )
            conn.commit()

    def get_latest_config(
        self,
        subject_id: str | None = None,
        model_version_id: str | None = None,
    ) -> ConfidenceConfig | None:
        """Fetch the most recent confidence configuration matching scope/subject."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            if subject_id:
                cursor.execute(
                    """
                    SELECT * FROM confidence_configurations
                    WHERE subject_id = ? ORDER BY created_at DESC LIMIT 1;
                    """,
                    (subject_id,),
                )
            elif model_version_id:
                cursor.execute(
                    """
                    SELECT * FROM confidence_configurations
                    WHERE model_version_id = ? ORDER BY created_at DESC LIMIT 1;
                    """,
                    (model_version_id,),
                )
            else:
                cursor.execute(
                    """
                    SELECT * FROM confidence_configurations
                    WHERE scope = 'GLOBAL' ORDER BY created_at DESC LIMIT 1;
                    """
                )

            row = cursor.fetchone()
            if not row:
                return None

            return self._row_to_config(row)

    def save_calibration_profile(self, profile: ConfidenceCalibrationProfile) -> None:
        """Persist a fitted calibration profile."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO confidence_calibration_profiles (
                    calibration_id, model_version_id, scope, subject_id,
                    method, fit_dataset_reference, parameters_json,
                    calibration_metrics_json, status, checksum, fit_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    profile.calibration_id,
                    profile.model_version_id,
                    profile.scope.value,
                    profile.subject_id,
                    profile.method.value,
                    profile.fit_dataset_reference,
                    json.dumps(profile.parameters),
                    profile.calibration_metrics.model_dump_json(),
                    profile.status,
                    profile.checksum,
                    profile.fit_timestamp,
                ),
            )
            conn.commit()

    def get_calibration_profile(
        self,
        model_version_id: str,
    ) -> ConfidenceCalibrationProfile | None:
        """Fetch active calibration profile for a model version."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM confidence_calibration_profiles
                WHERE model_version_id = ? AND status = 'ACTIVE'
                ORDER BY fit_timestamp DESC LIMIT 1;
                """,
                (model_version_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None

            return self._row_to_profile(row)

    def record_history(self, record: ConfidenceHistoryRecord) -> None:
        """Append a decision record to the bounded history log."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO confidence_history (
                    history_id, subject_id, session_id, model_version_id,
                    predicted_class, confidence, band, eligibility,
                    temporal_status, decision_reason, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    record.history_id,
                    record.subject_id,
                    record.session_id,
                    record.model_version_id,
                    record.predicted_class,
                    record.confidence,
                    record.band.value,
                    record.eligibility.value,
                    record.temporal_status.value,
                    record.decision_reason,
                    record.timestamp,
                ),
            )
            conn.commit()

    def get_history(
        self,
        limit: int = 50,
        subject_id: str | None = None,
    ) -> list[ConfidenceHistoryRecord]:
        """Fetch historical confidence decisions."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            if subject_id:
                cursor.execute(
                    """
                    SELECT * FROM confidence_history
                    WHERE subject_id = ? ORDER BY timestamp DESC LIMIT ?;
                    """,
                    (subject_id, limit),
                )
            else:
                cursor.execute(
                    """
                    SELECT * FROM confidence_history
                    ORDER BY timestamp DESC LIMIT ?;
                    """,
                    (limit,),
                )
            rows = cursor.fetchall()

            return [
                ConfidenceHistoryRecord(
                    history_id=r["history_id"],
                    subject_id=r["subject_id"],
                    session_id=r["session_id"],
                    model_version_id=r["model_version_id"],
                    predicted_class=r["predicted_class"],
                    confidence=float(r["confidence"]),
                    band=ConfidenceBand(r["band"]),
                    eligibility=ConfidenceEligibility(r["eligibility"]),
                    temporal_status=TemporalStatus(r["temporal_status"]),
                    decision_reason=r["decision_reason"],
                    timestamp=r["timestamp"],
                )
                for r in rows
            ]

    def record_temporal_event(self, event: TemporalConfirmationEvent) -> None:
        """Persist a temporal confirmation event transition."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO temporal_confirmation_events (
                    event_id, sequence_number, event_type, candidate_class,
                    consecutive_windows, accumulated_duration_ms,
                    confidence_score, decision_reason, model_version_id,
                    subject_id, session_id, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    event.event_id,
                    event.sequence_number,
                    event.event_type,
                    event.candidate_class,
                    event.consecutive_windows,
                    event.accumulated_duration_ms,
                    event.confidence_score,
                    event.decision_reason,
                    event.model_version_id,
                    event.subject_id,
                    event.session_id,
                    event.timestamp,
                ),
            )
            conn.commit()

    def get_temporal_events(self, limit: int = 50) -> list[TemporalConfirmationEvent]:
        """Fetch recent temporal confirmation transitions."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM temporal_confirmation_events
                ORDER BY sequence_number DESC LIMIT ?;
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            return [
                TemporalConfirmationEvent(
                    event_id=r["event_id"],
                    sequence_number=int(r["sequence_number"]),
                    event_type=r["event_type"],
                    candidate_class=r["candidate_class"],
                    consecutive_windows=int(r["consecutive_windows"]),
                    accumulated_duration_ms=float(r["accumulated_duration_ms"]),
                    confidence_score=float(r["confidence_score"]),
                    decision_reason=r["decision_reason"],
                    model_version_id=r["model_version_id"],
                    subject_id=r["subject_id"],
                    session_id=r["session_id"],
                    timestamp=r["timestamp"],
                )
                for r in rows
            ]

    def _row_to_config(self, row: dict[str, Any]) -> ConfidenceConfig:
        return ConfidenceConfig(
            config_id=row["config_id"],
            version=row["version"],
            scope=CalibrationScope(row["scope"]),
            subject_id=row["subject_id"],
            model_version_id=row["model_version_id"],
            high_threshold=float(row["high_threshold"]),
            medium_threshold=float(row["medium_threshold"]),
            min_eligible_confidence=float(row["min_eligible_confidence"]),
            min_consecutive_windows=int(row["min_consecutive_windows"]),
            min_duration_ms=float(row["min_duration_ms"]),
            max_gap_ms=float(row["max_gap_ms"]),
            cooldown_ms=float(row["cooldown_ms"]),
            refractory_ms=float(row["refractory_ms"]),
            hysteresis_enter=float(row["hysteresis_enter"]),
            hysteresis_exit=float(row["hysteresis_exit"]),
            max_age_ms=float(row["max_age_ms"]),
            quality_floor=float(row["quality_floor"]),
            allow_same_class_reconfirmation=bool(row["allow_same_class_reconfirmation"]),
            parameters=json.loads(row["parameters_json"]) if row["parameters_json"] else {},
            created_at=row["created_at"],
            checksum=row["checksum"],
        )

    def _row_to_profile(self, row: dict[str, Any]) -> ConfidenceCalibrationProfile:
        metrics_dict = json.loads(row["calibration_metrics_json"])
        metrics = CalibrationMetrics(
            brier_score=metrics_dict["brier_score"],
            log_loss=metrics_dict["log_loss"],
            expected_calibration_error=metrics_dict["expected_calibration_error"],
            rejection_rate=metrics_dict["rejection_rate"],
            coverage=metrics_dict["coverage"],
            precision_at_high_confidence=metrics_dict["precision_at_high_confidence"],
            reliability_curve=[
                ReliabilityBin(**b) for b in metrics_dict.get("reliability_curve", [])
            ],
        )

        return ConfidenceCalibrationProfile(
            calibration_id=row["calibration_id"],
            model_version_id=row["model_version_id"],
            scope=CalibrationScope(row["scope"]),
            subject_id=row["subject_id"],
            method=CalibrationMethod(row["method"]),
            fit_dataset_reference=row["fit_dataset_reference"],
            parameters=json.loads(row["parameters_json"]) if row["parameters_json"] else {},
            calibration_metrics=metrics,
            status=row["status"],
            checksum=row["checksum"],
            fit_timestamp=row["fit_timestamp"],
        )
