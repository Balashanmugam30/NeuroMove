"""SQLite-ready Database Connection Lifecycle and Initialization for NeuroMove."""

import logging
import sqlite3
from pathlib import Path

from ..config.settings import get_settings

logger = logging.getLogger("neuromove.database")


class DatabaseManager:
    """Manages SQLite connection lifecycle and schema bootstrap."""

    def __init__(self, db_url: str | None = None) -> None:
        self.db_url = db_url or get_settings().database_url
        self._is_initialized = False

    def get_db_path(self) -> Path:
        """Extract filesystem path from sqlite URL."""
        cleaned = self.db_url.replace("sqlite:///", "").replace("sqlite://", "")
        return Path(cleaned)

    def get_connection(self, db_path: Path | None = None) -> sqlite3.Connection:
        """Create a sqlite3 connection to database path."""
        target_path = db_path or self.get_db_path()
        return sqlite3.connect(target_path)

    def initialize_db(self) -> None:
        """Create database directory and initialize core schema tables."""
        db_path = self.get_db_path()
        db_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                # Create schema version audit table
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS schema_migrations (
                        version TEXT PRIMARY KEY,
                        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )
                # Create foundational events log table
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS canonical_events (
                        event_id TEXT PRIMARY KEY,
                        version TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        mode TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        correlation_id TEXT,
                        payload_json TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('001_initial_platform');"
                )

                # Migration 002: Public EEG Datasets and Recordings
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS datasets (
                        dataset_id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        version TEXT NOT NULL,
                        provider TEXT NOT NULL,
                        source_reference TEXT NOT NULL,
                        official_reference TEXT NOT NULL,
                        license TEXT NOT NULL,
                        description TEXT NOT NULL,
                        modality TEXT NOT NULL,
                        tasks_json TEXT NOT NULL,
                        default_loader TEXT NOT NULL,
                        supported INTEGER NOT NULL DEFAULT 1,
                        schema_version TEXT NOT NULL,
                        cache_status TEXT NOT NULL,
                        subjects_count INTEGER NOT NULL DEFAULT 0,
                        recordings_count INTEGER NOT NULL DEFAULT 0,
                        total_size_bytes INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS dataset_subjects (
                        dataset_id TEXT NOT NULL,
                        subject_id TEXT NOT NULL,
                        source_subject_id TEXT NOT NULL,
                        recording_count INTEGER NOT NULL DEFAULT 0,
                        runs_json TEXT NOT NULL,
                        available_tasks_json TEXT NOT NULL,
                        PRIMARY KEY (dataset_id, subject_id)
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS dataset_recordings (
                        recording_id TEXT PRIMARY KEY,
                        dataset_id TEXT NOT NULL,
                        dataset_version TEXT NOT NULL,
                        subject_id TEXT NOT NULL,
                        source_subject_id TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        run_id TEXT NOT NULL,
                        file_reference TEXT NOT NULL,
                        checksum_sha256 TEXT NOT NULL,
                        sample_rate_hz INTEGER NOT NULL,
                        channel_count INTEGER NOT NULL,
                        channel_names_json TEXT NOT NULL,
                        duration_seconds REAL NOT NULL,
                        task TEXT NOT NULL,
                        normalized_task_label TEXT NOT NULL,
                        event_count INTEGER NOT NULL DEFAULT 0,
                        source_kind TEXT NOT NULL DEFAULT 'RECORDED',
                        ingestion_version TEXT NOT NULL,
                        loader_version TEXT NOT NULL,
                        cache_status TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS dataset_events (
                        event_id TEXT PRIMARY KEY,
                        recording_id TEXT NOT NULL,
                        source_event_code TEXT NOT NULL,
                        source_label TEXT NOT NULL,
                        neuromove_event_type TEXT NOT NULL,
                        onset_samples INTEGER NOT NULL,
                        onset_seconds REAL NOT NULL,
                        duration_seconds REAL NOT NULL,
                        description TEXT NOT NULL,
                        mapping_status TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS dataset_files (
                        relative_path TEXT PRIMARY KEY,
                        dataset_id TEXT NOT NULL,
                        size_bytes INTEGER NOT NULL,
                        sha256 TEXT NOT NULL,
                        verification_status TEXT NOT NULL,
                        retrieved_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('002_public_datasets');"
                )
                conn.commit()

            # Migration 003: EEG Preprocessing & DSP Pipeline
            cursor.execute("SELECT 1 FROM schema_migrations WHERE version = '003_preprocessing';")
            if not cursor.fetchone():
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS preprocessing_configs (
                        config_hash TEXT PRIMARY KEY,
                        pipeline_version TEXT NOT NULL,
                        config_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS preprocessing_results (
                        result_id TEXT PRIMARY KEY,
                        pipeline_version TEXT NOT NULL,
                        config_hash TEXT NOT NULL,
                        source_kind TEXT NOT NULL,
                        dataset_id TEXT,
                        recording_id TEXT,
                        scenario_id TEXT,
                        parent_result_id TEXT,
                        input_sample_rate_hz REAL NOT NULL,
                        output_sample_rate_hz REAL NOT NULL,
                        input_channels_json TEXT NOT NULL,
                        output_channels_json TEXT NOT NULL,
                        duration_seconds REAL NOT NULL,
                        event_count INTEGER NOT NULL DEFAULT 0,
                        artifact_file_path TEXT NOT NULL,
                        artifact_checksum_sha256 TEXT NOT NULL,
                        integrity_status TEXT NOT NULL,
                        integrity_json TEXT NOT NULL,
                        stage_audit_json TEXT NOT NULL,
                        warnings_json TEXT NOT NULL,
                        software_versions_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS preprocessing_lineage (
                        child_result_id TEXT NOT NULL,
                        parent_result_id TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        PRIMARY KEY (child_result_id, parent_result_id)
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('003_preprocessing');"
                )
                conn.commit()

            # Migration 004: Motor-Imagery Epoching, Event Segmentation & Feature Foundation
            cursor.execute(
                "SELECT 1 FROM schema_migrations WHERE version = '004_epoching_and_features';"
            )
            if not cursor.fetchone():
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS event_mappings (
                        mapping_id TEXT PRIMARY KEY,
                        mapping_version TEXT NOT NULL,
                        dataset_id TEXT,
                        rules_json TEXT NOT NULL,
                        default_label TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS epoching_configs (
                        config_hash TEXT PRIMARY KEY,
                        epoching_version TEXT NOT NULL,
                        config_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS epoch_sets (
                        epoch_set_id TEXT PRIMARY KEY,
                        epoching_version TEXT NOT NULL,
                        config_hash TEXT NOT NULL,
                        source_kind TEXT NOT NULL,
                        dataset_id TEXT,
                        recording_id TEXT,
                        scenario_id TEXT,
                        preprocessing_result_id TEXT,
                        subject_id TEXT,
                        session_id TEXT,
                        run_id TEXT,
                        sampling_rate_hz REAL NOT NULL,
                        channels_json TEXT NOT NULL,
                        tmin REAL NOT NULL,
                        tmax REAL NOT NULL,
                        total_events INTEGER NOT NULL,
                        mapped_events INTEGER NOT NULL,
                        valid_epochs INTEGER NOT NULL,
                        rejected_epochs INTEGER NOT NULL,
                        rejection_counts_json TEXT NOT NULL,
                        label_distribution_json TEXT NOT NULL,
                        artifact_file_path TEXT NOT NULL,
                        artifact_checksum_sha256 TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS epoch_records (
                        epoch_id TEXT PRIMARY KEY,
                        epoch_set_id TEXT NOT NULL,
                        trial_id TEXT NOT NULL,
                        event_id TEXT NOT NULL,
                        subject_id TEXT NOT NULL,
                        session_id TEXT,
                        run_id TEXT,
                        label TEXT NOT NULL,
                        onset_seconds REAL NOT NULL,
                        qc_status TEXT NOT NULL,
                        rejection_reason TEXT,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS feature_configs (
                        config_hash TEXT PRIMARY KEY,
                        feature_version TEXT NOT NULL,
                        config_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS feature_sets (
                        feature_set_id TEXT PRIMARY KEY,
                        feature_version TEXT NOT NULL,
                        config_hash TEXT NOT NULL,
                        source_epoch_set_id TEXT NOT NULL,
                        subject_ids_json TEXT NOT NULL,
                        session_ids_json TEXT NOT NULL,
                        run_ids_json TEXT NOT NULL,
                        trial_ids_json TEXT NOT NULL,
                        labels_json TEXT NOT NULL,
                        feature_names_json TEXT NOT NULL,
                        row_count INTEGER NOT NULL,
                        feature_count INTEGER NOT NULL,
                        label_distribution_json TEXT NOT NULL,
                        artifact_file_path TEXT NOT NULL,
                        artifact_checksum_sha256 TEXT NOT NULL,
                        software_versions_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS feature_lineage (
                        feature_set_id TEXT NOT NULL,
                        epoch_set_id TEXT NOT NULL,
                        preprocessing_result_id TEXT,
                        recording_id TEXT,
                        dataset_id TEXT,
                        created_at TEXT NOT NULL,
                        PRIMARY KEY (feature_set_id, epoch_set_id)
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('004_epoching_and_features');"
                )
                conn.commit()

            # Migration 005: CSP Spatial Filtering & Classical Motor-Imagery Decoding
            cursor.execute(
                "SELECT 1 FROM schema_migrations WHERE version = '005_classical_decoding';"
            )
            if not cursor.fetchone():
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS classification_tasks (
                        task_id TEXT PRIMARY KEY,
                        task_name TEXT NOT NULL,
                        description TEXT NOT NULL,
                        class_labels_json TEXT NOT NULL,
                        label_mapping_json TEXT NOT NULL,
                        version TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS decoder_configs (
                        config_hash TEXT PRIMARY KEY,
                        pipeline_version TEXT NOT NULL,
                        config_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS decoder_runs (
                        run_id TEXT PRIMARY KEY,
                        model_id TEXT,
                        task_id TEXT NOT NULL,
                        epoch_set_id TEXT NOT NULL,
                        config_hash TEXT NOT NULL,
                        status TEXT NOT NULL,
                        started_at TEXT NOT NULL,
                        finished_at TEXT,
                        metrics_json TEXT,
                        error_message TEXT
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS models (
                        model_id TEXT PRIMARY KEY,
                        run_id TEXT NOT NULL,
                        pipeline_version TEXT NOT NULL,
                        task_id TEXT NOT NULL,
                        dataset_id TEXT,
                        source_epoch_set_id TEXT NOT NULL,
                        subjects_json TEXT NOT NULL,
                        channels_json TEXT NOT NULL,
                        sampling_rate_hz REAL NOT NULL,
                        classifier_type TEXT NOT NULL,
                        n_components INTEGER NOT NULL,
                        evaluation_protocol TEXT NOT NULL,
                        evaluation_mode TEXT NOT NULL,
                        config_hash TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'ACTIVE_RESEARCH',
                        artifact_file_path TEXT NOT NULL,
                        artifact_checksum_sha256 TEXT NOT NULL,
                        software_versions_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS model_metrics (
                        model_id TEXT PRIMARY KEY,
                        accuracy_mean REAL NOT NULL,
                        accuracy_std REAL NOT NULL,
                        balanced_accuracy_mean REAL NOT NULL,
                        balanced_accuracy_std REAL NOT NULL,
                        precision_mean REAL NOT NULL,
                        precision_std REAL NOT NULL,
                        recall_mean REAL NOT NULL,
                        recall_std REAL NOT NULL,
                        f1_mean REAL NOT NULL,
                        f1_std REAL NOT NULL,
                        chance_level REAL NOT NULL DEFAULT 0.5,
                        metrics_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS model_lineage (
                        model_id TEXT NOT NULL,
                        epoch_set_id TEXT NOT NULL,
                        preprocessing_result_id TEXT,
                        recording_id TEXT,
                        dataset_id TEXT,
                        created_at TEXT NOT NULL,
                        PRIMARY KEY (model_id, epoch_set_id)
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS cv_folds (
                        fold_id INTEGER NOT NULL,
                        model_id TEXT NOT NULL,
                        train_subjects_json TEXT NOT NULL,
                        test_subjects_json TEXT NOT NULL,
                        train_epochs INTEGER NOT NULL,
                        test_epochs INTEGER NOT NULL,
                        accuracy REAL NOT NULL,
                        balanced_accuracy REAL NOT NULL,
                        f1 REAL NOT NULL,
                        confusion_matrix_json TEXT NOT NULL,
                        PRIMARY KEY (model_id, fold_id)
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('005_classical_decoding');"
                )
                conn.commit()

            # Migration 006: AI Model Laboratory & Rigorous Model Evaluation
            cursor.execute(
                "SELECT 1 FROM schema_migrations WHERE version = '006_ai_model_laboratory';"
            )
            if not cursor.fetchone():
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS experiments (
                        experiment_id TEXT PRIMARY KEY,
                        config_hash TEXT NOT NULL,
                        dataset_id TEXT NOT NULL,
                        epoch_set_id TEXT NOT NULL,
                        task_id TEXT NOT NULL,
                        model_family TEXT NOT NULL,
                        representation TEXT NOT NULL,
                        evaluation_protocol TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'COMPLETED',
                        has_search INTEGER NOT NULL DEFAULT 0,
                        model_id TEXT,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS experiment_configs (
                        config_hash TEXT PRIMARY KEY,
                        experiment_version TEXT NOT NULL,
                        config_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS experiment_runs (
                        run_id TEXT PRIMARY KEY,
                        experiment_id TEXT NOT NULL,
                        stage TEXT NOT NULL,
                        progress REAL NOT NULL,
                        status TEXT NOT NULL,
                        error_message TEXT,
                        started_at TEXT NOT NULL,
                        completed_at TEXT
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS experiment_folds (
                        experiment_id TEXT NOT NULL,
                        fold_id INTEGER NOT NULL,
                        train_subjects_json TEXT NOT NULL,
                        test_subjects_json TEXT NOT NULL,
                        train_epoch_count INTEGER NOT NULL,
                        test_epoch_count INTEGER NOT NULL,
                        train_class_counts_json TEXT NOT NULL,
                        test_class_counts_json TEXT NOT NULL,
                        fold_hash TEXT NOT NULL,
                        search_results_json TEXT,
                        PRIMARY KEY (experiment_id, fold_id)
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS experiment_metrics (
                        experiment_id TEXT PRIMARY KEY,
                        accuracy_mean REAL NOT NULL,
                        accuracy_std REAL NOT NULL,
                        balanced_accuracy_mean REAL NOT NULL,
                        balanced_accuracy_std REAL NOT NULL,
                        precision_mean REAL NOT NULL,
                        precision_std REAL NOT NULL,
                        recall_mean REAL NOT NULL,
                        recall_std REAL NOT NULL,
                        f1_mean REAL NOT NULL,
                        f1_std REAL NOT NULL,
                        chance_level REAL NOT NULL DEFAULT 0.5,
                        metrics_json TEXT NOT NULL,
                        per_session_metrics_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS experiment_predictions (
                        prediction_id TEXT PRIMARY KEY,
                        experiment_id TEXT NOT NULL,
                        fold_id INTEGER NOT NULL,
                        epoch_id TEXT NOT NULL,
                        subject_id TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        run_id TEXT NOT NULL,
                        true_label TEXT NOT NULL,
                        predicted_label TEXT NOT NULL,
                        is_correct INTEGER NOT NULL,
                        decision_score REAL,
                        probabilities_json TEXT,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS experiment_search_candidates (
                        candidate_id TEXT PRIMARY KEY,
                        experiment_id TEXT NOT NULL,
                        fold_id INTEGER NOT NULL,
                        parameters_json TEXT NOT NULL,
                        mean_inner_score REAL NOT NULL,
                        std_inner_score REAL NOT NULL,
                        rank INTEGER NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS experiment_ablations (
                        ablation_id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        ablation_variable TEXT NOT NULL,
                        baseline_experiment_id TEXT NOT NULL,
                        results_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS model_cards (
                        model_id TEXT PRIMARY KEY,
                        experiment_id TEXT NOT NULL,
                        card_json TEXT NOT NULL,
                        markdown_content TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS model_comparisons (
                        comparison_id TEXT PRIMARY KEY,
                        comparison_name TEXT NOT NULL,
                        results_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('006_ai_model_laboratory');"
                )
                conn.commit()

            self._is_initialized = True

            logger.info("SQLite database initialized successfully at %s", db_path)
        except Exception as exc:
            logger.error("Failed to initialize SQLite database: %s", exc)
            self._is_initialized = False
            raise

    def check_health(self) -> bool:
        """Validate database connectivity and read/write integrity."""
        try:
            db_path = self.get_db_path()
            if not db_path.exists():
                return False
            with sqlite3.connect(db_path, timeout=1.0) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1;")
                row = cursor.fetchone()
                return row is not None and row[0] == 1
        except Exception:
            return False


default_db_manager = DatabaseManager()
