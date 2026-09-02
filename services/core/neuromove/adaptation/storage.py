"""Adaptation Storage: SQLite persistence and .joblib model serialization."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

import joblib

from neuromove.adaptation.models import (
    AdaptationDataBatch,
    AdaptationPolicy,
    AdaptationRun,
    DriftObservation,
)
from neuromove.database.connection import DatabaseManager, default_db_manager


class AdaptationStorage:
    """Handles database persistence and model file storage for Phase 14."""

    def __init__(self, db_manager: DatabaseManager = default_db_manager) -> None:
        self._db_manager = db_manager
        self._models_dir = Path("models") / "adapted"
        self._models_dir.mkdir(parents=True, exist_ok=True)

    def _get_connection(self) -> sqlite3.Connection:
        db_path = self._db_manager.get_db_path()
        return sqlite3.connect(db_path)

    # --- Policies ---
    def save_policy(self, policy: AdaptationPolicy) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO adaptation_policies (
                    policy_id, policy_version, name, description, mode, scope,
                    min_new_trials, min_trials_per_class, max_rejection_ratio,
                    retention_strategy, imbalance_policy, max_allowed_regression,
                    min_promoted_balanced_accuracy, min_validation_samples,
                    validation_strategy, random_state, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    policy.policy_id,
                    policy.policy_version,
                    policy.name,
                    policy.description,
                    str(policy.mode),
                    str(policy.scope),
                    policy.min_new_trials,
                    policy.min_trials_per_class,
                    policy.max_rejection_ratio,
                    str(policy.retention_strategy),
                    str(policy.imbalance_policy),
                    policy.max_allowed_regression,
                    policy.min_promoted_balanced_accuracy,
                    policy.min_validation_samples,
                    policy.validation_strategy,
                    policy.random_state,
                    policy.created_at,
                ),
            )
            conn.commit()

    def get_policy(self, policy_id: str) -> AdaptationPolicy | None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM adaptation_policies WHERE policy_id = ?",
                (policy_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return AdaptationPolicy(
                policy_id=row[0],
                policy_version=row[1],
                name=row[2],
                description=row[3],
                mode=row[4],
                scope=row[5],
                min_new_trials=row[6],
                min_trials_per_class=row[7],
                max_rejection_ratio=row[8],
                retention_strategy=row[9],
                imbalance_policy=row[10],
                max_allowed_regression=row[11],
                min_promoted_balanced_accuracy=row[12],
                min_validation_samples=row[13],
                validation_strategy=row[14],
                random_state=row[15],
                created_at=row[16],
            )

    def list_policies(self) -> list[AdaptationPolicy]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM adaptation_policies ORDER BY created_at ASC")
            rows = cursor.fetchall()
            return [
                AdaptationPolicy(
                    policy_id=r[0],
                    policy_version=r[1],
                    name=r[2],
                    description=r[3],
                    mode=r[4],
                    scope=r[5],
                    min_new_trials=r[6],
                    min_trials_per_class=r[7],
                    max_rejection_ratio=r[8],
                    retention_strategy=r[9],
                    imbalance_policy=r[10],
                    max_allowed_regression=r[11],
                    min_promoted_balanced_accuracy=r[12],
                    min_validation_samples=r[13],
                    validation_strategy=r[14],
                    random_state=r[15],
                    created_at=r[16],
                )
                for r in rows
            ]

    # --- Batches ---
    def save_batch(self, batch: AdaptationDataBatch) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO adaptation_batches (
                    batch_id, name, subject_id, source_mode, dataset_id, recording_id,
                    epoch_set_id, feature_set_id, trial_count, class_distribution_json,
                    quality_summary_json, source_fingerprint, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    batch.batch_id,
                    batch.name,
                    batch.subject_id,
                    batch.source_mode,
                    batch.dataset_id,
                    batch.recording_id,
                    batch.epoch_set_id,
                    batch.feature_set_id,
                    batch.trial_count,
                    json.dumps(batch.class_distribution),
                    json.dumps(batch.quality_summary),
                    batch.source_fingerprint,
                    batch.created_at,
                ),
            )
            conn.commit()

    def get_batch(self, batch_id: str) -> AdaptationDataBatch | None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM adaptation_batches WHERE batch_id = ?", (batch_id,))
            r = cursor.fetchone()
            if not r:
                return None
            return AdaptationDataBatch(
                batch_id=r[0],
                name=r[1],
                subject_id=r[2],
                source_mode=r[3],
                dataset_id=r[4],
                recording_id=r[5],
                epoch_set_id=r[6],
                feature_set_id=r[7],
                trial_count=r[8],
                class_distribution=json.loads(r[9]),
                quality_summary=json.loads(r[10]),
                source_fingerprint=r[11],
                created_at=r[12],
            )

    def list_batches(self, subject_id: str | None = None) -> list[AdaptationDataBatch]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if subject_id:
                cursor.execute(
                    "SELECT * FROM adaptation_batches WHERE subject_id = ? OR subject_id IS NULL ORDER BY created_at DESC",
                    (subject_id,),
                )
            else:
                cursor.execute("SELECT * FROM adaptation_batches ORDER BY created_at DESC")
            rows = cursor.fetchall()
            return [
                AdaptationDataBatch(
                    batch_id=r[0],
                    name=r[1],
                    subject_id=r[2],
                    source_mode=r[3],
                    dataset_id=r[4],
                    recording_id=r[5],
                    epoch_set_id=r[6],
                    feature_set_id=r[7],
                    trial_count=r[8],
                    class_distribution=json.loads(r[9]),
                    quality_summary=json.loads(r[10]),
                    source_fingerprint=r[11],
                    created_at=r[12],
                )
                for r in rows
            ]

    # --- Adaptation Runs ---
    def save_run(self, run: AdaptationRun) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO adaptation_runs (
                    adaptation_id, base_model_id, candidate_model_id, policy_id, scope,
                    subject_id, data_batch_ids_json, status, training_composition_json,
                    validation_composition_json, leakage_check_json, incumbent_metrics_json,
                    candidate_metrics_json, comparison_json, promotion_eligibility_json,
                    promotion_decision_json, manifest_json, started_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run.adaptation_id,
                    run.base_model_id,
                    run.candidate_model_id,
                    run.policy_id,
                    str(run.scope),
                    run.subject_id,
                    json.dumps(run.data_batch_ids),
                    str(run.status),
                    json.dumps(run.training_composition),
                    json.dumps(run.validation_composition),
                    json.dumps(run.leakage_check),
                    json.dumps(run.incumbent_metrics),
                    json.dumps(run.candidate_metrics) if run.candidate_metrics else None,
                    run.comparison.model_dump_json() if run.comparison else None,
                    run.promotion_eligibility.model_dump_json()
                    if run.promotion_eligibility
                    else None,
                    json.dumps(run.promotion_decision) if run.promotion_decision else None,
                    None,
                    run.started_at,
                    run.completed_at,
                ),
            )
            conn.commit()

    def get_run(self, adaptation_id: str) -> AdaptationRun | None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM adaptation_runs WHERE adaptation_id = ?", (adaptation_id,)
            )
            r = cursor.fetchone()
            if not r:
                return None
            return AdaptationRun(
                adaptation_id=r[0],
                base_model_id=r[1],
                candidate_model_id=r[2],
                policy_id=r[3],
                scope=r[4],
                subject_id=r[5],
                data_batch_ids=json.loads(r[6]),
                status=r[7],
                training_composition=json.loads(r[8]),
                validation_composition=json.loads(r[9]),
                leakage_check=json.loads(r[10]),
                incumbent_metrics=json.loads(r[11]),
                candidate_metrics=json.loads(r[12]) if r[12] else None,
                comparison=json.loads(r[13]) if r[13] else None,
                promotion_eligibility=json.loads(r[14]) if r[14] else None,
                promotion_decision=json.loads(r[15]) if r[15] else None,
                started_at=r[17],
                completed_at=r[18],
            )

    def list_runs(self, subject_id: str | None = None) -> list[AdaptationRun]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if subject_id:
                cursor.execute(
                    "SELECT * FROM adaptation_runs WHERE subject_id = ? ORDER BY started_at DESC",
                    (subject_id,),
                )
            else:
                cursor.execute("SELECT * FROM adaptation_runs ORDER BY started_at DESC")
            rows = cursor.fetchall()
            return [
                AdaptationRun(
                    adaptation_id=r[0],
                    base_model_id=r[1],
                    candidate_model_id=r[2],
                    policy_id=r[3],
                    scope=r[4],
                    subject_id=r[5],
                    data_batch_ids=json.loads(r[6]),
                    status=r[7],
                    training_composition=json.loads(r[8]),
                    validation_composition=json.loads(r[9]),
                    leakage_check=json.loads(r[10]),
                    incumbent_metrics=json.loads(r[11]),
                    candidate_metrics=json.loads(r[12]) if r[12] else None,
                    comparison=json.loads(r[13]) if r[13] else None,
                    promotion_eligibility=json.loads(r[14]) if r[14] else None,
                    promotion_decision=json.loads(r[15]) if r[15] else None,
                    started_at=r[17],
                    completed_at=r[18],
                )
                for r in rows
            ]

    # --- Drift Observations ---
    def save_drift(self, drift: DriftObservation) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO drift_observations (
                    observation_id, subject_id, dataset_id, window_label,
                    feature_shift_score, class_distribution_shift, signal_quality_score,
                    prediction_entropy, status, thresholds_json, details_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    drift.observation_id,
                    drift.subject_id,
                    drift.dataset_id,
                    drift.window_label,
                    drift.feature_shift_score,
                    drift.class_distribution_shift,
                    drift.signal_quality_score,
                    drift.prediction_entropy,
                    str(drift.status),
                    json.dumps(drift.thresholds),
                    json.dumps(drift.details),
                    drift.created_at,
                ),
            )
            conn.commit()

    def list_drift_observations(self, subject_id: str | None = None) -> list[DriftObservation]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if subject_id:
                cursor.execute(
                    "SELECT * FROM drift_observations WHERE subject_id = ? ORDER BY created_at DESC",
                    (subject_id,),
                )
            else:
                cursor.execute("SELECT * FROM drift_observations ORDER BY created_at DESC")
            rows = cursor.fetchall()
            return [
                DriftObservation(
                    observation_id=r[0],
                    subject_id=r[1],
                    dataset_id=r[2],
                    window_label=r[3],
                    feature_shift_score=r[4],
                    class_distribution_shift=r[5],
                    signal_quality_score=r[6],
                    prediction_entropy=r[7],
                    status=r[8],
                    thresholds=json.loads(r[9]),
                    details=json.loads(r[10]),
                    created_at=r[11],
                )
                for r in rows
            ]

    # --- Model Artifact Serialization ---
    def save_pipeline_artifact(self, model_id: str, pipeline_obj: Any) -> tuple[str, str]:
        """Serialize pipeline to .joblib and return (file_path, sha256_checksum)."""
        file_path = self._models_dir / f"{model_id}.joblib"
        joblib.dump(pipeline_obj, file_path)

        with open(file_path, "rb") as f:
            checksum = hashlib.sha256(f.read()).hexdigest()

        return str(file_path), checksum
