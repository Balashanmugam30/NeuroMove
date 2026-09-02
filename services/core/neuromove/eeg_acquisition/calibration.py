"""NeuroMove — Phase 21 Session-Level Calibration & Baseline Setup Workflow."""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import UTC, datetime

import numpy as np

from neuromove.eeg_acquisition.models import (
    ChannelQcStatus,
    EegCalibrationSnapshot,
)
from neuromove.eeg_acquisition.qc import EegSignalQcEngine

logger = logging.getLogger(__name__)


class EegCalibrationWorkflow:
    """Session-level calibration manager.

    Orchestrates channel QC, resting baseline recording, signal stabilization,
    and gating downstream live trial execution.
    """

    def __init__(self, qc_engine: EegSignalQcEngine | None = None):
        self.qc_engine = qc_engine or EegSignalQcEngine()
        self._current_snapshot: EegCalibrationSnapshot | None = None

    def reset(self) -> None:
        """Reset calibration state."""
        self._current_snapshot = None

    def calibrate(
        self,
        session_id: str,
        subject_id: str,
        data_uv: np.ndarray,
        channel_names: list[str],
        duration_sec: float = 2.0,
    ) -> EegCalibrationSnapshot:
        """Execute baseline calibration on resting EEG data window.

        Args:
            session_id: Active acquisition session ID
            subject_id: Subject pseudonym
            data_uv: Numpy array of shape (n_channels, n_samples)
            channel_names: Names of channels
            duration_sec: Baseline window duration in seconds

        Returns:
            EegCalibrationSnapshot with readiness verdict
        """
        cal_id = f"cal_{uuid.uuid4().hex[:10]}"
        now_iso = datetime.now(UTC).isoformat()

        # Step 1: Signal Quality Check
        qc_map, is_nominal, degraded_count = self.qc_engine.evaluate_window(
            data_uv=data_uv, channel_names=channel_names
        )

        channel_health = {ch: snap.qc_status for ch, snap in qc_map.items()}

        # Step 2: Compute Per-Channel Baseline Metrics
        baseline_means = {}
        baseline_stds = {}

        n_channels, n_samples = data_uv.shape if len(data_uv.shape) == 2 else (0, 0)
        for idx, ch in enumerate(channel_names):
            if idx < n_channels and n_samples > 0:
                ch_data = data_uv[idx, :]
                baseline_means[ch] = round(float(np.mean(ch_data)), 2)
                baseline_stds[ch] = round(float(np.std(ch_data)), 2)
            else:
                baseline_means[ch] = 0.0
                baseline_stds[ch] = 0.0

        # Step 3: Readiness Gate Assessment
        # Allow trial if no major fatal QC failures (no FLATLINE on primary motor channels C3/Cz/C4, no NONFINITE)
        is_ready = True
        state = "CALIBRATED"

        critical_channels = [ch for ch in channel_names if ch in ("C3", "Cz", "C4")]
        for ch in critical_channels:
            status = channel_health.get(ch, ChannelQcStatus.CHANNEL_MISSING)
            if status in (
                ChannelQcStatus.FLATLINE,
                ChannelQcStatus.NONFINITE,
                ChannelQcStatus.CHANNEL_MISSING,
            ):
                is_ready = False
                state = "FAILED"
                break

        if degraded_count > (len(channel_names) // 2):
            is_ready = False
            state = "FAILED"

        # Construct Deterministic Manifest Hash
        manifest_raw = (
            f"{session_id}:{subject_id}:{state}:{is_ready}:{sorted(channel_health.items())}"
        )
        manifest_hash = hashlib.sha256(manifest_raw.encode("utf-8")).hexdigest()

        snapshot = EegCalibrationSnapshot(
            calibration_id=cal_id,
            session_id=session_id,
            subject_id=subject_id,
            state=state,
            baseline_duration_sec=duration_sec,
            baseline_mean_uv=baseline_means,
            baseline_std_uv=baseline_stds,
            channel_health=channel_health,
            manifest_hash=manifest_hash,
            is_ready=is_ready,
            created_at=now_iso,
        )

        self._current_snapshot = snapshot
        logger.info(
            "EEG calibration completed for session %s: state=%s, is_ready=%s, manifest=%s",
            session_id,
            state,
            is_ready,
            manifest_hash[:8],
        )
        return snapshot

    def get_latest_snapshot(self) -> EegCalibrationSnapshot | None:
        """Return the most recent calibration snapshot."""
        return self._current_snapshot
