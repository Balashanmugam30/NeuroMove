"""Multi-Model Comparison Service for Phase 12 AI Model Laboratory."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from neuromove.decoding.models import ClassificationMetrics
from neuromove.experiments.models import (
    ExperimentConfig,
    ModelComparisonEntry,
    ModelComparisonResult,
)


class ModelComparisonService:
    """Compares multiple experiments under controlled task and dataset conditions."""

    @staticmethod
    def compare(
        comparison_name: str,
        experiments: list[tuple[str, ExperimentConfig, ClassificationMetrics]],
    ) -> ModelComparisonResult:
        if len(experiments) < 2:
            raise ValueError("Comparison requires at least 2 experiments.")

        first_exp_id, first_cfg, first_metrics = experiments[0]
        common_task_id = first_cfg.task_id
        common_protocol = first_cfg.evaluation_protocol.value
        common_dataset_id = first_cfg.dataset_id

        entries: list[ModelComparisonEntry] = []
        for exp_id, cfg, metrics in experiments:
            entries.append(
                ModelComparisonEntry(
                    experiment_id=exp_id,
                    model_family=cfg.model_family,
                    representation=cfg.representation,
                    parameters=cfg.model_params,
                    metrics=metrics,
                )
            )

        comparison_id = f"cmp_{uuid.uuid4().hex[:8]}"

        return ModelComparisonResult(
            comparison_id=comparison_id,
            comparison_name=comparison_name,
            common_task_id=common_task_id,
            common_protocol=common_protocol,
            common_dataset_id=common_dataset_id,
            entries=entries,
            created_at=datetime.now(UTC).isoformat(),
        )
