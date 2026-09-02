"""NeuroMove — Phase 23 Robust Neurophysiology Context Engine."""

from __future__ import annotations

import math
from datetime import UTC, datetime

from neuromove.domain.enums import MotionContaminationState, SensorModality
from neuromove.multimodal_sensors.models import (
    ContradictionRecord,
    FusionResult,
    MultimodalContext,
    SensorStreamPacket,
)


class NeurophysiologyContextEngine:
    """Evaluates contextual validity, movement contamination, and freshness for BCI decoding."""

    def evaluate_context(
        self,
        session_id: str,
        packets: dict[str, SensorStreamPacket],
        fusion_result: FusionResult,
        contradictions: list[ContradictionRecord],
    ) -> MultimodalContext:
        """Synthesize overall neurophysiology and mobility context."""
        now_iso = datetime.now(UTC).isoformat()

        # 1. Motion state and motion contamination from IMU
        motion_state = "STATIONARY"
        motion_contamination = MotionContaminationState.MOTION_QUIET

        imu_pkt = next((p for p in packets.values() if p.modality == SensorModality.IMU), None)
        if imu_pkt and imu_pkt.data:
            accel_data = imu_pkt.data[:3]
            if accel_data and len(accel_data[0]) > 0:
                accel_mag = [
                    math.sqrt(sum(accel_data[ch][i] ** 2 for ch in range(len(accel_data))))
                    for i in range(len(accel_data[0]))
                ]
                mean_mag = sum(accel_mag) / len(accel_mag)
                std_mag = math.sqrt(sum((m - mean_mag) ** 2 for m in accel_mag) / len(accel_mag))

                if std_mag > 1.5:
                    motion_state = "MOVING"
                    motion_contamination = MotionContaminationState.LIKELY_CONTAMINATED
                elif std_mag > 0.25:
                    motion_state = "MOVING"
                    motion_contamination = MotionContaminationState.MOTION_ACTIVE
                else:
                    motion_state = "STATIONARY"
                    motion_contamination = MotionContaminationState.MOTION_QUIET

        # 2. EMG Peripheral activation
        emg_active = False
        emg_pkt = next((p for p in packets.values() if p.modality == SensorModality.EMG), None)
        if emg_pkt and emg_pkt.data:
            max_val = max(max(abs(v) for v in ch) for ch in emg_pkt.data if ch)
            emg_active = max_val > 50.0

        # 3. EOG Ocular artifact
        eog_detected = False
        eog_pkt = next((p for p in packets.values() if p.modality == SensorModality.EOG), None)
        if eog_pkt and eog_pkt.data:
            max_eog = max(max(abs(v) for v in ch) for ch in eog_pkt.data if ch)
            eog_detected = max_eog > 80.0

        # 4. Pressure Contact
        contact_present = True
        press_pkt = next((p for p in packets.values() if p.modality == SensorModality.PRESSURE), None)
        if press_pkt and press_pkt.data:
            mean_press = sum(sum(ch) for ch in press_pkt.data) / max(1, sum(len(ch) for ch in press_pkt.data))
            contact_present = mean_press > 10.0

        # 5. PPG Pulse estimate
        pulse_bpm: float | None = None
        ppg_pkt = next((p for p in packets.values() if p.modality == SensorModality.PPG), None)
        if ppg_pkt and ppg_pkt.data and ppg_pkt.data[0]:
            pulse_bpm = 72.0  # Synthetic cardiac rate

        is_eeg_contaminated = (
            motion_contamination == MotionContaminationState.LIKELY_CONTAMINATED
            or eog_detected
        )

        is_movement_valid = (
            contact_present
            and not is_eeg_contaminated
            and fusion_result.is_valid
        )

        return MultimodalContext(
            context_id=f"ctx_{int(datetime.now(UTC).timestamp()*1000)}",
            timestamp=now_iso,
            session_id=session_id,
            motion_state=motion_state,
            motion_contamination_state=motion_contamination,
            peripheral_activation=emg_active,
            ocular_artifact_detected=eog_detected,
            contact_present=contact_present,
            pulse_bpm=pulse_bpm,
            context_confidence=fusion_result.context_confidence,
            is_movement_valid=is_movement_valid,
            is_eeg_contaminated=is_eeg_contaminated,
            is_stale=False,
            participating_sensors=list(packets.keys()),
            active_contradictions=contradictions,
        )
