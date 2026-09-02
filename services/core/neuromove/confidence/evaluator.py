"""Multi-Factor Confidence Evaluation and Strict Eligibility Gating Engine."""

from __future__ import annotations

import time

from neuromove.confidence.calibrator import ConfidenceCalibrator
from neuromove.confidence.models import (
    ConfidenceBand,
    ConfidenceCalibrationProfile,
    ConfidenceComponents,
    ConfidenceConfig,
    ConfidenceDecision,
    ConfidenceEligibility,
    ConfidenceInput,
    FreshnessStatus,
    ModelValidityStatus,
)
from neuromove.confidence.normalizer import ModelScoreNormalizer


class ConfidenceEvaluator:
    """Evaluates raw model predictions, applies multi-factor calibration, and enforces gating."""

    def __init__(self, config: ConfidenceConfig | None = None) -> None:
        self.config = config or ConfidenceConfig()

    def update_config(self, config: ConfidenceConfig) -> None:
        """Update active configuration."""
        self.config = config

    def evaluate(
        self,
        input_data: ConfidenceInput,
        calibration_profile: ConfidenceCalibrationProfile | None = None,
        evaluation_timestamp: float | None = None,
    ) -> ConfidenceDecision:
        """Perform deterministic multi-factor confidence evaluation and eligibility check."""
        now = evaluation_timestamp if evaluation_timestamp is not None else time.time()

        # 1. Normalize raw score
        norm_score = ModelScoreNormalizer.normalize_score(
            raw_score=input_data.raw_score,
            score_type=input_data.score_type,
        )

        # 2. Calibrate score
        calibrated_score = ConfidenceCalibrator.calibrate_score(
            raw_score=norm_score,
            profile=calibration_profile,
        )

        # 3. Class margin analysis
        raw_margin, runner_up, norm_margin = ModelScoreNormalizer.compute_class_margin(
            class_scores=input_data.class_scores,
            top_prediction=input_data.prediction,
            raw_score=norm_score,
        )
        if input_data.class_margin is not None:
            raw_margin = input_data.class_margin
            norm_margin = max(0.0, min(1.0, raw_margin))

        # 4. Freshness determination
        # Timestamps can be in seconds or ms; normalize difference to ms
        time_diff = abs(now - input_data.data_timestamp)
        # If timestamp is in seconds (< 1e11), multiply by 1000 to get ms
        age_ms = time_diff * 1000.0 if time_diff < 100000.0 else time_diff

        freshness_status: FreshnessStatus
        freshness_factor: float

        if age_ms <= 0.5 * self.config.max_age_ms:
            freshness_status = FreshnessStatus.FRESH
            freshness_factor = 1.0
        elif age_ms <= self.config.max_age_ms:
            freshness_status = FreshnessStatus.AGING
            # Linear decay from 1.0 to 0.5
            decay = (age_ms - 0.5 * self.config.max_age_ms) / (0.5 * self.config.max_age_ms)
            freshness_factor = max(0.5, 1.0 - 0.5 * decay)
        else:
            freshness_status = FreshnessStatus.STALE
            freshness_factor = 0.0

        # 5. Signal Quality component
        sig_quality = max(0.0, min(1.0, float(input_data.signal_quality)))

        # 6. Model validity component
        valid_model_statuses = {
            ModelValidityStatus.ACTIVE,
            ModelValidityStatus.VALIDATED,
            ModelValidityStatus.NOT_EXPIRED,
            ModelValidityStatus.COMPATIBLE,
            ModelValidityStatus.NOT_ROLLED_BACK,
        }
        is_model_valid = (
            input_data.model_validity in valid_model_statuses and input_data.feature_compatibility
        )
        model_validity_factor = 1.0 if is_model_valid else 0.0

        # 7. Calibration component
        calibration_factor = 1.0 if calibration_profile else 0.85

        # 8. Compute Multi-Factor Confidence Score
        # Margin factor: 1.0 if margin is healthy (>= 0.5), decaying towards 0.7 if tie
        margin_factor = min(1.0, 0.70 + 0.60 * norm_margin)

        # Quality factor: 1.0 if quality is high (>= 0.90), decaying towards 0.80 at quality floor
        if sig_quality >= 0.90:
            quality_factor = 1.0
        elif sig_quality >= self.config.quality_floor:
            quality_factor = 0.80 + 0.20 * (
                (sig_quality - self.config.quality_floor)
                / max(1e-5, 0.90 - self.config.quality_floor)
            )
        else:
            quality_factor = 0.0

        composite_confidence = (
            calibrated_score
            * margin_factor
            * quality_factor
            * freshness_factor
            * model_validity_factor
        )
        composite_confidence = max(0.0, min(1.0, round(float(composite_confidence), 4)))

        components = ConfidenceComponents(
            model_score_component=round(calibrated_score, 4),
            class_margin_component=round(norm_margin, 4),
            signal_quality_component=round(sig_quality, 4),
            freshness_component=round(freshness_factor, 4),
            model_validity_component=round(model_validity_factor, 4),
            calibration_component=round(calibration_factor, 4),
        )

        # 9. Hard Eligibility & Rejection Gating

        eligibility: ConfidenceEligibility = ConfidenceEligibility.VALID
        rejection_reasons: list[str] = []

        if input_data.prediction in ("NONE", "UNKNOWN", "UNCERTAIN", "REST"):
            eligibility = ConfidenceEligibility.NO_PREDICTION
            rejection_reasons.append(f"Class '{input_data.prediction}' is non-directional or rest.")

        if not is_model_valid:
            eligibility = ConfidenceEligibility.MODEL_INVALID
            rejection_reasons.append(
                f"Active model version '{input_data.model_version_id}' status is {input_data.model_validity}."
            )

        if freshness_status == FreshnessStatus.STALE:
            eligibility = ConfidenceEligibility.STALE
            rejection_reasons.append(
                f"Data frame age ({age_ms:.1f}ms) exceeds max allowable threshold ({self.config.max_age_ms}ms)."
            )

        if sig_quality < self.config.quality_floor:
            eligibility = ConfidenceEligibility.LOW_SIGNAL
            rejection_reasons.append(
                f"Signal quality score ({sig_quality:.2f}) below configured quality floor ({self.config.quality_floor:.2f})."
            )

        if (
            eligibility == ConfidenceEligibility.VALID
            and composite_confidence < self.config.min_eligible_confidence
        ):
            eligibility = ConfidenceEligibility.INSUFFICIENT_CONFIDENCE
            rejection_reasons.append(
                f"Confidence ({composite_confidence:.3f}) below minimum eligible threshold ({self.config.min_eligible_confidence:.2f})."
            )

        # 10. Confidence Band Classification
        band: ConfidenceBand
        if eligibility != ConfidenceEligibility.VALID:
            band = ConfidenceBand.UNKNOWN
        elif composite_confidence >= self.config.high_threshold:
            band = ConfidenceBand.HIGH
        elif composite_confidence >= self.config.medium_threshold:
            band = ConfidenceBand.MEDIUM
        else:
            band = ConfidenceBand.LOW

        decision_reason = (
            "; ".join(rejection_reasons)
            if rejection_reasons
            else f"Prediction '{input_data.prediction}' verified valid with {band.value} confidence ({composite_confidence:.1%})."
        )

        return ConfidenceDecision(
            prediction=input_data.prediction,
            raw_score=round(input_data.raw_score, 4),
            score_type=input_data.score_type,
            normalized_score=round(norm_score, 4),
            calibrated_confidence=composite_confidence,
            confidence_band=band,
            eligibility=eligibility,
            class_margin=round(raw_margin, 4),
            runner_up_class=runner_up,
            signal_quality=sig_quality,
            freshness=freshness_status,
            model_validity=input_data.model_validity,
            components=components,
            decision_reason=decision_reason,
            timestamp=now,
            model_version_id=input_data.model_version_id,
            subject_id=input_data.subject_id,
            session_id=input_data.session_id,
        )
