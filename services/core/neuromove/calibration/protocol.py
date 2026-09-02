"""Declarative Calibration Protocol Engine for NeuroMove (Phase 13)."""

import hashlib

import numpy as np

from ..epoching.models import NormalizedLabel
from .models import (
    CalibrationProtocol,
    CalibrationQCStatus,
    CalibrationTrial,
    CalibrationTrialStatus,
    CueType,
)


class CalibrationProtocolEngine:
    """Generates deterministic, seed-controlled trial schedules for calibration."""

    @staticmethod
    def get_default_protocol(random_state: int = 42) -> CalibrationProtocol:
        """Construct standard 2-class Graz motor imagery calibration protocol."""
        return CalibrationProtocol(
            protocol_id="CALIBRATION_PROTOCOL_V1",
            protocol_version="CALIBRATION_PROTOCOL_V1",
            name="Standard Graz Visual Cue Protocol",
            target_classes=[NormalizedLabel.LEFT_IMAGERY, NormalizedLabel.RIGHT_IMAGERY],
            trials_per_class=10,
            rest_duration_sec=2.0,
            fixation_duration_sec=2.0,
            cue_duration_sec=1.25,
            imagery_duration_sec=4.0,
            iti_min_sec=1.5,
            iti_max_sec=2.5,
            break_policy="EVERY_20_TRIALS",
            random_state=random_state,
            min_valid_trials_per_class=5,
            max_rejection_ratio=0.4,
            qc_rules={
                "min_amplitude_uv": 0.1,
                "max_amplitude_uv": 200.0,
                "max_flatline_samples": 25,
                "max_dropout_ratio": 0.1,
            },
        )

    @classmethod
    def generate_trial_sequence(
        cls,
        calibration_id: str,
        protocol: CalibrationProtocol,
    ) -> list[CalibrationTrial]:
        """Generate deterministic pseudo-random trial order with planned onset timestamps.

        Guarantees:
        - Exact balance: exactly `trials_per_class` for each target class.
        - Determinism: Identical `random_state` + `protocol` reproduces the identical sequence.
        - No silent shuffling.
        """
        rng = np.random.default_rng(protocol.random_state)

        # Build balanced class list
        class_pool: list[NormalizedLabel] = []
        for cls_label in protocol.target_classes:
            class_pool.extend([cls_label] * protocol.trials_per_class)

        # Deterministic permutation
        indices = rng.permutation(len(class_pool))
        ordered_classes = [class_pool[i] for i in indices]

        trials: list[CalibrationTrial] = []
        current_onset = 0.0

        for idx, target_label in enumerate(ordered_classes):
            # Compute randomized ITI within configured interval
            iti = rng.uniform(protocol.iti_min_sec, protocol.iti_max_sec)
            trial_duration = (
                protocol.rest_duration_sec
                + protocol.fixation_duration_sec
                + protocol.cue_duration_sec
                + protocol.imagery_duration_sec
                + iti
            )

            # Map target label to visual cue
            cue = CueType.LEFT if target_label == NormalizedLabel.LEFT_IMAGERY else CueType.RIGHT

            # Generate unique deterministic trial_id
            h = hashlib.sha256(f"{calibration_id}_{idx}_{target_label.value}".encode()).hexdigest()[
                :12
            ]
            trial_id = f"trl_{calibration_id[:8]}_{idx:03d}_{h}"

            trial = CalibrationTrial(
                trial_id=trial_id,
                calibration_id=calibration_id,
                sequence_index=idx,
                target_label=target_label,
                cue=cue,
                planned_onset=round(current_onset, 3),
                actual_onset=None,
                imagery_start=None,
                imagery_end=None,
                status=CalibrationTrialStatus.PLANNED,
                quality_status=CalibrationQCStatus.PASS,
                quality_reasons=[],
                epoch_id=None,
            )
            trials.append(trial)
            current_onset += trial_duration

        return trials

    @classmethod
    def compute_trial_phase_timings(
        cls,
        protocol: CalibrationProtocol,
    ) -> dict[str, float]:
        """Return cumulative offsets for each sub-phase within a single trial."""
        t_fixation_start = protocol.rest_duration_sec
        t_cue_start = t_fixation_start + protocol.fixation_duration_sec
        t_imagery_start = t_cue_start + protocol.cue_duration_sec
        t_imagery_end = t_imagery_start + protocol.imagery_duration_sec
        return {
            "rest_start": 0.0,
            "fixation_start": t_fixation_start,
            "cue_start": t_cue_start,
            "imagery_start": t_imagery_start,
            "imagery_end": t_imagery_end,
        }
