"""Managed Storage and Persistence for Personalized Calibration Artifacts (Phase 13)."""

import hashlib
import json
import logging
import sqlite3
from pathlib import Path

import joblib
from sklearn.pipeline import Pipeline

from ..database.connection import DatabaseManager, default_db_manager
from ..epoching.models import NormalizedLabel
from ..experiments.models import FeatureRepresentation, ModelFamily
from .models import (
    CalibrationHistoryItem,
    CalibrationProfile,
    CalibrationProfileState,
    CalibrationQCStatus,
    CalibrationQualitySummary,
    CalibrationRejectionReason,
    CalibrationSession,
    CalibrationSessionStatus,
    CalibrationSourceMode,
    CalibrationTrial,
    CalibrationTrialStatus,
    CueType,
    PersonalizedExperimentResult,
    PersonalizedModel,
    PersonalizedModelStatus,
    SubjectProfile,
    SubjectProfileStatus,
)

logger = logging.getLogger("neuromove.calibration")


class CalibrationStorage:
    """Manages SQLite persistence and filesystem serialization of calibration artifacts."""

    def __init__(
        self, db_manager: DatabaseManager | None = None, base_dir: Path | None = None
    ) -> None:
        self.db = db_manager or default_db_manager
        self.base_dir = base_dir or Path("data/calibration")
        self.base_dir.mkdir(parents=True, exist_ok=True)
        (self.base_dir / "models").mkdir(parents=True, exist_ok=True)
        (self.base_dir / "reports").mkdir(parents=True, exist_ok=True)

    # 1. Subject Profiles
    def save_subject_profile(self, profile: SubjectProfile) -> None:
        """Insert or update a pseudonymous subject profile."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO subject_profiles (
                    subject_id, profile_id, profile_version, status,
                    preferred_hand, display_name, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(subject_id) DO UPDATE SET
                    status=excluded.status,
                    preferred_hand=excluded.preferred_hand,
                    display_name=excluded.display_name,
                    notes=excluded.notes,
                    updated_at=excluded.updated_at;
                """,
                (
                    profile.subject_id,
                    profile.profile_id,
                    profile.profile_version,
                    profile.status.value,
                    profile.preferred_hand,
                    profile.display_name,
                    profile.notes,
                    profile.created_at,
                    profile.updated_at,
                ),
            )
            conn.commit()

    def get_subject_profile(self, subject_id: str) -> SubjectProfile | None:
        """Retrieve subject profile by subject ID."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM subject_profiles WHERE subject_id = ?;", (subject_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return SubjectProfile(
                subject_id=row[0],
                profile_id=row[1],
                profile_version=row[2],
                status=SubjectProfileStatus(row[3]),
                preferred_hand=row[4],
                display_name=row[5],
                notes=row[6],
                created_at=row[7],
                updated_at=row[8],
            )

    def list_subject_profiles(self) -> list[SubjectProfile]:
        """List all registered subject profiles."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM subject_profiles ORDER BY updated_at DESC;")
            rows = cursor.fetchall()
            return [
                SubjectProfile(
                    subject_id=r[0],
                    profile_id=r[1],
                    profile_version=r[2],
                    status=SubjectProfileStatus(r[3]),
                    preferred_hand=r[4],
                    display_name=r[5],
                    notes=r[6],
                    created_at=r[7],
                    updated_at=r[8],
                )
                for r in rows
            ]

    # 2. Calibration Profiles
    def save_calibration_profile(self, profile: CalibrationProfile) -> None:
        """Insert or update a calibration profile."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO calibration_profiles (
                    profile_id, subject_id, profile_version, state,
                    preferred_task, target_classes_json, channel_set_json,
                    preprocessing_config_json, epoching_config_json,
                    feature_config_json, decoder_config_json,
                    last_calibration_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(profile_id) DO UPDATE SET
                    state=excluded.state,
                    preferred_task=excluded.preferred_task,
                    target_classes_json=excluded.target_classes_json,
                    channel_set_json=excluded.channel_set_json,
                    preprocessing_config_json=excluded.preprocessing_config_json,
                    epoching_config_json=excluded.epoching_config_json,
                    feature_config_json=excluded.feature_config_json,
                    decoder_config_json=excluded.decoder_config_json,
                    last_calibration_id=excluded.last_calibration_id,
                    updated_at=excluded.updated_at;
                """,
                (
                    profile.profile_id,
                    profile.subject_id,
                    profile.profile_version,
                    profile.state.value,
                    profile.preferred_task,
                    json.dumps([c.value for c in profile.target_classes]),
                    json.dumps(profile.channel_set),
                    json.dumps(profile.preprocessing_config),
                    json.dumps(profile.epoching_config),
                    json.dumps(profile.feature_config),
                    json.dumps(profile.decoder_config),
                    profile.last_calibration_id,
                    profile.created_at,
                    profile.updated_at,
                ),
            )
            conn.commit()

    def get_calibration_profile(self, profile_id: str) -> CalibrationProfile | None:
        """Retrieve calibration profile by ID."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM calibration_profiles WHERE profile_id = ?;", (profile_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return CalibrationProfile(
                profile_id=row[0],
                subject_id=row[1],
                profile_version=row[2],
                state=CalibrationProfileState(row[3]),
                preferred_task=row[4],
                target_classes=[NormalizedLabel(lbl) for lbl in json.loads(row[5])],
                channel_set=json.loads(row[6]),
                preprocessing_config=json.loads(row[7]),
                epoching_config=json.loads(row[8]),
                feature_config=json.loads(row[9]),
                decoder_config=json.loads(row[10]),
                last_calibration_id=row[11],
                created_at=row[12],
                updated_at=row[13],
            )

    # 3. Sessions and Trials
    def save_calibration_session(
        self, session: CalibrationSession, trials: list[CalibrationTrial]
    ) -> None:
        """Persist calibration session and its full sequence of trials."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            # Save session
            cursor.execute(
                """
                INSERT INTO calibration_sessions (
                    calibration_id, profile_id, subject_id, session_number,
                    protocol_version, task_id, source_mode, status,
                    started_at, completed_at, trial_count, valid_trial_count,
                    rejected_trial_count, class_distribution_json,
                    quality_summary_json, pause_intervals_json,
                    active_trial_index, config_hash, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(calibration_id) DO UPDATE SET
                    status=excluded.status,
                    started_at=excluded.started_at,
                    completed_at=excluded.completed_at,
                    trial_count=excluded.trial_count,
                    valid_trial_count=excluded.valid_trial_count,
                    rejected_trial_count=excluded.rejected_trial_count,
                    class_distribution_json=excluded.class_distribution_json,
                    quality_summary_json=excluded.quality_summary_json,
                    pause_intervals_json=excluded.pause_intervals_json,
                    active_trial_index=excluded.active_trial_index;
                """,
                (
                    session.calibration_id,
                    session.profile_id,
                    session.subject_id,
                    session.session_number,
                    session.protocol_version,
                    session.task_id,
                    session.source_mode.value,
                    session.status.value,
                    session.started_at,
                    session.completed_at,
                    session.trial_count,
                    session.valid_trial_count,
                    session.rejected_trial_count,
                    json.dumps(session.class_distribution),
                    json.dumps(session.quality_summary.model_dump())
                    if session.quality_summary
                    else None,
                    json.dumps(session.pause_intervals),
                    session.active_trial_index,
                    session.config_hash,
                    session.created_at,
                ),
            )

            # Save trials
            for t in trials:
                cursor.execute(
                    """
                    INSERT INTO calibration_trials (
                        trial_id, calibration_id, sequence_index, target_label,
                        cue, planned_onset, actual_onset, imagery_start,
                        imagery_end, status, quality_status, quality_reasons_json,
                        epoch_id, notes, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(trial_id) DO UPDATE SET
                        actual_onset=excluded.actual_onset,
                        imagery_start=excluded.imagery_start,
                        imagery_end=excluded.imagery_end,
                        status=excluded.status,
                        quality_status=excluded.quality_status,
                        quality_reasons_json=excluded.quality_reasons_json,
                        epoch_id=excluded.epoch_id,
                        notes=excluded.notes;
                    """,
                    (
                        t.trial_id,
                        t.calibration_id,
                        t.sequence_index,
                        t.target_label.value,
                        t.cue.value,
                        t.planned_onset,
                        t.actual_onset,
                        t.imagery_start,
                        t.imagery_end,
                        t.status.value,
                        t.quality_status.value,
                        json.dumps([r.value for r in t.quality_reasons]),
                        t.epoch_id,
                        t.notes,
                        t.created_at,
                    ),
                )
            conn.commit()

    def get_calibration_session(self, calibration_id: str) -> CalibrationSession | None:
        """Retrieve session record by calibration ID."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM calibration_sessions WHERE calibration_id = ?;", (calibration_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return CalibrationSession(
                calibration_id=row[0],
                profile_id=row[1],
                subject_id=row[2],
                session_number=row[3],
                protocol_version=row[4],
                task_id=row[5],
                source_mode=CalibrationSourceMode(row[6]),
                status=CalibrationSessionStatus(row[7]),
                started_at=row[8],
                completed_at=row[9],
                trial_count=row[10],
                valid_trial_count=row[11],
                rejected_trial_count=row[12],
                class_distribution=json.loads(row[13]),
                quality_summary=CalibrationQualitySummary(**json.loads(row[14]))
                if row[14]
                else None,
                pause_intervals=json.loads(row[15]),
                active_trial_index=row[16],
                config_hash=row[17],
                created_at=row[18],
            )

    def get_calibration_trials(self, calibration_id: str) -> list[CalibrationTrial]:
        """Retrieve all trials for a session ordered by sequence index."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM calibration_trials WHERE calibration_id = ? ORDER BY sequence_index ASC;",
                (calibration_id,),
            )
            rows = cursor.fetchall()
            return [
                CalibrationTrial(
                    trial_id=r[0],
                    calibration_id=r[1],
                    sequence_index=r[2],
                    target_label=NormalizedLabel(r[3]),
                    cue=CueType(r[4]),
                    planned_onset=r[5],
                    actual_onset=r[6],
                    imagery_start=r[7],
                    imagery_end=r[8],
                    status=CalibrationTrialStatus(r[9]),
                    quality_status=CalibrationQCStatus(r[10]),
                    quality_reasons=[CalibrationRejectionReason(x) for x in json.loads(r[11])],
                    epoch_id=r[12],
                    notes=r[13],
                    created_at=r[14],
                )
                for r in rows
            ]

    # 4. Personalized Experiments & Models
    def save_personalized_model(
        self,
        exp_result: PersonalizedExperimentResult,
        model_artifact: PersonalizedModel,
        pipeline: Pipeline,
    ) -> None:
        """Serialize model pipeline to joblib, compute SHA-256, and persist metadata."""
        # 1. Save .joblib artifact
        artifact_path = self.base_dir / "models" / f"{model_artifact.model_id}.joblib"
        joblib.dump(pipeline, artifact_path, compress=3)

        # 2. Compute SHA-256 checksum
        hasher = hashlib.sha256()
        with open(artifact_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                hasher.update(chunk)
        checksum = hasher.hexdigest()

        model_artifact.artifact_file_path = str(artifact_path.resolve())
        model_artifact.artifact_checksum_sha256 = checksum

        # 3. Persist in SQLite
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            # Save experiment
            cursor.execute(
                """
                INSERT INTO personalized_experiments (
                    experiment_id, calibration_id, profile_id, subject_id,
                    model_id, generic_base_model_id, train_trial_count,
                    heldout_trial_count, train_trial_ids_json, heldout_trial_ids_json,
                    train_metrics_json, heldout_metrics_json, generic_comparison_json,
                    config_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(experiment_id) DO UPDATE SET
                    train_metrics_json=excluded.train_metrics_json,
                    heldout_metrics_json=excluded.heldout_metrics_json,
                    generic_comparison_json=excluded.generic_comparison_json;
                """,
                (
                    exp_result.experiment_id,
                    exp_result.calibration_id,
                    exp_result.profile_id,
                    exp_result.subject_id,
                    exp_result.model_id,
                    exp_result.generic_base_model_id,
                    exp_result.train_trial_count,
                    exp_result.heldout_trial_count,
                    json.dumps(exp_result.train_trial_ids),
                    json.dumps(exp_result.heldout_trial_ids),
                    json.dumps(exp_result.train_metrics),
                    json.dumps(exp_result.heldout_metrics),
                    json.dumps(exp_result.comparison_with_generic.model_dump())
                    if exp_result.comparison_with_generic
                    else None,
                    json.dumps(exp_result.config.model_dump()),
                    exp_result.created_at,
                ),
            )

            # Save model
            cursor.execute(
                """
                INSERT INTO personalized_models (
                    model_id, calibration_id, profile_id, subject_id,
                    experiment_id, generic_base_model_id, model_family,
                    representation, status, is_stale, staleness_reasons_json,
                    heldout_balanced_accuracy, heldout_f1, artifact_file_path,
                    artifact_checksum_sha256, model_card_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(model_id) DO UPDATE SET
                    status=excluded.status,
                    is_stale=excluded.is_stale,
                    staleness_reasons_json=excluded.staleness_reasons_json,
                    heldout_balanced_accuracy=excluded.heldout_balanced_accuracy,
                    heldout_f1=excluded.heldout_f1;
                """,
                (
                    model_artifact.model_id,
                    model_artifact.calibration_id,
                    model_artifact.profile_id,
                    model_artifact.subject_id,
                    model_artifact.experiment_id,
                    model_artifact.generic_base_model_id,
                    model_artifact.model_family.value,
                    model_artifact.representation.value,
                    model_artifact.status.value,
                    1 if model_artifact.is_stale else 0,
                    json.dumps(model_artifact.staleness_reasons),
                    model_artifact.heldout_balanced_accuracy,
                    model_artifact.heldout_f1,
                    model_artifact.artifact_file_path,
                    model_artifact.artifact_checksum_sha256,
                    json.dumps(model_artifact.model_card_json),
                    model_artifact.created_at,
                ),
            )
            conn.commit()

    def get_personalized_model(self, model_id: str) -> PersonalizedModel | None:
        """Retrieve personalized model metadata."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM personalized_models WHERE model_id = ?;", (model_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return PersonalizedModel(
                model_id=row[0],
                calibration_id=row[1],
                profile_id=row[2],
                subject_id=row[3],
                experiment_id=row[4],
                generic_base_model_id=row[5],
                model_family=ModelFamily(row[6]),
                representation=FeatureRepresentation(row[7]),
                status=PersonalizedModelStatus(row[8]),
                is_stale=bool(row[9]),
                staleness_reasons=json.loads(row[10]),
                heldout_balanced_accuracy=row[11],
                heldout_f1=row[12],
                artifact_file_path=row[13],
                artifact_checksum_sha256=row[14],
                model_card_json=json.loads(row[15]),
                created_at=row[16],
            )

    def load_personalized_pipeline(self, model_id: str) -> Pipeline:
        """Load fitted scikit-learn pipeline from disk and verify SHA-256."""
        model_meta = self.get_personalized_model(model_id)
        if not model_meta:
            raise FileNotFoundError(f"Personalized model '{model_id}' not found in registry.")

        artifact_path = Path(model_meta.artifact_file_path)
        if not artifact_path.exists():
            raise FileNotFoundError(f"Model artifact file '{artifact_path}' does not exist.")

        # Verify SHA-256
        hasher = hashlib.sha256()
        with open(artifact_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                hasher.update(chunk)
        if hasher.hexdigest() != model_meta.artifact_checksum_sha256:
            raise ValueError(
                f"Checksum mismatch for model '{model_id}'! Possible tampering or corruption."
            )

        return joblib.load(artifact_path)

    def get_subject_history(self, subject_id: str) -> list[CalibrationHistoryItem]:
        """Fetch chronological calibration session history for a subject."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT s.calibration_id, s.session_number, s.protocol_version,
                       s.source_mode, s.status, s.trial_count, s.valid_trial_count,
                       m.model_id, m.heldout_balanced_accuracy, s.created_at
                FROM calibration_sessions s
                LEFT JOIN personalized_models m ON s.calibration_id = m.calibration_id
                WHERE s.subject_id = ?
                ORDER BY s.session_number ASC;
                """,
                (subject_id,),
            )
            rows = cursor.fetchall()
            return [
                CalibrationHistoryItem(
                    calibration_id=r[0],
                    session_number=r[1],
                    protocol_version=r[2],
                    source_mode=CalibrationSourceMode(r[3]),
                    status=CalibrationSessionStatus(r[4]),
                    trial_count=r[5],
                    valid_trial_count=r[6],
                    model_id=r[7],
                    heldout_balanced_accuracy=r[8],
                    created_at=r[9],
                )
                for r in rows
            ]
