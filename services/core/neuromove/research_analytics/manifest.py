"""NeuroMove — Phase 22 Experiment Manifest & Provenance Hashing Manager."""

from __future__ import annotations

import copy
import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from neuromove.research_analytics.models import ExperimentManifest

logger = logging.getLogger(__name__)


class ExperimentManifestManager:
    """Manages immutable, deterministically serialized, SHA-256 hashed experiment manifests."""

    @staticmethod
    def canonicalize(manifest_data: dict[str, Any]) -> str:
        """Deterministically serialize manifest dictionary to sorted-keys, compact JSON."""
        # Strip volatile instance metadata before hashing
        data_to_hash = copy.deepcopy(manifest_data)
        data_to_hash.pop("manifest_id", None)
        data_to_hash.pop("experiment_id", None)
        data_to_hash.pop("created_at", None)
        data_to_hash.pop("sealed_at", None)
        data_to_hash.pop("manifest_hash", None)

        return json.dumps(data_to_hash, sort_keys=True, separators=(",", ":"))

    @classmethod
    def compute_hash(cls, manifest_data: dict[str, Any]) -> str:
        """Compute SHA-256 digest of canonicalized manifest data."""
        canonical_str = cls.canonicalize(manifest_data)
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    @classmethod
    def create_manifest(
        cls,
        experiment_id: str,
        source_session_ids: list[str] | None = None,
        source_checksums: dict[str, str] | None = None,
        channel_names: list[str] | None = None,
        sampling_rate: float = 250.0,
        montage: str = "10-20 International",
        dsp_config: dict[str, Any] | None = None,
        epoch_config: dict[str, Any] | None = None,
        feature_config: dict[str, Any] | None = None,
        csp_config: dict[str, Any] | None = None,
        model_id: str = "lda_csp_mi_v1",
        model_version: str = "1.0.0",
        personalization_profile: dict[str, Any] | None = None,
        adaptation_state: dict[str, Any] | None = None,
        confidence_policy: dict[str, Any] | None = None,
        intent_policy: dict[str, Any] | None = None,
        safety_policy: dict[str, Any] | None = None,
        hil_profile: dict[str, Any] | None = None,
        seed: int = 42,
        numerical_tolerances: dict[str, float] | None = None,
        analysis_parameters: dict[str, Any] | None = None,
    ) -> ExperimentManifest:
        """Create a fresh draft manifest and calculate its initial SHA-256 digest."""
        manifest_id = f"man_{uuid.uuid4().hex[:12]}"
        created_at = datetime.now(UTC).isoformat()

        manifest_dict: dict[str, Any] = {
            "manifest_id": manifest_id,
            "experiment_id": experiment_id,
            "app_version": "0.1.0",
            "git_commit": "63c8584",
            "source_session_ids": source_session_ids or ["sess_replay_fixture_01"],
            "source_checksums": source_checksums or {"sess_replay_fixture_01": "a1b2c3d4e5f67890"},
            "channel_names": channel_names or ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"],
            "sampling_rate": sampling_rate,
            "montage": montage,
            "clock_config": {"enforce_monotonicity": True, "max_drift_ppm": 200.0},
            "qc_config": {"flatline_threshold_uv": 0.05, "saturation_threshold_uv": 450.0},
            "dsp_config": dsp_config
            or {"filter_type": "butterworth", "lowcut": 8.0, "highcut": 30.0, "order": 4},
            "epoch_config": epoch_config
            or {"window_sec": 1.0, "step_sec": 0.1, "baseline_sec": 0.5},
            "feature_config": feature_config
            or {"bands": {"mu": [8, 12], "beta": [16, 24]}},
            "csp_config": csp_config
            or {"n_components": 4, "log_power": True},
            "model_id": model_id,
            "model_version": model_version,
            "personalization_profile": personalization_profile or {"enabled": True, "method": "EM_MAP"},
            "adaptation_state": adaptation_state or {"enabled": True, "lr": 0.01},
            "confidence_policy": confidence_policy
            or {"type": "TEMPORAL_CONFIRMATION", "threshold": 0.80, "window_samples": 3},
            "intent_policy": intent_policy
            or {"persistence_ms": 300, "expiration_ms": 2000},
            "safety_policy": safety_policy
            or {"pre_flight_authorization": True, "strict_non_actuation": True},
            "hil_profile": hil_profile
            or {"target": "ESP32_EMULATOR_VIRTUAL", "timeout_ms": 250},
            "seed": seed,
            "numerical_tolerances": numerical_tolerances
            or {"abs_tol": 1e-5, "rel_tol": 1e-4},
            "analysis_parameters": analysis_parameters or {},
            "export_version": "1.0.0",
            "is_sealed": False,
            "created_at": created_at,
        }

        manifest_hash = cls.compute_hash(manifest_dict)
        manifest_dict["manifest_hash"] = manifest_hash

        return ExperimentManifest(**manifest_dict)

    @classmethod
    def seal_manifest(cls, manifest: ExperimentManifest) -> ExperimentManifest:
        """Seal an experiment manifest, freezing its parameters and recording timestamp."""
        if manifest.is_sealed:
            return manifest

        manifest_dict = manifest.model_dump()
        manifest_dict["is_sealed"] = True
        manifest_dict["sealed_at"] = datetime.now(UTC).isoformat()
        manifest_dict["manifest_hash"] = cls.compute_hash(manifest_dict)

        return ExperimentManifest(**manifest_dict)

    @classmethod
    def verify_manifest_integrity(cls, manifest: ExperimentManifest) -> bool:
        """Verify that manifest contents match its recorded SHA-256 hash."""
        manifest_dict = manifest.model_dump()
        recorded_hash = manifest_dict.get("manifest_hash", "")
        calculated_hash = cls.compute_hash(manifest_dict)
        return recorded_hash == calculated_hash

    @classmethod
    def create_child_manifest(
        cls,
        parent_manifest: ExperimentManifest,
        child_experiment_id: str,
        delta_config: dict[str, Any],
    ) -> tuple[ExperimentManifest, dict[str, Any]]:
        """Create a child manifest from parent with explicit parameter deltas.
        Never mutates the parent manifest.
        """
        child_dict = copy.deepcopy(parent_manifest.model_dump())
        child_dict["manifest_id"] = f"man_{uuid.uuid4().hex[:12]}"
        child_dict["experiment_id"] = child_experiment_id
        child_dict["is_sealed"] = False
        child_dict["sealed_at"] = None
        child_dict["created_at"] = datetime.now(UTC).isoformat()

        # Apply parameter delta updates
        applied_deltas: dict[str, Any] = {}
        for key, value in delta_config.items():
            if key in child_dict:
                applied_deltas[key] = {
                    "original": child_dict[key],
                    "updated": value,
                }
                child_dict[key] = value

        child_dict["manifest_hash"] = cls.compute_hash(child_dict)
        return ExperimentManifest(**child_dict), applied_deltas
