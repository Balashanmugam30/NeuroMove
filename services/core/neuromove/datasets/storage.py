"""Storage management, safe path resolution, and SHA-256 integrity verification."""

import hashlib
import logging
from pathlib import Path
from typing import BinaryIO

logger = logging.getLogger("neuromove.datasets.storage")


class DatasetStorage:
    """Manages local storage boundaries, checksum calculations, and file security."""

    def __init__(self, base_data_dir: Path | None = None) -> None:
        if base_data_dir is None:
            # Find repository root (3 levels up from this file)
            repo_root = Path(__file__).resolve().parents[4]
            self.base_data_dir = repo_root / "data"
        else:
            self.base_data_dir = base_data_dir

        self.cache_dir = self.base_data_dir / "cache"
        self.manifests_dir = self.base_data_dir / "manifests"
        self.metadata_dir = self.base_data_dir / "metadata"
        self.fixtures_dir = self.base_data_dir / "fixtures"

        self._ensure_directories()

    def _ensure_directories(self) -> None:
        """Create standard data directories."""
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.manifests_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_dir.mkdir(parents=True, exist_ok=True)
        self.fixtures_dir.mkdir(parents=True, exist_ok=True)

    def resolve_safe_path(self, relative_path: str, category: str = "cache") -> Path:
        """Resolve a path safely within the managed category directory, preventing directory traversal.

        Raises ValueError if the path attempts to escape the root.
        """
        # Strip leading slashes
        clean_rel = relative_path.lstrip("/\\")

        if category == "cache":
            target_root = self.cache_dir
        elif category == "manifests":
            target_root = self.manifests_dir
        elif category == "metadata":
            target_root = self.metadata_dir
        elif category == "fixtures":
            target_root = self.fixtures_dir
        else:
            target_root = self.base_data_dir

        resolved = (target_root / clean_rel).resolve()

        # Check traversal
        try:
            resolved.relative_to(target_root.resolve())
        except ValueError as exc:
            logger.error("Path traversal attempt detected: %s", relative_path)
            raise ValueError(
                f"Security violation: path '{relative_path}' is outside managed directory '{target_root}'"
            ) from exc

        return resolved

    @staticmethod
    def calculate_sha256(file_path: Path, chunk_size: int = 65536) -> str:
        """Compute SHA-256 checksum of a file in chunks."""
        if not file_path.exists():
            raise FileNotFoundError(f"File not found for checksum: {file_path}")

        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(chunk_size):
                hasher.update(chunk)
        return hasher.hexdigest()

    @staticmethod
    def calculate_sha256_stream(stream: BinaryIO, chunk_size: int = 65536) -> str:
        """Compute SHA-256 checksum from a readable binary stream."""
        hasher = hashlib.sha256()
        while chunk := stream.read(chunk_size):
            hasher.update(chunk)
        return hasher.hexdigest()

    def verify_file_checksum(self, file_path: Path, expected_sha256: str) -> bool:
        """Verify if a file matches the expected SHA-256."""
        if not file_path.exists():
            return False
        computed = self.calculate_sha256(file_path)
        return computed.lower() == expected_sha256.lower()


default_storage = DatasetStorage()
