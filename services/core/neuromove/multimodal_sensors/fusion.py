"""NeuroMove — Phase 23 Deterministic Multimodal Sensor Fusion Engine."""

from __future__ import annotations

import math
from datetime import UTC, datetime

from neuromove.domain.enums import (
    ContradictionOutcome,
    FusionStrategy,
    SensorModality,
    SynchronizationStatus,
)
from neuromove.multimodal_sensors.models import (
    ContradictionRecord,
    FusionEvidence,
    FusionResult,
    MultimodalSyncState,
    SensorHealthSnapshot,
    SensorStreamPacket,
)


class SensorFusionEngine:
    """Deterministic, interpretable multimodal sensor fusion engine.

    Combines auxiliary sensor evidence (IMU, EMG, EOG, PPG, Pressure) to modulate
    decision confidence, confirm context, or hold execution upon contradiction.
    """

    def fuse(
        self,
        eeg_confidence: float,
        candidate_intent: str,
        packets: dict[str, SensorStreamPacket],
        sensor_healths: dict[str, SensorHealthSnapshot],
        sync_state: MultimodalSyncState | None,
        contradictions: list[ContradictionRecord],
        strategy: FusionStrategy = FusionStrategy.RULE_BASED_CONTEXT,
    ) -> FusionResult:
        """Execute deterministic multimodal fusion."""
        now_iso = datetime.now(UTC).isoformat()
        evidence_list: list[FusionEvidence] = []
        participating_ids: list[str] = list(packets.keys())
        participating_mods: list[SensorModality] = [p.modality for p in packets.values()]

        context_score = 1.0
        confidence_multiplier = 1.0

        # 1. Evaluate IMU evidence
        imu_pkt = next((p for p in packets.values() if p.modality == SensorModality.IMU), None)
        if imu_pkt and imu_pkt.data:
            # Compute acceleration magnitude variance
            accel_samples = imu_pkt.data[:3] if len(imu_pkt.data) >= 3 else []
            if accel_samples and len(accel_samples[0]) > 0:
                accel_mag = [
                    math.sqrt(sum(accel_samples[ch][i] ** 2 for ch in range(len(accel_samples))))
                    for i in range(len(accel_samples[0]))
                ]
                mean_mag = sum(accel_mag) / len(accel_mag)
                std_mag = math.sqrt(sum((m - mean_mag) ** 2 for m in accel_mag) / len(accel_mag))

                is_quiet = std_mag < 0.5
                evidence_list.append(
                    FusionEvidence(
                        evidence_id=f"ev_imu_{int(datetime.now(UTC).timestamp()*1000)}",
                        timestamp=now_iso,
                        sensor_id=imu_pkt.sensor_id,
                        modality=SensorModality.IMU,
                        feature_name="motion_stability",
                        feature_value=std_mag,
                        confidence=0.95 if is_quiet else 0.70,
                        interpretation="Stationary head/chassis context" if is_quiet else "Active motion / disturbance",
                    )
                )
                if not is_quiet:
                    context_score *= 0.8
                    confidence_multiplier *= 0.85

        # 2. Evaluate EMG evidence
        emg_pkt = next((p for p in packets.values() if p.modality == SensorModality.EMG), None)
        if emg_pkt and emg_pkt.data:
            emg_rms = [
                math.sqrt(sum(v ** 2 for v in ch_data) / max(1, len(ch_data)))
                for ch_data in emg_pkt.data
            ]
            max_rms = max(emg_rms) if emg_rms else 0.0
            is_active = max_rms > 40.0
            evidence_list.append(
                FusionEvidence(
                    evidence_id=f"ev_emg_{int(datetime.now(UTC).timestamp()*1000)}",
                    timestamp=now_iso,
                    sensor_id=emg_pkt.sensor_id,
                    modality=SensorModality.EMG,
                    feature_name="muscle_activation_rms",
                    feature_value=max_rms,
                    confidence=0.90,
                    interpretation="Peripheral muscle burst detected" if is_active else "Quiet baseline EMG",
                )
            )

        # 3. Evaluate EOG evidence
        eog_pkt = next((p for p in packets.values() if p.modality == SensorModality.EOG), None)
        if eog_pkt and eog_pkt.data:
            max_eog = max(max(abs(v) for v in ch_data) for ch_data in eog_pkt.data if ch_data)
            has_blink = max_eog > 120.0
            evidence_list.append(
                FusionEvidence(
                    evidence_id=f"ev_eog_{int(datetime.now(UTC).timestamp()*1000)}",
                    timestamp=now_iso,
                    sensor_id=eog_pkt.sensor_id,
                    modality=SensorModality.EOG,
                    feature_name="ocular_amplitude_max",
                    feature_value=max_eog,
                    confidence=0.90,
                    interpretation="Ocular blink spike detected" if has_blink else "Clean ocular baseline",
                )
            )
            if has_blink:
                context_score *= 0.9

        # 4. Evaluate Pressure evidence
        press_pkt = next((p for p in packets.values() if p.modality == SensorModality.PRESSURE), None)
        if press_pkt and press_pkt.data:
            mean_press = sum(sum(ch) for ch in press_pkt.data) / max(1, sum(len(ch) for ch in press_pkt.data))
            has_contact = mean_press > 10.0
            evidence_list.append(
                FusionEvidence(
                    evidence_id=f"ev_press_{int(datetime.now(UTC).timestamp()*1000)}",
                    timestamp=now_iso,
                    sensor_id=press_pkt.sensor_id,
                    modality=SensorModality.PRESSURE,
                    feature_name="seating_contact_pressure",
                    feature_value=mean_press,
                    confidence=0.95,
                    interpretation="User seated / contact confirmed" if has_contact else "Loss of seating contact",
                )
            )
            if not has_contact:
                context_score *= 0.5
                confidence_multiplier *= 0.5

        # 5. Evaluate Synchronization alignment quality
        alignment_quality = 1.0
        if sync_state:
            alignment_quality = sync_state.alignment_quality_pct / 100.0
            if sync_state.status == SynchronizationStatus.DEGRADED:
                context_score *= 0.85
            elif sync_state.status in (SynchronizationStatus.UNSYNCHRONIZED, SynchronizationStatus.FAILED):
                context_score *= 0.2
                confidence_multiplier *= 0.2

        # 6. Evaluate Contradiction impact
        has_contra = len(contradictions) > 0
        contra_outcome = ContradictionOutcome.INFORMATIONAL
        contra_reason = None

        if has_contra:
            # Find most severe contradiction outcome
            outcomes = [c.outcome for c in contradictions]
            if ContradictionOutcome.INVALID in outcomes:
                contra_outcome = ContradictionOutcome.INVALID
                context_score = 0.0
                confidence_multiplier = 0.0
            elif ContradictionOutcome.HOLD in outcomes:
                contra_outcome = ContradictionOutcome.HOLD
                context_score = min(context_score, 0.4)
                confidence_multiplier = min(confidence_multiplier, 0.4)
            elif ContradictionOutcome.DEGRADED in outcomes:
                contra_outcome = ContradictionOutcome.DEGRADED
                context_score = min(context_score, 0.7)
                confidence_multiplier = min(confidence_multiplier, 0.7)
            contra_reason = "; ".join(c.reason for c in contradictions)

        final_context_confidence = min(1.0, max(0.0, eeg_confidence * confidence_multiplier))
        is_valid = contra_outcome not in (ContradictionOutcome.INVALID, ContradictionOutcome.HOLD) and context_score >= 0.5

        return FusionResult(
            fusion_id=f"fuse_{int(datetime.now(UTC).timestamp()*1000)}",
            timestamp=now_iso,
            strategy=strategy,
            participating_sensor_ids=participating_ids,
            participating_modalities=participating_mods,
            evidence=evidence_list,
            alignment_quality=alignment_quality,
            has_contradiction=has_contra,
            contradiction_outcome=contra_outcome,
            contradiction_reason=contra_reason,
            fused_context_score=round(context_score, 3),
            context_confidence=round(final_context_confidence, 3),
            is_valid=is_valid,
        )
