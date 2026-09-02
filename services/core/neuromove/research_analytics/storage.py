"""NeuroMove — Phase 22 Research Analytics SQLite Persistence Layer."""

from __future__ import annotations

import json
import logging
import sqlite3
from typing import Any

from neuromove.database.connection import DatabaseManager, default_db_manager
from neuromove.research_analytics.models import (
    AblationRun,
    ComparisonResult,
    ExperimentManifest,
    ReplayCheckpoint,
    ResearchArtifact,
    ResearchDataset,
    ResearchExperiment,
    ResearchExperimentStatus,
    RobustnessRun,
    StageResult,
)

logger = logging.getLogger(__name__)


class ResearchStorage:
    """Handles CRUD persistence for experiments, manifests, stages, metrics, ablations, comparisons, and artifacts."""

    def __init__(self, db_manager: DatabaseManager | None = None):
        self.db = db_manager or default_db_manager
        try:
            self.db.initialize_db()
        except Exception:
            pass

    def _get_connection(self) -> sqlite3.Connection:
        try:
            self.db.initialize_db()
        except Exception:
            pass
        return sqlite3.connect(self.db.get_db_path(), timeout=5.0)

    def save_experiment(self, experiment: ResearchExperiment) -> None:
        """Persist or update research experiment record and manifest."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # 1. Upsert experiment
            cursor.execute(
                """
                INSERT OR REPLACE INTO research_experiments (
                    experiment_id, title, description, analysis_type, status,
                    replay_mode, parent_experiment_id, dataset_id, grouping_strategy,
                    is_sealed, result_hash, created_at, updated_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    experiment.experiment_id,
                    experiment.title,
                    experiment.description,
                    experiment.analysis_type.value if hasattr(experiment.analysis_type, "value") else str(experiment.analysis_type),
                    experiment.status.value if hasattr(experiment.status, "value") else str(experiment.status),
                    experiment.replay_mode.value if hasattr(experiment.replay_mode, "value") else str(experiment.replay_mode),
                    experiment.parent_experiment_id,
                    experiment.dataset_id,
                    experiment.grouping_strategy.value if hasattr(experiment.grouping_strategy, "value") else str(experiment.grouping_strategy),
                    1 if experiment.is_sealed else 0,
                    experiment.result_hash,
                    experiment.created_at,
                    experiment.updated_at,
                    experiment.completed_at,
                ),
            )

            # 2. Upsert manifest
            man = experiment.manifest
            cursor.execute(
                """
                INSERT OR REPLACE INTO research_manifests (
                    manifest_id, experiment_id, app_version, git_commit,
                    source_session_ids_json, source_checksums_json, channel_names_json,
                    sampling_rate, montage, clock_config_json, qc_config_json,
                    dsp_config_json, epoch_config_json, feature_config_json,
                    csp_config_json, model_id, model_version, personalization_profile_json,
                    adaptation_state_json, confidence_policy_json, intent_policy_json,
                    safety_policy_json, hil_profile_json, seed, numerical_tolerances_json,
                    analysis_parameters_json, export_version, is_sealed, manifest_hash,
                    created_at, sealed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    man.manifest_id,
                    man.experiment_id,
                    man.app_version,
                    man.git_commit,
                    json.dumps(man.source_session_ids),
                    json.dumps(man.source_checksums),
                    json.dumps(man.channel_names),
                    man.sampling_rate,
                    man.montage,
                    json.dumps(man.clock_config),
                    json.dumps(man.qc_config),
                    json.dumps(man.dsp_config),
                    json.dumps(man.epoch_config),
                    json.dumps(man.feature_config),
                    json.dumps(man.csp_config),
                    man.model_id,
                    man.model_version,
                    json.dumps(man.personalization_profile),
                    json.dumps(man.adaptation_state),
                    json.dumps(man.confidence_policy),
                    json.dumps(man.intent_policy),
                    json.dumps(man.safety_policy),
                    json.dumps(man.hil_profile),
                    man.seed,
                    json.dumps(man.numerical_tolerances),
                    json.dumps(man.analysis_parameters),
                    man.export_version,
                    1 if man.is_sealed else 0,
                    man.manifest_hash,
                    man.created_at,
                    man.sealed_at,
                ),
            )

            # 3. Save stages
            for stg in experiment.stages:
                stg_id = f"stg_{experiment.experiment_id}_{stg.stage.value}"
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO research_stage_results (
                        stage_result_id, experiment_id, stage, status,
                        input_count, output_count, rejected_count, latency_ms,
                        configuration_hash, stage_checksum, warnings_json,
                        errors_json, metadata_json, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        stg_id,
                        experiment.experiment_id,
                        stg.stage.value if hasattr(stg.stage, "value") else str(stg.stage),
                        stg.status,
                        stg.input_count,
                        stg.output_count,
                        stg.rejected_count,
                        stg.latency_ms,
                        stg.configuration_hash,
                        stg.stage_checksum,
                        json.dumps(stg.warnings),
                        json.dumps(stg.errors),
                        json.dumps(stg.metadata),
                        stg.timestamp,
                    ),
                )

            # 4. Save metrics if available
            if experiment.metrics:
                m = experiment.metrics
                m_id = f"met_{experiment.experiment_id}"
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO research_metric_results (
                        metric_id, experiment_id, accuracy, balanced_accuracy,
                        precision_macro, recall_macro, f1_macro,
                        per_class_precision_json, per_class_recall_json, per_class_f1_json,
                        expected_calibration_error, brier_score, roc_auc_macro, pr_auc_macro,
                        total_trials, evaluated_trials, rejected_trials, rejection_rate, evaluated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        m_id,
                        m.experiment_id,
                        m.accuracy,
                        m.balanced_accuracy,
                        m.precision_macro,
                        m.recall_macro,
                        m.f1_macro,
                        json.dumps(m.per_class_precision),
                        json.dumps(m.per_class_recall),
                        json.dumps(m.per_class_f1),
                        m.expected_calibration_error,
                        m.brier_score,
                        m.roc_auc_macro,
                        m.pr_auc_macro,
                        m.total_trials,
                        m.evaluated_trials,
                        m.rejected_trials,
                        m.rejection_rate,
                        m.evaluated_at,
                    ),
                )

            conn.commit()

    def get_experiment(self, experiment_id: str) -> ResearchExperiment | None:
        """Fetch experiment by ID from database."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT experiment_id, title, description, analysis_type, status,
                           replay_mode, parent_experiment_id, dataset_id, grouping_strategy,
                           is_sealed, result_hash, created_at, updated_at, completed_at
                    FROM research_experiments WHERE experiment_id = ?;
                    """,
                    (experiment_id,),
                )
                row = cursor.fetchone()
                if not row:
                    return None

                # Fetch manifest
                cursor.execute(
                    """
                    SELECT manifest_id, experiment_id, app_version, git_commit,
                           source_session_ids_json, source_checksums_json, channel_names_json,
                           sampling_rate, montage, clock_config_json, qc_config_json,
                           dsp_config_json, epoch_config_json, feature_config_json,
                           csp_config_json, model_id, model_version, personalization_profile_json,
                           adaptation_state_json, confidence_policy_json, intent_policy_json,
                           safety_policy_json, hil_profile_json, seed, numerical_tolerances_json,
                           analysis_parameters_json, export_version, is_sealed, manifest_hash,
                           created_at, sealed_at
                    FROM research_manifests WHERE experiment_id = ?;
                    """,
                    (experiment_id,),
                )
                m_row = cursor.fetchone()
                if not m_row:
                    return None

                manifest = ExperimentManifest(
                    manifest_id=m_row[0],
                    experiment_id=m_row[1],
                    app_version=m_row[2],
                    git_commit=m_row[3],
                    source_session_ids=json.loads(m_row[4]),
                    source_checksums=json.loads(m_row[5]),
                    channel_names=json.loads(m_row[6]),
                    sampling_rate=m_row[7],
                    montage=m_row[8],
                    clock_config=json.loads(m_row[9]),
                    qc_config=json.loads(m_row[10]),
                    dsp_config=json.loads(m_row[11]),
                    epoch_config=json.loads(m_row[12]),
                    feature_config=json.loads(m_row[13]),
                    csp_config=json.loads(m_row[14]),
                    model_id=m_row[15],
                    model_version=m_row[16],
                    personalization_profile=json.loads(m_row[17]),
                    adaptation_state=json.loads(m_row[18]),
                    confidence_policy=json.loads(m_row[19]),
                    intent_policy=json.loads(m_row[20]),
                    safety_policy=json.loads(m_row[21]),
                    hil_profile=json.loads(m_row[22]),
                    seed=m_row[23],
                    numerical_tolerances=json.loads(m_row[24]),
                    analysis_parameters=json.loads(m_row[25]),
                    export_version=m_row[26],
                    is_sealed=bool(m_row[27]),
                    manifest_hash=m_row[28],
                    created_at=m_row[29],
                    sealed_at=m_row[30],
                )

                # Fetch stages
                cursor.execute(
                    """
                    SELECT stage, status, input_count, output_count, rejected_count,
                           latency_ms, configuration_hash, stage_checksum, warnings_json,
                           errors_json, metadata_json, timestamp
                    FROM research_stage_results WHERE experiment_id = ?;
                    """,
                    (experiment_id,),
                )
                stages = []
                for s_row in cursor.fetchall():
                    stages.append(
                        StageResult(
                            stage=s_row[0],
                            status=s_row[1],
                            input_count=s_row[2],
                            output_count=s_row[3],
                            rejected_count=s_row[4],
                            latency_ms=s_row[5],
                            configuration_hash=s_row[6],
                            stage_checksum=s_row[7],
                            warnings=json.loads(s_row[8]),
                            errors=json.loads(s_row[9]),
                            metadata=json.loads(s_row[10]) if s_row[10] else {},
                            timestamp=s_row[11],
                        )
                    )

                return ResearchExperiment(
                    experiment_id=row[0],
                    title=row[1],
                    description=row[2],
                    analysis_type=row[3],
                    status=row[4],
                    replay_mode=row[5],
                    parent_experiment_id=row[6],
                    dataset_id=row[7],
                    grouping_strategy=row[8],
                    manifest=manifest,
                    stages=stages,
                    is_sealed=bool(row[9]),
                    result_hash=row[10],
                    created_at=row[11],
                    updated_at=row[12],
                    completed_at=row[13],
                )
        except Exception:
            return None

    def list_experiments(self) -> list[ResearchExperiment]:
        """List all experiments."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT experiment_id FROM research_experiments ORDER BY created_at DESC;")
                ids = [row[0] for row in cursor.fetchall()]

            return [exp for exp_id in ids if (exp := self.get_experiment(exp_id)) is not None]
        except Exception:
            return []

    def save_artifact(self, artifact: ResearchArtifact) -> None:
        """Persist research export artifact."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO research_artifacts (
                    artifact_id, experiment_id, artifact_type, checksum,
                    file_name, content_json, generated_time, generator_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    artifact.artifact_id,
                    artifact.experiment_id,
                    artifact.artifact_type.value if hasattr(artifact.artifact_type, "value") else str(artifact.artifact_type),
                    artifact.checksum,
                    artifact.file_name,
                    artifact.content_json,
                    artifact.generated_time,
                    artifact.generator_version,
                ),
            )
            conn.commit()

    def list_artifacts(self, experiment_id: str) -> list[ResearchArtifact]:
        """List artifacts for an experiment."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT artifact_id, experiment_id, artifact_type, checksum,
                           file_name, content_json, generated_time, generator_version
                    FROM research_artifacts WHERE experiment_id = ?;
                    """,
                    (experiment_id,),
                )
                artifacts = []
                for row in cursor.fetchall():
                    artifacts.append(
                        ResearchArtifact(
                            artifact_id=row[0],
                            experiment_id=row[1],
                            artifact_type=row[2],
                            checksum=row[3],
                            file_name=row[4],
                            content_json=row[5],
                            generated_time=row[6],
                            generator_version=row[7],
                        )
                    )
                return artifacts
        except Exception:
            return []

    def save_checkpoint(self, checkpoint: ReplayCheckpoint) -> None:
        """Save a replay checkpoint."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO research_replay_checkpoints (
                    checkpoint_id, experiment_id, stage, source_offset,
                    epoch_index, manifest_hash, intermediate_checksum,
                    model_version, state_payload_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    checkpoint.checkpoint_id,
                    checkpoint.experiment_id,
                    checkpoint.stage.value if hasattr(checkpoint.stage, "value") else str(checkpoint.stage),
                    checkpoint.source_offset,
                    checkpoint.epoch_index,
                    checkpoint.manifest_hash,
                    checkpoint.intermediate_checksum,
                    checkpoint.model_version,
                    json.dumps(checkpoint.state_payload),
                    checkpoint.created_at,
                ),
            )
            conn.commit()
