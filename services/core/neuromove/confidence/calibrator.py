"""Confidence Calibration Engine with Zero Data Leakage Protection."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression

from neuromove.confidence.models import (
    CalibrationMethod,
    CalibrationMetrics,
    CalibrationScope,
    ConfidenceCalibrationProfile,
    ReliabilityBin,
)


class ConfidenceCalibrator:
    """Fits and applies model-specific confidence calibration transformations."""

    @staticmethod
    def calculate_calibration_metrics(
        y_true: np.ndarray,
        y_prob: np.ndarray,
        n_bins: int = 10,
        high_conf_threshold: float = 0.75,
    ) -> CalibrationMetrics:
        """Calculate Brier score, log loss, ECE, reliability curve, and rejection metrics."""
        y_true = np.asarray(y_true, dtype=float)
        y_prob = np.asarray(y_prob, dtype=float)
        y_prob = np.clip(y_prob, 1e-15, 1.0 - 1e-15)
        n_samples = len(y_true)

        if n_samples == 0:
            return CalibrationMetrics(
                brier_score=0.0,
                log_loss=0.0,
                expected_calibration_error=0.0,
                rejection_rate=0.0,
                coverage=0.0,
                precision_at_high_confidence=0.0,
                reliability_curve=[],
            )

        # 1. Brier Score
        brier_score = float(np.mean((y_prob - y_true) ** 2))

        # 2. Log Loss
        log_loss = float(-np.mean(y_true * np.log(y_prob) + (1.0 - y_true) * np.log(1.0 - y_prob)))

        # 3. Expected Calibration Error (ECE) and Reliability Curve
        bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
        ece = 0.0
        reliability_curve: list[ReliabilityBin] = []

        for i in range(n_bins):
            bin_lower = bin_edges[i]
            bin_upper = bin_edges[i + 1]

            if i == n_bins - 1:
                in_bin = (y_prob >= bin_lower) & (y_prob <= bin_upper)
            else:
                in_bin = (y_prob >= bin_lower) & (y_prob < bin_upper)

            bin_count = int(np.sum(in_bin))
            bin_center = float((bin_lower + bin_upper) / 2.0)

            if bin_count > 0:
                bin_acc = float(np.mean(y_true[in_bin]))
                bin_conf = float(np.mean(y_prob[in_bin]))
                ece += (bin_count / n_samples) * abs(bin_acc - bin_conf)
                reliability_curve.append(
                    ReliabilityBin(
                        bin_center=round(bin_center, 3),
                        empirical_prob=round(bin_acc, 4),
                        mean_confidence=round(bin_conf, 4),
                        count=bin_count,
                    )
                )
            else:
                reliability_curve.append(
                    ReliabilityBin(
                        bin_center=round(bin_center, 3),
                        empirical_prob=round(bin_center, 4),
                        mean_confidence=round(bin_center, 4),
                        count=0,
                    )
                )

        # 4. High confidence coverage & precision
        high_conf_mask = y_prob >= high_conf_threshold
        high_conf_count = int(np.sum(high_conf_mask))
        coverage = float(high_conf_count / n_samples)
        rejection_rate = float(1.0 - coverage)

        if high_conf_count > 0:
            precision_at_high = float(np.mean(y_true[high_conf_mask]))
        else:
            precision_at_high = 0.0

        return CalibrationMetrics(
            brier_score=round(brier_score, 4),
            log_loss=round(log_loss, 4),
            expected_calibration_error=round(float(ece), 4),
            rejection_rate=round(rejection_rate, 4),
            coverage=round(coverage, 4),
            precision_at_high_confidence=round(precision_at_high, 4),
            reliability_curve=reliability_curve,
        )

    @classmethod
    def fit_calibration_profile(
        cls,
        model_version_id: str,
        uncalibrated_scores: np.ndarray,
        y_true: np.ndarray,
        method: CalibrationMethod = CalibrationMethod.PLATT,
        scope: CalibrationScope = CalibrationScope.GLOBAL,
        subject_id: str | None = None,
        dataset_reference: str = "validation_set",
        protected_eval_epoch_ids: set[str] | None = None,
        fit_epoch_ids: set[str] | None = None,
    ) -> ConfidenceCalibrationProfile:
        """Fit a calibration profile with explicit zero data leakage enforcement."""
        # 1. Zero Data Leakage Invariant Check
        if protected_eval_epoch_ids and fit_epoch_ids:
            overlap = protected_eval_epoch_ids.intersection(fit_epoch_ids)
            if overlap:
                raise ValueError(
                    f"Data leakage detected! Calibration fit set overlaps protected evaluation set by {len(overlap)} epochs: {list(overlap)[:5]}"
                )

        scores = np.asarray(uncalibrated_scores, dtype=float)
        targets = np.asarray(y_true, dtype=float)

        if len(scores) < 4:
            # Fallback to Identity if insufficient validation samples
            method = CalibrationMethod.IDENTITY

        params: dict[str, Any] = {}
        calibrated_probs: np.ndarray

        if method == CalibrationMethod.PLATT:
            # Platt Scaling (Logistic Regression on scores)
            lr = LogisticRegression(C=1.0, solver="lbfgs")
            X_scores = scores.reshape(-1, 1)
            lr.fit(X_scores, targets)
            params = {
                "coef": float(lr.coef_[0][0]),
                "intercept": float(lr.intercept_[0]),
            }
            calibrated_probs = lr.predict_proba(X_scores)[:, 1]

        elif method == CalibrationMethod.ISOTONIC:
            # Isotonic Regression (Piecewise non-parametric)
            iso = IsotonicRegression(out_of_bounds="clip")
            iso.fit(scores, targets)
            params = {
                "x_min": float(iso.X_min_),
                "x_max": float(iso.X_max_),
                "x_thresholds": [float(x) for x in iso.X_thresholds_[:20]],
                "y_thresholds": [float(y) for y in iso.y_thresholds_[:20]],
            }
            calibrated_probs = iso.predict(scores)

        elif method == CalibrationMethod.MARGIN_SIGMOID:
            # Sigmoid on margin
            scale = float(np.std(scores)) if np.std(scores) > 0 else 1.0
            params = {"scale": scale}
            calibrated_probs = 1.0 / (1.0 + np.exp(-scores / max(1e-5, scale)))

        else:
            # Identity
            params = {"type": "identity"}
            calibrated_probs = np.clip(scores, 0.0, 1.0)

        metrics = cls.calculate_calibration_metrics(targets, calibrated_probs)

        return ConfidenceCalibrationProfile(
            model_version_id=model_version_id,
            scope=scope,
            subject_id=subject_id,
            method=method,
            fit_dataset_reference=dataset_reference,
            parameters=params,
            calibration_metrics=metrics,
            status="ACTIVE",
        )

    @staticmethod
    def calibrate_score(
        raw_score: float,
        profile: ConfidenceCalibrationProfile | None,
    ) -> float:
        """Apply fitted calibration profile parameters to normalize a single score."""
        if math.isnan(raw_score) or math.isinf(raw_score):
            return 0.0

        if not profile:
            return max(0.0, min(1.0, raw_score))

        params = profile.parameters

        if profile.method == CalibrationMethod.PLATT:
            coef = params.get("coef", 1.0)
            intercept = params.get("intercept", 0.0)
            z = coef * raw_score + intercept
            z = max(-40.0, min(40.0, z))
            return float(1.0 / (1.0 + math.exp(-z)))

        if profile.method == CalibrationMethod.MARGIN_SIGMOID:
            scale = params.get("scale", 1.0)
            z = raw_score / max(1e-5, scale)
            z = max(-40.0, min(40.0, z))
            return float(1.0 / (1.0 + math.exp(-z)))

        if profile.method == CalibrationMethod.ISOTONIC:
            # Piecewise linear interpolation on saved thresholds
            x_thresh = params.get("x_thresholds", [])
            y_thresh = params.get("y_thresholds", [])
            if x_thresh and y_thresh and len(x_thresh) == len(y_thresh):
                return float(np.interp(raw_score, x_thresh, y_thresh))

        return max(0.0, min(1.0, raw_score))
