"""Storage manager for scientific feature matrices, covariance tensors, and CSV exports."""

import csv
import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import numpy as np

from neuromove.features.models import CovarianceMatrixRecord, FeatureVector

logger = logging.getLogger(__name__)


class FeatureStorage:
    """Manages content-addressed feature matrix artifacts (.npz) and CSV exports."""

    def __init__(self, base_dir: Path | str | None = None) -> None:
        if base_dir is None:
            current = Path(__file__).resolve()
            repo_root = current.parents[4]
            self.base_dir = repo_root / "data" / "features"
        else:
            self.base_dir = Path(base_dir).resolve()

        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, feature_set_id: str, suffix: str) -> Path:
        """Resolve file path and prevent directory traversal."""
        safe_id = Path(feature_set_id).name
        if ".." in safe_id or "/" in safe_id or "\\" in safe_id:
            raise ValueError(f"Illegal identifier: {feature_set_id}")
        return (self.base_dir / f"{safe_id}{suffix}").resolve()

    def exists(self, feature_set_id: str) -> bool:
        """Check if NPZ artifact and metadata sidecar exist on disk."""
        npz_file = self._resolve_safe_path(feature_set_id, ".npz")
        meta_file = self._resolve_safe_path(feature_set_id, ".meta.json")
        return npz_file.is_file() and meta_file.is_file()

    def compute_sha256(self, file_path: Path) -> str:
        """Compute streaming SHA-256 hash."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    def save_feature_set(
        self,
        feature_set_id: str,
        vectors: list[FeatureVector],
        covariances: list[CovarianceMatrixRecord],
        feature_names: list[str],
        metadata: dict[str, Any],
    ) -> tuple[Path, str]:
        """Save feature matrix array and covariance matrices to .npz file and write metadata sidecar."""
        npz_file = self._resolve_safe_path(feature_set_id, ".npz")
        meta_file = self._resolve_safe_path(feature_set_id, ".meta.json")
        csv_file = self._resolve_safe_path(feature_set_id, ".csv")

        # Build dense feature matrix: (n_samples, n_features)
        n_samples = len(vectors)
        n_features = len(feature_names)
        matrix = np.zeros((n_samples, n_features), dtype=np.float64)
        labels = []
        epoch_ids = []
        subject_ids = []
        trial_ids = []

        for row_idx, vec in enumerate(vectors):
            labels.append(vec.label.value)
            epoch_ids.append(vec.epoch_id)
            subject_ids.append(vec.subject_id)
            trial_ids.append(vec.trial_id)
            for col_idx, feat_name in enumerate(feature_names):
                matrix[row_idx, col_idx] = vec.values.get(feat_name, 0.0)

        # Build 3D covariance array: (n_samples, n_channels, n_channels)
        if covariances:
            cov_tensor = np.array([c.matrix for c in covariances], dtype=np.float64)
        else:
            cov_tensor = np.zeros((n_samples, 1, 1), dtype=np.float64)

        # Save to NPZ
        np.savez_compressed(
            str(npz_file),
            features=matrix,
            covariances=cov_tensor,
            feature_names=np.array(feature_names),
            labels=np.array(labels),
            epoch_ids=np.array(epoch_ids),
            subject_ids=np.array(subject_ids),
            trial_ids=np.array(trial_ids),
        )

        checksum = self.compute_sha256(npz_file)
        metadata["artifact_file_path"] = str(npz_file.relative_to(self.base_dir.parent.parent))
        metadata["artifact_checksum_sha256"] = checksum

        # Write metadata sidecar
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        # Write CSV export
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            header = ["epoch_id", "trial_id", "subject_id", "label"] + feature_names
            writer.writerow(header)
            for row_idx, vec in enumerate(vectors):
                row = [
                    vec.epoch_id,
                    vec.trial_id,
                    vec.subject_id,
                    vec.label.value,
                ] + [f"{matrix[row_idx, col_idx]:.6e}" for col_idx in range(n_features)]
                writer.writerow(row)

        logger.info("Saved feature artifact %s (SHA-256: %s)", npz_file.name, checksum[:12])
        return npz_file, checksum

    def load_feature_matrix(self, feature_set_id: str) -> dict[str, np.ndarray]:
        """Load compressed NPZ feature artifact."""
        npz_file = self._resolve_safe_path(feature_set_id, ".npz")
        if not npz_file.is_file():
            raise FileNotFoundError(f"Feature artifact not found: {npz_file}")
        return dict(np.load(str(npz_file), allow_pickle=False))

    def load_metadata(self, feature_set_id: str) -> dict[str, Any]:
        """Load JSON metadata sidecar."""
        meta_file = self._resolve_safe_path(feature_set_id, ".meta.json")
        if not meta_file.is_file():
            raise FileNotFoundError(f"Feature metadata sidecar not found: {meta_file}")
        with open(meta_file, encoding="utf-8") as f:
            return json.load(f)

    def get_csv_export_path(self, feature_set_id: str) -> Path:
        """Get path to exported CSV file."""
        csv_file = self._resolve_safe_path(feature_set_id, ".csv")
        if not csv_file.is_file():
            raise FileNotFoundError(f"Feature CSV export not found: {csv_file}")
        return csv_file
