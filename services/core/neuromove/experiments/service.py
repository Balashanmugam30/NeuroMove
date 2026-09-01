"""AI Model Laboratory Service Facade for Phase 12."""

from __future__ import annotations

import json
import logging
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import mne
import numpy as np
from sklearn.pipeline import Pipeline

from neuromove.database.connection import DatabaseManager, default_db_manager
from neuromove.decoding.tasks import get_canonical_task
from neuromove.epoching.storage import EpochStorage
from neuromove.experiments.ablations import AblationStudyOrchestrator
from neuromove.experiments.comparison import ModelComparisonService
from neuromove.experiments.engine import ExperimentEngine
from neuromove.experiments.error_analysis import OutOfFoldErrorAnalyzer
from neuromove.experiments.model_card import ModelCardGenerator
from neuromove.experiments.models import (
    AblationStudyResult,
    ErrorAnalysisResult,
    ExperimentConfig,
    ExperimentDetail,
    ExperimentPreview,
    ExperimentStatus,
    ExperimentSummary,
    ModelCard,
    ModelComparisonResult,
    OutOfFoldPredictionRecord,
    OutOfFoldPredictionSet,
    SearchType,
)
from neuromove.experiments.storage import ExperimentStorage

logger = logging.getLogger("neuromove.experiments.service")


class AIModelLabService:
    """High-level facade orchestrating experiment lifecycle, nested CV, ablations, and model cards."""

    def __init__(
        self,
        db_manager: DatabaseManager | None = None,
        storage: ExperimentStorage | None = None,
        epoch_storage: EpochStorage | None = None,
    ):
        self.db = db_manager or default_db_manager
        self.storage = storage or ExperimentStorage()
        self.epoch_storage = epoch_storage or EpochStorage()

    def _get_conn(self) -> sqlite3.Connection:
        self.db.initialize_db()
        return sqlite3.connect(self.db.get_db_path())

    def _load_epochs_and_metadata(self, epoch_set_id: str) -> tuple[mne.Epochs, dict[str, Any]]:
        epochs = self.epoch_storage.load_epochs(epoch_set_id)
        meta = self.epoch_storage.load_metadata(epoch_set_id)
        return epochs, meta

    def preview_experiment(self, config: ExperimentConfig) -> ExperimentPreview:
        """Provide a lightweight pre-flight inspection without running full model training."""
        exp_id = config.experiment_id
        warnings: list[str] = []
        errors: list[str] = []

        try:
            epochs, meta = self._load_epochs_and_metadata(config.epoch_set_id)
        except Exception as exc:
            return ExperimentPreview(
                valid=False,
                experiment_id=exp_id,
                dataset_id=config.dataset_id,
                epoch_set_id=config.epoch_set_id,
                task_id=config.task_id,
                representation=config.representation,
                model_family=config.model_family,
                total_epochs=0,
                eligible_epochs=0,
                excluded_epochs=0,
                class_distribution={},
                subjects=[],
                subject_count=0,
                channels=[],
                expected_outer_folds=0,
                search_candidate_count=0,
                warnings=[],
                errors=[f"Could not load epoch set: {exc}"],
            )

        task = get_canonical_task(config.task_id)
        events = epochs.events
        event_id = epochs.event_id

        # Determine eligible epochs
        eligible_indices = []
        for i, ev in enumerate(events):
            ev_code = int(ev[2])
            for lbl_name, code in event_id.items():
                if code == ev_code and lbl_name in task.class_labels:
                    eligible_indices.append(i)
                    break

        total_epochs = len(epochs)
        eligible_epochs = len(eligible_indices)
        excluded_epochs = total_epochs - eligible_epochs

        # Subjects
        subjects = list(meta.get("subject_ids", []))
        if not subjects and "subject_id" in meta:
            subjects = [meta["subject_id"]]
        if not subjects:
            subjects = ["sub_01"]

        # Calculate search candidate count
        search_cand_count = 1
        if config.search_config.search_type != SearchType.NONE:
            grid = config.search_config.param_grid
            if grid:
                grid_sizes = [len(v) for v in grid.values()]
                total_combos = 1
                for s in grid_sizes:
                    total_combos *= max(1, s)
                if config.search_config.search_type == SearchType.GRID:
                    search_cand_count = total_combos
                else:
                    search_cand_count = min(config.search_config.n_iter, total_combos)

        # Expected outer folds
        protocol = config.evaluation_protocol.value
        expected_folds = 5
        if protocol == "LEAVE_ONE_SUBJECT_OUT":
            expected_folds = max(1, len(subjects))
        elif protocol in ["GROUP_KFOLD", "STRATIFIED_GROUP_KFOLD"]:
            expected_folds = min(config.n_splits, len(subjects))

        if len(subjects) < 2 and config.evaluation_mode.value == "INTER_SUBJECT":
            warnings.append(
                "Inter-subject evaluation selected with fewer than 2 subjects. Generalization cannot be validated."
            )

        if eligible_epochs < 10:
            warnings.append(
                f"Small sample size ({eligible_epochs} eligible epochs). Cross-validation may exhibit high variance."
            )

        return ExperimentPreview(
            valid=len(errors) == 0,
            experiment_id=exp_id,
            dataset_id=config.dataset_id,
            epoch_set_id=config.epoch_set_id,
            task_id=config.task_id,
            representation=config.representation,
            model_family=config.model_family,
            total_epochs=total_epochs,
            eligible_epochs=eligible_epochs,
            excluded_epochs=excluded_epochs,
            class_distribution=meta.get("label_distribution", {}),
            subjects=subjects,
            subject_count=len(subjects),
            channels=epochs.ch_names,
            expected_outer_folds=expected_folds,
            search_candidate_count=search_cand_count,
            warnings=warnings,
            errors=errors,
        )

    def run_experiment(self, config: ExperimentConfig) -> ExperimentDetail:
        """Execute full nested cross-validation, OOF error analysis, model card generation, and persistence."""
        exp_id = config.experiment_id
        config_hash = config.compute_deterministic_hash()
        started_at = datetime.now(UTC).isoformat()
        run_id = f"run_{uuid.uuid4().hex[:8]}"

        # Load data
        epochs, meta = self._load_epochs_and_metadata(config.epoch_set_id)
        task = get_canonical_task(config.task_id)

        # Pick channels if specified
        if config.channels:
            avail_chs = [c for c in config.channels if c in epochs.ch_names]
            if avail_chs:
                epochs = epochs.copy().pick(avail_chs)

        # Filter for task labels
        events = epochs.events
        event_id = epochs.event_id
        inv_event_id = {v: k for k, v in event_id.items()}

        eligible_indices = []
        mapped_y = []
        for i, ev in enumerate(events):
            ev_code = int(ev[2])
            lbl_name = inv_event_id.get(ev_code, "")
            if lbl_name in task.class_labels:
                eligible_indices.append(i)
                mapped_y.append(task.label_mapping[lbl_name])

        if len(eligible_indices) == 0:
            raise ValueError(
                f"No eligible epochs found in {config.epoch_set_id} matching task {task.task_id}."
            )

        epochs_subset = epochs[eligible_indices]
        X = epochs_subset.get_data()  # shape (n_epochs, n_channels, n_times)
        y = np.array(mapped_y, dtype=int)

        # Subject, session, run metadata
        subject_list = meta.get("subject_ids", [])
        if not subject_list or len(subject_list) != len(epochs):
            def_subj = meta.get("subject_id", "sub_01")
            subject_list = [def_subj] * len(epochs)

        session_list = meta.get("session_ids", ["session_01"] * len(epochs))
        run_list = meta.get("run_ids", ["run_01"] * len(epochs))
        epoch_id_list = [f"ep_{i:04d}" for i in range(len(epochs))]

        subjs_arr = np.array(subject_list)[eligible_indices]
        sess_arr = np.array(session_list)[eligible_indices]
        run_arr = np.array(run_list)[eligible_indices]
        epoch_ids_sub = [epoch_id_list[i] for i in eligible_indices]

        # Execute nested CV engine
        engine = ExperimentEngine(config)
        (
            metrics,
            folds,
            oof_set,
            per_session_metrics,
            final_pipeline,
        ) = engine.run_experiment(
            X=X,
            y=y,
            groups=subjs_arr,
            epoch_ids=epoch_ids_sub,
            sessions=sess_arr.tolist(),
            runs=run_arr.tolist(),
            label_names=task.class_labels,
            label_mapping=task.label_mapping,
            channels=epochs_subset.ch_names,
        )

        # Error analysis
        error_analysis = OutOfFoldErrorAnalyzer.analyze(oof_set.predictions)

        # Save model artifact
        model_id = f"mdl_{exp_id}"
        art_path, art_checksum = self.storage.save_model_artifact(model_id, final_pipeline)

        # Software stack versions
        software_versions = {
            "mne": mne.__version__,
            "scikit_learn": "1.9.0",
            "numpy": np.__version__,
            "neuromove": "0.1.0",
        }

        # Model card generation
        unique_subjs = sorted(set(subjs_arr.tolist()))

        model_card = ModelCardGenerator.generate_card(
            model_id=model_id,
            experiment_id=exp_id,
            config=config,
            task=task,
            metrics=metrics,
            artifact_checksum_sha256=art_checksum,
            software_versions=software_versions,
            subjects=unique_subjs,
            total_epochs=len(X),
        )
        self.storage.save_model_card(model_card)

        # Save OOF predictions CSV
        self.storage.save_oof_predictions_csv(oof_set)

        detail = ExperimentDetail(
            experiment_id=exp_id,
            config=config,
            config_hash=config_hash,
            status=ExperimentStatus.COMPLETED,
            task=task,
            dataset_id=config.dataset_id,
            epoch_set_id=config.epoch_set_id,
            subjects=unique_subjs,
            channels=epochs_subset.ch_names,
            sampling_rate_hz=epochs_subset.info["sfreq"],
            folds=folds,
            metrics=metrics,
            per_session_metrics=per_session_metrics,
            error_analysis=error_analysis,
            model_id=model_id,
            artifact_file_path=str(art_path),
            artifact_checksum_sha256=art_checksum,
            software_versions=software_versions,
            created_at=datetime.now(UTC).isoformat(),
        )

        # Save experiment detail to disk
        self.storage.save_experiment_detail(detail)

        # Persist to SQLite
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()

                # Clean up existing records for this experiment_id
                cursor.execute(
                    "DELETE FROM experiment_predictions WHERE experiment_id = ?",
                    (exp_id,),
                )
                cursor.execute("DELETE FROM experiment_folds WHERE experiment_id = ?", (exp_id,))
                cursor.execute("DELETE FROM experiment_metrics WHERE experiment_id = ?", (exp_id,))
                cursor.execute("DELETE FROM experiment_runs WHERE experiment_id = ?", (exp_id,))

                # 1. experiment_configs
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO experiment_configs
                    (config_hash, experiment_version, config_json, created_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        config_hash,
                        config.experiment_version,
                        config.model_dump_json(),
                        started_at,
                    ),
                )

                # 2. experiments
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO experiments
                    (experiment_id, config_hash, dataset_id, epoch_set_id, task_id,
                     model_family, representation, evaluation_protocol, status,
                     has_search, model_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        exp_id,
                        config_hash,
                        config.dataset_id,
                        config.epoch_set_id,
                        config.task_id,
                        config.model_family.value,
                        config.representation.value,
                        config.evaluation_protocol.value,
                        "COMPLETED",
                        1 if config.search_config.search_type != SearchType.NONE else 0,
                        model_id,
                        started_at,
                    ),
                )

                # 3. experiment_runs
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO experiment_runs
                    (run_id, experiment_id, stage, progress, status, error_message, started_at, completed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run_id,
                        exp_id,
                        "COMPLETE",
                        100.0,
                        "COMPLETED",
                        None,
                        started_at,
                        datetime.now(UTC).isoformat(),
                    ),
                )

                # 4. experiment_folds
                for f in folds:
                    cursor.execute(
                        """
                        INSERT OR REPLACE INTO experiment_folds
                        (experiment_id, fold_id, train_subjects_json, test_subjects_json,
                         train_epoch_count, test_epoch_count, train_class_counts_json,
                         test_class_counts_json, fold_hash, search_results_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            exp_id,
                            f.fold_id,
                            json.dumps(f.train_subjects),
                            json.dumps(f.test_subjects),
                            f.train_epoch_count,
                            f.test_epoch_count,
                            json.dumps(f.train_class_counts),
                            json.dumps(f.test_class_counts),
                            f.fold_hash,
                            f.inner_search_result.model_dump_json()
                            if f.inner_search_result
                            else None,
                        ),
                    )

                # 5. experiment_metrics
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO experiment_metrics
                    (experiment_id, accuracy_mean, accuracy_std, balanced_accuracy_mean,
                     balanced_accuracy_std, precision_mean, precision_std, recall_mean,
                     recall_std, f1_mean, f1_std, chance_level, metrics_json,
                     per_session_metrics_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        exp_id,
                        metrics.accuracy.mean,
                        metrics.accuracy.std,
                        metrics.balanced_accuracy.mean,
                        metrics.balanced_accuracy.std,
                        metrics.precision.mean,
                        metrics.precision.std,
                        metrics.recall.mean,
                        metrics.recall.std,
                        metrics.f1.mean,
                        metrics.f1.std,
                        metrics.chance_level,
                        metrics.model_dump_json(),
                        json.dumps([s.model_dump() for s in per_session_metrics]),
                        started_at,
                    ),
                )

                # 6. experiment_predictions
                for p in oof_set.predictions:
                    pred_id = f"pred_{uuid.uuid4().hex[:10]}"
                    cursor.execute(
                        """
                        INSERT OR REPLACE INTO experiment_predictions
                        (prediction_id, experiment_id, fold_id, epoch_id, subject_id,
                         session_id, run_id, true_label, predicted_label, is_correct,
                         decision_score, probabilities_json, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            pred_id,
                            exp_id,
                            p.fold_id,
                            p.epoch_id,
                            p.subject_id,
                            p.session_id,
                            p.run_id,
                            p.true_label,
                            p.predicted_label,
                            1 if p.is_correct else 0,
                            p.decision_score,
                            json.dumps(p.probability_vector) if p.probability_vector else None,
                            started_at,
                        ),
                    )

                # 7. model_cards
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO model_cards
                    (model_id, experiment_id, card_json, markdown_content, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        model_id,
                        exp_id,
                        model_card.model_dump_json(),
                        model_card.markdown_content,
                        started_at,
                    ),
                )

                conn.commit()
        except Exception as exc:
            logger.error("Failed to persist experiment %s to SQLite: %s", exp_id, exc)

        return detail

    def list_experiments(self) -> list[ExperimentSummary]:
        """List summary of all persisted experiments."""
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT e.experiment_id, e.dataset_id, e.epoch_set_id, e.task_id,
                           e.model_family, e.representation, e.evaluation_protocol,
                           m.balanced_accuracy_mean, m.f1_mean, m.accuracy_mean,
                           e.status, e.has_search, e.created_at
                    FROM experiments e
                    LEFT JOIN experiment_metrics m ON e.experiment_id = m.experiment_id
                    ORDER BY e.created_at DESC
                    """
                )
                rows = cursor.fetchall()
                summaries = []
                for r in rows:
                    summaries.append(
                        ExperimentSummary(
                            experiment_id=r[0],
                            dataset_id=r[1],
                            epoch_set_id=r[2],
                            task_id=r[3],
                            model_family=r[4],
                            representation=r[5],
                            evaluation_protocol=r[6],
                            balanced_accuracy_mean=r[7] or 0.0,
                            f1_mean=r[8] or 0.0,
                            accuracy_mean=r[9] or 0.0,
                            status=r[10] or "COMPLETED",
                            has_search=bool(r[11]),
                            created_at=r[12],
                        )
                    )
                return summaries
        except Exception as exc:
            logger.warning("Could not list experiments from DB: %s", exc)
            return []

    def get_experiment(self, experiment_id: str) -> ExperimentDetail:
        """Load experiment detail from disk meta JSON."""
        exp_file = self.storage.base_dir / f"{experiment_id}.meta.json"
        if not exp_file.exists():
            raise FileNotFoundError(f"Experiment metadata not found: {exp_file}")
        with open(exp_file, encoding="utf-8") as f:
            data = json.load(f)
        return ExperimentDetail.model_validate(data)

    def get_experiment_predictions(self, experiment_id: str) -> OutOfFoldPredictionSet:
        """Fetch all out-of-fold predictions for an experiment from SQLite."""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT epoch_id, subject_id, session_id, run_id, true_label,
                       predicted_label, is_correct, decision_score, probabilities_json,
                       fold_id, experiment_id
                FROM experiment_predictions
                WHERE experiment_id = ?
                ORDER BY fold_id, epoch_id
                """,
                (experiment_id,),
            )
            rows = cursor.fetchall()
            preds = []
            for r in rows:
                probs = json.loads(r[8]) if r[8] else None
                preds.append(
                    OutOfFoldPredictionRecord(
                        epoch_id=r[0],
                        subject_id=r[1],
                        session_id=r[2],
                        run_id=r[3],
                        true_label=r[4],
                        predicted_label=r[5],
                        is_correct=bool(r[6]),
                        decision_score=r[7],
                        probability_vector=probs,
                        fold_id=r[9],
                        model_id=f"mdl_{r[10]}",
                        experiment_id=r[10],
                    )
                )
            return OutOfFoldPredictionSet(
                experiment_id=experiment_id,
                total_predictions=len(preds),
                coverage_percentage=100.0,
                predictions=preds,
            )

    def get_experiment_errors(self, experiment_id: str) -> ErrorAnalysisResult:
        """Compute error analysis from out-of-fold predictions."""
        oof_set = self.get_experiment_predictions(experiment_id)
        return OutOfFoldErrorAnalyzer.analyze(oof_set.predictions)

    def run_ablation_study(
        self,
        baseline_config: ExperimentConfig,
        ablation_variable: str,
    ) -> AblationStudyResult:
        """Execute a controlled ablation study across variants."""
        # 1. Run baseline experiment
        baseline_detail = self.run_experiment(baseline_config)

        # 2. Build ablation config
        ablation_cfg = AblationStudyOrchestrator.generate_ablation_config(
            baseline_config=baseline_config,
            ablation_variable=ablation_variable,
        )

        variant_results: list[tuple[str, Any, Any, str]] = []
        for v in ablation_cfg.variants:
            v_detail = self.run_experiment(v.config)
            variant_results.append(
                (v.variant_name, v.param_value, v_detail.metrics, v_detail.experiment_id)
            )

        study_res = AblationStudyOrchestrator.compile_results(
            ablation_id=ablation_cfg.ablation_id,
            name=ablation_cfg.name,
            ablation_variable=ablation_variable,
            baseline_experiment_id=baseline_detail.experiment_id,
            baseline_metrics=baseline_detail.metrics,
            variant_results=variant_results,
        )

        # Persist ablation to SQLite
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO experiment_ablations
                    (ablation_id, name, ablation_variable, baseline_experiment_id,
                     results_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        study_res.ablation_id,
                        study_res.name,
                        study_res.ablation_variable,
                        study_res.baseline_experiment_id,
                        study_res.model_dump_json(),
                        study_res.created_at,
                    ),
                )
                conn.commit()
        except Exception as exc:
            logger.error("Failed to save ablation to DB: %s", exc)

        return study_res

    def compare_experiments(
        self,
        comparison_name: str,
        experiment_ids: list[str],
    ) -> ModelComparisonResult:
        """Compare multiple experiments under identical task/data conditions."""
        exp_tuples = []
        for exp_id in experiment_ids:
            detail = self.get_experiment(exp_id)
            exp_tuples.append((detail.experiment_id, detail.config, detail.metrics))

        cmp_res = ModelComparisonService.compare(comparison_name, exp_tuples)

        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO model_comparisons
                    (comparison_id, comparison_name, results_json, created_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        cmp_res.comparison_id,
                        cmp_res.comparison_name,
                        cmp_res.model_dump_json(),
                        cmp_res.created_at,
                    ),
                )
                conn.commit()
        except Exception as exc:
            logger.error("Failed to save comparison to DB: %s", exc)

        return cmp_res

    def get_model_card(self, model_id: str) -> ModelCard:
        """Fetch model card JSON from disk."""
        card_file = self.storage.base_dir / f"{model_id}.card.json"
        if not card_file.exists():
            raise FileNotFoundError(f"Model card not found for: {model_id}")
        with open(card_file, encoding="utf-8") as f:
            data = json.load(f)
        return ModelCard.model_validate(data)

    def predict_batch(self, model_id: str, epoch_set_id: str) -> dict[str, Any]:
        """Perform batch prediction over an epoch set for offline replay evaluation."""
        epochs, meta = self._load_epochs_and_metadata(epoch_set_id)
        art_path = Path("models/classical") / f"{model_id}.joblib"
        pipeline: Pipeline = self.storage.load_model_artifact(art_path)

        X = epochs.get_data()
        preds = pipeline.predict(X)

        prob_vectors = None
        if hasattr(pipeline, "predict_proba"):
            try:
                prob_vectors = pipeline.predict_proba(X).tolist()
            except Exception:
                pass

        return {
            "model_id": model_id,
            "epoch_set_id": epoch_set_id,
            "total_epochs": len(epochs),
            "predictions": preds.tolist(),
            "probabilities": prob_vectors,
            "timestamp": datetime.now(UTC).isoformat(),
        }
