"""Model artifact persistence, checksum verification, and export engine."""

import csv
import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import joblib

from .models import ModelManifest

logger = logging.getLogger("neuromove.decoding.storage")


class DecoderStorage:
    """Manages file storage, serialization, and exports for trained classical decoders."""

    def __init__(self, base_dir: Path | str = "models/classical"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir = self.base_dir / "exports"
        self.exports_dir.mkdir(parents=True, exist_ok=True)

    def _compute_file_sha256(self, file_path: Path) -> str:
        """Compute cryptographic SHA-256 hash of a file on disk."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def save_model(
        self,
        model_id: str,
        pipeline: Any,
        manifest: ModelManifest,
    ) -> tuple[Path, str]:
        """Serialize a trained pipeline artifact and sidecar manifest.

        Args:
            model_id: Unique model identifier.
            pipeline: Scikit-learn Pipeline instance.
            manifest: Provenance and performance manifest.

        Returns:
            tuple containing:
                - Path to serialized joblib artifact.
                - SHA-256 checksum string.
        """
        artifact_path = self.base_dir / f"{model_id}.joblib"
        meta_path = self.base_dir / f"{model_id}.meta.json"

        # Save pipeline with compression
        joblib.dump(pipeline, artifact_path, compress=3)
        checksum = self._compute_file_sha256(artifact_path)

        # Update manifest with checksum and relative path
        manifest.artifact_file_path = str(artifact_path)
        manifest.artifact_checksum_sha256 = checksum

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(manifest.model_dump(), f, indent=2)

        # Generate CSV export
        self.generate_csv_exports(model_id, manifest)

        logger.info("Saved model artifact %s (SHA-256: %s...)", model_id, checksum[:12])
        return artifact_path, checksum

    def load_model(self, model_id: str) -> tuple[Any, ModelManifest]:
        """Load and verify a trained model and its provenance manifest.

        Args:
            model_id: Unique model identifier.

        Returns:
            tuple of (pipeline, ModelManifest).
        """
        artifact_path = self.base_dir / f"{model_id}.joblib"
        meta_path = self.base_dir / f"{model_id}.meta.json"

        if not artifact_path.exists():
            raise FileNotFoundError(f"Model artifact '{artifact_path}' not found on disk.")
        if not meta_path.exists():
            raise FileNotFoundError(f"Model metadata '{meta_path}' not found on disk.")

        with open(meta_path, encoding="utf-8") as f:
            meta_dict = json.load(f)
        manifest = ModelManifest(**meta_dict)

        # Verify cryptographic integrity
        current_checksum = self._compute_file_sha256(artifact_path)
        if current_checksum != manifest.artifact_checksum_sha256:
            raise ValueError(
                f"Model integrity check failed for {model_id}! Expected {manifest.artifact_checksum_sha256}, got {current_checksum}."
            )

        pipeline = joblib.load(artifact_path)
        return pipeline, manifest

    def generate_csv_exports(self, model_id: str, manifest: ModelManifest) -> Path:
        """Export fold and per-subject metrics to tabular CSV."""
        csv_path = self.exports_dir / f"{model_id}_metrics.csv"
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "Fold",
                    "Train Subjects",
                    "Test Subjects",
                    "Train Epochs",
                    "Test Epochs",
                    "Accuracy",
                    "Balanced Accuracy",
                    "Precision",
                    "Recall",
                    "F1 Score",
                ]
            )
            for fold in manifest.metrics.per_fold_results:
                writer.writerow(
                    [
                        fold.fold_id,
                        ";".join(fold.train_subjects),
                        ";".join(fold.test_subjects),
                        fold.train_epochs,
                        fold.test_epochs,
                        f"{fold.accuracy:.4f}",
                        f"{fold.balanced_accuracy:.4f}",
                        f"{fold.precision:.4f}",
                        f"{fold.recall:.4f}",
                        f"{fold.f1:.4f}",
                    ]
                )

            writer.writerow([])
            writer.writerow(["--- SUMMARY ---"])
            writer.writerow(["Metric", "Mean", "Std", "Median", "Min", "Max"])
            for name, stats in [
                ("Accuracy", manifest.metrics.accuracy),
                ("Balanced Accuracy", manifest.metrics.balanced_accuracy),
                ("Precision", manifest.metrics.precision),
                ("Recall", manifest.metrics.recall),
                ("F1 Score", manifest.metrics.f1),
            ]:
                writer.writerow(
                    [
                        name,
                        f"{stats.mean:.4f}",
                        f"{stats.std:.4f}",
                        f"{stats.median:.4f}",
                        f"{stats.min:.4f}",
                        f"{stats.max:.4f}",
                    ]
                )

            writer.writerow([])
            writer.writerow(["--- PER SUBJECT PERFORMANCE ---"])
            writer.writerow(
                ["Subject ID", "Epoch Count", "Accuracy", "Balanced Accuracy", "F1 Score"]
            )
            for s_metric in manifest.metrics.per_subject_metrics:
                writer.writerow(
                    [
                        s_metric.subject_id,
                        s_metric.epoch_count,
                        f"{s_metric.accuracy:.4f}",
                        f"{s_metric.balanced_accuracy:.4f}",
                        f"{s_metric.f1:.4f}",
                    ]
                )

        return csv_path

    def get_csv_export_path(self, model_id: str) -> Path:
        """Retrieve path to generated CSV metrics export."""
        csv_path = self.exports_dir / f"{model_id}_metrics.csv"
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV export for model '{model_id}' not found.")
        return csv_path
