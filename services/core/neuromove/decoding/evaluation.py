"""Group-aware cross-validation engine ensuring zero data leakage for motor-imagery decoding."""

import logging
from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import (
    GroupKFold,
    LeaveOneGroupOut,
    StratifiedGroupKFold,
    StratifiedKFold,
)

from .models import (
    ClassificationMetrics,
    ClassificationTask,
    ConfusionMatrixData,
    CVFoldResult,
    DecoderPipelineConfig,
    EvaluationProtocol,
    MetricStats,
    PerSubjectMetric,
)
from .pipeline import build_decoding_pipeline

logger = logging.getLogger("neuromove.decoding.evaluation")


def _calculate_stats(values: list[float]) -> MetricStats:
    """Calculate mean, std, median, min, max for a metric series."""
    if not values:
        return MetricStats(mean=0.0, std=0.0, median=0.0, min=0.0, max=0.0)
    arr = np.array(values, dtype=np.float64)
    return MetricStats(
        mean=float(np.mean(arr)),
        std=float(np.std(arr)),
        median=float(np.median(arr)),
        min=float(np.min(arr)),
        max=float(np.max(arr)),
    )


def _build_confusion_matrix_data(
    cm: np.ndarray,
    labels: list[str],
) -> ConfusionMatrixData:
    """Build structured ConfusionMatrixData with raw and row-normalized percentages."""
    raw_matrix = cm.tolist()
    row_sums = cm.sum(axis=1, keepdims=True)
    with np.errstate(divide="ignore", invalid="ignore"):
        norm_cm = np.where(row_sums > 0, cm / row_sums, 0.0)
    norm_matrix = norm_cm.round(4).tolist()

    return ConfusionMatrixData(
        labels=labels,
        matrix=raw_matrix,
        normalized_matrix=norm_matrix,
    )


def evaluate_decoder_pipeline(
    X: np.ndarray,
    y: np.ndarray,
    subjects: list[str],
    pipeline_config: DecoderPipelineConfig,
    task: ClassificationTask,
) -> tuple[ClassificationMetrics, Any]:
    """Execute leakage-safe group-aware cross-validation on motor-imagery epochs.

    Guarantees:
    1. CSP spatial filters and scalers are fitted ONLY on the training fold.
    2. For inter-subject protocols, train_subjects ∩ test_subjects = ∅.
    3. Fits a final model on all data for artifact persistence and extracts spatial patterns.

    Args:
        X: Epoch tensor of shape (n_epochs, n_channels, n_times).
        y: Integer target array of shape (n_epochs,).
        subjects: Subject identifier for each epoch.
        pipeline_config: Pipeline and cross-validation specification.
        task: Classification task specification.

    Returns:
        tuple containing:
            - ClassificationMetrics: Complete statistical breakdown and fold results.
            - fitted_final_pipeline: End-to-end pipeline fitted on all eligible data.
    """
    n_epochs, n_channels, n_times = X.shape
    unique_subjects = sorted(set(subjects))
    n_subjects = len(unique_subjects)

    if n_epochs < 4:
        raise ValueError(f"Insufficient epochs for cross-validation, found {n_epochs}.")

    if len(np.unique(y)) < 2:
        raise ValueError("Cross-validation requires at least 2 target classes in dataset.")

    # Select split strategy
    protocol = pipeline_config.evaluation_protocol
    splits: list[tuple[np.ndarray, np.ndarray]] = []

    match protocol:
        case EvaluationProtocol.LEAVE_ONE_SUBJECT_OUT:
            if n_subjects >= 2:
                logo = LeaveOneGroupOut()
                splits = list(logo.split(X, y, groups=subjects))
            else:
                logger.warning("Only 1 subject found, falling back to 5-fold StratifiedKFold")
                skf = StratifiedKFold(
                    n_splits=min(5, n_epochs // 2),
                    shuffle=True,
                    random_state=pipeline_config.random_state,
                )
                splits = list(skf.split(X, y))

        case EvaluationProtocol.GROUP_K_FOLD:
            n_splits = min(pipeline_config.n_splits, n_subjects)
            if n_splits >= 2:
                gkf = GroupKFold(n_splits=n_splits)
                splits = list(gkf.split(X, y, groups=subjects))
            else:
                skf = StratifiedKFold(
                    n_splits=min(5, n_epochs // 2),
                    shuffle=True,
                    random_state=pipeline_config.random_state,
                )
                splits = list(skf.split(X, y))

        case EvaluationProtocol.STRATIFIED_GROUP_K_FOLD:
            n_splits = min(pipeline_config.n_splits, n_subjects)
            if n_splits >= 2:
                sgkf = StratifiedGroupKFold(
                    n_splits=n_splits,
                    shuffle=True,
                    random_state=pipeline_config.random_state,
                )
                splits = list(sgkf.split(X, y, groups=subjects))
            else:
                skf = StratifiedKFold(
                    n_splits=min(5, n_epochs // 2),
                    shuffle=True,
                    random_state=pipeline_config.random_state,
                )
                splits = list(skf.split(X, y))

        case EvaluationProtocol.WITHIN_SUBJECT_K_FOLD:
            skf = StratifiedKFold(
                n_splits=min(pipeline_config.n_splits, n_epochs // 2),
                shuffle=True,
                random_state=pipeline_config.random_state,
            )
            splits = list(skf.split(X, y))

    if not splits:
        raise ValueError("Failed to generate cross-validation splits.")

    fold_results: list[CVFoldResult] = []
    subject_predictions: dict[str, dict[str, list[int]]] = {
        s: {"y_true": [], "y_pred": []} for s in unique_subjects
    }

    acc_list: list[float] = []
    bal_acc_list: list[float] = []
    prec_list: list[float] = []
    rec_list: list[float] = []
    f1_list: list[float] = []
    aggregate_cm = np.zeros((len(task.class_labels), len(task.class_labels)), dtype=np.int64)

    class_names = [str(lbl) for lbl in task.class_labels]

    for fold_idx, (train_idx, test_idx) in enumerate(splits):
        train_subjs = sorted({subjects[i] for i in train_idx})
        test_subjs = sorted({subjects[i] for i in test_idx})

        # Strict inter-subject leakage check
        if protocol in (
            EvaluationProtocol.LEAVE_ONE_SUBJECT_OUT,
            EvaluationProtocol.GROUP_K_FOLD,
            EvaluationProtocol.STRATIFIED_GROUP_K_FOLD,
        ):
            overlap = set(train_subjs).intersection(set(test_subjs))
            if overlap:
                logger.error(
                    "LEAKAGE VIOLATION DETECTED in Fold %d: Overlapping subjects %s",
                    fold_idx,
                    overlap,
                )
                raise RuntimeError(
                    f"Data leakage invariant violated in fold {fold_idx}: subjects {overlap} present in both train and test."
                )

        X_train, y_train = X[train_idx], y[train_idx]
        X_test, y_test = X[test_idx], y[test_idx]

        # Verify training fold contains at least 2 classes for CSP
        if len(np.unique(y_train)) < 2:
            logger.warning(
                "Fold %d training data lacks class diversity (%s), skipping fold",
                fold_idx,
                np.unique(y_train),
            )
            continue

        # Instantiate fresh pipeline for fold
        fold_pipeline = build_decoding_pipeline(pipeline_config, n_channels)
        fold_pipeline.fit(X_train, y_train)

        y_pred = fold_pipeline.predict(X_test)

        acc = float(accuracy_score(y_test, y_pred))
        bal_acc = float(balanced_accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
        rec = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
        f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

        cm = confusion_matrix(y_test, y_pred, labels=list(range(len(task.class_labels)))).astype(
            np.int64
        )
        aggregate_cm += cm

        acc_list.append(acc)
        bal_acc_list.append(bal_acc)
        prec_list.append(prec)
        rec_list.append(rec)
        f1_list.append(f1)

        # Collect per-subject predictions
        for t_idx, true_val, pred_val in zip(test_idx, y_test, y_pred, strict=False):
            sub = subjects[t_idx]
            subject_predictions[sub]["y_true"].append(int(true_val))
            subject_predictions[sub]["y_pred"].append(int(pred_val))

        fold_cm_data = _build_confusion_matrix_data(cm, class_names)

        fold_results.append(
            CVFoldResult(
                fold_id=fold_idx + 1,
                train_subjects=train_subjs,
                test_subjects=test_subjs,
                train_epochs=len(train_idx),
                test_epochs=len(test_idx),
                accuracy=acc,
                balanced_accuracy=bal_acc,
                precision=prec,
                recall=rec,
                f1=f1,
                confusion_matrix=fold_cm_data,
            )
        )

    if not fold_results:
        raise RuntimeError("All cross-validation folds failed due to insufficient class diversity.")

    # Compute per-subject performance breakdown
    per_subject_metrics: list[PerSubjectMetric] = []
    for sub, preds in subject_predictions.items():
        y_true_s = preds["y_true"]
        y_pred_s = preds["y_pred"]
        if y_true_s:
            s_acc = float(accuracy_score(y_true_s, y_pred_s))
            s_bal = (
                float(balanced_accuracy_score(y_true_s, y_pred_s))
                if len(set(y_true_s)) > 1
                else s_acc
            )
            s_f1 = float(f1_score(y_true_s, y_pred_s, average="weighted", zero_division=0))
            per_subject_metrics.append(
                PerSubjectMetric(
                    subject_id=sub,
                    epoch_count=len(y_true_s),
                    accuracy=s_acc,
                    balanced_accuracy=s_bal,
                    f1=s_f1,
                )
            )

    # Class distribution and chance level
    class_dist = {str(lbl): int((y == idx).sum()) for lbl, idx in task.label_mapping.items()}
    total_y = len(y)
    max_class_prop = max(class_dist.values()) / total_y if total_y > 0 else 0.5
    chance_level = float(max_class_prop)

    metrics = ClassificationMetrics(
        accuracy=_calculate_stats(acc_list),
        balanced_accuracy=_calculate_stats(bal_acc_list),
        precision=_calculate_stats(prec_list),
        recall=_calculate_stats(rec_list),
        f1=_calculate_stats(f1_list),
        chance_level=chance_level,
        class_distribution=class_dist,
        confusion_matrix=_build_confusion_matrix_data(aggregate_cm, class_names),
        per_subject_metrics=per_subject_metrics,
        per_fold_results=fold_results,
    )

    # Fit final pipeline on all eligible data for artifact serialization
    final_pipeline = build_decoding_pipeline(pipeline_config, n_channels)
    final_pipeline.fit(X, y)

    return metrics, final_pipeline
