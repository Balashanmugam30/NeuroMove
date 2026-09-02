"""Model Score Normalization and Class Margin Analysis Layer."""

from __future__ import annotations

import math

from neuromove.confidence.models import ScoreType


class ModelScoreNormalizer:
    """Normalizes heterogeneous model score representations into standard [0, 1] bounded metrics."""

    @staticmethod
    def normalize_score(
        raw_score: float,
        score_type: ScoreType,
        beta: float = 1.0,
    ) -> float:
        """Normalize raw model outputs into bounded [0.0, 1.0] probability-like values."""
        if math.isnan(raw_score) or math.isinf(raw_score):
            return 0.0

        if score_type in (
            ScoreType.PROBABILITY,
            ScoreType.CALIBRATED_PROBABILITY,
            ScoreType.VOTE_RATIO,
        ):
            return max(0.0, min(1.0, float(raw_score)))

        if score_type == ScoreType.DECISION_MARGIN:
            # Standard logistic sigmoid mapping for unbounded hyperplane margins
            try:
                z = beta * raw_score
                # Prevent overflow in exp
                if z < -40.0:
                    return 0.0
                if z > 40.0:
                    return 1.0
                return 1.0 / (1.0 + math.exp(-z))
            except OverflowError:
                return 1.0 if raw_score > 0 else 0.0

        return max(0.0, min(1.0, float(raw_score)))

    @staticmethod
    def compute_class_margin(
        class_scores: dict[str, float] | None,
        top_prediction: str | None = None,
        raw_score: float | None = None,
    ) -> tuple[float, str | None, float]:
        """Compute top prediction, runner-up class, raw margin, and normalized margin.

        Returns:
            Tuple of (raw_margin, runner_up_class, normalized_margin)
        """
        if not class_scores or len(class_scores) < 2:
            if raw_score is not None and 0.0 <= raw_score <= 1.0:
                raw_margin = max(0.0, float(raw_score - (1.0 - raw_score)))
                return (raw_margin, "OTHER", raw_margin)
            return (0.0, None, 0.0)

        # Sort descending by score
        sorted_classes = sorted(class_scores.items(), key=lambda item: item[1], reverse=True)

        top_class, top_score = sorted_classes[0]
        runner_up_class, runner_up_score = sorted_classes[1]

        # If top_prediction was specified and differs from highest in dict
        if top_prediction and top_prediction in class_scores:
            top_score = class_scores[top_prediction]
            other_scores = [v for k, v in class_scores.items() if k != top_prediction]
            if other_scores:
                runner_up_score = max(other_scores)
                # find runner up class key
                for k, v in class_scores.items():
                    if k != top_prediction and v == runner_up_score:
                        runner_up_class = k
                        break

        raw_margin = float(top_score - runner_up_score)
        normalized_margin = max(0.0, min(1.0, raw_margin))

        return (raw_margin, runner_up_class, normalized_margin)
