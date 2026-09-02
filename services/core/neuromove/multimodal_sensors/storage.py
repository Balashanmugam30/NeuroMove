"""NeuroMove — Phase 23 Multimodal Sensor SQLite Persistence Layer."""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import UTC, datetime
from typing import Any

from neuromove.database.connection import DatabaseManager
from neuromove.domain.enums import SensorModality, SensorSource
from neuromove.multimodal_sensors.models import (
    ContradictionRecord,
    FusionResult,
    MultimodalContext,
    MultimodalSession,
    MultimodalSyncState,
    SensorCalibrationSnapshot,
    SensorDeviceDescriptor,
    SensorHealthSnapshot,
)

logger = logging.getLogger(__name__)


class MultimodalSensorStorage:
    """SQLite persistence repository for Phase 23 multimodal sensors, sync, fusion, and context."""

    def __init__(self, db_mgr: DatabaseManager | None = None):
        self.db_mgr = db_mgr or DatabaseManager()

    def _get_connection(self) -> sqlite3.Connection:
        return self.db_mgr.get_connection()

    def save_device(self, desc: SensorDeviceDescriptor) -> None:
        now_iso = datetime.now(UTC).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO multimodal_sensor_devices (
                    device_id, name, modality, source, vendor, model,
                    firmware_version, protocol, channel_count, channel_names,
                    supported_sampling_rates, default_sampling_rate, adc_resolution_bits,
                    is_available, is_connected, connection_path, serial_hash,
                    imu_orientation, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    desc.device_id,
                    desc.name,
                    desc.modality.value,
                    desc.source.value,
                    desc.vendor,
                    desc.model,
                    desc.firmware_version,
                    desc.protocol,
                    desc.channel_count,
                    json.dumps(desc.channel_names),
                    json.dumps(desc.supported_sampling_rates),
                    desc.default_sampling_rate,
                    desc.adc_resolution_bits,
                    1 if desc.is_available else 0,
                    1 if desc.is_connected else 0,
                    desc.connection_path,
                    desc.serial_hash,
                    desc.imu_orientation,
                    now_iso,
                    now_iso,
                ),
            )
            conn.commit()

    def save_session(self, session: MultimodalSession) -> None:
        now_iso = datetime.now(UTC).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO multimodal_sensor_sessions (
                    session_id, subject_id, start_time, end_time,
                    active_sensors, global_state, analysis_profile, config_hash, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    session.session_id,
                    session.subject_id,
                    session.start_time,
                    session.end_time,
                    json.dumps(session.active_sensors),
                    session.global_state.value,
                    session.analysis_profile,
                    session.config_hash,
                    now_iso,
                ),
            )
            conn.commit()

    def save_calibration(self, calib: SensorCalibrationSnapshot) -> None:
        now_iso = datetime.now(UTC).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO multimodal_calibrations (
                    calibration_id, sensor_id, modality, timestamp,
                    parameters_json, quality_metrics_json, manifest_hash,
                    is_calibrated, is_ready, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    calib.calibration_id,
                    calib.sensor_id,
                    calib.modality.value,
                    calib.timestamp,
                    json.dumps(calib.parameters),
                    json.dumps(calib.quality_metrics),
                    calib.manifest_hash,
                    1 if calib.is_calibrated else 0,
                    1 if calib.is_ready else 0,
                    now_iso,
                ),
            )
            conn.commit()

    def save_fusion_result(self, session_id: str, fusion: FusionResult) -> None:
        now_iso = datetime.now(UTC).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO multimodal_fusion_results (
                    fusion_id, session_id, timestamp, strategy,
                    participating_sensor_ids_json, participating_modalities_json,
                    evidence_json, alignment_quality, has_contradiction,
                    contradiction_outcome, contradiction_reason, fused_context_score,
                    context_confidence, is_valid, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    fusion.fusion_id,
                    session_id,
                    fusion.timestamp,
                    fusion.strategy.value,
                    json.dumps(fusion.participating_sensor_ids),
                    json.dumps([m.value for m in fusion.participating_modalities]),
                    json.dumps([e.model_dump() for e in fusion.evidence]),
                    fusion.alignment_quality,
                    1 if fusion.has_contradiction else 0,
                    fusion.contradiction_outcome.value,
                    fusion.contradiction_reason,
                    fusion.fused_context_score,
                    fusion.context_confidence,
                    1 if fusion.is_valid else 0,
                    now_iso,
                ),
            )
            conn.commit()

    def save_context_event(self, context: MultimodalContext) -> None:
        now_iso = datetime.now(UTC).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO multimodal_context_events (
                    context_id, session_id, timestamp, motion_state,
                    motion_contamination_state, peripheral_activation,
                    ocular_artifact_detected, contact_present, pulse_bpm,
                    context_confidence, is_movement_valid, is_eeg_contaminated,
                    is_stale, participating_sensors_json, active_contradictions_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    context.context_id,
                    context.session_id,
                    context.timestamp,
                    context.motion_state,
                    context.motion_contamination_state.value,
                    1 if context.peripheral_activation else 0,
                    1 if context.ocular_artifact_detected else 0,
                    1 if context.contact_present else 0,
                    context.pulse_bpm,
                    context.context_confidence,
                    1 if context.is_movement_valid else 0,
                    1 if context.is_eeg_contaminated else 0,
                    1 if context.is_stale else 0,
                    json.dumps(context.participating_sensors),
                    json.dumps([c.model_dump() for c in context.active_contradictions]),
                    now_iso,
                ),
            )
            conn.commit()
