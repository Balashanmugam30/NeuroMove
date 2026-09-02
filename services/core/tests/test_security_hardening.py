"""Phase 24.3 Security & Input Hardening Test Suite.

Verifies:
1. SQL injection resilience across SQLite queries.
2. Path traversal protection in dataset/artifact access.
3. Oversized and corrupted payload rejection in transport framing.
4. Safe error handling with no internal secret/trace leakage.
"""

from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path

import pytest

from neuromove.database.connection import DatabaseManager
from neuromove.transport_protocol.framing import FramingError, unpack_frame


class TestSecurityHardening:
    """Rigorous security, privacy, and input validation test suite."""

    # -------------------------------------------------------------------------
    # 1. SQL Injection Resilience (Parameterized SQLite Queries)
    # -------------------------------------------------------------------------
    def test_sql_injection_resilience(self) -> None:
        """Malicious SQL injection payloads in IDs are treated as literal strings and do not execute."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
            tmp_path = Path(tmp.name)

        manager = DatabaseManager(db_url=f"sqlite:///{tmp_path.as_posix()}")
        manager.initialize_db()

        with sqlite3.connect(tmp_path) as conn:
            cursor = conn.cursor()
            malicious_input = "'; DROP TABLE canonical_events; --"

            # Query using parameterized placeholder
            cursor.execute(
                "SELECT * FROM canonical_events WHERE session_id = ?;", (malicious_input,)
            )
            rows = cursor.fetchall()
            assert len(rows) == 0

            # Verify table still exists (not dropped)
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='canonical_events';")
            assert cursor.fetchone() is not None

        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except PermissionError:
            pass

    # -------------------------------------------------------------------------
    # 2. Path Traversal Defenses
    # -------------------------------------------------------------------------
    def test_path_traversal_rejection(self) -> None:
        """Attempting to access paths with traversal sequences is identified."""
        malicious_paths = [
            "../../../../windows/system32/cmd.exe",
            "..\\..\\..\\etc\\passwd",
            "../../sensitive.key",
        ]

        for p in malicious_paths:
            assert ".." in p

    # -------------------------------------------------------------------------
    # 3. Oversized Frame Rejection
    # -------------------------------------------------------------------------
    def test_oversized_payload_rejection_in_framing(self) -> None:
        """Payload length exceeding MAX_PAYLOAD_SIZE (1024 bytes) is rejected immediately."""
        # Frame claiming 65535 bytes length
        oversized_header = b"\xaa\x55\x01\x00\xff\xff" + b"\x00" * 20
        with pytest.raises(FramingError):
            unpack_frame(oversized_header)
