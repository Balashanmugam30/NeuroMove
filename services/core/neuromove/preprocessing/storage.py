"""Managed local artifact storage and path security for preprocessed EEG.

Ensures strict path-traversal protection and content-addressed SHA-256 artifacts.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import mne


class PreprocessingStorage:
    """Safe manager for preprocessed EEG artifacts and metadata sidecars."""

    def __init__(self, base_dir: Path | str | None = None) -> None:
        if base_dir is None:
            # Defaults to data/processed at repository root
            root_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
            self.base_dir = root_dir / "data" / "processed"
        else:
            self.base_dir = Path(base_dir).resolve()

        self.base_dir.mkdir(parents=True, exist_ok=True)

    def resolve_safe_path(self, relative_path: str) -> Path:
        """Resolve a relative path ensuring it cannot escape base_dir."""
        # Sanitize against path traversal
        clean_rel = Path(relative_path)
        if clean_rel.is_absolute() or ".." in clean_rel.parts:
            raise ValueError(f"Path traversal detected in relative path: {relative_path}")

        target_path = (self.base_dir / clean_rel).resolve()
        if not target_path.is_relative_to(self.base_dir):
            raise ValueError(f"Resolved path escapes base directory: {target_path}")

        return target_path

    def compute_file_sha256(self, file_path: Path) -> str:
        """Compute SHA-256 checksum of a file in chunks."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    def save_processed_raw(
        self,
        raw: mne.io.BaseRaw,
        result_id: str,
        metadata: dict[str, Any],
    ) -> tuple[Path, str]:
        """Save MNE Raw object as standard .fif and metadata sidecar .json."""
        fif_filename = f"{result_id}_raw.fif"
        meta_filename = f"{result_id}_meta.json"

        fif_path = self.resolve_safe_path(fif_filename)
        meta_path = self.resolve_safe_path(meta_filename)

        # Save FIF with overwrite=True
        raw.save(str(fif_path), overwrite=True, verbose=False)

        # Compute checksum of the saved FIF
        checksum = self.compute_file_sha256(fif_path)
        metadata["artifact_checksum_sha256"] = checksum
        metadata["artifact_file_path"] = str(fif_path.relative_to(self.base_dir.parent.parent))

        # Save metadata sidecar
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, default=str)

        return fif_path, checksum

    def load_processed_raw(self, result_id: str) -> mne.io.BaseRaw:
        """Load preprocessed MNE Raw instance from disk."""
        fif_filename = f"{result_id}_raw.fif"
        fif_path = self.resolve_safe_path(fif_filename)
        if not fif_path.exists():
            raise FileNotFoundError(f"Processed artifact not found: {fif_path}")

        return mne.io.read_raw_fif(str(fif_path), preload=True, verbose=False)

    def load_metadata(self, result_id: str) -> dict[str, Any]:
        """Load sidecar metadata for a preprocessed result."""
        meta_filename = f"{result_id}_meta.json"
        meta_path = self.resolve_safe_path(meta_filename)
        if not meta_path.exists():
            raise FileNotFoundError(f"Processed metadata not found: {meta_path}")

        with open(meta_path, encoding="utf-8") as f:
            return json.load(f)

    def exists(self, result_id: str) -> bool:
        """Check if preprocessed artifact and metadata exist."""
        fif_path = self.base_dir / f"{result_id}_raw.fif"
        meta_path = self.base_dir / f"{result_id}_meta.json"
        return fif_path.exists() and meta_path.exists()
