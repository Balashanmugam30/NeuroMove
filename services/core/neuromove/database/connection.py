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
        if not self._is_initialized:
            self.initialize_db()
        target_path = db_path or self.get_db_path()
        conn = sqlite3.connect(target_path)
        conn.row_factory = sqlite3.Row
        return conn

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

            # Migration 007: Personalized Calibration & Subject Adaptation
            cursor.execute(
                "SELECT 1 FROM schema_migrations WHERE version = '007_personalized_calibration';"
            )
            if not cursor.fetchone():
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS subject_profiles (
                        subject_id TEXT PRIMARY KEY,
                        profile_id TEXT NOT NULL UNIQUE,
                        profile_version TEXT NOT NULL,
                        status TEXT NOT NULL,
                        preferred_hand TEXT NOT NULL,
                        display_name TEXT,
                        notes TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS calibration_profiles (
                        profile_id TEXT PRIMARY KEY,
                        subject_id TEXT NOT NULL,
                        profile_version TEXT NOT NULL,
                        state TEXT NOT NULL,
                        preferred_task TEXT NOT NULL,
                        target_classes_json TEXT NOT NULL,
                        channel_set_json TEXT NOT NULL,
                        preprocessing_config_json TEXT NOT NULL,
                        epoching_config_json TEXT NOT NULL,
                        feature_config_json TEXT NOT NULL,
                        decoder_config_json TEXT NOT NULL,
                        last_calibration_id TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS calibration_protocols (
                        protocol_id TEXT PRIMARY KEY,
                        protocol_version TEXT NOT NULL,
                        name TEXT NOT NULL,
                        target_classes_json TEXT NOT NULL,
                        trials_per_class INTEGER NOT NULL,
                        rest_duration_sec REAL NOT NULL,
                        fixation_duration_sec REAL NOT NULL,
                        cue_duration_sec REAL NOT NULL,
                        imagery_duration_sec REAL NOT NULL,
                        iti_min_sec REAL NOT NULL,
                        iti_max_sec REAL NOT NULL,
                        break_policy TEXT NOT NULL,
                        random_state INTEGER NOT NULL,
                        min_valid_trials_per_class INTEGER NOT NULL,
                        max_rejection_ratio REAL NOT NULL,
                        qc_rules_json TEXT NOT NULL,
                        timing_hash TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS calibration_sessions (
                        calibration_id TEXT PRIMARY KEY,
                        profile_id TEXT NOT NULL,
                        subject_id TEXT NOT NULL,
                        session_number INTEGER NOT NULL,
                        protocol_version TEXT NOT NULL,
                        task_id TEXT NOT NULL,
                        source_mode TEXT NOT NULL,
                        status TEXT NOT NULL,
                        started_at TEXT,
                        completed_at TEXT,
                        trial_count INTEGER NOT NULL DEFAULT 0,
                        valid_trial_count INTEGER NOT NULL DEFAULT 0,
                        rejected_trial_count INTEGER NOT NULL DEFAULT 0,
                        class_distribution_json TEXT NOT NULL,
                        quality_summary_json TEXT,
                        pause_intervals_json TEXT NOT NULL,
                        active_trial_index INTEGER NOT NULL DEFAULT 0,
                        config_hash TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS calibration_trials (
                        trial_id TEXT PRIMARY KEY,
                        calibration_id TEXT NOT NULL,
                        sequence_index INTEGER NOT NULL,
                        target_label TEXT NOT NULL,
                        cue TEXT NOT NULL,
                        planned_onset REAL NOT NULL,
                        actual_onset REAL,
                        imagery_start REAL,
                        imagery_end REAL,
                        status TEXT NOT NULL,
                        quality_status TEXT NOT NULL,
                        quality_reasons_json TEXT NOT NULL,
                        epoch_id TEXT,
                        notes TEXT,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS personalized_experiments (
                        experiment_id TEXT PRIMARY KEY,
                        calibration_id TEXT NOT NULL,
                        profile_id TEXT NOT NULL,
                        subject_id TEXT NOT NULL,
                        model_id TEXT NOT NULL,
                        generic_base_model_id TEXT,
                        train_trial_count INTEGER NOT NULL,
                        heldout_trial_count INTEGER NOT NULL,
                        train_trial_ids_json TEXT NOT NULL,
                        heldout_trial_ids_json TEXT NOT NULL,
                        train_metrics_json TEXT NOT NULL,
                        heldout_metrics_json TEXT NOT NULL,
                        generic_comparison_json TEXT,
                        config_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS personalized_models (
                        model_id TEXT PRIMARY KEY,
                        calibration_id TEXT NOT NULL,
                        profile_id TEXT NOT NULL,
                        subject_id TEXT NOT NULL,
                        experiment_id TEXT NOT NULL,
                        generic_base_model_id TEXT,
                        model_family TEXT NOT NULL,
                        representation TEXT NOT NULL,
                        status TEXT NOT NULL,
                        is_stale INTEGER NOT NULL DEFAULT 0,
                        staleness_reasons_json TEXT NOT NULL,
                        heldout_balanced_accuracy REAL NOT NULL,
                        heldout_f1 REAL NOT NULL,
                        artifact_file_path TEXT NOT NULL,
                        artifact_checksum_sha256 TEXT NOT NULL,
                        model_card_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS calibration_reports (
                        report_id TEXT PRIMARY KEY,
                        calibration_id TEXT NOT NULL,
                        subject_id TEXT NOT NULL,
                        profile_id TEXT NOT NULL,
                        report_json TEXT NOT NULL,
                        markdown_content TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('007_personalized_calibration');"
                )
                conn.commit()

            # Migration 008: Adaptive Learning & Controlled Model Update Pipeline
            cursor.execute(
                "SELECT 1 FROM schema_migrations WHERE version = '008_adaptive_learning';"
            )
            if not cursor.fetchone():
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS adaptation_policies (
                        policy_id TEXT PRIMARY KEY,
                        policy_version TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        mode TEXT NOT NULL,
                        scope TEXT NOT NULL,
                        min_new_trials INTEGER NOT NULL,
                        min_trials_per_class INTEGER NOT NULL,
                        max_rejection_ratio REAL NOT NULL,
                        retention_strategy TEXT NOT NULL,
                        imbalance_policy TEXT NOT NULL,
                        max_allowed_regression REAL NOT NULL,
                        min_promoted_balanced_accuracy REAL NOT NULL,
                        min_validation_samples INTEGER NOT NULL,
                        validation_strategy TEXT NOT NULL,
                        random_state INTEGER NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS adaptation_batches (
                        batch_id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        subject_id TEXT,
                        source_mode TEXT NOT NULL,
                        dataset_id TEXT,
                        recording_id TEXT,
                        epoch_set_id TEXT,
                        feature_set_id TEXT,
                        trial_count INTEGER NOT NULL,
                        class_distribution_json TEXT NOT NULL,
                        quality_summary_json TEXT NOT NULL,
                        source_fingerprint TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS model_versions (
                        version_id TEXT PRIMARY KEY,
                        model_id TEXT NOT NULL,
                        parent_model_id TEXT,
                        version_number INTEGER NOT NULL,
                        scope TEXT NOT NULL,
                        subject_id TEXT,
                        status TEXT NOT NULL,
                        is_active INTEGER NOT NULL DEFAULT 0,
                        adaptation_id TEXT,
                        model_family TEXT NOT NULL,
                        representation TEXT NOT NULL,
                        task_id TEXT NOT NULL,
                        metrics_json TEXT NOT NULL,
                        artifact_checksum_sha256 TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS adaptation_runs (
                        adaptation_id TEXT PRIMARY KEY,
                        base_model_id TEXT NOT NULL,
                        candidate_model_id TEXT,
                        policy_id TEXT NOT NULL,
                        scope TEXT NOT NULL,
                        subject_id TEXT,
                        data_batch_ids_json TEXT NOT NULL,
                        status TEXT NOT NULL,
                        training_composition_json TEXT NOT NULL,
                        validation_composition_json TEXT NOT NULL,
                        leakage_check_json TEXT NOT NULL,
                        incumbent_metrics_json TEXT NOT NULL,
                        candidate_metrics_json TEXT,
                        comparison_json TEXT,
                        promotion_eligibility_json TEXT,
                        promotion_decision_json TEXT,
                        manifest_json TEXT,
                        started_at TEXT NOT NULL,
                        completed_at TEXT
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS promotion_decisions (
                        decision_id TEXT PRIMARY KEY,
                        adaptation_id TEXT NOT NULL,
                        base_model_id TEXT NOT NULL,
                        candidate_model_id TEXT NOT NULL,
                        decision TEXT NOT NULL,
                        decision_rule_version TEXT NOT NULL,
                        operator_action TEXT NOT NULL,
                        reasons_json TEXT NOT NULL,
                        metrics_summary_json TEXT NOT NULL,
                        timestamp TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS rollback_events (
                        rollback_id TEXT PRIMARY KEY,
                        from_model_id TEXT NOT NULL,
                        to_model_id TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        operator_action TEXT NOT NULL,
                        timestamp TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS drift_observations (
                        observation_id TEXT PRIMARY KEY,
                        subject_id TEXT,
                        dataset_id TEXT,
                        window_label TEXT NOT NULL,
                        feature_shift_score REAL NOT NULL,
                        class_distribution_shift REAL NOT NULL,
                        signal_quality_score REAL NOT NULL,
                        prediction_entropy REAL,
                        status TEXT NOT NULL,
                        thresholds_json TEXT NOT NULL,
                        details_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('008_adaptive_learning');"
                )
                conn.commit()

            # Migration 009: Confidence Estimation & Temporal Confirmation Engine
            cursor.execute(
                "SELECT 1 FROM schema_migrations WHERE version = '009_confidence_temporal';"
            )
            if not cursor.fetchone():
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS confidence_configurations (
                        config_id TEXT PRIMARY KEY,
                        version TEXT NOT NULL,
                        scope TEXT NOT NULL,
                        subject_id TEXT,
                        model_version_id TEXT,
                        high_threshold REAL NOT NULL,
                        medium_threshold REAL NOT NULL,
                        min_eligible_confidence REAL NOT NULL,
                        min_consecutive_windows INTEGER NOT NULL,
                        min_duration_ms REAL NOT NULL,
                        max_gap_ms REAL NOT NULL,
                        cooldown_ms REAL NOT NULL,
                        refractory_ms REAL NOT NULL,
                        hysteresis_enter REAL NOT NULL,
                        hysteresis_exit REAL NOT NULL,
                        max_age_ms REAL NOT NULL,
                        quality_floor REAL NOT NULL,
                        allow_same_class_reconfirmation INTEGER NOT NULL DEFAULT 0,
                        parameters_json TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        checksum TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS confidence_calibration_profiles (
                        calibration_id TEXT PRIMARY KEY,
                        model_version_id TEXT NOT NULL,
                        scope TEXT NOT NULL,
                        subject_id TEXT,
                        method TEXT NOT NULL,
                        fit_dataset_reference TEXT NOT NULL,
                        parameters_json TEXT NOT NULL,
                        calibration_metrics_json TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'ACTIVE',
                        checksum TEXT NOT NULL,
                        fit_timestamp TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS confidence_evaluations (
                        evaluation_id TEXT PRIMARY KEY,
                        prediction_id TEXT NOT NULL,
                        model_version_id TEXT NOT NULL,
                        subject_id TEXT,
                        session_id TEXT,
                        predicted_class TEXT NOT NULL,
                        raw_score REAL NOT NULL,
                        score_type TEXT NOT NULL,
                        normalized_score REAL NOT NULL,
                        calibrated_confidence REAL NOT NULL,
                        confidence_band TEXT NOT NULL,
                        eligibility TEXT NOT NULL,
                        class_margin REAL NOT NULL,
                        runner_up_class TEXT,
                        signal_quality REAL NOT NULL,
                        freshness TEXT NOT NULL,
                        model_validity TEXT NOT NULL,
                        components_json TEXT NOT NULL,
                        decision_reason TEXT NOT NULL,
                        timestamp REAL NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS temporal_confirmation_events (
                        event_id TEXT PRIMARY KEY,
                        sequence_number INTEGER NOT NULL,
                        event_type TEXT NOT NULL,
                        candidate_class TEXT,
                        consecutive_windows INTEGER NOT NULL,
                        accumulated_duration_ms REAL NOT NULL,
                        confidence_score REAL NOT NULL,
                        decision_reason TEXT NOT NULL,
                        model_version_id TEXT NOT NULL,
                        subject_id TEXT,
                        session_id TEXT,
                        timestamp TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS confidence_history (
                        history_id TEXT PRIMARY KEY,
                        subject_id TEXT,
                        session_id TEXT,
                        model_version_id TEXT NOT NULL,
                        predicted_class TEXT NOT NULL,
                        confidence REAL NOT NULL,
                        band TEXT NOT NULL,
                        eligibility TEXT NOT NULL,
                        temporal_status TEXT NOT NULL,
                        decision_reason TEXT NOT NULL,
                        timestamp TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('009_confidence_temporal');"
                )
                conn.commit()

            # Migration 010: Canonical Intent State Machine & Lifecycle (Phase 16)
            cursor.execute(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = '010_intent_state_machine';"
            )
            mig_010 = cursor.fetchone()[0] == 0
            if mig_010:
                logger.info("Applying migration 010_intent_state_machine...")
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS intent_policies (
                        policy_id TEXT PRIMARY KEY,
                        version TEXT NOT NULL,
                        candidate_timeout_ms REAL NOT NULL,
                        confirmation_acceptance_window_ms REAL NOT NULL,
                        active_intent_timeout_ms REAL NOT NULL,
                        allow_replacement INTEGER NOT NULL DEFAULT 1,
                        replacement_requires_confirmation INTEGER NOT NULL DEFAULT 1,
                        same_class_reconfirmation_cooldown_ms REAL NOT NULL,
                        cross_class_replacement_policy TEXT NOT NULL,
                        subject_change_policy TEXT NOT NULL,
                        session_change_policy TEXT NOT NULL,
                        model_change_policy TEXT NOT NULL,
                        rest_handling_policy TEXT NOT NULL,
                        parameters_json TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        checksum TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS intent_records (
                        intent_id TEXT PRIMARY KEY,
                        intent_class TEXT NOT NULL,
                        current_state TEXT NOT NULL,
                        subject_id TEXT,
                        session_id TEXT,
                        model_version_id TEXT NOT NULL,
                        confidence_score REAL NOT NULL,
                        confidence_band TEXT NOT NULL,
                        eligibility TEXT NOT NULL,
                        source_event_id TEXT,
                        confidence_evaluation_id TEXT,
                        temporal_confirmation_id TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        state_deadline REAL,
                        is_terminal INTEGER NOT NULL DEFAULT 0,
                        terminal_reason TEXT,
                        policy_version TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS intent_state_transitions (
                        transition_id TEXT PRIMARY KEY,
                        sequence_number INTEGER NOT NULL,
                        intent_id TEXT,
                        intent_class TEXT,
                        previous_state TEXT NOT NULL,
                        next_state TEXT NOT NULL,
                        trigger_name TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        subject_id TEXT,
                        session_id TEXT,
                        model_version_id TEXT,
                        source_event_id TEXT,
                        confidence_score REAL,
                        policy_version TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        details TEXT
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS intent_snapshots (
                        snapshot_id TEXT PRIMARY KEY,
                        active_intent_id TEXT,
                        current_state TEXT NOT NULL,
                        intent_class TEXT,
                        subject_id TEXT,
                        session_id TEXT,
                        model_version_id TEXT,
                        confidence_score REAL,
                        confidence_evaluation_id TEXT,
                        temporal_confirmation_id TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        state_deadline REAL,
                        transition_reason TEXT NOT NULL,
                        policy_version TEXT NOT NULL,
                        transition_count INTEGER NOT NULL DEFAULT 0
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('010_intent_state_machine');"
                )
                conn.commit()

            # Migration 011: Safety Arbitration, Constraint Evaluation & Execution Authorization Gate (Phase 17)
            cursor.execute(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = '011_safety_arbitration';"
            )
            mig_011 = cursor.fetchone()[0] == 0
            if mig_011:
                logger.info("Applying migration 011_safety_arbitration...")
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS safety_policies (
                        policy_id TEXT PRIMARY KEY,
                        version TEXT NOT NULL,
                        allowlisted_intents_json TEXT NOT NULL,
                        blocked_intents_json TEXT NOT NULL,
                        max_intent_age_ms REAL NOT NULL,
                        max_evaluation_age_ms REAL NOT NULL,
                        max_context_age_ms REAL NOT NULL,
                        max_authorized_duration_ms REAL NOT NULL,
                        maximum_command_rate INTEGER NOT NULL,
                        rate_window_ms REAL NOT NULL,
                        minimum_command_gap_ms REAL NOT NULL,
                        critical_health_requirements_json TEXT NOT NULL,
                        operator_hold_enabled INTEGER NOT NULL DEFAULT 1,
                        emergency_stop_enabled INTEGER NOT NULL DEFAULT 1,
                        lockout_threshold INTEGER NOT NULL DEFAULT 3,
                        lockout_policy TEXT NOT NULL DEFAULT 'REQUIRE_MANUAL_RESET',
                        reset_requirements_json TEXT NOT NULL,
                        parameters_json TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        checksum TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS safety_context_snapshots (
                        snapshot_id TEXT PRIMARY KEY,
                        system_health_json TEXT NOT NULL,
                        stream_health_json TEXT NOT NULL,
                        sensor_health_json TEXT NOT NULL,
                        intent_freshness_json TEXT NOT NULL,
                        model_health_json TEXT NOT NULL,
                        session_validity_json TEXT NOT NULL,
                        operator_state_json TEXT NOT NULL,
                        environment_state_json TEXT NOT NULL,
                        execution_rate_json TEXT NOT NULL,
                        current_action_state_json TEXT NOT NULL,
                        emergency_stop_state_json TEXT NOT NULL,
                        lockout_state_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS safety_evaluations (
                        evaluation_id TEXT PRIMARY KEY,
                        decision TEXT NOT NULL,
                        safety_state TEXT NOT NULL,
                        primary_reason TEXT NOT NULL,
                        precedence_rank INTEGER NOT NULL,
                        all_reasons_json TEXT NOT NULL,
                        violated_rules_json TEXT NOT NULL,
                        passed_rules_json TEXT NOT NULL,
                        policy_version TEXT NOT NULL,
                        intent_id TEXT,
                        intent_class TEXT,
                        subject_id TEXT,
                        session_id TEXT,
                        model_version_id TEXT,
                        confidence_score REAL,
                        confidence_evaluation_id TEXT,
                        temporal_confirmation_id TEXT,
                        evaluated_at TEXT NOT NULL,
                        duration_ms REAL NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS safety_rule_results (
                        result_id TEXT PRIMARY KEY,
                        evaluation_id TEXT NOT NULL,
                        rule_id TEXT NOT NULL,
                        category TEXT NOT NULL,
                        status TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        reason_code TEXT NOT NULL,
                        message TEXT NOT NULL,
                        evidence_json TEXT NOT NULL,
                        evaluated_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS safety_state_transitions (
                        transition_id TEXT PRIMARY KEY,
                        sequence_number INTEGER NOT NULL,
                        previous_state TEXT NOT NULL,
                        next_state TEXT NOT NULL,
                        trigger_name TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        evaluation_id TEXT,
                        intent_id TEXT,
                        policy_version TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        details TEXT
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS safety_snapshots (
                        snapshot_id TEXT PRIMARY KEY,
                        current_state TEXT NOT NULL,
                        last_decision TEXT NOT NULL,
                        active_intent_id TEXT,
                        intent_class TEXT,
                        primary_reason TEXT NOT NULL,
                        active_policy_version TEXT NOT NULL,
                        emergency_stop INTEGER NOT NULL DEFAULT 0,
                        emergency_stop_reason TEXT,
                        operator_hold INTEGER NOT NULL DEFAULT 0,
                        operator_id TEXT,
                        lockout INTEGER NOT NULL DEFAULT 0,
                        lockout_reason TEXT,
                        system_healthy INTEGER NOT NULL DEFAULT 1,
                        stream_healthy INTEGER NOT NULL DEFAULT 1,
                        last_evaluation_id TEXT,
                        state_deadline REAL,
                        transition_count INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('011_safety_arbitration');"
                )
                conn.commit()

            # Migration 012: Failure Injection, Fault-Tolerance & Resilience Laboratory (Phase 18)
            cursor.execute(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = '012_resilience_fault_lab';"
            )
            mig_012 = cursor.fetchone()[0] == 0
            if mig_012:
                logger.info("Applying migration 012_resilience_fault_lab...")
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS resilience_experiments (
                        experiment_id TEXT PRIMARY KEY,
                        scenario_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        seed INTEGER NOT NULL,
                        status TEXT NOT NULL,
                        manifest_json TEXT NOT NULL,
                        baseline_snapshot_json TEXT NOT NULL,
                        final_snapshot_json TEXT NOT NULL,
                        invariants_json TEXT NOT NULL,
                        recovery_status TEXT NOT NULL,
                        data_loss_status TEXT NOT NULL,
                        authorization_before_failure INTEGER NOT NULL,
                        authorization_during_failure INTEGER NOT NULL,
                        authorization_after_failure INTEGER NOT NULL,
                        steps_audit_json TEXT NOT NULL,
                        replay_hash TEXT NOT NULL,
                        artifact_checksum TEXT NOT NULL,
                        started_at TEXT NOT NULL,
                        ended_at TEXT,
                        duration_ms REAL NOT NULL DEFAULT 0.0
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS resilience_faults (
                        fault_id TEXT PRIMARY KEY,
                        experiment_id TEXT,
                        fault_type TEXT NOT NULL,
                        category TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        scope TEXT NOT NULL,
                        status TEXT NOT NULL,
                        target_service TEXT,
                        target_stream TEXT,
                        target_session TEXT,
                        trigger_type TEXT NOT NULL,
                        trigger_value TEXT,
                        parameters_json TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        armed_at TEXT,
                        activated_at TEXT,
                        cleared_at TEXT,
                        description TEXT
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS resilience_fault_events (
                        event_id TEXT PRIMARY KEY,
                        experiment_id TEXT,
                        fault_id TEXT,
                        event_type TEXT NOT NULL,
                        sequence_number INTEGER NOT NULL,
                        timestamp TEXT NOT NULL,
                        details_json TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS resilience_invariant_results (
                        result_id TEXT PRIMARY KEY,
                        experiment_id TEXT NOT NULL,
                        invariant_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        status TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        observed_value TEXT NOT NULL,
                        expected_value TEXT NOT NULL,
                        evidence_json TEXT NOT NULL,
                        evaluated_at TEXT NOT NULL
                    );
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS resilience_recovery_checkpoints (
                        checkpoint_id TEXT PRIMARY KEY,
                        experiment_id TEXT NOT NULL,
                        component TEXT NOT NULL,
                        last_known_safe_state TEXT NOT NULL,
                        sequence_number INTEGER NOT NULL,
                        snapshot_version TEXT NOT NULL,
                        checksum TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        details_json TEXT
                    );
                    """
                )
                cursor.execute(
                    "INSERT OR IGNORE INTO schema_migrations (version) VALUES ('012_resilience_fault_lab');"
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
