"""NeuroMove — Phase 22 Confidence Analytics Engine."""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

from neuromove.research_analytics.models import ConfidenceAnalytics

logger = logging.getLogger(__name__)


class ConfidenceAnalyticsEngine:
    """Evaluates classifier output confidence distributions, temporal confirmation rates, and reliability."""

    @classmethod
    def analyze(
        cls,
        confidences: list[float],
        predictions: list[str],
        ground_truth: list[str],
        threshold: float = 0.80,
        n_bins: int = 10,
    ) -> ConfidenceAnalytics:
        """Compute confidence distributions, low-confidence rate, and confidence vs correctness bins."""
        if not confidences:
            return ConfidenceAnalytics()

        arr = np.array(confidences, dtype=np.float64)
        mean_conf = float(np.mean(arr))
        median_conf = float(np.median(arr))

        low_conf_count = sum(1 for c in confidences if c < threshold)
        low_conf_rate = round(low_conf_count / len(confidences), 4)

        # Histogram distribution
        bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
        counts, _ = np.histogram(arr, bins=bin_edges)

        # Reliability bins (Confidence vs Accuracy)
        reliability_bins = []
        for i in range(n_bins):
            lower = bin_edges[i]
            upper = bin_edges[i + 1]

            indices = [
                j for j, c in enumerate(confidences)
                if (lower <= c < upper) or (i == n_bins - 1 and c == 1.0)
            ]
            if not indices:
                continue

            sample_cnt = len(indices)
            avg_c = float(np.mean([confidences[j] for j in indices]))

            correct_cnt = sum(
                1 for j in indices
                if j < len(predictions) and j < len(ground_truth) and predictions[j] == ground_truth[j]
            )
            acc = round(correct_cnt / sample_cnt, 4) if sample_cnt > 0 else 0.0

            reliability_bins.append({
                "bin_range": f"{lower:.1f}-{upper:.1f}",
                "avg_confidence": round(avg_c, 4),
                "accuracy": acc,
                "sample_count": sample_cnt,
            })

        confirmation_rate = round(1.0 - low_conf_rate, 4)

        return ConfidenceAnalytics(
            distribution_bins=[round(float(b), 2) for b in bin_edges],
            bin_counts=[int(c) for c in counts],
            mean_confidence=round(mean_conf, 4),
            median_confidence=round(median_conf, 4),
            low_confidence_rate=low_conf_rate,
            confirmation_rate=confirmation_rate,
            stale_data_rate=0.0,
            confidence_vs_accuracy_bins=reliability_bins,
        )
