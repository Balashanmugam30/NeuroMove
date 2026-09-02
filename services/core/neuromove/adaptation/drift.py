"""Research Diagnostic Drift Engine: Distribution shift monitoring and statistical metrics."""

from __future__ import annotations

import numpy as np
from scipy.stats import wasserstein_distance

from neuromove.adaptation.models import DriftObservation, DriftStatus, generate_drift_id


class DriftDiagnosticsEngine:
    """Computes statistical distribution shifts and electrophysiological quality variation."""

    @staticmethod
    def compute_feature_shift(
        baseline_features: np.ndarray,
        recent_features: np.ndarray,
    ) -> float:
        """
        Compute mean 1D Wasserstein distance across feature dimensions.
        Returns a normalized score (0.0 = identical distributions).
        """
        if baseline_features.size == 0 or recent_features.size == 0:
            return 0.0

        n_dims = min(baseline_features.shape[1], recent_features.shape[1])
        distances = []
        for d in range(n_dims):
            base_col = baseline_features[:, d]
            rec_col = recent_features[:, d]
            # Standardize based on baseline
            std = np.std(base_col)
            if std > 1e-6:
                norm_base = (base_col - np.mean(base_col)) / std
                norm_rec = (rec_col - np.mean(base_col)) / std
                dist = wasserstein_distance(norm_base, norm_rec)
                distances.append(dist)
            else:
                distances.append(0.0)

        return float(np.mean(distances)) if distances else 0.0

    @staticmethod
    def compute_class_distribution_shift(
        baseline_class_counts: dict[str, int],
        recent_class_counts: dict[str, int],
    ) -> float:
        """
        Compute total variation distance on normalized class probabilities.
        Returns score in [0.0, 1.0].
        """
        total_base = sum(baseline_class_counts.values())
        total_rec = sum(recent_class_counts.values())
        if total_base == 0 or total_rec == 0:
            return 0.0

        all_keys = set(baseline_class_counts.keys()) | set(recent_class_counts.keys())
        tv_dist = 0.0
        for k in all_keys:
            p_base = baseline_class_counts.get(k, 0) / total_base
            p_rec = recent_class_counts.get(k, 0) / total_rec
            tv_dist += abs(p_base - p_rec)

        return float(round(0.5 * tv_dist, 4))

    @classmethod
    def evaluate_distribution_drift(
        cls,
        baseline_features: np.ndarray,
        recent_features: np.ndarray,
        baseline_classes: dict[str, int],
        recent_classes: dict[str, int],
        signal_quality_score: float = 0.95,
        prediction_entropy: float | None = None,
        subject_id: str | None = None,
        dataset_id: str | None = None,
        window_label: str = "Window_Recent",
        feature_shift_threshold: float = 0.35,
        class_shift_threshold: float = 0.25,
    ) -> DriftObservation:
        """Evaluate multi-metric distribution drift and assign research diagnostic status."""
        if baseline_features.shape[0] < 4 or recent_features.shape[0] < 4:
            status = DriftStatus.INSUFFICIENT_DATA
            feat_shift = 0.0
            class_shift = 0.0
        else:
            feat_shift = round(cls.compute_feature_shift(baseline_features, recent_features), 4)
            class_shift = cls.compute_class_distribution_shift(baseline_classes, recent_classes)

            if feat_shift >= feature_shift_threshold or class_shift >= class_shift_threshold:
                status = DriftStatus.SHIFT_DETECTED
            elif feat_shift >= (0.6 * feature_shift_threshold) or class_shift >= (
                0.6 * class_shift_threshold
            ):
                status = DriftStatus.MONITOR
            else:
                status = DriftStatus.STABLE

        obs_id = generate_drift_id(subject_id, dataset_id, window_label)

        thresholds = {
            "feature_shift_threshold": feature_shift_threshold,
            "class_shift_threshold": class_shift_threshold,
        }

        details = {
            "baseline_samples": int(baseline_features.shape[0]),
            "recent_samples": int(recent_features.shape[0]),
            "feature_shift_metric": "Mean_Standardized_Wasserstein_Distance",
            "class_shift_metric": "Total_Variation_Distance",
            "non_clinical_disclaimer": "Diagnostic research metric only. Does not reflect clinical or neurological status.",
        }

        return DriftObservation(
            observation_id=obs_id,
            subject_id=subject_id,
            dataset_id=dataset_id,
            window_label=window_label,
            feature_shift_score=feat_shift,
            class_distribution_shift=class_shift,
            signal_quality_score=signal_quality_score,
            prediction_entropy=prediction_entropy,
            status=status,
            thresholds=thresholds,
            details=details,
        )
