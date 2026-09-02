"""Controlled Adaptation Engine: Multi-stage candidate fitting, leakage-safe validation, and error analysis."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

import numpy as np
from mne.decoding import CSP
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from neuromove.adaptation.batch_engine import AdaptationBatchEngine
from neuromove.adaptation.models import (
    AdaptationDataBatch,
    AdaptationPolicy,
    AdaptationRun,
    AdaptationRunStatus,
    CandidateComparison,
    generate_adaptation_id,
)
from neuromove.adaptation.policy import AdaptationPolicyEngine
from neuromove.decoding.models import ConfusionMatrixData
from neuromove.experiments.models import ModelFamily


class AdaptationEngine:
    """Executes controlled adaptation experiments under zero data leakage constraints."""

    @classmethod
    def execute_adaptation_run(
        cls,
        base_model_id: str,
        base_pipeline: Any,
        policy: AdaptationPolicy,
        data_batches: list[AdaptationDataBatch],
        base_training_data: tuple[
            np.ndarray, np.ndarray, list[str]
        ],  # (X_base, y_base, ep_ids_base)
        base_validation_data: tuple[
            np.ndarray, np.ndarray, list[str]
        ],  # (X_val_base, y_val_base, ep_ids_val_base)
        new_candidate_data: tuple[np.ndarray, np.ndarray, list[str]],  # (X_new, y_new, ep_ids_new)
        model_family: ModelFamily = ModelFamily.LDA,
        scope: str = "SUBJECT",
        subject_id: str | None = None,
    ) -> tuple[AdaptationRun, Any, str]:
        """
        Execute full controlled adaptation pipeline.
        Returns (adaptation_run, fitted_candidate_pipeline, candidate_model_id).
        """
        batch_ids = [b.batch_id for b in data_batches]
        adaptation_id = generate_adaptation_id(base_model_id, batch_ids, policy.policy_id)

        # 1. Stage: BUILDING_TRAINING_SET & ZERO LEAKAGE PARTITIONING
        X_base_train, y_base_train, ids_base_train = base_training_data
        X_base_val, y_base_val, ids_base_val = base_validation_data
        X_new_raw, y_new_raw, ids_new_raw = new_candidate_data

        # Detect and remove duplicates in new data relative to base train
        dup_count, unique_new_ids = AdaptationBatchEngine.detect_duplicate_epochs(
            ids_base_train, ids_new_raw
        )

        # Filter new data to unique epochs
        if dup_count > 0:
            keep_mask = np.array([eid in set(unique_new_ids) for eid in ids_new_raw])
            X_new = X_new_raw[keep_mask]
            y_new = y_new_raw[keep_mask]
            ids_new = [ids_new_raw[i] for i in range(len(ids_new_raw)) if keep_mask[i]]
        else:
            X_new, y_new, ids_new = X_new_raw, y_new_raw, ids_new_raw

        # Split new data into New Training (e.g. 60%) and New Validation (e.g. 40%)
        n_new = len(X_new)
        n_new_train = max(1, int(0.6 * n_new)) if n_new > 1 else 1

        X_new_train = X_new[:n_new_train]
        y_new_train = y_new[:n_new_train]
        ids_new_train = ids_new[:n_new_train]

        X_new_val = X_new[n_new_train:]
        y_new_val = y_new[n_new_train:]
        ids_new_val = ids_new[n_new_train:]

        # Compose Candidate Training Data
        if policy.retention_strategy == "NEW_DATA_ONLY":
            X_train = X_new_train
            y_train = y_new_train
            train_ids = ids_new_train
            base_retained_count = 0
        else:  # BASELINE_PLUS_NEW or NEW_PLUS_RETAINED_DATA
            X_train = (
                np.concatenate([X_base_train, X_new_train], axis=0)
                if len(X_base_train) > 0
                else X_new_train
            )
            y_train = (
                np.concatenate([y_base_train, y_new_train], axis=0)
                if len(y_base_train) > 0
                else y_new_train
            )
            train_ids = ids_base_train + ids_new_train
            base_retained_count = len(ids_base_train)

        # Compose Protected Validation Data (Historical Protected Val + New Val)
        if len(X_base_val) > 0 and len(X_new_val) > 0:
            X_val = np.concatenate([X_base_val, X_new_val], axis=0)
            y_val = np.concatenate([y_base_val, y_new_val], axis=0)
            val_ids = ids_base_val + ids_new_val
        elif len(X_new_val) > 0:
            X_val, y_val, val_ids = X_new_val, y_new_val, ids_new_val
        else:
            X_val, y_val, val_ids = X_base_val, y_base_val, ids_base_val

        # Mandatory Leakage Check
        overlap = set(train_ids).intersection(set(val_ids))
        train_val_overlap_count = len(overlap)
        is_leakage_safe = train_val_overlap_count == 0

        train_fp = AdaptationBatchEngine.compute_data_fingerprint(train_ids, X_train)
        val_fp = AdaptationBatchEngine.compute_data_fingerprint(val_ids, X_val)

        training_composition = {
            "base_retained_count": base_retained_count,
            "new_count": len(ids_new_train),
            "total_count": len(train_ids),
            "fingerprint": train_fp,
        }
        validation_composition = {
            "protected_count": len(val_ids),
            "fingerprint": val_fp,
        }
        leakage_check = {
            "overlap_count": train_val_overlap_count,
            "is_leakage_safe": is_leakage_safe,
        }

        # 2. Stage: TRAINING Candidate Model
        candidate_pipeline = cls._build_and_fit_pipeline(
            X_train,
            y_train,
            model_family=model_family,
            random_state=policy.random_state,
        )

        candidate_digest = hashlib.sha256(f"{adaptation_id}_{train_fp}".encode()).hexdigest()[:16]
        candidate_model_id = f"pmdl_adapt_{candidate_digest}"

        # 3. Stage: VALIDATING & COMPARING on Protected Validation Data
        incumbent_preds = base_pipeline.predict(X_val)
        candidate_preds = candidate_pipeline.predict(X_val)

        # Incumbent Metrics on Validation Set
        inc_acc = float(accuracy_score(y_val, incumbent_preds))
        inc_bal_acc = float(balanced_accuracy_score(y_val, incumbent_preds))
        inc_f1 = float(f1_score(y_val, incumbent_preds, average="weighted", zero_division=0))

        # Candidate Metrics on Validation Set
        cand_acc = float(accuracy_score(y_val, candidate_preds))
        cand_bal_acc = float(balanced_accuracy_score(y_val, candidate_preds))
        cand_f1 = float(f1_score(y_val, candidate_preds, average="weighted", zero_division=0))

        delta_acc = round(cand_acc - inc_acc, 4)
        delta_bal_acc = round(cand_bal_acc - inc_bal_acc, 4)
        delta_f1 = round(cand_f1 - inc_f1, 4)

        # Confusion Matrices
        labels_unique = sorted(set(np.unique(y_val)).union(set(np.unique(candidate_preds))))
        inc_cm = confusion_matrix(y_val, incumbent_preds, labels=labels_unique)

        cand_cm = confusion_matrix(y_val, candidate_preds, labels=labels_unique)

        def to_cm_obj(cm_arr: np.ndarray, labels: list[Any]) -> ConfusionMatrixData:
            norm = cm_arr.astype(float) / np.maximum(cm_arr.sum(axis=1, keepdims=True), 1e-9)
            return ConfusionMatrixData(
                labels=[str(lbl) for lbl in labels],
                matrix=cm_arr.tolist(),
                normalized_matrix=norm.round(4).tolist(),
            )

        # Error Analysis (Fixed vs New vs Persistent Errors)
        inc_errors = incumbent_preds != y_val
        cand_errors = candidate_preds != y_val

        fixed_errors = int(np.sum(inc_errors & (~cand_errors)))
        new_errors = int(np.sum((~inc_errors) & cand_errors))
        persistent_errors = int(np.sum(inc_errors & cand_errors))

        is_regression = cand_bal_acc < inc_bal_acc
        regression_amount = max(0.0, round(inc_bal_acc - cand_bal_acc, 4))

        comparison = CandidateComparison(
            incumbent_model_id=base_model_id,
            candidate_model_id=candidate_model_id,
            task_id="LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
            validation_sample_count=len(val_ids),
            incumbent_balanced_accuracy=round(inc_bal_acc, 4),
            candidate_balanced_accuracy=round(cand_bal_acc, 4),
            delta_balanced_accuracy=delta_bal_acc,
            incumbent_f1=round(inc_f1, 4),
            candidate_f1=round(cand_f1, 4),
            delta_f1=delta_f1,
            incumbent_accuracy=round(inc_acc, 4),
            candidate_accuracy=round(cand_acc, 4),
            delta_accuracy=delta_acc,
            chance_level=0.5,
            incumbent_confusion_matrix=to_cm_obj(inc_cm, labels_unique),
            candidate_confusion_matrix=to_cm_obj(cand_cm, labels_unique),
            error_analysis={
                "fixed_errors": fixed_errors,
                "new_errors": new_errors,
                "persistent_errors": persistent_errors,
            },
            is_regression=is_regression,
            regression_amount=regression_amount,
        )

        # 4. Stage: APPROVAL_PENDING & PROMOTION ELIGIBILITY
        val_class_counts: dict[str, int] = {}
        for y_item in y_val:
            val_class_counts[str(y_item)] = val_class_counts.get(str(y_item), 0) + 1

        eligibility = AdaptationPolicyEngine.evaluate_promotion_eligibility(
            policy=policy,
            incumbent_balanced_accuracy=inc_bal_acc,
            candidate_balanced_accuracy=cand_bal_acc,
            validation_sample_count=len(val_ids),
            validation_class_counts=val_class_counts,
            train_val_overlap_count=train_val_overlap_count,
        )

        status = (
            AdaptationRunStatus.APPROVAL_PENDING if is_leakage_safe else AdaptationRunStatus.FAILED
        )

        run = AdaptationRun(
            adaptation_id=adaptation_id,
            base_model_id=base_model_id,
            candidate_model_id=candidate_model_id,
            policy_id=policy.policy_id,
            scope=policy.scope,
            subject_id=subject_id,
            data_batch_ids=batch_ids,
            status=status,
            training_composition=training_composition,
            validation_composition=validation_composition,
            leakage_check=leakage_check,
            incumbent_metrics={
                "accuracy": round(inc_acc, 4),
                "balanced_accuracy": round(inc_bal_acc, 4),
                "f1": round(inc_f1, 4),
            },
            candidate_metrics={
                "accuracy": round(cand_acc, 4),
                "balanced_accuracy": round(cand_bal_acc, 4),
                "f1": round(cand_f1, 4),
            },
            comparison=comparison,
            promotion_eligibility=eligibility,
            promotion_decision=None,
            completed_at=datetime.now(UTC).isoformat(),
        )

        return run, candidate_pipeline, candidate_model_id

    @staticmethod
    def _build_and_fit_pipeline(
        X: np.ndarray,
        y: np.ndarray,
        model_family: ModelFamily = ModelFamily.LDA,
        random_state: int = 42,
    ) -> Pipeline:
        """Fit CSP + Classifier pipeline on training data."""
        n_channels = X.shape[1]
        n_components = min(4, n_channels)

        csp = CSP(
            n_components=n_components,
            cov_est="concat",
            log=True,
            norm_trace=False,
            component_order="mutual_info",
            transform_into="average_power",
        )

        if model_family == ModelFamily.SVM_LINEAR:
            clf = SVC(kernel="linear", C=1.0, random_state=random_state)
            pipeline = Pipeline([("csp", csp), ("scaler", StandardScaler()), ("clf", clf)])
        else:
            clf = LinearDiscriminantAnalysis(solver="svd")
            pipeline = Pipeline([("csp", csp), ("clf", clf)])

        pipeline.fit(X, y)
        return pipeline
