"""High-level orchestration service for classical CSP and motor-imagery decoding."""

import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import mne
import numpy as np
import scipy
import sklearn

from ..database.connection import DatabaseManager, default_db_manager
from ..epoching.models import NormalizedLabel
from ..epoching.storage import EpochStorage
from .csp import extract_csp_pattern_data
from .evaluation import evaluate_decoder_pipeline
from .models import (
    BenchmarkPreview,
    ClassificationMetrics,
    ClassifierType,
    DecoderPipelineConfig,
    DecoderRun,
    DecoderRunStatus,
    ModelManifest,
    ModelStatus,
    ModelSummary,
    PredictionRequest,
    PredictionResponse,
)
from .storage import DecoderStorage
from .tasks import filter_epochs_for_task, get_task_by_id

logger = logging.getLogger("neuromove.decoding.service")


class ClassicalDecodingService:
    """Core service managing classical motor-imagery decoders, benchmarks, and model registry."""

    def __init__(
        self,
        db_manager: DatabaseManager | None = None,
        epoch_storage: EpochStorage | None = None,
        decoder_storage: DecoderStorage | None = None,
    ):
        self.db = db_manager or default_db_manager
        self.epoch_storage = epoch_storage or EpochStorage()
        self.decoder_storage = decoder_storage or DecoderStorage()

    def _get_software_versions(self) -> dict[str, str]:
        """Record precise scientific computing dependencies for reproducibility."""
        return {
            "mne": mne.__version__,
            "scikit_learn": sklearn.__version__,
            "numpy": np.__version__,
            "scipy": scipy.__version__,
        }

    def _load_epoch_data_and_records(
        self, epoch_set_id: str
    ) -> tuple[mne.Epochs, list[dict[str, Any]], dict[str, Any]]:
        """Load MNE Epochs artifact, epoch records, and summary from disk/database."""
        epochs = self.epoch_storage.load_epochs(epoch_set_id)
        summary = self.epoch_storage.load_metadata(epoch_set_id)

        # Retrieve records from SQLite

        db_path = self.db.get_db_path()
        with self.db.get_connection(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT epoch_id, trial_id, event_id, subject_id, label, onset_seconds, qc_status
                FROM epoch_records
                WHERE epoch_set_id = ?
                ORDER BY onset_seconds ASC
                """,
                (epoch_set_id,),
            )
            rows = cursor.fetchall()
            records = [
                {
                    "epoch_id": r[0],
                    "trial_id": r[1],
                    "event_id": r[2],
                    "subject_id": r[3],
                    "label": r[4],
                    "onset_seconds": r[5],
                    "qc_status": r[6],
                }
                for r in rows
            ]

        return epochs, records, summary

    def preview_benchmark(self, config: DecoderPipelineConfig) -> BenchmarkPreview:
        """Validate pipeline parameters, eligible class counts, and expected CV folds."""
        task = get_task_by_id(config.task_id)
        if not task:
            return BenchmarkPreview(
                valid=False,
                task_id=config.task_id,
                epoch_set_id=config.epoch_set_id,
                total_epochs=0,
                eligible_epochs=0,
                excluded_epochs=0,
                class_distribution={},
                subjects_found=[],
                subject_count=0,
                channels=[],
                sampling_rate_hz=0.0,
                protocol=config.evaluation_protocol,
                expected_folds=0,
                warnings=[],
                errors=[f"Task '{config.task_id}' not recognized."],
            )

        try:
            epochs, records, summary = self._load_epoch_data_and_records(config.epoch_set_id)
        except Exception as exc:
            return BenchmarkPreview(
                valid=False,
                task_id=config.task_id,
                epoch_set_id=config.epoch_set_id,
                total_epochs=0,
                eligible_epochs=0,
                excluded_epochs=0,
                class_distribution={},
                subjects_found=[],
                subject_count=0,
                channels=[],
                sampling_rate_hz=0.0,
                protocol=config.evaluation_protocol,
                expected_folds=0,
                warnings=[],
                errors=[f"Failed to load epoch set '{config.epoch_set_id}': {exc}"],
            )

        # Extract labels and subjects
        raw_labels = [r["label"] for r in records]
        subjects = [r["subject_id"] for r in records]
        trial_ids = [r["trial_id"] for r in records]

        # Filter for target task
        epoch_tensor = epochs.get_data(copy=True)
        _, _, filt_subjs, _, excl_count, class_dist = filter_epochs_for_task(
            epoch_tensor, raw_labels, subjects, trial_ids, task
        )

        unique_subjs = sorted(set(filt_subjs))
        n_eligible = len(filt_subjs)
        errors = []
        warnings = []

        if n_eligible < 4:
            errors.append(f"Insufficient eligible epochs ({n_eligible}) for training.")

        if any(cnt == 0 for cnt in class_dist.values()):
            errors.append(f"Missing samples for at least one target class: {class_dist}")

        # Expected folds calculation
        match config.evaluation_protocol:
            case "LEAVE_ONE_SUBJECT_OUT":
                expected_folds = len(unique_subjs)
            case "GROUP_K_FOLD" | "STRATIFIED_GROUP_K_FOLD":
                expected_folds = min(config.n_splits, len(unique_subjs))
            case _:
                expected_folds = min(config.n_splits, n_eligible // 2)

        if len(unique_subjs) < 2 and "GROUP" in config.evaluation_protocol.value:
            warnings.append(
                f"Only {len(unique_subjs)} subject found; group-based protocols will fall back to StratifiedKFold."
            )

        return BenchmarkPreview(
            valid=len(errors) == 0,
            task_id=task.task_id,
            epoch_set_id=config.epoch_set_id,
            total_epochs=len(records),
            eligible_epochs=n_eligible,
            excluded_epochs=excl_count,
            class_distribution=class_dist,
            subjects_found=unique_subjs,
            subject_count=len(unique_subjs),
            channels=epochs.ch_names,
            sampling_rate_hz=float(epochs.info["sfreq"]),
            protocol=config.evaluation_protocol,
            expected_folds=expected_folds,
            warnings=warnings,
            errors=errors,
        )

    def run_benchmark(self, config: DecoderPipelineConfig) -> ModelManifest:
        """Execute cross-validated decoding benchmark and persist model artifact."""
        task = get_task_by_id(config.task_id)
        if not task:
            raise ValueError(f"Task '{config.task_id}' not found.")

        run_id = f"run_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(UTC).isoformat()
        config_hash = config.compute_hash()

        epochs, records, summary = self._load_epoch_data_and_records(config.epoch_set_id)

        # Apply channel selection if specified
        if config.channels:
            avail_chs = [ch for ch in config.channels if ch in epochs.ch_names]
            if not avail_chs:
                raise ValueError(
                    f"None of specified channels {config.channels} exist in epoch set {epochs.ch_names}."
                )
            epochs = epochs.copy().pick(avail_chs)

        channels = epochs.ch_names
        sampling_rate_hz = float(epochs.info["sfreq"])
        epoch_tensor = epochs.get_data(copy=True)

        raw_labels = [r["label"] for r in records]
        subjects = [r["subject_id"] for r in records]
        trial_ids = [r["trial_id"] for r in records]

        X_filt, y_filt, subjs_filt, _, _, _ = filter_epochs_for_task(
            epoch_tensor, raw_labels, subjects, trial_ids, task
        )

        if len(y_filt) < 4:
            raise ValueError(
                f"Insufficient eligible epochs ({len(y_filt)}) to train task {task.task_id}."
            )

        # Record run start in SQLite
        db_path = self.db.get_db_path()
        with self.db.get_connection(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO decoder_runs (run_id, model_id, task_id, epoch_set_id, config_hash, status, started_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    None,
                    task.task_id,
                    config.epoch_set_id,
                    config_hash,
                    DecoderRunStatus.RUNNING.value,
                    now_iso,
                ),
            )
            # Store config if new
            cursor.execute(
                """
                INSERT OR IGNORE INTO decoder_configs (config_hash, pipeline_version, config_json, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (config_hash, config.pipeline_version, config.model_dump_json(), now_iso),
            )
            conn.commit()

        try:
            # Execute group-aware cross validation and fit final model
            metrics, final_pipeline = evaluate_decoder_pipeline(
                X_filt, y_filt, subjs_filt, config, task
            )

            # Extract CSP spatial patterns from final model
            csp_estimator = final_pipeline.named_steps.get("csp")
            csp_patterns = (
                extract_csp_pattern_data(csp_estimator, channels) if csp_estimator else None
            )

            # Generate unique model_id
            model_id = f"mdl_{config_hash}_{run_id[-6:]}"
            fin_iso = datetime.now(UTC).isoformat()

            manifest = ModelManifest(
                model_id=model_id,
                pipeline_version=config.pipeline_version,
                task=task,
                dataset_id=summary.get("dataset_id"),
                source_epoch_set_id=config.epoch_set_id,
                subjects=sorted(set(subjs_filt)),
                channels=channels,
                sampling_rate_hz=sampling_rate_hz,
                csp_config=config.csp_config,
                classifier_config=config.classifier_config,
                evaluation_protocol=config.evaluation_protocol,
                evaluation_mode=config.evaluation_mode,
                metrics=metrics,
                csp_patterns=csp_patterns,
                artifact_file_path="",
                artifact_checksum_sha256="",
                config_hash=config_hash,
                status=ModelStatus.ACTIVE_RESEARCH,
                software_versions=self._get_software_versions(),
                created_at=fin_iso,
            )

            # Persist artifact on disk
            artifact_path, checksum = self.decoder_storage.save_model(
                model_id, final_pipeline, manifest
            )

            # Update database records
            with self.db.get_connection(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO models (
                        model_id, run_id, pipeline_version, task_id, dataset_id, source_epoch_set_id,
                        subjects_json, channels_json, sampling_rate_hz, classifier_type, n_components,
                        evaluation_protocol, evaluation_mode, config_hash, status, artifact_file_path,
                        artifact_checksum_sha256, software_versions_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        model_id,
                        run_id,
                        manifest.pipeline_version,
                        task.task_id,
                        manifest.dataset_id,
                        manifest.source_epoch_set_id,
                        json.dumps(manifest.subjects),
                        json.dumps(manifest.channels),
                        manifest.sampling_rate_hz,
                        config.classifier_config.classifier_type.value,
                        config.csp_config.n_components,
                        config.evaluation_protocol.value,
                        config.evaluation_mode.value,
                        config_hash,
                        manifest.status.value,
                        str(artifact_path),
                        checksum,
                        json.dumps(manifest.software_versions),
                        fin_iso,
                    ),
                )
                # Store summary metrics
                cursor.execute(
                    """
                    INSERT INTO model_metrics (
                        model_id, accuracy_mean, accuracy_std, balanced_accuracy_mean, balanced_accuracy_std,
                        precision_mean, precision_std, recall_mean, recall_std, f1_mean, f1_std,
                        chance_level, metrics_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        model_id,
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
                        fin_iso,
                    ),
                )
                # Store lineage
                cursor.execute(
                    """
                    INSERT OR IGNORE INTO model_lineage (
                        model_id, epoch_set_id, preprocessing_result_id, dataset_id, created_at
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        model_id,
                        config.epoch_set_id,
                        summary.get("preprocessing_result_id"),
                        manifest.dataset_id,
                        fin_iso,
                    ),
                )
                # Store individual folds
                for fold in metrics.per_fold_results:
                    cursor.execute(
                        """
                        INSERT INTO cv_folds (
                            fold_id, model_id, train_subjects_json, test_subjects_json,
                            train_epochs, test_epochs, accuracy, balanced_accuracy, f1, confusion_matrix_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            fold.fold_id,
                            model_id,
                            json.dumps(fold.train_subjects),
                            json.dumps(fold.test_subjects),
                            fold.train_epochs,
                            fold.test_epochs,
                            fold.accuracy,
                            fold.balanced_accuracy,
                            fold.f1,
                            fold.confusion_matrix.model_dump_json(),
                        ),
                    )

                # Update run status
                cursor.execute(
                    """
                    UPDATE decoder_runs
                    SET model_id = ?, status = ?, finished_at = ?, metrics_json = ?
                    WHERE run_id = ?
                    """,
                    (
                        model_id,
                        DecoderRunStatus.COMPLETED.value,
                        fin_iso,
                        metrics.model_dump_json(),
                        run_id,
                    ),
                )
                conn.commit()

            return manifest

        except Exception as exc:
            logger.error("Benchmark decoding run failed: %s", exc, exc_info=True)
            with self.db.get_connection(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    UPDATE decoder_runs
                    SET status = ?, finished_at = ?, error_message = ?
                    WHERE run_id = ?
                    """,
                    (
                        DecoderRunStatus.FAILED.value,
                        datetime.now(UTC).isoformat(),
                        str(exc),
                        run_id,
                    ),
                )
                conn.commit()
            raise

    def list_models(self, limit: int = 50, task_id: str | None = None) -> list[ModelSummary]:
        """List registered decoder models."""
        db_path = self.db.get_db_path()
        with self.db.get_connection(db_path) as conn:
            cursor = conn.cursor()
            query = """
                SELECT m.model_id, m.task_id, m.dataset_id, m.source_epoch_set_id, m.classifier_type,
                       m.n_components, m.evaluation_protocol, mm.accuracy_mean, mm.balanced_accuracy_mean,
                       mm.f1_mean, m.status, m.artifact_file_path, m.artifact_checksum_sha256, m.created_at
                FROM models m
                JOIN model_metrics mm ON m.model_id = mm.model_id
            """
            params = []
            if task_id:
                query += " WHERE m.task_id = ?"
                params.append(task_id)
            query += " ORDER BY m.created_at DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [
                ModelSummary(
                    model_id=r[0],
                    task_id=r[1],
                    dataset_id=r[2],
                    source_epoch_set_id=r[3],
                    classifier_type=ClassifierType(r[4]),
                    n_components=r[5],
                    evaluation_protocol=r[6],
                    accuracy_mean=r[7],
                    balanced_accuracy_mean=r[8],
                    f1_mean=r[9],
                    status=r[10],
                    artifact_file_path=r[11],
                    artifact_checksum_sha256=r[12],
                    created_at=r[13],
                )
                for r in rows
            ]

    def get_model_manifest(self, model_id: str) -> ModelManifest:
        """Retrieve full model provenance manifest."""
        _, manifest = self.decoder_storage.load_model(model_id)
        return manifest

    def list_runs(self, limit: int = 50) -> list[DecoderRun]:
        """List recent decoder benchmark runs."""
        db_path = self.db.get_db_path()
        with self.db.get_connection(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT r.run_id, r.model_id, r.task_id, r.epoch_set_id, dc.config_json,
                       r.status, r.started_at, r.finished_at, r.metrics_json, r.error_message
                FROM decoder_runs r
                JOIN decoder_configs dc ON r.config_hash = dc.config_hash
                ORDER BY r.started_at DESC LIMIT ?
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            return [
                DecoderRun(
                    run_id=r[0],
                    model_id=r[1],
                    task_id=r[2],
                    epoch_set_id=r[3],
                    config=DecoderPipelineConfig(**json.loads(r[4])),
                    status=r[5],
                    started_at=r[6],
                    finished_at=r[7],
                    metrics=ClassificationMetrics(**json.loads(r[8])) if r[8] else None,
                    error_message=r[9],
                )
                for r in rows
            ]

    def predict_epoch(self, req: PredictionRequest) -> PredictionResponse:
        """Execute offline or replay prediction for a single trial."""
        pipeline, manifest = self.decoder_storage.load_model(req.model_id)
        task = manifest.task

        # Invert label mapping
        idx_to_label = {v: k for k, v in task.label_mapping.items()}

        trial_tensor: np.ndarray | None = None
        source_epoch_id = req.epoch_id
        source_subj_id = None
        true_label = None

        if req.trial_data is not None:
            # (channels x times) -> (1, channels, times)
            trial_tensor = np.array(req.trial_data, dtype=np.float64)
            if trial_tensor.ndim == 2:
                trial_tensor = np.expand_dims(trial_tensor, axis=0)
        elif req.epoch_set_id and req.epoch_id:
            epochs, records, _ = self._load_epoch_data_and_records(req.epoch_set_id)
            rec_map = {r["epoch_id"]: (idx, r) for idx, r in enumerate(records)}
            if req.epoch_id not in rec_map:
                raise FileNotFoundError(
                    f"Epoch '{req.epoch_id}' not found in set '{req.epoch_set_id}'."
                )
            idx, rec = rec_map[req.epoch_id]
            source_subj_id = rec["subject_id"]
            true_label = (
                NormalizedLabel(rec["label"])
                if rec["label"] in NormalizedLabel.__members__.values()
                else None
            )

            # Check channel compatibility
            if manifest.channels:
                avail_chs = [ch for ch in manifest.channels if ch in epochs.ch_names]
                if len(avail_chs) != len(manifest.channels):
                    raise ValueError(
                        f"Epoch set channels {epochs.ch_names} incompatible with model channels {manifest.channels}."
                    )
                epochs = epochs.copy().pick(manifest.channels)

            trial_tensor = epochs[idx : idx + 1].get_data(copy=True)
        else:
            raise ValueError("Must provide either trial_data or epoch_set_id + epoch_id.")

        # Execute prediction
        y_pred_int = int(pipeline.predict(trial_tensor)[0])
        pred_label = idx_to_label.get(y_pred_int, NormalizedLabel.UNKNOWN)

        # Decision scores / probabilities if available
        decision_scores = None
        probabilities = None
        clf = pipeline.named_steps.get("classifier")

        if hasattr(clf, "decision_function"):
            try:
                # Transform through CSP first
                X_csp = pipeline.named_steps["csp"].transform(trial_tensor)
                if "scaler" in pipeline.named_steps:
                    X_csp = pipeline.named_steps["scaler"].transform(X_csp)
                df = clf.decision_function(X_csp)
                if df.ndim == 1:
                    decision_scores = {"class_0": float(-df[0]), "class_1": float(df[0])}
                else:
                    decision_scores = {f"class_{i}": float(v) for i, v in enumerate(df[0])}
            except Exception:
                pass

        if hasattr(clf, "predict_proba"):
            try:
                X_csp = pipeline.named_steps["csp"].transform(trial_tensor)
                if "scaler" in pipeline.named_steps:
                    X_csp = pipeline.named_steps["scaler"].transform(X_csp)
                probs = clf.predict_proba(X_csp)[0]
                probabilities = {
                    str(idx_to_label.get(i, f"class_{i}")): float(p) for i, p in enumerate(probs)
                }
            except Exception:
                pass

        return PredictionResponse(
            prediction_id=f"pred_{uuid.uuid4().hex[:12]}",
            model_id=req.model_id,
            task_id=task.task_id,
            predicted_label=pred_label,
            predicted_class_index=y_pred_int,
            decision_score=decision_scores,
            probabilities=probabilities,
            source_epoch_id=source_epoch_id,
            source_subject_id=source_subj_id,
            true_label=true_label,
            operating_mode="RESEARCH",
            created_at=datetime.now(UTC).isoformat(),
        )


_service_instance: ClassicalDecodingService | None = None


def get_classical_decoding_service() -> ClassicalDecodingService:
    """Retrieve singleton instance of ClassicalDecodingService."""
    global _service_instance
    if _service_instance is None:
        _service_instance = ClassicalDecodingService()
    return _service_instance
