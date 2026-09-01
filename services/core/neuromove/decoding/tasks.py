"""Canonical classification tasks and data filtering for motor-imagery decoding."""

import numpy as np

from ..epoching.models import NormalizedLabel
from .models import ClassificationTask

TASK_LEFT_VS_RIGHT = ClassificationTask(
    task_id="LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
    task_name="Left Hand vs Right Hand Motor Imagery",
    description="Binary sensorimotor rhythm decoding for contralateral motor cortex activation (C3 vs C4).",
    class_labels=[NormalizedLabel.LEFT_IMAGERY, NormalizedLabel.RIGHT_IMAGERY],
    label_mapping={
        NormalizedLabel.LEFT_IMAGERY: 0,
        NormalizedLabel.RIGHT_IMAGERY: 1,
    },
    version="1.0.0",
)

TASK_FEET_VS_FISTS = ClassificationTask(
    task_id="FEET_VS_FISTS_V1",
    task_name="Feet vs Bilateral Fists Motor Imagery",
    description="Binary motor imagery task for sagittal (Cz) vs lateral sensorimotor rhythm modulation.",
    class_labels=[NormalizedLabel.FEET_IMAGERY, NormalizedLabel.BOTH_FISTS_IMAGERY],
    label_mapping={
        NormalizedLabel.FEET_IMAGERY: 0,
        NormalizedLabel.BOTH_FISTS_IMAGERY: 1,
    },
    version="1.0.0",
)

CANONICAL_TASKS = {
    TASK_LEFT_VS_RIGHT.task_id: TASK_LEFT_VS_RIGHT,
    TASK_FEET_VS_FISTS.task_id: TASK_FEET_VS_FISTS,
}


def get_canonical_tasks() -> list[ClassificationTask]:
    """Retrieve all available canonical classification tasks."""
    return list(CANONICAL_TASKS.values())


def get_canonical_task(task_id: str) -> ClassificationTask:
    """Find a task specification by unique task ID or raise ValueError."""
    task = CANONICAL_TASKS.get(task_id)
    if not task:
        raise ValueError(f"Unknown task ID: '{task_id}'. Available: {list(CANONICAL_TASKS.keys())}")
    return task


def get_task_by_id(task_id: str) -> ClassificationTask | None:
    """Find a task specification by unique task ID."""
    return CANONICAL_TASKS.get(task_id)


def filter_epochs_for_task(
    epoch_data: np.ndarray,
    labels: list[str | NormalizedLabel],
    subject_ids: list[str],
    trial_ids: list[str],
    task: ClassificationTask,
) -> tuple[np.ndarray, np.ndarray, list[str], list[str], int, dict[str, int]]:
    """Filter epoch tensor to include only eligible classes for the target task.

    Returns:
        tuple containing:
            - filtered_data (n_eligible, n_channels, n_times)
            - integer target labels (n_eligible,)
            - filtered subject_ids (n_eligible,)
            - filtered trial_ids (n_eligible,)
            - excluded_count (int)
            - class_distribution (dict[str, int])
    """
    eligible_indices = []
    int_labels = []
    filtered_subjects = []
    filtered_trials = []
    class_counts: dict[str, int] = {str(lbl): 0 for lbl in task.class_labels}

    normalized_task_labels = {
        (lbl if isinstance(lbl, NormalizedLabel) else NormalizedLabel(lbl))
        for lbl in task.class_labels
    }

    for idx, raw_label in enumerate(labels):
        norm_label = (
            raw_label
            if isinstance(raw_label, NormalizedLabel)
            else NormalizedLabel(raw_label)
            if raw_label in NormalizedLabel.__members__.values()
            else NormalizedLabel.UNKNOWN
        )

        if norm_label in normalized_task_labels:
            eligible_indices.append(idx)
            int_labels.append(task.label_mapping[norm_label])
            filtered_subjects.append(subject_ids[idx] if idx < len(subject_ids) else "sub_unknown")
            filtered_trials.append(trial_ids[idx] if idx < len(trial_ids) else f"trial_{idx}")
            class_counts[str(norm_label)] += 1

    excluded_count = len(labels) - len(eligible_indices)

    if not eligible_indices:
        filtered_data = np.empty((0, epoch_data.shape[1], epoch_data.shape[2]), dtype=np.float64)
        target_y = np.empty((0,), dtype=np.int64)
    else:
        filtered_data = epoch_data[eligible_indices]
        target_y = np.array(int_labels, dtype=np.int64)

    return (
        filtered_data,
        target_y,
        filtered_subjects,
        filtered_trials,
        excluded_count,
        class_counts,
    )
