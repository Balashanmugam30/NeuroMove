"""Storage and Serialization Engine for Phase 12 AI Model Laboratory."""

from __future__ import annotations

import csv
import hashlib
import json
import logging
from pathlib import Path

import joblib
from sklearn.pipeline import Pipeline

from neuromove.experiments.models import (
    ExperimentDetail,
    ModelCard,
    OutOfFoldPredictionSet,
)

logger = logging.getLogger("neuromove.experiments.storage")


class ExperimentStorage:
    """Handles disk serialization, cryptographic hashing, and tabular exports for experiments."""

    def __init__(self, base_dir: Path | str = "experiments"):
        self.base_dir = Path(base_dir)
        self.models_dir = Path("models/classical")
        self.exports_dir = self.base_dir / "exports"
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def compute_file_sha256(file_path: Path) -> str:
        """Compute streaming SHA-256 checksum of a file."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    def save_model_artifact(self, model_id: str, pipeline: Pipeline) -> tuple[Path, str]:
        """Serialize scikit-learn pipeline to compressed joblib file with SHA-256 checksum."""
        self.models_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = self.models_dir / f"{model_id}.joblib"
        joblib.dump(pipeline, artifact_path, compress=3)
        checksum = self.compute_file_sha256(artifact_path)
        logger.info("Saved model artifact %s (SHA-256: %s)", artifact_path, checksum)
        return artifact_path, checksum

    def load_model_artifact(
        self, artifact_path: Path | str, expected_checksum: str | None = None
    ) -> Pipeline:
        """Load and verify SHA-256 checksum of a serialized model artifact."""
        path = Path(artifact_path)
        if not path.exists():
            raise FileNotFoundError(f"Model artifact not found at: {path}")

        if expected_checksum:
            current_checksum = self.compute_file_sha256(path)
            if current_checksum != expected_checksum:
                raise ValueError(
                    f"Model artifact integrity check failed for {path}! "
                    f"Expected SHA-256: {expected_checksum}, Found: {current_checksum}"
                )

        return joblib.load(path)

    def save_experiment_detail(self, detail: ExperimentDetail) -> Path:
        """Save full experiment metadata JSON."""
        exp_file = self.base_dir / f"{detail.experiment_id}.meta.json"
        with open(exp_file, "w", encoding="utf-8") as f:
            json.dump(detail.model_dump(), f, indent=2)
        return exp_file

    def save_oof_predictions_csv(self, oof_set: OutOfFoldPredictionSet) -> Path:
        """Export out-of-fold predictions to CSV."""
        csv_file = self.exports_dir / f"{oof_set.experiment_id}_oof_predictions.csv"
        fieldnames = [
            "epoch_id",
            "subject_id",
            "session_id",
            "run_id",
            "true_label",
            "predicted_label",
            "is_correct",
            "decision_score",
            "fold_id",
            "model_id",
            "experiment_id",
        ]
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for p in oof_set.predictions:
                row = p.model_dump()
                row.pop("probability_vector", None)
                writer.writerow(row)
        return csv_file

    def save_model_card(self, card: ModelCard) -> tuple[Path, Path]:
        """Save model card JSON and Markdown files."""
        json_file = self.base_dir / f"{card.model_id}.card.json"
        md_file = self.base_dir / f"{card.model_id}.card.md"

        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(card.model_dump(), f, indent=2)

        with open(md_file, "w", encoding="utf-8") as f:
            f.write(card.markdown_content)

        return json_file, md_file
