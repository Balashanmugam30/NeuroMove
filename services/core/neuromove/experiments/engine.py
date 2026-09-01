"""Group-Aware & Nested Cross-Validation Engine for Phase 12 AI Model Laboratory."""

from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
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
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from neuromove.decoding.csp import build_csp_transformer
from neuromove.decoding.models import (
    ClassificationMetrics,
    ConfusionMatrixData,
    CVFoldResult,
    MetricStats,
    PerSubjectMetric,
)
from neuromove.experiments.adapters import get_model_adapter
from neuromove.experiments.models import (
    ExperimentConfig,
    FeatureRepresentation,
    FoldAssignment,
    OutOfFoldPredictionRecord,
    OutOfFoldPredictionSet,
    PerSessionMetric,
    SearchResult,
    SearchType,
)
from neuromove.experiments.search import NestedHyperparameterSearcher


class ExperimentEngine:
    """Executes leakage-safe nested and group-aware cross-validation experiments."""

    def __init__(self, config: ExperimentConfig):
        self.config = config
        self.adapter = get_model_adapter(config.model_family)

    def _compute_fold_hash(
        self,
        fold_id: int,
        train_subjects: list[str],
        test_subjects: list[str],
    ) -> str:
        payload = {
            "fold_id": fold_id,
            "train_subjects": sorted(train_subjects),
            "test_subjects": sorted(test_subjects),
            "protocol": self.config.evaluation_protocol.value,
            "seed": self.config.random_state,
        }
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:12]

    def _create_cv_splits(
        self,
        X: np.ndarray,
        y: np.ndarray,
        groups: np.ndarray,
        sessions: np.ndarray | None = None,
    ) -> list[tuple[np.ndarray, np.ndarray]]:
        """Generate outer CV splits adhering strictly to group separation."""
        unique_groups = np.unique(groups)
        protocol = self.config.evaluation_protocol.value

        if protocol == "LEAVE_ONE_SUBJECT_OUT":
            if len(unique_groups) < 2:
                raise ValueError(
                    f"LeaveOneSubjectOut requires at least 2 subjects, found {len(unique_groups)}."
                )
            logo = LeaveOneGroupOut()
            return list(logo.split(X, y, groups=groups))

        elif protocol == "STRATIFIED_GROUP_KFOLD":
            n_splits = min(self.config.n_splits, len(unique_groups))
            if n_splits < 2:
                raise ValueError(
                    f"StratifiedGroupKFold requires at least 2 subject groups, found {len(unique_groups)}."
                )
            try:
                sgkf = StratifiedGroupKFold(n_splits=n_splits)
                return list(sgkf.split(X, y, groups=groups))
            except Exception:
                gkf = GroupKFold(n_splits=n_splits)
                return list(gkf.split(X, y, groups=groups))

        elif protocol == "GROUP_KFOLD":
            n_splits = min(self.config.n_splits, len(unique_groups))
            if n_splits < 2:
                raise ValueError(
                    f"GroupKFold requires at least 2 subject groups, found {len(unique_groups)}."
                )
            gkf = GroupKFold(n_splits=n_splits)
            return list(gkf.split(X, y, groups=groups))

        elif protocol == "CROSS_SESSION":
            if sessions is None or len(np.unique(sessions)) < 2:
                raise ValueError("CrossSession evaluation requires at least 2 unique sessions.")
            logo = LeaveOneGroupOut()
            return list(logo.split(X, y, groups=sessions))

        elif protocol == "WITHIN_SUBJECT_KFOLD":
            n_splits = min(self.config.n_splits, len(np.unique(y)))
            skf = StratifiedKFold(
                n_splits=max(2, n_splits),
                shuffle=True,
                random_state=self.config.random_state,
            )
            return list(skf.split(X, y))

        else:
            raise ValueError(f"Unsupported evaluation protocol: {protocol}")

    def run_experiment(
        self,
        X: np.ndarray,
        y: np.ndarray,
        groups: np.ndarray,
        epoch_ids: list[str],
        sessions: list[str],
        runs: list[str],
        label_names: list[str],
        label_mapping: dict[str, int],
        channels: list[str],
    ) -> tuple[
        ClassificationMetrics,
        list[FoldAssignment],
        OutOfFoldPredictionSet,
        list[PerSessionMetric],
        Pipeline,
    ]:
        """Execute full nested cross-validation and out-of-fold predictions."""
        inv_label_map = {v: k for k, v in label_mapping.items()}
        sessions_arr = np.array(sessions)

        splits = self._create_cv_splits(X, y, groups, sessions=sessions_arr)
        if not splits:
            raise RuntimeError("No cross-validation splits generated.")

        fold_assignments: list[FoldAssignment] = []
        fold_results: list[CVFoldResult] = []
        oof_predictions: list[OutOfFoldPredictionRecord] = []

        # Nested searcher instance
        searcher = NestedHyperparameterSearcher(
            search_config=self.config.search_config,
            model_family=self.config.model_family,
            representation=self.config.representation,
            base_csp_config=self.config.csp_config,
            scale_features=self.config.scale_features,
            random_state=self.config.random_state,
        )

        for fold_idx, (train_idx, test_idx) in enumerate(splits, start=1):
            train_subjs = sorted(set(groups[train_idx]))
            test_subjs = sorted(set(groups[test_idx]))

            # Invariant Check: inter-subject zero test data leakage
            if self.config.evaluation_mode.value == "INTER_SUBJECT":
                leakage = set(train_subjs).intersection(set(test_subjs))
                if leakage:
                    raise RuntimeError(
                        f"Data Leakage Invariant Violation in fold {fold_idx}: "
                        f"Subject(s) {leakage} appear in both train and test partitions!"
                    )

            X_train, y_train = X[train_idx], y[train_idx]
            X_test, y_test = X[test_idx], y[test_idx]
            groups_train = groups[train_idx]

            # 1. Inner Hyperparameter Search if configured
            search_res: SearchResult | None = None
            effective_params = dict(self.config.model_params)

            if self.config.search_config.search_type != SearchType.NONE:
                search_res = searcher.search(
                    X_train, y_train, groups_train=groups_train, channels=channels
                )
                effective_params.update(search_res.best_parameters)

            # 2. Build and Fit Outer Training Pipeline
            steps: list[tuple[str, Any]] = []

            # Dynamic CSP config if tuned
            csp_n_comp = effective_params.get("n_components", self.config.csp_config.n_components)
            fold_csp_cfg = self.config.csp_config.model_copy(update={"n_components": csp_n_comp})

            if self.config.representation == FeatureRepresentation.CSP_LOG_POWER:
                steps.append(("csp", build_csp_transformer(fold_csp_cfg, X_train.shape[1])))

            if self.config.scale_features:
                steps.append(("scaler", StandardScaler()))

            clf = self.adapter.build_estimator(
                effective_params, random_state=self.config.random_state
            )
            steps.append(("classifier", clf))

            outer_pipeline = Pipeline(steps)

            # Fit strictly on outer train fold
            outer_pipeline.fit(X_train, y_train)

            # 3. Predict on Outer Held-Out Test Fold
            y_pred = outer_pipeline.predict(X_test)

            # Decision scores / probabilities
            decision_scores: np.ndarray | None = None
            prob_vectors: list[dict[str, float] | None] = [None] * len(test_idx)

            classifier_step = outer_pipeline.named_steps["classifier"]
            if hasattr(outer_pipeline, "predict_proba"):
                try:
                    probs = outer_pipeline.predict_proba(X_test)
                    prob_vectors = [
                        {
                            inv_label_map.get(ci, str(ci)): float(p_val)
                            for ci, p_val in enumerate(row)
                        }
                        for row in probs
                    ]
                except Exception:
                    pass

            if hasattr(classifier_step, "decision_function"):
                try:
                    decision_scores = outer_pipeline.decision_function(X_test)
                except Exception:
                    pass

            # Compute fold metrics
            f_acc = float(accuracy_score(y_test, y_pred))
            f_bal_acc = float(balanced_accuracy_score(y_test, y_pred))
            f_prec = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
            f_rec = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
            f_f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

            f_cm = confusion_matrix(y_test, y_pred, labels=list(range(len(label_names))))
            f_cm_norm = (
                f_cm.astype(float) / np.maximum(f_cm.sum(axis=1, keepdims=True), 1e-9)
            ).tolist()

            fold_cm_data = ConfusionMatrixData(
                labels=label_names,
                matrix=f_cm.tolist(),
                normalized_matrix=f_cm_norm,
            )

            fold_results.append(
                CVFoldResult(
                    fold_id=fold_idx,
                    train_subjects=train_subjs,
                    test_subjects=test_subjs,
                    train_epochs=len(train_idx),
                    test_epochs=len(test_idx),
                    accuracy=round(f_acc, 4),
                    balanced_accuracy=round(f_bal_acc, 4),
                    precision=round(f_prec, 4),
                    recall=round(f_rec, 4),
                    f1=round(f_f1, 4),
                    confusion_matrix=fold_cm_data,
                )
            )

            # Record Fold Assignment Manifest
            train_class_counts = {
                inv_label_map.get(k, str(k)): int(v) for k, v in Counter(y_train).items()
            }
            test_class_counts = {
                inv_label_map.get(k, str(k)): int(v) for k, v in Counter(y_test).items()
            }
            f_hash = self._compute_fold_hash(fold_idx, train_subjs, test_subjs)

            fold_assignments.append(
                FoldAssignment(
                    fold_id=fold_idx,
                    train_subjects=train_subjs,
                    test_subjects=test_subjs,
                    train_epoch_count=len(train_idx),
                    test_epoch_count=len(test_idx),
                    train_class_counts=train_class_counts,
                    test_class_counts=test_class_counts,
                    fold_hash=f_hash,
                    inner_search_result=search_res,
                )
            )

            # Record Out-of-Fold Predictions
            for sample_i, global_idx in enumerate(test_idx):
                true_int = int(y_test[sample_i])
                pred_int = int(y_pred[sample_i])
                true_lbl_str = inv_label_map.get(true_int, str(true_int))
                pred_lbl_str = inv_label_map.get(pred_int, str(pred_int))

                dec_score: float | None = None
                if decision_scores is not None:
                    ds = decision_scores[sample_i]
                    dec_score = float(ds[0]) if isinstance(ds, (list, np.ndarray)) else float(ds)

                oof_predictions.append(
                    OutOfFoldPredictionRecord(
                        epoch_id=epoch_ids[global_idx],
                        subject_id=str(groups[global_idx]),
                        session_id=str(sessions[global_idx]),
                        run_id=str(runs[global_idx]),
                        true_label=true_lbl_str,
                        predicted_label=pred_lbl_str,
                        is_correct=(true_int == pred_int),
                        decision_score=dec_score,
                        probability_vector=prob_vectors[sample_i],
                        fold_id=fold_idx,
                        model_id=f"mdl_{self.config.experiment_id}",
                        experiment_id=self.config.experiment_id,
                    )
                )

        # 4. Aggregate Statistical Summary Metrics
        def _dist(vals: list[float]) -> MetricStats:
            arr = np.array(vals)
            return MetricStats(
                mean=round(float(np.mean(arr)), 4),
                std=round(float(np.std(arr)), 4),
                median=round(float(np.median(arr)), 4),
                min=round(float(np.min(arr)), 4),
                max=round(float(np.max(arr)), 4),
            )

        acc_dist = _dist([f.accuracy for f in fold_results])
        bal_acc_dist = _dist([f.balanced_accuracy for f in fold_results])
        prec_dist = _dist([f.precision for f in fold_results])
        rec_dist = _dist([f.recall for f in fold_results])
        f1_dist = _dist([f.f1 for f in fold_results])

        # Aggregate Confusion Matrix across all OOF predictions
        y_true_all = [label_mapping[p.true_label] for p in oof_predictions]
        y_pred_all = [label_mapping[p.predicted_label] for p in oof_predictions]

        agg_cm = confusion_matrix(y_true_all, y_pred_all, labels=list(range(len(label_names))))
        agg_cm_norm = (
            agg_cm.astype(float) / np.maximum(agg_cm.sum(axis=1, keepdims=True), 1e-9)
        ).tolist()

        agg_confusion_matrix = ConfusionMatrixData(
            labels=label_names,
            matrix=agg_cm.tolist(),
            normalized_matrix=agg_cm_norm,
        )

        # Per-Subject Metrics
        subj_preds: dict[str, list[OutOfFoldPredictionRecord]] = defaultdict(list)
        for p in oof_predictions:
            subj_preds[p.subject_id].append(p)

        per_subject_metrics: list[PerSubjectMetric] = []
        for subj_id, s_preds in subj_preds.items():
            s_yt = [label_mapping[p.true_label] for p in s_preds]
            s_yp = [label_mapping[p.predicted_label] for p in s_preds]
            per_subject_metrics.append(
                PerSubjectMetric(
                    subject_id=subj_id,
                    epoch_count=len(s_preds),
                    accuracy=round(float(accuracy_score(s_yt, s_yp)), 4),
                    balanced_accuracy=round(float(balanced_accuracy_score(s_yt, s_yp)), 4),
                    f1=round(
                        float(f1_score(s_yt, s_yp, average="weighted", zero_division=0)),
                        4,
                    ),
                )
            )

        # Per-Session Metrics
        sess_preds: dict[tuple[str, str], list[OutOfFoldPredictionRecord]] = defaultdict(list)
        for p in oof_predictions:
            sess_preds[(p.subject_id, p.session_id)].append(p)

        per_session_metrics: list[PerSessionMetric] = []
        for (subj_id, sess_id), sp_list in sess_preds.items():
            s_yt = [label_mapping[p.true_label] for p in sp_list]
            s_yp = [label_mapping[p.predicted_label] for p in sp_list]
            per_session_metrics.append(
                PerSessionMetric(
                    subject_id=subj_id,
                    session_id=sess_id,
                    epoch_count=len(sp_list),
                    accuracy=round(float(accuracy_score(s_yt, s_yp)), 4),
                    balanced_accuracy=round(float(balanced_accuracy_score(s_yt, s_yp)), 4),
                    f1=round(
                        float(f1_score(s_yt, s_yp, average="weighted", zero_division=0)),
                        4,
                    ),
                )
            )

        # Calculate theoretical chance level
        unique_classes = len(label_names)
        chance_level = 1.0 / unique_classes if unique_classes > 0 else 0.5

        overall_metrics = ClassificationMetrics(
            accuracy=acc_dist,
            balanced_accuracy=bal_acc_dist,
            precision=prec_dist,
            recall=rec_dist,
            f1=f1_dist,
            chance_level=chance_level,
            class_distribution={
                inv_label_map.get(k, str(k)): int(v) for k, v in Counter(y).items()
            },
            confusion_matrix=agg_confusion_matrix,
            per_subject_metrics=per_subject_metrics,
            per_fold_results=fold_results,
        )

        oof_set = OutOfFoldPredictionSet(
            experiment_id=self.config.experiment_id,
            total_predictions=len(oof_predictions),
            coverage_percentage=100.0
            if len(oof_predictions) == len(X)
            else round((len(oof_predictions) / len(X)) * 100, 2),
            predictions=oof_predictions,
        )

        # 5. Fit Final Full-Dataset Pipeline for Model Registry
        final_steps: list[tuple[str, Any]] = []
        if self.config.representation == FeatureRepresentation.CSP_LOG_POWER:
            final_steps.append(("csp", build_csp_transformer(self.config.csp_config, X.shape[1])))

        if self.config.scale_features:
            final_steps.append(("scaler", StandardScaler()))

        final_clf = self.adapter.build_estimator(
            self.config.model_params, random_state=self.config.random_state
        )

        final_steps.append(("classifier", final_clf))

        final_pipeline = Pipeline(final_steps)
        final_pipeline.fit(X, y)

        return (
            overall_metrics,
            fold_assignments,
            oof_set,
            per_session_metrics,
            final_pipeline,
        )
