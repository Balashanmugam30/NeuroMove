"""MNE-Python based Motor-Imagery Epoching, Segmentation & Quality Control Engine."""

import logging

import mne
import numpy as np

from neuromove.epoching.events import normalize_events
from neuromove.epoching.models import (
    EpochingConfig,
    EpochingPreview,
    EpochQC,
    EpochQCStatus,
    EpochRecord,
    EventMappingConfig,
    NormalizedLabel,
    TrialDefinition,
)

logger = logging.getLogger(__name__)


def generate_epoching_preview(
    raw: mne.io.BaseRaw,
    mapping_config: EventMappingConfig,
    epoch_config: EpochingConfig,
) -> EpochingPreview:
    """Validate epoching parameters and calculate expected trial counts."""
    warnings: list[str] = []
    errors: list[str] = []

    sfreq = float(raw.info["sfreq"])
    duration_sec = float(raw.times[-1]) if len(raw.times) > 0 else 0.0

    if epoch_config.tmin >= epoch_config.tmax:
        errors.append(
            f"Invalid epoch interval: tmin ({epoch_config.tmin}s) must be < tmax ({epoch_config.tmax}s)."
        )

    if epoch_config.baseline:
        b_start, b_end = epoch_config.baseline
        if b_start > b_end:
            errors.append(f"Invalid baseline: start ({b_start}s) must be <= end ({b_end}s).")
        if b_start < epoch_config.tmin or b_end > epoch_config.tmax:
            warnings.append(
                f"Baseline interval [{b_start}, {b_end}]s exceeds epoch boundaries [{epoch_config.tmin}, {epoch_config.tmax}]s."
            )

    norm_events = normalize_events(raw, mapping_config)
    discovered = len(norm_events)
    mapped = sum(1 for e in norm_events if e.mapping_status == "MAPPED")
    unmapped = sum(1 for e in norm_events if e.mapping_status == "UNMAPPED")
    invalid = sum(1 for e in norm_events if e.mapping_status == "INVALID")

    # Check for boundary clipping
    expected = 0
    labels_found = set()
    for evt in norm_events:
        if evt.mapping_status == "MAPPED":
            labels_found.add(evt.normalized_label.value)
            t_start = evt.processed_onset_seconds + epoch_config.tmin
            t_end = evt.processed_onset_seconds + epoch_config.tmax
            if t_start >= 0 and t_end <= duration_sec:
                expected += 1
            else:
                warnings.append(
                    f"Event at {evt.processed_onset_seconds:.2f}s with window [{t_start:.2f}, {t_end:.2f}]s crosses recording boundary [0, {duration_sec:.2f}]s."
                )

    return EpochingPreview(
        valid=len(errors) == 0,
        events_discovered=discovered,
        mapped_events=mapped,
        unmapped_events=unmapped,
        invalid_events=invalid,
        expected_epochs=expected,
        sampling_rate_hz=sfreq,
        tmin=epoch_config.tmin,
        tmax=epoch_config.tmax,
        baseline=epoch_config.baseline if epoch_config.baseline_mode == "APPLIED" else None,
        analysis_window=epoch_config.analysis_window,
        labels_found=sorted(labels_found),
        warnings=warnings,
        errors=errors,
    )


def apply_epoch_segmentation(
    raw_input: mne.io.BaseRaw,
    mapping_config: EventMappingConfig,
    epoch_config: EpochingConfig,
    epoch_set_id: str,
    subject_id: str,
    session_id: str | None = None,
    run_id: str | None = None,
    now_iso: str = "2026-09-01T00:00:00Z",
) -> tuple[mne.Epochs, list[TrialDefinition], list[EpochRecord], list[EpochQC], dict[str, int]]:
    """Segment MNE Raw data into MNE Epochs, apply baseline, and run Quality Control."""
    # Deep copy to maintain raw immutability
    raw = raw_input.copy()
    duration_sec = float(raw.times[-1]) if len(raw.times) > 0 else 0.0

    # 1. Normalize events
    norm_events = normalize_events(raw, mapping_config, session_id=session_id)

    # 2. Build MNE integer event array
    event_id_map: dict[str, int] = {}
    mne_events_list: list[list[int]] = []
    trials: list[TrialDefinition] = []
    records: list[EpochRecord] = []
    qc_list: list[EpochQC] = []
    rejection_counts: dict[str, int] = {}

    code_counter = 1
    for idx, nevt in enumerate(norm_events):
        trial_id = f"trl_{epoch_set_id}_{idx:03d}"
        epoch_id = f"ep_{epoch_set_id}_{idx:03d}"

        # Baseline window
        b_start = epoch_config.baseline[0] if epoch_config.baseline else None
        b_end = epoch_config.baseline[1] if epoch_config.baseline else None

        trial = TrialDefinition(
            trial_id=trial_id,
            session_id=session_id,
            recording_id=nevt.recording_id,
            event_id=nevt.event_id,
            subject_id=subject_id,
            label=nevt.normalized_label,
            cue_onset_seconds=nevt.processed_onset_seconds,
            analysis_onset_seconds=nevt.processed_onset_seconds + epoch_config.analysis_window[0],
            window_start_seconds=nevt.processed_onset_seconds + epoch_config.tmin,
            window_end_seconds=nevt.processed_onset_seconds + epoch_config.tmax,
            baseline_start_seconds=b_start,
            baseline_end_seconds=b_end,
            status="ACTIVE",
        )
        trials.append(trial)

        # Skip invalid or unmapped events
        if nevt.mapping_status != "MAPPED" or nevt.normalized_label == NormalizedLabel.UNKNOWN:
            qc = EpochQC(
                epoch_id=epoch_id,
                status=EpochQCStatus.REJECTED,
                rejection_reason=f"Event status is {nevt.mapping_status.value}",
            )
            qc_list.append(qc)
            rejection_counts["UNMAPPED_EVENT"] = rejection_counts.get("UNMAPPED_EVENT", 0) + 1
            records.append(
                EpochRecord(
                    epoch_id=epoch_id,
                    epoch_set_id=epoch_set_id,
                    trial_id=trial_id,
                    event_id=nevt.event_id,
                    subject_id=subject_id,
                    session_id=session_id,
                    run_id=run_id,
                    label=nevt.normalized_label,
                    onset_seconds=nevt.processed_onset_seconds,
                    qc_status=EpochQCStatus.REJECTED,
                    rejection_reason=qc.rejection_reason,
                    created_at=now_iso,
                )
            )
            continue

        # Check boundary errors
        t_start = nevt.processed_onset_seconds + epoch_config.tmin
        t_end = nevt.processed_onset_seconds + epoch_config.tmax
        if t_start < 0 or t_end > duration_sec:
            qc = EpochQC(
                epoch_id=epoch_id,
                status=EpochQCStatus.BOUNDARY_ERROR,
                rejection_reason="Epoch window crosses recording bounds",
            )
            qc_list.append(qc)
            rejection_counts["BOUNDARY_ERROR"] = rejection_counts.get("BOUNDARY_ERROR", 0) + 1
            records.append(
                EpochRecord(
                    epoch_id=epoch_id,
                    epoch_set_id=epoch_set_id,
                    trial_id=trial_id,
                    event_id=nevt.event_id,
                    subject_id=subject_id,
                    session_id=session_id,
                    run_id=run_id,
                    label=nevt.normalized_label,
                    onset_seconds=nevt.processed_onset_seconds,
                    qc_status=EpochQCStatus.BOUNDARY_ERROR,
                    rejection_reason=qc.rejection_reason,
                    created_at=now_iso,
                )
            )
            continue

        label_str = nevt.normalized_label.value
        if label_str not in event_id_map:
            event_id_map[label_str] = code_counter
            code_counter += 1

        code_val = event_id_map[label_str]
        mne_events_list.append([nevt.processed_sample, 0, code_val])

        # Valid candidate
        qc = EpochQC(
            epoch_id=epoch_id,
            status=EpochQCStatus.VALID,
            rejection_reason=None,
        )
        qc_list.append(qc)
        records.append(
            EpochRecord(
                epoch_id=epoch_id,
                epoch_set_id=epoch_set_id,
                trial_id=trial_id,
                event_id=nevt.event_id,
                subject_id=subject_id,
                session_id=session_id,
                run_id=run_id,
                label=nevt.normalized_label,
                onset_seconds=nevt.processed_onset_seconds,
                qc_status=EpochQCStatus.VALID,
                rejection_reason=None,
                created_at=now_iso,
            )
        )

    # 3. Create MNE Epochs
    if len(mne_events_list) == 0:
        # Fallback empty epochs
        mne_events_arr = np.array([[0, 0, 1]], dtype=int)
        event_id_map = {"REST": 1}
    else:
        mne_events_arr = np.array(mne_events_list, dtype=int)

    baseline_val = epoch_config.baseline if epoch_config.baseline_mode == "APPLIED" else None

    epochs = mne.Epochs(
        raw,
        events=mne_events_arr,
        event_id=event_id_map,
        tmin=epoch_config.tmin,
        tmax=epoch_config.tmax,
        baseline=baseline_val,
        reject=None,
        reject_by_annotation=epoch_config.reject_by_annotation,
        preload=True,
        verbose=False,
    )

    # 4. Measure amplitude and evaluate QC on every trial
    epoch_data = epochs.get_data()  # Shape: (n_epochs, n_channels, n_times)
    valid_idx = 0
    drop_indices: list[int] = []

    for qc, rec in zip(qc_list, records, strict=False):
        if rec.qc_status == EpochQCStatus.VALID:
            if valid_idx < len(epoch_data):
                single_ep = epoch_data[valid_idx]  # in Volts
                min_uv = float(np.min(single_ep) * 1e6)
                max_uv = float(np.max(single_ep) * 1e6)
                qc.min_amplitude_uv = round(min_uv, 2)
                qc.max_amplitude_uv = round(max_uv, 2)

                # Check amplitude threshold
                if (
                    epoch_config.amplitude_rejection_uv is not None
                    and max(abs(min_uv), abs(max_uv)) > epoch_config.amplitude_rejection_uv
                ):
                    qc.status = EpochQCStatus.REJECTED
                    qc.rejection_reason = f"Peak amplitude ({max(abs(min_uv), abs(max_uv)):.1f} uV) exceeded limit ({epoch_config.amplitude_rejection_uv:.1f} uV)"
                    rec.qc_status = EpochQCStatus.REJECTED
                    rec.rejection_reason = qc.rejection_reason
                    rejection_counts["AMPLITUDE_OUTLIER"] = (
                        rejection_counts.get("AMPLITUDE_OUTLIER", 0) + 1
                    )
                    drop_indices.append(valid_idx)

                valid_idx += 1

    # Drop rejected epochs from MNE Epochs object if any were flagged
    if drop_indices and len(drop_indices) < len(epochs):
        epochs.drop(drop_indices, reason="AMPLITUDE_OUTLIER", verbose=False)

    return epochs, trials, records, qc_list, rejection_counts
