"""NeuroMove — Phase 22 Research Artifact & Export Generator."""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime

from neuromove.research_analytics.models import (
    ArtifactType,
    ReproducibilityResult,
    ResearchArtifact,
    ResearchExperiment,
)

logger = logging.getLogger(__name__)


class ResearchArtifactGenerator:
    """Generates scoped, checksummed export artifacts in JSON, CSV, and Markdown formats."""

    @staticmethod
    def _create_artifact(
        experiment_id: str,
        artifact_type: ArtifactType,
        file_name: str,
        content_str: str,
    ) -> ResearchArtifact:
        """Helper to create a checksummed research artifact."""
        art_id = f"art_{uuid.uuid4().hex[:10]}"
        checksum = hashlib.sha256(content_str.encode("utf-8")).hexdigest()

        return ResearchArtifact(
            artifact_id=art_id,
            experiment_id=experiment_id,
            artifact_type=artifact_type,
            checksum=checksum,
            file_name=file_name,
            content_json=content_str,
            generated_time=datetime.now(UTC).isoformat(),
            generator_version="1.0.0",
        )

    @classmethod
    def generate_manifest_artifact(cls, experiment: ResearchExperiment) -> ResearchArtifact:
        """Generate sealed manifest JSON artifact."""
        content = json.dumps(experiment.manifest.model_dump(), indent=2, sort_keys=True)
        return cls._create_artifact(
            experiment_id=experiment.experiment_id,
            artifact_type=ArtifactType.MANIFEST_JSON,
            file_name=f"{experiment.experiment_id}_manifest.json",
            content_str=content,
        )

    @classmethod
    def generate_result_artifact(cls, experiment: ResearchExperiment) -> ResearchArtifact:
        """Generate full result JSON artifact."""
        content = json.dumps(experiment.model_dump(), indent=2, sort_keys=True)
        return cls._create_artifact(
            experiment_id=experiment.experiment_id,
            artifact_type=ArtifactType.RESULT_JSON,
            file_name=f"{experiment.experiment_id}_results.json",
            content_str=content,
        )

    @classmethod
    def generate_metrics_csv(cls, experiment: ResearchExperiment) -> ResearchArtifact:
        """Generate metrics CSV artifact."""
        lines = [
            "metric_name,value,unit",
            f"accuracy,{experiment.metrics.accuracy if experiment.metrics else ''},ratio",
            f"balanced_accuracy,{experiment.metrics.balanced_accuracy if experiment.metrics else ''},ratio",
            f"f1_macro,{experiment.metrics.f1_macro if experiment.metrics else ''},score",
            f"precision_macro,{experiment.metrics.precision_macro if experiment.metrics else ''},score",
            f"recall_macro,{experiment.metrics.recall_macro if experiment.metrics else ''},score",
            f"expected_calibration_error,{experiment.metrics.expected_calibration_error if experiment.metrics else ''},score",
            f"brier_score,{experiment.metrics.brier_score if experiment.metrics else ''},score",
            f"total_trials,{experiment.metrics.total_trials if experiment.metrics else 0},count",
            f"rejection_rate,{experiment.metrics.rejection_rate if experiment.metrics else 0.0},ratio",
        ]
        content = "\n".join(lines)
        return cls._create_artifact(
            experiment_id=experiment.experiment_id,
            artifact_type=ArtifactType.METRICS_CSV,
            file_name=f"{experiment.experiment_id}_metrics.csv",
            content_str=content,
        )

    @classmethod
    def generate_latency_csv(cls, experiment: ResearchExperiment) -> ResearchArtifact:
        """Generate latency percentiles CSV artifact."""
        lines = ["stage,min_ms,mean_ms,median_ms,p90_ms,p95_ms,p99_ms,max_ms,sample_count"]
        if experiment.latency_analytics:
            for stg, p in experiment.latency_analytics.per_stage.items():
                lines.append(
                    f"{stg},{p.min_ms},{p.mean_ms},{p.median_ms},{p.p90_ms},{p.p95_ms},{p.p99_ms},{p.max_ms},{p.sample_count}"
                )
            tot = experiment.latency_analytics.total_pipeline
            lines.append(
                f"TOTAL_PIPELINE,{tot.min_ms},{tot.mean_ms},{tot.median_ms},{tot.p90_ms},{tot.p95_ms},{tot.p99_ms},{tot.max_ms},{tot.sample_count}"
            )
        content = "\n".join(lines)
        return cls._create_artifact(
            experiment_id=experiment.experiment_id,
            artifact_type=ArtifactType.LATENCY_CSV,
            file_name=f"{experiment.experiment_id}_latency.csv",
            content_str=content,
        )

    @classmethod
    def generate_confusion_matrix_artifact(cls, experiment: ResearchExperiment) -> ResearchArtifact:
        """Generate confusion matrix JSON artifact."""
        cm_data = experiment.metrics.confusion_matrix.model_dump() if experiment.metrics and experiment.metrics.confusion_matrix else {}
        content = json.dumps(cm_data, indent=2)
        return cls._create_artifact(
            experiment_id=experiment.experiment_id,
            artifact_type=ArtifactType.CONFUSION_MATRIX_JSON,
            file_name=f"{experiment.experiment_id}_confusion_matrix.json",
            content_str=content,
        )

    @classmethod
    def generate_reproducibility_report_artifact(cls, audit: ReproducibilityResult) -> ResearchArtifact:
        """Generate reproducibility report JSON artifact."""
        content = json.dumps(audit.model_dump(), indent=2)
        return cls._create_artifact(
            experiment_id=audit.baseline_experiment_id,
            artifact_type=ArtifactType.REPRODUCIBILITY_REPORT_JSON,
            file_name=f"{audit.baseline_experiment_id}_reproducibility_audit.json",
            content_str=content,
        )

    @classmethod
    def generate_summary_markdown(cls, experiment: ResearchExperiment) -> ResearchArtifact:
        """Generate high-level scientific summary markdown document."""
        acc = experiment.metrics.accuracy if experiment.metrics and experiment.metrics.accuracy is not None else "N/A"
        f1 = experiment.metrics.f1_macro if experiment.metrics and experiment.metrics.f1_macro is not None else "N/A"
        lat = experiment.latency_analytics.total_pipeline.mean_ms if experiment.latency_analytics else "N/A"

        md = f"""# Scientific Experiment Summary: {experiment.title}

## Overview
- **Experiment ID**: `{experiment.experiment_id}`
- **Analysis Type**: `{experiment.analysis_type}`
- **Status**: `{experiment.status}`
- **Replay Mode**: `{experiment.replay_mode}`
- **Manifest Hash**: `{experiment.manifest.manifest_hash}`
- **Result Hash**: `{experiment.result_hash or 'N/A'}`
- **Sealed**: `{experiment.is_sealed}`

## Primary Performance Metrics
- **Accuracy**: `{acc}`
- **Macro F1**: `{f1}`
- **Mean Pipeline Latency**: `{lat} ms`

## Safety & Non-Actuation Guarantee
- All evaluation strictly operates in an observational offline / HIL replay environment.
- Zero physical actuators or motors are energized.
"""
        return cls._create_artifact(
            experiment_id=experiment.experiment_id,
            artifact_type=ArtifactType.EXPERIMENT_SUMMARY_MD,
            file_name=f"{experiment.experiment_id}_summary.md",
            content_str=md,
        )
