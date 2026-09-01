"""Model Card Generator for Phase 12 AI Model Laboratory."""

from __future__ import annotations

from datetime import UTC, datetime

from neuromove.decoding.models import ClassificationMetrics, ClassificationTask
from neuromove.experiments.models import ExperimentConfig, ModelCard


class ModelCardGenerator:
    """Generates structured JSON and GitHub-flavored Markdown Model Cards."""

    @staticmethod
    def generate_card(
        model_id: str,
        experiment_id: str,
        config: ExperimentConfig,
        task: ClassificationTask,
        metrics: ClassificationMetrics,
        artifact_checksum_sha256: str,
        software_versions: dict[str, str],
        subjects: list[str],
        total_epochs: int,
    ) -> ModelCard:
        created_at = datetime.now(UTC).isoformat()

        intended_use = (
            "Offline research benchmarking and controlled comparative evaluation of "
            "sensorimotor rhythm EEG motor imagery intention decoding. "
            "Explicitly not intended for medical diagnosis, clinical decision support, "
            "or direct real-time hardware actuation."
        )

        training_data_summary = (
            f"Dataset: {config.dataset_id}, Source Epoch Set: {config.epoch_set_id}. "
            f"Evaluated across {len(subjects)} subjects ({total_epochs} motor-imagery trials)."
        )

        metrics_summary = {
            "balanced_accuracy_mean": metrics.balanced_accuracy.mean,
            "balanced_accuracy_std": metrics.balanced_accuracy.std,
            "accuracy_mean": metrics.accuracy.mean,
            "accuracy_std": metrics.accuracy.std,
            "f1_mean": metrics.f1.mean,
            "f1_std": metrics.f1.std,
            "chance_level": metrics.chance_level,
        }

        known_limitations = [
            "Evaluated strictly on recorded/offline EEG; does not reflect online real-time non-stationarity.",
            "Subject variability: Inter-subject generalization performance may vary significantly across individuals.",
            "No direct actuator connection: Model predictions require confidence gating and safety arbitration before downstream actuation.",
        ]

        failure_modes = [
            "High impedance or ocular/myographic artifacts in sensorimotor electrodes (C3, Cz, C4).",
            "Atypical sensorimotor rhythm dynamics (e.g. BCI illiteracy or absent mu-rhythm suppression).",
            "Mismatched sampling rates or altered electrode montages during inference.",
        ]

        provenance_chain = {
            "dataset_id": config.dataset_id,
            "epoch_set_id": config.epoch_set_id,
            "task_id": config.task_id,
            "feature_representation": config.representation.value,
            "evaluation_protocol": config.evaluation_protocol.value,
            "random_state": config.random_state,
        }

        limitations_md = "\n".join(f"- {lim}" for lim in known_limitations)
        software_md = "\n".join(f"  - `{pkg}`: {ver}" for pkg, ver in software_versions.items())

        # Build GitHub-flavored Markdown
        md = f"""# Model Card: `{model_id}`

## Summary & Intended Use
- **Model Family**: `{config.model_family.value}`
- **Feature Representation**: `{config.representation.value}`
- **Task**: {task.task_name} (`{task.task_id}`)
- **Intended Use**: {intended_use}

## Training & Evaluation Lineage
- **Dataset**: `{config.dataset_id}`
- **Epoch Set**: `{config.epoch_set_id}`
- **Evaluation Protocol**: `{config.evaluation_protocol.value}` ({config.evaluation_mode.value})
- **Subjects Evaluated**: {len(subjects)} ({", ".join(subjects[:5])}{"..." if len(subjects) > 5 else ""})
- **Total Valid Epochs**: {total_epochs}

## Performance Metrics (Cross-Validated)
- **Balanced Accuracy**: {metrics.balanced_accuracy.mean * 100:.1f}% ± {metrics.balanced_accuracy.std * 100:.1f}%
- **Overall Accuracy**: {metrics.accuracy.mean * 100:.1f}% ± {metrics.accuracy.std * 100:.1f}%
- **F1 Score**: {metrics.f1.mean * 100:.1f}% ± {metrics.f1.std * 100:.1f}%
- **Theoretical Chance Level**: {metrics.chance_level * 100:.1f}%

## Known Limitations & Failure Modes
{limitations_md}

## Cryptographic Provenance
- **Artifact SHA-256**: `{artifact_checksum_sha256}`
- **Created At**: `{created_at}`
- **Software Stack**:
{software_md}
"""

        return ModelCard(
            model_id=model_id,
            experiment_id=experiment_id,
            intended_use=intended_use,
            training_data_summary=training_data_summary,
            task=task,
            feature_representation=config.representation,
            model_family=config.model_family,
            validation_protocol=f"{config.evaluation_protocol.value} ({config.evaluation_mode.value})",
            metrics_summary=metrics_summary,
            known_limitations=known_limitations,
            failure_modes=failure_modes,
            provenance_chain=provenance_chain,
            software_versions=software_versions,
            artifact_checksum_sha256=artifact_checksum_sha256,
            markdown_content=md,
            created_at=created_at,
        )
