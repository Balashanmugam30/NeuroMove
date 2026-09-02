"""Research-Grade Trial Quality Control (QC) and Data Sufficiency Engine (Phase 13)."""

import numpy as np

from .models import (
    CalibrationQCStatus,
    CalibrationQualitySummary,
    CalibrationRejectionReason,
    CalibrationTrial,
    CalibrationTrialStatus,
)


class CalibrationQCEngine:
    """Evaluates electrophysiological integrity and data sufficiency for calibration trials."""

    @classmethod
    def evaluate_trial_signal(
        cls,
        signal_array: np.ndarray,
        sampling_rate_hz: float = 250.0,
        expected_duration_sec: float = 4.0,
        min_amplitude_uv: float = 0.1,
        max_amplitude_uv: float = 200.0,
        max_flatline_samples: int = 25,
    ) -> tuple[CalibrationQCStatus, list[CalibrationRejectionReason]]:
        """Run multi-stage research quality audits on raw epoch data [channels, time_samples].

        Returns:
            Tuple of (qc_status, rejection_reasons)
        """
        reasons: list[CalibrationRejectionReason] = []

        # 1. Non-finite data check (NaN / Inf)
        if not np.isfinite(signal_array).all():
            reasons.append(CalibrationRejectionReason.NONFINITE_DATA)

        # 2. Duration / completeness check
        expected_samples = int(
            expected_duration_sec * sampling_rate_hz * 0.8
        )  # allow slight margin
        if signal_array.shape[-1] < expected_samples:
            reasons.append(CalibrationRejectionReason.INCOMPLETE_EPOCH)

        # 3. Flatline / Dropout check per channel
        diffs = np.diff(signal_array, axis=-1)
        zero_diffs = np.isclose(diffs, 0.0, atol=1e-8)
        if np.any(np.sum(zero_diffs, axis=-1) >= max_flatline_samples):
            reasons.append(CalibrationRejectionReason.DROPOUT)

        # 4. Amplitude threshold bounds
        peak_to_peak = np.ptp(signal_array, axis=-1)
        if np.any(peak_to_peak < min_amplitude_uv):
            reasons.append(CalibrationRejectionReason.SIGNAL_QUALITY_LOW)
        if np.any(np.abs(signal_array) > max_amplitude_uv):
            reasons.append(CalibrationRejectionReason.OUT_OF_BOUNDS)

        # 5. Determine overall QC status
        if len(reasons) == 0:
            return CalibrationQCStatus.PASS, []
        elif len(reasons) == 1 and reasons[0] == CalibrationRejectionReason.SIGNAL_QUALITY_LOW:
            return CalibrationQCStatus.WARN, reasons
        else:
            return CalibrationQCStatus.REJECT, reasons

    @classmethod
    def summarize_session_quality(
        cls,
        trials: list[CalibrationTrial],
        min_valid_trials_per_class: int = 5,
        max_rejection_ratio: float = 0.4,
    ) -> CalibrationQualitySummary:
        """Compute aggregate quality metrics, class balance, and sufficiency assessment."""
        total = len(trials)
        if total == 0:
            return CalibrationQualitySummary(
                total_trials=0,
                valid_trials=0,
                rejected_trials=0,
                warn_trials=0,
                valid_ratio=0.0,
                rejection_ratio=0.0,
                class_balance={},
                rejection_breakdown={},
                is_sufficient=False,
                sufficiency_warnings=["No calibration trials recorded."],
            )

        valid_trials = [
            t
            for t in trials
            if t.status == CalibrationTrialStatus.COMPLETED
            and t.quality_status != CalibrationQCStatus.REJECT
        ]
        rejected_trials = [
            t
            for t in trials
            if t.quality_status == CalibrationQCStatus.REJECT
            or t.status == CalibrationTrialStatus.REJECTED
        ]
        warn_trials = [
            t
            for t in trials
            if t.quality_status == CalibrationQCStatus.WARN
            and t.status == CalibrationTrialStatus.COMPLETED
        ]

        valid_count = len(valid_trials)
        rejected_count = len(rejected_trials)
        warn_count = len(warn_trials)

        valid_ratio = valid_count / total
        rejection_ratio = rejected_count / total

        # Class balance of valid trials
        class_counts: dict[str, int] = {}
        for t in valid_trials:
            lbl = t.target_label.value
            class_counts[lbl] = class_counts.get(lbl, 0) + 1

        class_balance: dict[str, float] = {}
        for lbl, count in class_counts.items():
            class_balance[lbl] = round(count / valid_count, 3) if valid_count > 0 else 0.0

        # Rejection breakdown
        rejection_breakdown: dict[str, int] = {}
        for t in trials:
            for r in t.quality_reasons:
                rejection_breakdown[r.value] = rejection_breakdown.get(r.value, 0) + 1

        # Evaluate Data Sufficiency
        warnings: list[str] = []
        is_sufficient = True

        if rejection_ratio > max_rejection_ratio:
            is_sufficient = False
            warnings.append(
                f"Rejection ratio ({rejection_ratio:.1%}) exceeds threshold ({max_rejection_ratio:.1%})."
            )

        for lbl, count in class_counts.items():
            if count < min_valid_trials_per_class:
                is_sufficient = False
                warnings.append(
                    f"Class '{lbl}' has only {count} valid trials (minimum required: {min_valid_trials_per_class})."
                )

        if len(class_counts) < 2:
            is_sufficient = False
            warnings.append(
                "At least 2 target classes required for personalized motor imagery decoding."
            )

        # Class imbalance check (e.g. < 30% or > 70%)
        for lbl, pct in class_balance.items():
            if pct < 0.3 or pct > 0.7:
                warnings.append(
                    f"Class imbalance detected: '{lbl}' represents {pct:.1%} of valid trials."
                )

        return CalibrationQualitySummary(
            total_trials=total,
            valid_trials=valid_count,
            rejected_trials=rejected_count,
            warn_trials=warn_count,
            valid_ratio=round(valid_ratio, 3),
            rejection_ratio=round(rejection_ratio, 3),
            class_balance=class_balance,
            rejection_breakdown=rejection_breakdown,
            is_sufficient=is_sufficient,
            sufficiency_warnings=warnings,
        )
