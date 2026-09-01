"""Storage and artifact management for MNE Epochs and metadata sidecars."""

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import mne

logger = logging.getLogger(__name__)


class EpochStorage:
    """Manages content-addressed MNE Epochs FIF files and JSON metadata sidecars."""

    def __init__(self, base_dir: Path | str | None = None) -> None:
        if base_dir is None:
            # Default to data/epochs in repo root
            current = Path(__file__).resolve()
            repo_root = current.parents[4]
            self.base_dir = repo_root / "data" / "epochs"
        else:
            self.base_dir = Path(base_dir).resolve()

        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, epoch_set_id: str, suffix: str) -> Path:
        """Resolve file path and guard strictly against directory traversal."""
        safe_id = Path(epoch_set_id).name
        if ".." in safe_id or "/" in safe_id or "\\" in safe_id:
            raise ValueError(f"Illegal identifier: {epoch_set_id}")
        return (self.base_dir / f"{safe_id}{suffix}").resolve()

    def exists(self, epoch_set_id: str) -> bool:
        """Check if both FIF artifact and metadata sidecar exist on disk."""
        fif_file = self._resolve_safe_path(epoch_set_id, "_epo.fif")
        meta_file = self._resolve_safe_path(epoch_set_id, ".meta.json")
        return fif_file.is_file() and meta_file.is_file()

    def compute_sha256(self, file_path: Path) -> str:
        """Compute streaming SHA-256 hash of a file."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    def save_epochs(
        self,
        epochs: mne.Epochs,
        epoch_set_id: str,
        metadata: dict[str, Any],
    ) -> tuple[Path, str]:
        """Save MNE Epochs object to FIF and write metadata sidecar."""
        fif_file = self._resolve_safe_path(epoch_set_id, "_epo.fif")
        meta_file = self._resolve_safe_path(epoch_set_id, ".meta.json")

        epochs.save(str(fif_file), overwrite=True, verbose=False)
        checksum = self.compute_sha256(fif_file)

        metadata["artifact_file_path"] = str(fif_file.relative_to(self.base_dir.parent.parent))
        metadata["artifact_checksum_sha256"] = checksum

        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        logger.info("Saved epoch artifact %s (SHA-256: %s)", fif_file.name, checksum[:12])
        return fif_file, checksum

    def load_epochs(self, epoch_set_id: str) -> mne.Epochs:
        """Load MNE Epochs artifact from disk."""
        fif_file = self._resolve_safe_path(epoch_set_id, "_epo.fif")
        if not fif_file.is_file():
            raise FileNotFoundError(f"Epoch artifact not found: {fif_file}")
        return mne.read_epochs(str(fif_file), preload=True, verbose=False)

    def load_metadata(self, epoch_set_id: str) -> dict[str, Any]:
        """Load JSON metadata sidecar."""
        meta_file = self._resolve_safe_path(epoch_set_id, ".meta.json")
        if not meta_file.is_file():
            raise FileNotFoundError(f"Epoch metadata sidecar not found: {meta_file}")
        with open(meta_file, encoding="utf-8") as f:
            return json.load(f)
