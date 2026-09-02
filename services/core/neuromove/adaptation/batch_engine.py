"""Adaptation Data Batch Engine: Ingestion, eligibility checking, and duplicate detection."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

import numpy as np

from neuromove.adaptation.models import AdaptationDataBatch, generate_batch_id


class AdaptationBatchEngine:
    """Manages candidate adaptation data batches, compatibility validation, and duplicate detection."""

    @staticmethod
    def compute_data_fingerprint(epoch_ids: list[str], signals: np.ndarray | None = None) -> str:
        """Compute stable SHA-256 digest over sorted epoch IDs and optional signal array sample."""
        hasher = hashlib.sha256()
        sorted_ids = sorted(epoch_ids)
        for ep_id in sorted_ids:
            hasher.update(ep_id.encode("utf-8"))
        if signals is not None and signals.size > 0:
            sample_bytes = signals[: min(5, len(signals))].tobytes()
            hasher.update(sample_bytes)
        return hasher.hexdigest()

    @classmethod
    def create_batch(
        cls,
        name: str,
        epoch_ids: list[str],
        labels: list[str],
        subject_id: str | None = None,
        source_mode: str = "SIMULATION",
        dataset_id: str | None = None,
        recording_id: str | None = None,
        epoch_set_id: str | None = None,
        feature_set_id: str | None = None,
        rejected_count: int = 0,
        warn_count: int = 0,
        signals: np.ndarray | None = None,
    ) -> AdaptationDataBatch:
        """Package validated candidate data into an immutable AdaptationDataBatch."""
        total_trials = len(epoch_ids) + rejected_count
        valid_trials = len(epoch_ids)
        valid_ratio = round(valid_trials / total_trials, 4) if total_trials > 0 else 0.0
        rejection_ratio = round(rejected_count / total_trials, 4) if total_trials > 0 else 0.0

        # Compute class distribution
        class_dist: dict[str, int] = {}
        for lbl in labels:
            class_dist[lbl] = class_dist.get(lbl, 0) + 1

        fingerprint = cls.compute_data_fingerprint(epoch_ids, signals)
        now_iso = datetime.now(UTC).isoformat()
        batch_id = generate_batch_id(fingerprint, now_iso)

        quality_summary = {
            "total_trials": total_trials,
            "valid_trials": valid_trials,
            "rejected_trials": rejected_count,
            "warn_trials": warn_count,
            "valid_ratio": valid_ratio,
            "rejection_ratio": rejection_ratio,
            "is_sufficient": valid_trials >= 6 and rejection_ratio <= 0.4,
        }

        return AdaptationDataBatch(
            batch_id=batch_id,
            name=name,
            subject_id=subject_id,
            source_mode=source_mode,
            dataset_id=dataset_id,
            recording_id=recording_id,
            epoch_set_id=epoch_set_id,
            feature_set_id=feature_set_id,
            trial_count=valid_trials,
            class_distribution=class_dist,
            quality_summary=quality_summary,
            source_fingerprint=fingerprint,
            created_at=now_iso,
        )

    @staticmethod
    def validate_compatibility(
        base_model_metadata: dict[str, Any],
        candidate_batches: list[AdaptationDataBatch],
        scope: str = "SUBJECT",
        target_subject_id: str | None = None,
    ) -> tuple[str, list[str]]:
        """
        Validate compatibility between base model and candidate data batches.
        Returns (status: "COMPATIBLE" | "INCOMPATIBLE" | "WARNING", issues: list[str]).
        """
        issues: list[str] = []

        if not candidate_batches:
            return "INCOMPATIBLE", ["No candidate data batches provided for adaptation."]

        # 1. Subject Scope Compatibility
        if scope == "SUBJECT":
            base_subject = base_model_metadata.get("subject_id") or target_subject_id
            for batch in candidate_batches:
                if batch.subject_id and base_subject and batch.subject_id != base_subject:
                    issues.append(
                        f"Subject mismatch in batch '{batch.name}': batch subject '{batch.subject_id}' "
                        f"does not match base model subject '{base_subject}'."
                    )

        # 2. Source Mode Consistency
        base_source_mode = base_model_metadata.get("source_mode", "SIMULATION")
        for batch in candidate_batches:
            if batch.source_mode != base_source_mode:
                issues.append(
                    f"Source mode mismatch: batch '{batch.name}' ({batch.source_mode}) cannot be combined "
                    f"with base model mode ({base_source_mode})."
                )

        # 3. Quality threshold check
        for batch in candidate_batches:
            rejection_ratio = batch.quality_summary.get("rejection_ratio", 0.0)
            if rejection_ratio > 0.4:
                issues.append(
                    f"Batch '{batch.name}' has excessive rejection ratio ({round(rejection_ratio * 100, 1)}% > 40%)."
                )

        if issues:
            return "INCOMPATIBLE", issues

        return "COMPATIBLE", []

    @staticmethod
    def detect_duplicate_epochs(
        base_epoch_ids: list[str],
        new_batch_epoch_ids: list[str],
    ) -> tuple[int, list[str]]:
        """
        Detect exact duplicate epoch identifiers between existing base data and candidate batches.
        Returns (duplicate_count, unique_new_epoch_ids).
        """
        base_set = set(base_epoch_ids)
        duplicates: list[str] = []
        unique_new: list[str] = []

        for ep_id in new_batch_epoch_ids:
            if ep_id in base_set:
                duplicates.append(ep_id)
            else:
                unique_new.append(ep_id)

        return len(duplicates), unique_new
