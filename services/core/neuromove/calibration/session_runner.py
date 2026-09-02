"""Authoritative Backend Calibration Session Runner & State Machine (Phase 13)."""

import logging
import time
from datetime import UTC, datetime

from .models import (
    CalibrationProtocol,
    CalibrationQCStatus,
    CalibrationSession,
    CalibrationSessionStatus,
    CalibrationTrial,
    CalibrationTrialStatus,
)
from .qc import CalibrationQCEngine

logger = logging.getLogger("neuromove.calibration")


class CalibrationSessionRunner:
    """Manages protocol timing, trial execution, and lifecycle state transitions."""

    LEGAL_TRANSITIONS: dict[CalibrationSessionStatus, set[CalibrationSessionStatus]] = {
        CalibrationSessionStatus.PLANNED: {
            CalibrationSessionStatus.IN_PROGRESS,
            CalibrationSessionStatus.ABORTED,
            CalibrationSessionStatus.ARCHIVED,
        },
        CalibrationSessionStatus.IN_PROGRESS: {
            CalibrationSessionStatus.PAUSED,
            CalibrationSessionStatus.QUALITY_REVIEW,
            CalibrationSessionStatus.ABORTED,
            CalibrationSessionStatus.INVALID,
        },
        CalibrationSessionStatus.PAUSED: {
            CalibrationSessionStatus.IN_PROGRESS,
            CalibrationSessionStatus.ABORTED,
            CalibrationSessionStatus.INVALID,
        },
        CalibrationSessionStatus.QUALITY_REVIEW: {
            CalibrationSessionStatus.READY,
            CalibrationSessionStatus.INVALID,
            CalibrationSessionStatus.ABORTED,
            CalibrationSessionStatus.ARCHIVED,
        },
        CalibrationSessionStatus.READY: {
            CalibrationSessionStatus.ARCHIVED,
            CalibrationSessionStatus.INVALID,
        },
        CalibrationSessionStatus.ABORTED: {
            CalibrationSessionStatus.ARCHIVED,
        },
        CalibrationSessionStatus.INVALID: {
            CalibrationSessionStatus.ARCHIVED,
        },
        CalibrationSessionStatus.ARCHIVED: set(),
    }

    def __init__(
        self,
        session: CalibrationSession,
        protocol: CalibrationProtocol,
        trials: list[CalibrationTrial],
    ) -> None:
        self.session = session
        self.protocol = protocol
        self.trials = trials
        self._current_phase_start_time: float | None = None
        self._paused_at_time: float | None = None

    def start(self) -> CalibrationSession:
        """Begin calibration session and activate first trial."""
        self._transition_state(CalibrationSessionStatus.IN_PROGRESS)
        now_iso = datetime.now(UTC).isoformat()
        self.session.started_at = now_iso
        self.session.active_trial_index = 0
        self.session.active_phase = "REST"
        self.session.phase_time_remaining_sec = self.protocol.rest_duration_sec
        self._current_phase_start_time = time.time()

        if self.trials:
            self.trials[0].status = CalibrationTrialStatus.ACTIVE
            self.trials[0].actual_onset = 0.0

        logger.info(
            "Started calibration session %s (%d trials)",
            self.session.calibration_id,
            len(self.trials),
        )
        return self.session

    def pause(self, reason: str = "User requested pause") -> CalibrationSession:
        """Freeze session progression and record pause interval."""
        self._transition_state(CalibrationSessionStatus.PAUSED)
        now_iso = datetime.now(UTC).isoformat()
        self._paused_at_time = time.time()
        self.session.pause_intervals.append(
            {"paused_at": now_iso, "resumed_at": None, "reason": reason}
        )
        logger.info(
            "Paused calibration session %s (active trial %d)",
            self.session.calibration_id,
            self.session.active_trial_index,
        )
        return self.session

    def resume(self) -> CalibrationSession:
        """Resume session progression from authoritative active trial."""
        self._transition_state(CalibrationSessionStatus.IN_PROGRESS)
        now_iso = datetime.now(UTC).isoformat()
        if self.session.pause_intervals and self.session.pause_intervals[-1]["resumed_at"] is None:
            self.session.pause_intervals[-1]["resumed_at"] = now_iso

        self._current_phase_start_time = time.time()
        logger.info(
            "Resumed calibration session %s (active trial %d)",
            self.session.calibration_id,
            self.session.active_trial_index,
        )
        return self.session

    def abort(self, reason: str = "Operator aborted calibration") -> CalibrationSession:
        """Halt progression, mark active/future trials aborted, and preserve audit records."""
        self._transition_state(CalibrationSessionStatus.ABORTED)
        now_iso = datetime.now(UTC).isoformat()
        self.session.completed_at = now_iso
        self.session.active_phase = "COMPLETE"
        self.session.phase_time_remaining_sec = 0.0

        # Mark active or uncompleted trials as ABORTED
        for t in self.trials:
            if t.status in (CalibrationTrialStatus.PLANNED, CalibrationTrialStatus.ACTIVE):
                t.status = CalibrationTrialStatus.ABORTED
                t.notes = f"Aborted: {reason}"

        self._update_counts_and_quality()
        logger.warning("Aborted calibration session %s: %s", self.session.calibration_id, reason)
        return self.session

    def advance_simulation_step(
        self, qc_override_status: CalibrationQCStatus | None = None
    ) -> CalibrationSession:
        """Advance one trial in simulation mode, evaluating signal QC and recording state."""
        if self.session.status != CalibrationSessionStatus.IN_PROGRESS:
            return self.session

        idx = self.session.active_trial_index
        if idx >= len(self.trials):
            return self.complete_session()

        trial = self.trials[idx]

        # Simulate synthetic/replay trial execution

        trial.actual_onset = trial.planned_onset
        trial.imagery_start = (
            trial.planned_onset
            + self.protocol.rest_duration_sec
            + self.protocol.fixation_duration_sec
            + self.protocol.cue_duration_sec
        )
        trial.imagery_end = trial.imagery_start + self.protocol.imagery_duration_sec

        # Determine trial QC
        if qc_override_status:
            trial.quality_status = qc_override_status
        else:
            # Deterministic simulation signal QC
            trial.quality_status = CalibrationQCStatus.PASS
            trial.quality_reasons = []

        if trial.quality_status == CalibrationQCStatus.REJECT:
            trial.status = CalibrationTrialStatus.REJECTED
        else:
            trial.status = CalibrationTrialStatus.COMPLETED

        # Advance to next trial
        next_idx = idx + 1
        self.session.active_trial_index = next_idx

        if next_idx < len(self.trials):
            self.trials[next_idx].status = CalibrationTrialStatus.ACTIVE
            self.session.active_phase = "REST"
            self.session.phase_time_remaining_sec = self.protocol.rest_duration_sec
        else:
            return self.complete_session()

        self._update_counts_and_quality()
        return self.session

    def complete_session(self) -> CalibrationSession:
        """Finalize all trials and transition to QUALITY_REVIEW or READY."""
        self._transition_state(CalibrationSessionStatus.QUALITY_REVIEW)
        now_iso = datetime.now(UTC).isoformat()
        self.session.completed_at = now_iso
        self.session.active_phase = "COMPLETE"
        self.session.phase_time_remaining_sec = 0.0

        self._update_counts_and_quality()

        # If sufficiency passes, mark READY
        if self.session.quality_summary and self.session.quality_summary.is_sufficient:
            self._transition_state(CalibrationSessionStatus.READY)

        logger.info(
            "Completed calibration session %s (Status: %s)",
            self.session.calibration_id,
            self.session.status,
        )
        return self.session

    def _update_counts_and_quality(self) -> None:
        """Recalculate summary trial statistics and update quality audit."""
        self.session.trial_count = len(self.trials)
        self.session.valid_trial_count = sum(
            1
            for t in self.trials
            if t.status == CalibrationTrialStatus.COMPLETED
            and t.quality_status != CalibrationQCStatus.REJECT
        )
        self.session.rejected_trial_count = sum(
            1
            for t in self.trials
            if t.quality_status == CalibrationQCStatus.REJECT
            or t.status == CalibrationTrialStatus.REJECTED
        )

        class_dist: dict[str, int] = {}
        for t in self.trials:
            if (
                t.status == CalibrationTrialStatus.COMPLETED
                and t.quality_status != CalibrationQCStatus.REJECT
            ):
                lbl = t.target_label.value
                class_dist[lbl] = class_dist.get(lbl, 0) + 1
        self.session.class_distribution = class_dist

        self.session.quality_summary = CalibrationQCEngine.summarize_session_quality(
            self.trials,
            min_valid_trials_per_class=self.protocol.min_valid_trials_per_class,
            max_rejection_ratio=self.protocol.max_rejection_ratio,
        )

    def _transition_state(self, new_state: CalibrationSessionStatus) -> None:
        """Validate state transition rules before mutating."""
        allowed = self.LEGAL_TRANSITIONS.get(self.session.status, set())
        if new_state not in allowed:
            raise ValueError(
                f"Illegal calibration state transition from '{self.session.status.value}' to '{new_state.value}'."
            )
        self.session.status = new_state
