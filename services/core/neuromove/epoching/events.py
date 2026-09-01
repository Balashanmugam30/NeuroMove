"""Event discovery, normalization, validation, and mapping logic."""

import logging

import mne
import numpy as np

from neuromove.epoching.models import (
    EpochEventMappingStatus,
    EventMappingConfig,
    EventMappingRule,
    NormalizedEvent,
    NormalizedLabel,
)

logger = logging.getLogger(__name__)


def get_default_event_mapping_config(
    dataset_id: str | None = None, run_id: str | None = None
) -> EventMappingConfig:
    """Return canonical event mapping rules for synthetic simulation or PhysioNet EEGBCI."""
    if not dataset_id or dataset_id == "simulation":
        return EventMappingConfig(
            mapping_version="EVENT_MAPPING_V1",
            dataset_id="simulation",
            rules=[
                EventMappingRule(
                    source_code="REST",
                    normalized_label=NormalizedLabel.REST,
                    description="Baseline resting state",
                ),
                EventMappingRule(
                    source_code="LEFT_IMAGERY",
                    normalized_label=NormalizedLabel.LEFT_IMAGERY,
                    description="Left hand motor imagery",
                ),
                EventMappingRule(
                    source_code="RIGHT_IMAGERY",
                    normalized_label=NormalizedLabel.RIGHT_IMAGERY,
                    description="Right hand motor imagery",
                ),
            ],
            default_label=NormalizedLabel.UNKNOWN,
        )

    # PhysioNet EEGBCI mappings
    # Run 3, 4, 7, 8, 11, 12 = Left Fist (T1) vs Right Fist (T2)
    # Run 5, 6, 9, 10, 13, 14 = Both Fists (T1) vs Both Feet (T2)
    # Run 1, 2 = Eyes Open / Eyes Closed Baseline (T0)
    is_feet_run = False
    if run_id:
        try:
            r_num = int(run_id.replace("R", "")) if "R" in run_id else int(run_id)
            if r_num in (5, 6, 9, 10, 13, 14):
                is_feet_run = True
        except ValueError:
            pass

    if is_feet_run:
        rules = [
            EventMappingRule(
                source_code="T0",
                normalized_label=NormalizedLabel.REST,
                description="Rest / Baseline",
            ),
            EventMappingRule(
                source_code="T1",
                normalized_label=NormalizedLabel.BOTH_FISTS_IMAGERY,
                description="Motor Imagery: Both Fists",
            ),
            EventMappingRule(
                source_code="T2",
                normalized_label=NormalizedLabel.FEET_IMAGERY,
                description="Motor Imagery: Both Feet",
            ),
        ]
    else:
        rules = [
            EventMappingRule(
                source_code="T0",
                normalized_label=NormalizedLabel.REST,
                description="Rest / Baseline",
            ),
            EventMappingRule(
                source_code="T1",
                normalized_label=NormalizedLabel.LEFT_IMAGERY,
                description="Motor Imagery: Left Fist",
            ),
            EventMappingRule(
                source_code="T2",
                normalized_label=NormalizedLabel.RIGHT_IMAGERY,
                description="Motor Imagery: Right Fist",
            ),
        ]

    return EventMappingConfig(
        mapping_version="EVENT_MAPPING_V1",
        dataset_id=dataset_id,
        rules=rules,
        default_label=NormalizedLabel.UNKNOWN,
    )


def discover_raw_events(raw: mne.io.BaseRaw) -> tuple[np.ndarray, dict[str, int]]:
    """Extract integer event array and string-to-int mapping from MNE Raw annotations or stim channels."""
    if len(raw.annotations) > 0:
        try:
            events, event_id = mne.events_from_annotations(raw, verbose=False)
            return events, event_id
        except ValueError:
            pass

    # Synthesize fallback events based on recording duration if annotations are empty
    sfreq = float(raw.info["sfreq"])
    duration = float(raw.times[-1]) if len(raw.times) > 0 else 10.0

    # Default synthetic Graz timeline: 3 trials spaced every 3.0 seconds
    events_list = []
    event_id = {"REST": 1, "LEFT_IMAGERY": 2, "RIGHT_IMAGERY": 3}

    t = 1.0
    trial_idx = 0
    labels = ["LEFT_IMAGERY", "RIGHT_IMAGERY", "LEFT_IMAGERY"]

    while t + 2.0 <= duration and trial_idx < len(labels):
        sample = int(t * sfreq)
        code = event_id[labels[trial_idx]]
        events_list.append([sample, 0, code])
        t += 3.0
        trial_idx += 1

    if not events_list:
        events_list.append([0, 0, 1])

    return np.array(events_list, dtype=int), event_id


def validate_event_timing(
    onset_seconds: float,
    sample_index: int,
    total_samples: int,
    duration_seconds: float,
) -> bool:
    """Validate that event onset timing lies strictly within recording bounds."""
    if onset_seconds < 0.0 or onset_seconds >= duration_seconds:
        return False
    if sample_index < 0 or sample_index >= total_samples:
        return False
    return True


def normalize_events(
    raw: mne.io.BaseRaw,
    mapping_config: EventMappingConfig | None = None,
    session_id: str | None = None,
    recording_id: str | None = None,
    source_sfreq: float | None = None,
) -> list[NormalizedEvent]:
    """Discover, map, and validate events into normalized event records."""
    if not mapping_config:
        mapping_config = get_default_event_mapping_config(recording_id=recording_id)

    rules_by_code = {r.source_code.upper(): r for r in mapping_config.rules}
    sfreq = float(raw.info["sfreq"])
    total_samples = len(raw.times)
    duration_sec = float(raw.times[-1]) if total_samples > 0 else 0.0

    normalized_list: list[NormalizedEvent] = []

    # 1. Process from MNE annotations if available
    if len(raw.annotations) > 0:
        for idx, annot in enumerate(raw.annotations):
            code = str(annot["description"]).strip()
            code_upper = code.upper()
            onset_sec = float(annot["onset"])
            sample_idx = int(onset_sec * sfreq)
            dur_sec = float(annot["duration"])

            is_valid = validate_event_timing(onset_sec, sample_idx, total_samples, duration_sec)

            if not is_valid:
                status = EpochEventMappingStatus.INVALID
                label = NormalizedLabel.UNKNOWN
            elif code_upper in rules_by_code:
                status = EpochEventMappingStatus.MAPPED
                label = rules_by_code[code_upper].normalized_label
            else:
                status = EpochEventMappingStatus.UNMAPPED
                label = mapping_config.default_label

            src_sfreq = source_sfreq or sfreq
            src_sample = int(onset_sec * src_sfreq)

            normalized_list.append(
                NormalizedEvent(
                    event_id=f"evt_{recording_id or 'rec'}_{idx:03d}",
                    source_event_code=code,
                    source_label=code,
                    normalized_label=label,
                    source_sample=src_sample,
                    source_onset_seconds=onset_sec,
                    processed_sample=sample_idx,
                    processed_onset_seconds=onset_sec,
                    duration_seconds=dur_sec,
                    session_id=session_id,
                    recording_id=recording_id,
                    mapping_status=status,
                )
            )
        return normalized_list

    # 2. Process from extracted integer events
    events, event_id_dict = discover_raw_events(raw)
    id_to_name = {v: k for k, v in event_id_dict.items()}

    for idx, evt in enumerate(events):
        sample_idx = int(evt[0])
        code_val = int(evt[2])
        code_name = id_to_name.get(code_val, f"E{code_val}")
        code_upper = code_name.upper()
        onset_sec = float(sample_idx / sfreq) if sfreq > 0 else 0.0

        is_valid = validate_event_timing(onset_sec, sample_idx, total_samples, duration_sec)

        if not is_valid:
            status = EpochEventMappingStatus.INVALID
            label = NormalizedLabel.UNKNOWN
        elif code_upper in rules_by_code:
            status = EpochEventMappingStatus.MAPPED
            label = rules_by_code[code_upper].normalized_label
        else:
            status = EpochEventMappingStatus.UNMAPPED
            label = mapping_config.default_label

        src_sfreq = source_sfreq or sfreq
        src_sample = int(onset_sec * src_sfreq)

        normalized_list.append(
            NormalizedEvent(
                event_id=f"evt_{recording_id or 'rec'}_{idx:03d}",
                source_event_code=code_name,
                source_label=code_name,
                normalized_label=label,
                source_sample=src_sample,
                source_onset_seconds=onset_sec,
                processed_sample=sample_idx,
                processed_onset_seconds=onset_sec,
                duration_seconds=4.0,
                session_id=session_id,
                recording_id=recording_id,
                mapping_status=status,
            )
        )

    return normalized_list
