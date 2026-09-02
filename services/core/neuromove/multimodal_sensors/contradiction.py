"""NeuroMove — Phase 23 Explicit Multimodal Contradiction Detection Engine."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from neuromove.domain.enums import ContradictionOutcome, SensorModality, SynchronizationStatus
from neuromove.multimodal_sensors.models import (
    ContradictionRecord,
    MultimodalSyncState,
    SensorHealthSnapshot,
)

logger = logging.getLogger(__name__)


class ContradictionDetector:
    """Detects physiological, physical, timing, and quality contradictions across multimodal streams."""

    def evaluate_contradictions(
        self,
        candidate_intent: str,
        motion_state: str,
        imu_energy: float,
        sync_state: MultimodalSyncState | None,
        sensor_healths: dict[str, SensorHealthSnapshot],
        calibrations_ready: bool,
        eog_blink_detected: bool = False,
        emg_active: bool = False,
    ) -> list[ContradictionRecord]:
        """Evaluate all active signals for multimodal contradictions."""
        contradictions: list[ContradictionRecord] = []
        now_iso = datetime.now(UTC).isoformat()

        # 1. EEG Intent vs High Motion / Head Jerk Contradiction
        # If candidate is active (e.g. FORWARD/LEFT/RIGHT) while IMU detects large acceleration spike
        if candidate_intent in ("FORWARD", "BACKWARD", "LEFT", "RIGHT") and imu_energy > 6.0:
            contradictions.append(
                ContradictionRecord(
                    contradiction_id=f"contra_motion_{int(datetime.now(UTC).timestamp()*1000)}",
                    timestamp=now_iso,
                    rule_name="CONTRADICTION_INTENT_VS_MOTION",
                    conflicting_sensor_ids=["sensor_eeg_sim", "sensor_imu_sim"],
                    conflicting_modalities=[SensorModality.EEG, SensorModality.IMU],
                    outcome=ContradictionOutcome.HOLD,
                    reason=f"EEG candidate {candidate_intent} coincides with violent physical motion (energy={imu_energy:.1f} m/s^2).",
                    severity="HIGH",
                )
            )

        # 2. Clock Desynchronization Contradiction
        if sync_state and sync_state.status in (
            SynchronizationStatus.UNSYNCHRONIZED,
            SynchronizationStatus.FAILED,
        ):
            contradictions.append(
                ContradictionRecord(
                    contradiction_id=f"contra_sync_{int(datetime.now(UTC).timestamp()*1000)}",
                    timestamp=now_iso,
                    rule_name="CONTRADICTION_DESYNCHRONIZATION",
                    conflicting_sensor_ids=[sync_state.primary_clock_sensor_id],
                    conflicting_modalities=[SensorModality.EEG, SensorModality.AUXILIARY],
                    outcome=ContradictionOutcome.DEGRADED,
                    reason=f"Inter-sensor clock alignment failed (max jitter={sync_state.max_jitter_ms:.1f}ms).",
                    severity="HIGH",
                )
            )

        # 3. Degraded / Stale Sensor Contradiction
        for s_id, health in sensor_healths.items():
            if not health.is_healthy:
                contradictions.append(
                    ContradictionRecord(
                        contradiction_id=f"contra_health_{s_id}",
                        timestamp=now_iso,
                        rule_name="CONTRADICTION_SENSOR_DEGRADED",
                        conflicting_sensor_ids=[s_id],
                        conflicting_modalities=[health.modality],
                        outcome=ContradictionOutcome.DEGRADED,
                        reason=f"Sensor {s_id} ({health.modality}) reports degraded or corrupt signal.",
                        severity="MEDIUM",
                    )
                )

        # 4. Calibration Invalidation Contradiction
        if not calibrations_ready:
            contradictions.append(
                ContradictionRecord(
                    contradiction_id=f"contra_calib_{int(datetime.now(UTC).timestamp()*1000)}",
                    timestamp=now_iso,
                    rule_name="CONTRADICTION_CALIBRATION_INVALID",
                    conflicting_sensor_ids=list(sensor_healths.keys()),
                    conflicting_modalities=[SensorModality.EEG],
                    outcome=ContradictionOutcome.HOLD,
                    reason="Required sensor calibration is uninitialized or invalid.",
                    severity="HIGH",
                )
            )

        # 5. Ocular Blink Artifact Contradiction
        if eog_blink_detected and candidate_intent in ("FORWARD", "LEFT", "RIGHT"):
            contradictions.append(
                ContradictionRecord(
                    contradiction_id=f"contra_eog_{int(datetime.now(UTC).timestamp()*1000)}",
                    timestamp=now_iso,
                    rule_name="CONTRADICTION_OCULAR_CONTAMINATION",
                    conflicting_sensor_ids=["sensor_eeg_sim", "sensor_eog_sim"],
                    conflicting_modalities=[SensorModality.EEG, SensorModality.EOG],
                    outcome=ContradictionOutcome.INFORMATIONAL,
                    reason="EOG blink pulse detected concurrent with EEG intent epoch.",
                    severity="LOW",
                )
            )

        return contradictions
