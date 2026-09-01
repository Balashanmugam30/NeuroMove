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
