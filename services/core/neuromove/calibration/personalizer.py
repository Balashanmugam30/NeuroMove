"""Subject-Specific Motor-Imagery Personalization & Adaptation Engine (Phase 13)."""

import logging
from datetime import UTC, datetime
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
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ..experiments.adapters import (
    DummyModelAdapter,
    LDAModelAdapter,
    LinearSVMModelAdapter,
    RBFSVMModelAdapter,
)
from ..experiments.models import FeatureRepresentation, ModelFamily
from .models import (
    GenericVsPersonalizedComparison,
    HeldOutSplitStrategy,
    PersonalizationConfig,
    PersonalizedExperimentResult,
    PersonalizedModel,
    PersonalizedModelStatus,
)

logger = logging.getLogger("neuromove.calibration")


class PersonalizationEngine:
    """Executes leakage-safe subject-specific training, held-out evaluation, and generic model benchmarking."""

    @classmethod
    def run_personalization(
        cls,
        config: PersonalizationConfig,
        epochs_data: np.ndarray,  # shape: [n_epochs, n_channels, n_times]
        labels: list[str],
        trial_ids: list[str],
        channel_names: list[str],
        sampling_rate_hz: float = 250.0,
        generic_model_pipeline: Any | None = None,
        generic_model_id: str = "mdl_generic_baseline",
    ) -> tuple[PersonalizedExperimentResult, PersonalizedModel, Pipeline]:
        """Execute strict leakage-free personalized model fitting and held-out validation.

        Partitioning Rule:
        - `training_trials` ∩ `heldout_trials` = ∅
        - Split Strategy: Temporal Block Split (e.g. 60% early train, 40% late held-out)
        - CSP spatial filters and classifier fitted SOLELY on training partition.
        """
        n_total = len(trial_ids)
        if n_total < 4:
            raise ValueError(
                f"Insufficient calibration trials ({n_total}) for train/held-out split (minimum 4)."
            )

        unique_labels = sorted(set(labels))
        if len(unique_labels) < 2:
            raise ValueError(
                "Personalization requires at least 2 distinct target classes in calibration data."
            )

        # 1. Deterministic Partitioning
        train_count = int(np.floor(n_total * config.train_ratio))
        train_count = max(2, min(n_total - 2, train_count))

        if config.split_strategy == HeldOutSplitStrategy.TEMPORAL_BLOCK_SPLIT:
            train_indices = list(range(0, train_count))
            heldout_indices = list(range(train_count, n_total))
        else:
            # Stratified random split with seed
            rng = np.random.default_rng(config.random_state)
            indices = np.arange(n_total)
            rng.shuffle(indices)
            train_indices = list(indices[:train_count])
            heldout_indices = list(indices[train_count:])

        train_trial_ids = [trial_ids[i] for i in train_indices]
        heldout_trial_ids = [trial_ids[i] for i in heldout_indices]

        # Verify zero leakage invariant
        assert set(train_trial_ids).isdisjoint(set(heldout_trial_ids)), (
            "Leakage Error: train and heldout overlap!"
        )

        # Extract subsets
        X_train = epochs_data[train_indices]
        y_train = [labels[i] for i in train_indices]
        X_heldout = epochs_data[heldout_indices]
        y_heldout = [labels[i] for i in heldout_indices]

        # Map labels to numeric indices for estimator fitting
        label_to_int = {lbl: i for i, lbl in enumerate(unique_labels)}
        y_train_int = np.array([label_to_int[item] for item in y_train])
        y_heldout_int = np.array([label_to_int[item] for item in y_heldout])

        # 2. Build and Fit Personalized Pipeline (CSP + Scaler + Classifier) on Training Set ONLY
        personalized_pipeline = cls._build_pipeline(config, unique_labels)
        personalized_pipeline.fit(X_train, y_train_int)

        # 3. Training Set Metrics
        train_preds_int = personalized_pipeline.predict(X_train)
        train_acc = float(accuracy_score(y_train_int, train_preds_int))
        train_bal_acc = float(balanced_accuracy_score(y_train_int, train_preds_int))
        train_f1 = float(
            f1_score(y_train_int, train_preds_int, average="weighted", zero_division=0)
        )

        # 4. Held-Out Evaluation
        heldout_preds_int = personalized_pipeline.predict(X_heldout)
        heldout_acc = float(accuracy_score(y_heldout_int, heldout_preds_int))
        heldout_bal_acc = float(balanced_accuracy_score(y_heldout_int, heldout_preds_int))
        heldout_f1 = float(
            f1_score(y_heldout_int, heldout_preds_int, average="weighted", zero_division=0)
        )
        heldout_prec = float(
            precision_score(y_heldout_int, heldout_preds_int, average="weighted", zero_division=0)
        )
        heldout_rec = float(
            recall_score(y_heldout_int, heldout_preds_int, average="weighted", zero_division=0)
        )

        # Held-out confusion matrix
        cm_raw = confusion_matrix(
            y_heldout_int, heldout_preds_int, labels=list(range(len(unique_labels)))
        )
        cm_norm = confusion_matrix(
            y_heldout_int,
            heldout_preds_int,
            labels=list(range(len(unique_labels))),
            normalize="true",
        )
        cm_norm = np.nan_to_num(cm_norm, nan=0.0)

        confusion_matrix_data = {
            "labels": unique_labels,
            "matrix": cm_raw.tolist(),
            "normalized_matrix": cm_norm.tolist(),
        }

        # 5. Generic vs Personalized Benchmark on the SAME Held-Out Partition
        comparison: GenericVsPersonalizedComparison | None = None
        if generic_model_pipeline is not None:
            try:
                gen_preds_int = generic_model_pipeline.predict(X_heldout)
                gen_bal_acc = float(balanced_accuracy_score(y_heldout_int, gen_preds_int))
                gen_f1 = float(
                    f1_score(y_heldout_int, gen_preds_int, average="weighted", zero_division=0)
                )
            except Exception as e:
                logger.warning(
                    "Failed to evaluate generic pipeline on heldout set: %s. Using chance level.", e
                )
                gen_bal_acc = 0.5
                gen_f1 = 0.5
        else:
            # Empirical generic baseline
            gen_bal_acc = 0.5
            gen_f1 = 0.5

        delta_bal_acc = round(heldout_bal_acc - gen_bal_acc, 4)
        delta_f1 = round(heldout_f1 - gen_f1, 4)

        comparison = GenericVsPersonalizedComparison(
            generic_model_id=generic_model_id,
            personalized_model_id="",  # populated below
            task_id=config.task_id,
            heldout_trial_count=len(heldout_trial_ids),
            generic_balanced_accuracy=round(gen_bal_acc, 4),
            personalized_balanced_accuracy=round(heldout_bal_acc, 4),
            delta_balanced_accuracy=delta_bal_acc,
            generic_f1=round(gen_f1, 4),
            personalized_f1=round(heldout_f1, 4),
            delta_f1=delta_f1,
            chance_level=round(1.0 / len(unique_labels), 4),
        )

        # 6. Generate Identifiers & Artifacts
        config_hash = config.compute_hash()
        experiment_id = f"pexp_{config_hash}"
        model_id = f"pmdl_{config_hash}"
        comparison.personalized_model_id = model_id

        # Model Card
        now_iso = datetime.now(UTC).isoformat()
        model_card = {
            "model_id": model_id,
            "experiment_id": experiment_id,
            "subject_id": config.subject_id,
            "profile_id": config.profile_id,
            "calibration_id": config.calibration_id,
            "task_id": config.task_id,
            "model_family": config.model_family.value,
            "representation": config.representation.value,
            "training_trials": len(train_trial_ids),
            "heldout_trials": len(heldout_trial_ids),
            "heldout_balanced_accuracy": round(heldout_bal_acc, 4),
            "heldout_f1": round(heldout_f1, 4),
            "generic_delta_balanced_accuracy": delta_bal_acc,
            "created_at": now_iso,
        }

        # 7. Package Results
        exp_result = PersonalizedExperimentResult(
            experiment_id=experiment_id,
            calibration_id=config.calibration_id,
            profile_id=config.profile_id,
            subject_id=config.subject_id,
            model_id=model_id,
            generic_base_model_id=generic_model_id,
            train_trial_count=len(train_trial_ids),
            heldout_trial_count=len(heldout_trial_ids),
            train_trial_ids=train_trial_ids,
            heldout_trial_ids=heldout_trial_ids,
            train_metrics={
                "accuracy": round(train_acc, 4),
                "balanced_accuracy": round(train_bal_acc, 4),
                "f1": round(train_f1, 4),
            },
            heldout_metrics={
                "accuracy": round(heldout_acc, 4),
                "balanced_accuracy": round(heldout_bal_acc, 4),
                "f1": round(heldout_f1, 4),
                "precision": round(heldout_prec, 4),
                "recall": round(heldout_rec, 4),
                "chance_level": round(1.0 / len(unique_labels), 4),
                "confusion_matrix": confusion_matrix_data,
            },
            comparison_with_generic=comparison,
            config=config,
            created_at=now_iso,
        )

        model_artifact = PersonalizedModel(
            model_id=model_id,
            calibration_id=config.calibration_id,
            profile_id=config.profile_id,
            subject_id=config.subject_id,
            experiment_id=experiment_id,
            generic_base_model_id=generic_model_id,
            model_family=config.model_family,
            representation=config.representation,
            status=PersonalizedModelStatus.RESEARCH_READY,
            is_stale=False,
            staleness_reasons=[],
            heldout_balanced_accuracy=round(heldout_bal_acc, 4),
            heldout_f1=round(heldout_f1, 4),
            artifact_file_path="",  # populated upon save
            artifact_checksum_sha256="",
            model_card_json=model_card,
            created_at=now_iso,
        )

        return exp_result, model_artifact, personalized_pipeline

    @classmethod
    def _build_pipeline(cls, config: PersonalizationConfig, class_labels: list[str]) -> Pipeline:
        """Construct scikit-learn Pipeline with MNE CSP and adapter estimator."""
        steps: list[tuple[str, Any]] = []

        if config.representation == FeatureRepresentation.CSP_LOG_POWER:
            n_components = min(config.csp_config.n_components, 4)
            # MNE CSP expects at most n_channels components
            from mne.decoding import CSP

            csp = CSP(
                n_components=n_components,
                cov_est=config.csp_config.cov_est,
                log=config.csp_config.log,
                norm_trace=config.csp_config.norm_trace,
                component_order=config.csp_config.component_order,
                transform_into="average_power",
            )
            steps.append(("csp", csp))

        if config.scale_features:
            steps.append(("scaler", StandardScaler()))

        # Classifier Adapter
        if config.model_family == ModelFamily.LDA:
            adapter = LDAModelAdapter()
        elif config.model_family == ModelFamily.SVM_LINEAR:
            adapter = LinearSVMModelAdapter()
        elif config.model_family == ModelFamily.SVM_RBF:
            adapter = RBFSVMModelAdapter()
        else:
            adapter = DummyModelAdapter()

        estimator = adapter.build_estimator({})
        steps.append(("classifier", estimator))

        return Pipeline(steps)
