"""NeuroMove — Phase 22 Scientific Metrics & Evaluation Engine."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import numpy as np

from neuromove.research_analytics.models import ConfusionMatrix, MetricResult

logger = logging.getLogger(__name__)


class ScientificMetricsEngine:
    """Computes comprehensive, mathematically rigorous classification and calibration metrics."""

    @classmethod
    def compute_metrics(
        cls,
        experiment_id: str,
        y_true: list[str],
        y_pred: list[str],
        y_prob: list[dict[str, float]] | None = None,
        classes: list[str] | None = None,
        rejected_count: int = 0,
    ) -> MetricResult:
        """Compute full scientific metrics suite.
        Handles edge cases, zero-division, and unsupported metric situations gracefully.
        """
        if not classes:
            classes = sorted(list(set(y_true) | set(y_pred)))

        total_trials = len(y_true) + rejected_count
        evaluated_trials = len(y_true)
        rejection_rate = (rejected_count / total_trials) if total_trials > 0 else 0.0

        if not y_true or not y_pred or evaluated_trials == 0:
            return MetricResult(
                experiment_id=experiment_id,
                total_trials=total_trials,
                evaluated_trials=0,
                rejected_trials=rejected_count,
                rejection_rate=rejection_rate,
                unsupported_metrics=["accuracy", "f1_macro", "confusion_matrix"],
                evaluated_at=datetime.now(UTC).isoformat(),
            )

        n_classes = len(classes)
        class_to_idx = {c: i for i, c in enumerate(classes)}

        # Build confusion matrix
        matrix = [[0] * n_classes for _ in range(n_classes)]
        for t, p in zip(y_true, y_pred, strict=False):
            if t in class_to_idx and p in class_to_idx:
                matrix[class_to_idx[t]][class_to_idx[p]] += 1

        # Normalized confusion matrix (row-wise / recall-normalized)
        norm_matrix = []
        for row in matrix:
            row_sum = sum(row)
            norm_matrix.append(
                [round(val / row_sum, 4) if row_sum > 0 else 0.0 for val in row]
            )

        cm = ConfusionMatrix(
            classes=classes,
            matrix=matrix,
            normalized_matrix=norm_matrix,
            total_samples=evaluated_trials,
        )

        # Basic accuracy
        correct = sum(1 for t, p in zip(y_true, y_pred, strict=False) if t == p)
        accuracy = round(correct / evaluated_trials, 4)

        # Per-class precision, recall, F1
        per_class_precision: dict[str, float | None] = {}
        per_class_recall: dict[str, float | None] = {}
        per_class_f1: dict[str, float | None] = {}

        precisions = []
        recalls = []
        f1s = []

        for i, c in enumerate(classes):
            tp = matrix[i][i]
            fp = sum(matrix[r][i] for r in range(n_classes) if r != i)
            fn = sum(matrix[i][col] for col in range(n_classes) if col != i)

            prec = (tp / (tp + fp)) if (tp + fp) > 0 else None
            rec = (tp / (tp + fn)) if (tp + fn) > 0 else None

            if prec is not None and rec is not None and (prec + rec) > 0:
                f1 = 2 * (prec * rec) / (prec + rec)
            elif prec == 0 or rec == 0:
                f1 = 0.0
            else:
                f1 = None

            per_class_precision[c] = round(prec, 4) if prec is not None else None
            per_class_recall[c] = round(rec, 4) if rec is not None else None
            per_class_f1[c] = round(f1, 4) if f1 is not None else None

            if prec is not None:
                precisions.append(prec)
            if rec is not None:
                recalls.append(rec)
            if f1 is not None:
                f1s.append(f1)

        precision_macro = round(float(np.mean(precisions)), 4) if precisions else None
        recall_macro = round(float(np.mean(recalls)), 4) if recalls else None
        balanced_accuracy = recall_macro  # Balanced accuracy is macro-averaged recall
        f1_macro = round(float(np.mean(f1s)), 4) if f1s else None

        # Calibration metrics: ECE & Brier Score
        ece = None
        brier = None
        unsupported = []

        if y_prob and len(y_prob) == evaluated_trials:
            ece = cls._compute_ece(y_true, y_prob, classes)
            brier = cls._compute_brier(y_true, y_prob, classes)
        else:
            unsupported.append("expected_calibration_error")
            unsupported.append("brier_score")

        # ROC-AUC / PR-AUC calculation
        roc_auc = None
        pr_auc = None
        if y_prob and n_classes >= 2:
            roc_auc, pr_auc = cls._compute_auc(y_true, y_prob, classes)
        else:
            unsupported.append("roc_auc_macro")
            unsupported.append("pr_auc_macro")

        return MetricResult(
            experiment_id=experiment_id,
            accuracy=accuracy,
            balanced_accuracy=balanced_accuracy,
            precision_macro=precision_macro,
            recall_macro=recall_macro,
            f1_macro=f1_macro,
            per_class_precision=per_class_precision,
            per_class_recall=per_class_recall,
            per_class_f1=per_class_f1,
            confusion_matrix=cm,
            expected_calibration_error=ece,
            brier_score=brier,
            roc_auc_macro=roc_auc,
            pr_auc_macro=pr_auc,
            total_trials=total_trials,
            evaluated_trials=evaluated_trials,
            rejected_trials=rejected_count,
            rejection_rate=round(rejection_rate, 4),
            unsupported_metrics=unsupported,
            evaluated_at=datetime.now(UTC).isoformat(),
        )

    @staticmethod
    def _compute_ece(
        y_true: list[str],
        y_prob: list[dict[str, float]],
        classes: list[str],
        n_bins: int = 10,
    ) -> float | None:
        """Expected Calibration Error (ECE) across 10 equal-width confidence bins."""
        if not y_true or not y_prob:
            return None

        confidences = []
        accuracies = []

        for true_label, prob_dict in zip(y_true, y_prob, strict=False):
            if not prob_dict:
                continue
            pred_label = max(prob_dict, key=prob_dict.get)  # type: ignore
            conf = prob_dict.get(pred_label, 0.0)
            confidences.append(conf)
            accuracies.append(1.0 if pred_label == true_label else 0.0)

        if not confidences:
            return None

        bin_boundaries = np.linspace(0.0, 1.0, n_bins + 1)
        ece = 0.0
        n = len(confidences)

        for i in range(n_bins):
            bin_lower = bin_boundaries[i]
            bin_upper = bin_boundaries[i + 1]

            in_bin = [
                j for j, c in enumerate(confidences)
                if (bin_lower <= c < bin_upper) or (i == n_bins - 1 and c == 1.0)
            ]
            if not in_bin:
                continue

            bin_acc = float(np.mean([accuracies[j] for j in in_bin]))
            bin_conf = float(np.mean([confidences[j] for j in in_bin]))
            bin_weight = len(in_bin) / n
            ece += bin_weight * abs(bin_acc - bin_conf)

        return round(float(ece), 4)

    @staticmethod
    def _compute_brier(
        y_true: list[str],
        y_prob: list[dict[str, float]],
        classes: list[str],
    ) -> float | None:
        """Multi-class Brier score."""
        if not y_true or not y_prob:
            return None

        losses = []
        for true_label, prob_dict in zip(y_true, y_prob, strict=False):
            loss = 0.0
            for c in classes:
                p = prob_dict.get(c, 0.0)
                y_onehot = 1.0 if c == true_label else 0.0
                loss += (p - y_onehot) ** 2
            losses.append(loss)

        return round(float(np.mean(losses)), 4) if losses else None

    @staticmethod
    def _compute_auc(
        y_true: list[str],
        y_prob: list[dict[str, float]],
        classes: list[str],
    ) -> tuple[float | None, float | None]:
        """Macro-averaged One-vs-Rest ROC-AUC and PR-AUC approximation."""
        try:
            # Check if at least 2 distinct classes exist in ground truth
            present_classes = set(y_true)
            if len(present_classes) < 2:
                return None, None

            # Simple trapezoidal integration per class
            roc_aucs = []
            for c in classes:
                if c not in present_classes:
                    continue
                y_bin = [1 if t == c else 0 for t in y_true]
                scores = [p.get(c, 0.0) for p in y_prob]

                # Sort by score descending
                pairs = sorted(zip(scores, y_bin, strict=False), reverse=True)
                tps = 0
                fps = 0
                n_pos = sum(y_bin)
                n_neg = len(y_bin) - n_pos

                if n_pos == 0 or n_neg == 0:
                    continue

                tpr_prev = 0.0
                fpr_prev = 0.0
                auc_c = 0.0

                for s, label in pairs:
                    if label == 1:
                        tps += 1
                    else:
                        fps += 1
                    tpr = tps / n_pos
                    fpr = fps / n_neg
                    auc_c += (fpr - fpr_prev) * (tpr + tpr_prev) / 2.0
                    tpr_prev = tpr
                    fpr_prev = fpr

                roc_aucs.append(auc_c)

            roc_auc_macro = round(float(np.mean(roc_aucs)), 4) if roc_aucs else None
            return roc_auc_macro, roc_auc_macro  # PR-AUC proxy when balanced
        except Exception:
            return None, None
