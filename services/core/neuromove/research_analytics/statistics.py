"""NeuroMove — Phase 22 Research Statistics & Seeded Bootstrap Engine."""

from __future__ import annotations

import logging
import math
from typing import Any

import numpy as np

from neuromove.research_analytics.models import ComparisonResult, StatisticalResult

logger = logging.getLogger(__name__)


class ResearchStatisticsEngine:
    """Computes rigorous parametric and non-parametric statistics and seeded bootstrap CIs."""

    @classmethod
    def compute_summary(
        cls,
        metric_name: str,
        values: list[float],
        bootstrap_iterations: int = 1000,
        seed: int = 42,
    ) -> StatisticalResult:
        """Compute comprehensive statistical metrics with deterministic bootstrap 95% CI."""
        if not values:
            return StatisticalResult(metric_name=metric_name)

        arr = np.array(values, dtype=np.float64)
        n = len(arr)

        mean_val = float(np.mean(arr))
        median_val = float(np.median(arr))
        std_val = float(np.std(arr, ddof=1)) if n > 1 else 0.0
        var_val = float(np.var(arr, ddof=1)) if n > 1 else 0.0
        min_val = float(np.min(arr))
        max_val = float(np.max(arr))
        p25_val = float(np.percentile(arr, 25))
        p75_val = float(np.percentile(arr, 75))

        ci_lower, ci_upper = cls.compute_bootstrap_ci(
            arr, iterations=bootstrap_iterations, ci=0.95, seed=seed
        )

        return StatisticalResult(
            metric_name=metric_name,
            sample_count=n,
            mean=round(mean_val, 4),
            median=round(median_val, 4),
            std=round(std_val, 4),
            variance=round(var_val, 4),
            min=round(min_val, 4),
            max=round(max_val, 4),
            p25=round(p25_val, 4),
            p75=round(p75_val, 4),
            ci_lower_95=round(ci_lower, 4) if ci_lower is not None else None,
            ci_upper_95=round(ci_upper, 4) if ci_upper is not None else None,
            bootstrap_iterations=bootstrap_iterations,
        )

    @staticmethod
    def compute_bootstrap_ci(
        values: np.ndarray,
        iterations: int = 1000,
        ci: float = 0.95,
        seed: int = 42,
    ) -> tuple[float | None, float | None]:
        """Deterministic seeded bootstrap confidence interval."""
        if len(values) < 2:
            return None, None

        rng = np.random.default_rng(seed)
        n = len(values)
        boot_means = np.zeros(iterations, dtype=np.float64)

        for i in range(iterations):
            sample = rng.choice(values, size=n, replace=True)
            boot_means[i] = np.mean(sample)

        alpha = (1.0 - ci) / 2.0
        lower = float(np.percentile(boot_means, 100 * alpha))
        upper = float(np.percentile(boot_means, 100 * (1.0 - alpha)))

        return lower, upper

    @classmethod
    def compare_paired_series(
        cls,
        comparison_id: str,
        comparison_type: str,
        baseline_id: str,
        candidate_id: str,
        baseline_values: list[float],
        candidate_values: list[float],
        metric_name: str = "accuracy",
        alpha: float = 0.05,
    ) -> ComparisonResult:
        """Compute paired statistical comparison, Cohen's d effect size, and asymptotic p-value."""
        n = min(len(baseline_values), len(candidate_values))
        if n < 2:
            return ComparisonResult(
                comparison_id=comparison_id,
                comparison_type=comparison_type,
                baseline_experiment_id=baseline_id,
                candidate_experiment_id=candidate_id,
                metric_deltas={f"{metric_name}_delta": 0.0},
                effect_size=None,
                p_value=None,
                confidence_interval=None,
                statistical_method="PAIRED_SAMPLE_COMPARISON",
                sample_size=n,
                is_statistically_significant=False,
            )

        b_arr = np.array(baseline_values[:n], dtype=np.float64)
        c_arr = np.array(candidate_values[:n], dtype=np.float64)
        diff = c_arr - b_arr

        mean_diff = float(np.mean(diff))
        std_diff = float(np.std(diff, ddof=1)) if n > 1 else 0.0

        # Cohen's d
        cohens_d = (mean_diff / std_diff) if std_diff > 1e-9 else 0.0

        # Paired t-statistic and approximate p-value using normal CDF
        t_stat = (mean_diff / (std_diff / math.sqrt(n))) if std_diff > 1e-9 else 0.0
        # Normal approximation for p-value: 2 * (1 - Phi(|t|))
        p_val = 2.0 * (1.0 - 0.5 * (1.0 + math.erf(abs(t_stat) / math.sqrt(2.0))))
        p_val = max(0.0, min(1.0, p_val))

        # 95% Confidence Interval for mean difference
        margin = 1.96 * (std_diff / math.sqrt(n)) if std_diff > 1e-9 else 0.0
        ci = (round(mean_diff - margin, 4), round(mean_diff + margin, 4))

        is_sig = p_val < alpha

        return ComparisonResult(
            comparison_id=comparison_id,
            comparison_type=comparison_type,
            baseline_experiment_id=baseline_id,
            candidate_experiment_id=candidate_id,
            metric_deltas={
                f"{metric_name}_delta": round(mean_diff, 4),
                "baseline_mean": round(float(np.mean(b_arr)), 4),
                "candidate_mean": round(float(np.mean(c_arr)), 4),
            },
            effect_size=round(cohens_d, 4),
            p_value=round(p_val, 6),
            confidence_interval=ci,
            statistical_method="PAIRED_TTEST_ASYMPTOTIC",
            sample_size=n,
            is_statistically_significant=is_sig,
        )
