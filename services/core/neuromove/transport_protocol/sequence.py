"""Monotonic Sequence number tracking, gap detection, and ordering verification."""

from __future__ import annotations

import logging
from typing import NamedTuple

logger = logging.getLogger(__name__)

MAX_SEQUENCE_NUMBER: int = 2_147_483_647  # 31-bit signed int max


class SequenceValidationResult(NamedTuple):
    is_valid: bool
    status: str
    expected_sequence: int
    received_sequence: int
    gap_count: int = 0


class SequenceTracker:
    """Tracks monotonic sequence numbers for a specific connection or session."""

    def __init__(self, initial_sequence: int = 0, session_id: str | None = None) -> None:
        self.session_id = session_id
        self._current_tx_sequence: int = initial_sequence
        self._expected_rx_sequence: int = initial_sequence + 1 if initial_sequence > 0 else 1
        self._received_sequences: set[int] = set()

    def allocate_next_tx(self) -> int:
        """Allocate the next monotonically increasing transmission sequence number."""
        self._current_tx_sequence += 1
        if self._current_tx_sequence > MAX_SEQUENCE_NUMBER:
            logger.warning("Sequence number wrapped around MAX_SEQUENCE_NUMBER; resetting to 1")
            self._current_tx_sequence = 1
        return self._current_tx_sequence

    def get_current_tx(self) -> int:
        """Return the current transmission sequence number."""
        return self._current_tx_sequence

    def get_expected_rx(self) -> int:
        """Return the expected next incoming sequence number."""
        return self._expected_rx_sequence

    def validate_incoming_rx(self, sequence_number: int) -> SequenceValidationResult:
        """Validate an incoming sequence number against monotonic expectations."""
        expected = self._expected_rx_sequence

        if sequence_number == expected:
            return SequenceValidationResult(
                is_valid=True,
                status="VALID",
                expected_sequence=expected,
                received_sequence=sequence_number,
                gap_count=0,
            )

        if sequence_number in self._received_sequences or sequence_number < expected:
            return SequenceValidationResult(
                is_valid=False,
                status="DUPLICATE",
                expected_sequence=expected,
                received_sequence=sequence_number,
                gap_count=0,
            )

        if sequence_number > expected:
            gap = sequence_number - expected
            return SequenceValidationResult(
                is_valid=False,
                status="GAP",
                expected_sequence=expected,
                received_sequence=sequence_number,
                gap_count=gap,
            )

        return SequenceValidationResult(
            is_valid=False,
            status="OUT_OF_ORDER",
            expected_sequence=expected,
            received_sequence=sequence_number,
            gap_count=0,
        )

    def record_rx(self, sequence_number: int) -> None:
        """Record receipt of a sequence number and advance expected counter."""
        self._received_sequences.add(sequence_number)
        # Keep bounded history of seen sequences to prevent unbounded memory growth
        if len(self._received_sequences) > 1000:
            min_seen = min(self._received_sequences)
            self._received_sequences.discard(min_seen)

        if sequence_number >= self._expected_rx_sequence:
            self._expected_rx_sequence = sequence_number + 1
            if self._expected_rx_sequence > MAX_SEQUENCE_NUMBER:
                self._expected_rx_sequence = 1

    def reset(self, baseline: int = 0) -> None:
        """Reset sequence tracker baseline (e.g. upon connection renegotiation)."""
        self._current_tx_sequence = baseline
        self._expected_rx_sequence = baseline + 1 if baseline > 0 else 1
        self._received_sequences.clear()
