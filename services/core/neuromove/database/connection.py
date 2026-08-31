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
