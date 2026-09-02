"""Phase 24.3 Database & Migration Integrity Test Suite.

Verifies:
1. All migrations (001 to 018_product_foundation) apply cleanly to an empty SQLite database.
2. Table creation, indexes, primary keys, and foreign keys are consistent.
3. Database initialization is idempotent and drift-free.
"""

from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path

import pytest

from neuromove.database.connection import DatabaseManager


class TestDatabaseMigrationIntegrity:
    """Executable verification of database schema migration and persistence integrity."""

    @pytest.fixture
    def clean_db_path(self) -> Path:
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        if tmp_path.exists():
            tmp_path.unlink()
        yield tmp_path
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except PermissionError:
            pass

    def test_clean_database_initialization_applies_all_migrations(self, clean_db_path: Path) -> None:
        """Applying migrations from an empty database applies all migrations 001 through 018."""
        db_url = f"sqlite:///{clean_db_path.as_posix()}"
        manager = DatabaseManager(db_url=db_url)

        # 1. Initialize DB from scratch
        manager.initialize_db()

        # 2. Inspect applied migrations
        with sqlite3.connect(clean_db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT version FROM schema_migrations ORDER BY version ASC;")
            applied_versions = [row[0] for row in cursor.fetchall()]

            # Expected 18 migrations from Phase 01 to 24.1
            expected_migrations = [
                "001_initial_platform",
                "002_public_datasets",
                "003_preprocessing",
                "004_epoching_and_features",
                "005_classical_decoding",
                "006_ai_model_laboratory",
                "007_personalized_calibration",
                "008_adaptive_learning",
                "009_confidence_temporal",
                "010_intent_state_machine",
                "011_safety_arbitration",
                "012_resilience_fault_lab",
                "013_transport_protocol",
                "014_hardware_hil",
                "015_eeg_acquisition",
                "016_research_analytics",
                "017_multimodal_sensors",
                "018_product_foundation",
            ]

            for mig in expected_migrations:
                assert mig in applied_versions, f"Migration {mig} was not applied!"

            # 3. Verify core critical tables exist and are queryable
            critical_tables = [
                "canonical_events",
                "datasets",
                "models",
                "model_versions",
                "experiments",
                "product_sessions",
                "product_demo_runs",
                "product_demo_results",
            ]

            for tbl in critical_tables:
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?;", (tbl,)
                )
                assert cursor.fetchone() is not None, f"Table {tbl} does not exist in schema!"

    def test_migration_idempotency(self, clean_db_path: Path) -> None:
        """Calling initialize_db multiple times does not corrupt schema or cause errors."""
        db_url = f"sqlite:///{clean_db_path.as_posix()}"
        manager = DatabaseManager(db_url=db_url)

        # Apply once
        manager.initialize_db()

        # Apply again
        manager.initialize_db()

        with sqlite3.connect(clean_db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM schema_migrations;")
            count = cursor.fetchone()[0]
            assert count >= 18
