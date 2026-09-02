"""NeuroMove — Phase 22 Research Dataset & Leakage-Safe Evaluation Manager."""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from neuromove.research_analytics.models import GroupingStrategy, ResearchDataset

logger = logging.getLogger(__name__)


class ResearchDatasetManager:
    """Provides deterministic dataset grouping and leakage-safe train/test isolation."""

    @staticmethod
    def compute_dataset_checksum(
        session_ids: list[str],
        subjects: list[str],
        classes: list[str],
        channel_count: int,
        sampling_rate: float,
    ) -> str:
        """Compute SHA-256 digest over dataset specification."""
        summary = {
            "session_ids": sorted(session_ids),
            "subjects": sorted(subjects),
            "classes": sorted(classes),
            "channel_count": channel_count,
            "sampling_rate": sampling_rate,
        }
        json_bytes = json.dumps(summary, sort_keys=True).encode("utf-8")
        return hashlib.sha256(json_bytes).hexdigest()

    @classmethod
    def create_dataset(
        cls,
        name: str,
        description: str,
        session_ids: list[str],
        subjects: list[str],
        classes: list[str] | None = None,
        grouping_strategy: GroupingStrategy = GroupingStrategy.GROUP_BY_SUBJECT,
        channel_count: int = 8,
        sampling_rate: float = 250.0,
    ) -> ResearchDataset:
        """Create a new research dataset metadata descriptor."""
        classes = classes or ["MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT", "STOP"]
        dataset_id = f"ds_{uuid.uuid4().hex[:10]}"
        checksum = cls.compute_dataset_checksum(
            session_ids, subjects, classes, channel_count, sampling_rate
        )

        return ResearchDataset(
            dataset_id=dataset_id,
            name=name,
            description=description,
            session_ids=session_ids,
            subjects=subjects,
            classes=classes,
            grouping_strategy=grouping_strategy,
            channel_count=channel_count,
            sampling_rate=sampling_rate,
            dataset_checksum=checksum,
            created_at=datetime.now(UTC).isoformat(),
        )

    @staticmethod
    def partition_folds(
        items: list[dict[str, Any]],
        group_key: str = "subject_id",
        test_ratio: float = 0.2,
        seed: int = 42,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Strict leakage-safe group partition.
        Ensures all samples of any group (e.g. subject or session) are strictly in either train OR test.
        """
        import random

        # Group items by group_key
        groups: dict[str, list[dict[str, Any]]] = {}
        for item in items:
            g = item.get(group_key, "default")
            groups.setdefault(g, []).append(item)

        group_names = sorted(groups.keys())
        rng = random.Random(seed)
        rng.shuffle(group_names)

        n_test = max(1, int(len(group_names) * test_ratio)) if len(group_names) > 1 else 0
        test_groups = set(group_names[:n_test])
        train_groups = set(group_names[n_test:])

        if not train_groups:
            train_groups = test_groups
            test_groups = set()

        train_set = [item for g in train_groups for item in groups[g]]
        test_set = [item for g in test_groups for item in groups[g]]

        # Verify zero leakage
        train_subjects = {item.get(group_key) for item in train_set}
        test_subjects = {item.get(group_key) for item in test_set}
        assert not (train_subjects & test_subjects), "Data leakage detected across evaluation folds!"

        return train_set, test_set
