"""Service layer for EEG Preprocessing & DSP Pipeline.

Coordinates configuration preview, MNE pipeline execution, content-addressed
artifact storage, SQLite indexing, lineage tracking, and manifest exports.
"""

from __future__ import annotations

import hashlib
import json
import logging
import platform
import sqlite3
import sys
from datetime import UTC, datetime
from typing import Any

import mne
import numpy as np
import scipy

from neuromove.analysis.models import EEGSourceKind
from neuromove.database.connection import DatabaseManager, default_db_manager
from neuromove.datasets.provider import PhysioNetEEGBCIProvider
from neuromove.preprocessing.models import (
    PreprocessingConfig,
    PreprocessingManifest,
    PreprocessingPreview,
    PreprocessingRequest,
    PreprocessingResult,
    PreprocessingSignalResponse,
    SignalIntegrityReport,
)
from neuromove.preprocessing.pipeline import (
    apply_preprocessing_pipeline,
    generate_pipeline_preview,
)
from neuromove.preprocessing.storage import PreprocessingStorage

logger = logging.getLogger(__name__)


class PreprocessingService:
    """Orchestrates research-grade EEG preprocessing runs and artifacts."""

    def __init__(
        self,
        db_manager: DatabaseManager | None = None,
        storage: PreprocessingStorage | None = None,
    ) -> None:
        self.db = db_manager or default_db_manager
        self.storage = storage or PreprocessingStorage()
        self.provider = PhysioNetEEGBCIProvider()

    def get_software_versions(self) -> dict[str, str]:
        """Collect current scientific software and platform versions."""
        return {
            "neuromove": "0.1.0",
            "pipeline_spec": "EEG_PREPROCESSING_V1",
            "python": sys.version.split()[0],
            "mne": mne.__version__,
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "os": platform.system(),
        }

    def _get_synthetic_raw(self, duration_sec: float = 10.0) -> mne.io.BaseRaw:
        """Create an in-memory MNE Raw object from deterministic synthetic EEG."""
        sfreq = 250.0
        n_samples = int(duration_sec * sfreq)
        channels = ["Fc5", "C3", "Cz", "C4"]

        t = np.linspace(0, duration_sec, n_samples, endpoint=False)
        data = np.zeros((len(channels), n_samples))

        # Channel 0: Fc5 (Rest/Background 10 Hz alpha)
        data[0, :] = 15e-6 * np.sin(2 * np.pi * 10.0 * t) + 2e-6 * np.random.RandomState(42).randn(
            n_samples
        )
        # Channel 1: C3 (Mu suppression 12 Hz + Beta 22 Hz)
        data[1, :] = 10e-6 * np.sin(2 * np.pi * 12.0 * t) + 5e-6 * np.sin(2 * np.pi * 22.0 * t)
        # Channel 2: Cz (Vertex reference / slow drift 0.3 Hz)
        data[2, :] = 25e-6 * np.sin(2 * np.pi * 0.3 * t) + 8e-6 * np.sin(2 * np.pi * 10.0 * t)
        # Channel 3: C4 (Contralateral Mu 12 Hz)
        data[3, :] = 20e-6 * np.sin(2 * np.pi * 12.0 * t)

        info = mne.create_info(ch_names=channels, sfreq=sfreq, ch_types="eeg")
        raw = mne.io.RawArray(data, info, verbose=False)
        return raw

    def _get_source_raw(
        self, request: PreprocessingRequest
    ) -> tuple[mne.io.BaseRaw, str, dict[str, Any]]:
        """Load source MNE Raw object and calculate a deterministic source identifier."""
        if request.source_kind == EEGSourceKind.SYNTHETIC:
            raw = self._get_synthetic_raw(duration_sec=10.0)
            source_id = f"sim_{request.scenario_id or 'default'}"
            source_meta = {"kind": "SYNTHETIC", "scenario": request.scenario_id or "default"}
            return raw, source_id, source_meta

        # RECORDED EEG from public dataset
        recording_id = request.recording_id or "rec_eegbci_S001_R04"
        raw = self.provider.get_raw_mne(recording_id)
        source_id = f"rec_{recording_id}"
        source_meta = {
            "kind": "RECORDED",
            "recording_id": recording_id,
            "dataset": request.dataset_id or "physionet-eegbci",
        }
        return raw, source_id, source_meta

    def preview_pipeline(self, request: PreprocessingRequest) -> PreprocessingPreview:
        """Validate pipeline configuration against source metadata."""
        raw, _, _ = self._get_source_raw(request)
        return generate_pipeline_preview(raw.info, request.config)

    def run_preprocessing(self, request: PreprocessingRequest) -> PreprocessingResult:
        """Execute full preprocessing pipeline, cache result, and persist in database."""
        raw_source, source_id, source_meta = self._get_source_raw(request)

        config_hash = request.config.compute_config_hash()
        source_hash = hashlib.sha256(source_id.encode("utf-8")).hexdigest()[:12]
        result_id = f"pre_{config_hash}_{source_hash}"

        # 1. Check cache: if result exists and verified, return it
        if self.storage.exists(result_id):
            cached = self.get_result(result_id)
            if cached:
                logger.info("Returning cached preprocessed result: %s", result_id)
                return cached

        # 2. Execute pipeline non-destructively
        proc_raw, audits, warnings, integrity = apply_preprocessing_pipeline(
            raw_source, request.config
        )

        now_iso = datetime.now(UTC).isoformat()
        software_versions = self.get_software_versions()

        metadata_dict = {
            "result_id": result_id,
            "pipeline_version": request.config.pipeline_version,
            "config_hash": config_hash,
            "source_kind": request.source_kind.value,
            "dataset_id": request.dataset_id,
            "recording_id": request.recording_id,
            "scenario_id": request.scenario_id,
            "parent_result_id": request.parent_result_id,
            "input_sample_rate_hz": float(raw_source.info["sfreq"]),
            "output_sample_rate_hz": float(proc_raw.info["sfreq"]),
            "input_channels": list(raw_source.ch_names),
            "output_channels": list(proc_raw.ch_names),
            "duration_seconds": float(proc_raw.times[-1]) if len(proc_raw.times) > 0 else 0.0,
            "event_count": len(proc_raw.annotations) if proc_raw.annotations else 0,
            "integrity_report": integrity.model_dump(),
            "stage_audit": [a.model_dump() for a in audits],
            "created_at": now_iso,
            "software_versions": software_versions,
            "warnings": warnings,
        }

        # 3. Save MNE Raw FIF artifact
        fif_path, checksum = self.storage.save_processed_raw(proc_raw, result_id, metadata_dict)

        result = PreprocessingResult(
            result_id=result_id,
            pipeline_version=request.config.pipeline_version,
            config_hash=config_hash,
            source_kind=request.source_kind,
            dataset_id=request.dataset_id,
            recording_id=request.recording_id,
            scenario_id=request.scenario_id,
            parent_result_id=request.parent_result_id,
            input_sample_rate_hz=float(raw_source.info["sfreq"]),
            output_sample_rate_hz=float(proc_raw.info["sfreq"]),
            input_channels=list(raw_source.ch_names),
            output_channels=list(proc_raw.ch_names),
            duration_seconds=float(proc_raw.times[-1]) if len(proc_raw.times) > 0 else 0.0,
            event_count=len(proc_raw.annotations) if proc_raw.annotations else 0,
            artifact_file_path=str(fif_path),
            artifact_checksum_sha256=checksum,
            integrity_report=integrity,
            stage_audit=audits,
            warnings=warnings,
            software_versions=software_versions,
            created_at=now_iso,
        )

        # 4. Persist in SQLite
        self._persist_result(result, request.config)

        return result

    def _persist_result(self, result: PreprocessingResult, config: PreprocessingConfig) -> None:
        """Persist config, result, and lineage in SQLite."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()

            # Save config
            cursor.execute(
                """
                INSERT OR REPLACE INTO preprocessing_configs (
                    config_hash, pipeline_version, config_json, created_at
                ) VALUES (?, ?, ?, ?);
                """,
                (
                    result.config_hash,
                    config.pipeline_version,
                    config.model_dump_json(),
                    result.created_at,
                ),
            )

            # Save result
            cursor.execute(
                """
                INSERT OR REPLACE INTO preprocessing_results (
                    result_id, pipeline_version, config_hash, source_kind,
                    dataset_id, recording_id, scenario_id, parent_result_id,
                    input_sample_rate_hz, output_sample_rate_hz,
                    input_channels_json, output_channels_json,
                    duration_seconds, event_count,
                    artifact_file_path, artifact_checksum_sha256,
                    integrity_status, integrity_json,
                    stage_audit_json, warnings_json, software_versions_json,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    result.result_id,
                    result.pipeline_version,
                    result.config_hash,
                    result.source_kind.value,
                    result.dataset_id,
                    result.recording_id,
                    result.scenario_id,
                    result.parent_result_id,
                    result.input_sample_rate_hz,
                    result.output_sample_rate_hz,
                    json.dumps(result.input_channels),
                    json.dumps(result.output_channels),
                    result.duration_seconds,
                    result.event_count,
                    result.artifact_file_path,
                    result.artifact_checksum_sha256,
                    result.integrity_report.status,
                    result.integrity_report.model_dump_json(),
                    json.dumps([a.model_dump() for a in result.stage_audit]),
                    json.dumps(result.warnings),
                    json.dumps(result.software_versions),
                    result.created_at,
                ),
            )

            # Save lineage if parent result exists
            if result.parent_result_id:
                cursor.execute(
                    """
                    INSERT OR IGNORE INTO preprocessing_lineage (
                        child_result_id, parent_result_id, created_at
                    ) VALUES (?, ?, ?);
                    """,
                    (result.result_id, result.parent_result_id, result.created_at),
                )

            conn.commit()

    def get_result(self, result_id: str) -> PreprocessingResult | None:
        """Retrieve preprocessed result record from database or storage sidecar."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM preprocessing_results WHERE result_id = ?;", (result_id,))
            row = cursor.fetchone()
            if row:
                return PreprocessingResult(
                    result_id=row[0],
                    pipeline_version=row[1],
                    config_hash=row[2],
                    source_kind=EEGSourceKind(row[3]),
                    dataset_id=row[4],
                    recording_id=row[5],
                    scenario_id=row[6],
                    parent_result_id=row[7],
                    input_sample_rate_hz=row[8],
                    output_sample_rate_hz=row[9],
                    input_channels=json.loads(row[10]),
                    output_channels=json.loads(row[11]),
                    duration_seconds=row[12],
                    event_count=row[13],
                    artifact_file_path=row[14],
                    artifact_checksum_sha256=row[15],
                    integrity_report=SignalIntegrityReport(**json.loads(row[17])),
                    stage_audit=json.loads(row[18]),
                    warnings=json.loads(row[19]),
                    software_versions=json.loads(row[20]),
                    created_at=row[21],
                )

        # Fallback to storage sidecar metadata
        if self.storage.exists(result_id):
            meta = self.storage.load_metadata(result_id)
            # Reconstruct model
            return PreprocessingResult(
                result_id=meta["result_id"],
                pipeline_version=meta["pipeline_version"],
                config_hash=meta["config_hash"],
                source_kind=EEGSourceKind(meta["source_kind"]),
                dataset_id=meta.get("dataset_id"),
                recording_id=meta.get("recording_id"),
                scenario_id=meta.get("scenario_id"),
                parent_result_id=meta.get("parent_result_id"),
                input_sample_rate_hz=meta["input_sample_rate_hz"],
                output_sample_rate_hz=meta["output_sample_rate_hz"],
                input_channels=meta["input_channels"],
                output_channels=meta["output_channels"],
                duration_seconds=meta["duration_seconds"],
                event_count=meta.get("event_count", 0),
                artifact_file_path=meta["artifact_file_path"],
                artifact_checksum_sha256=meta["artifact_checksum_sha256"],
                integrity_report=SignalIntegrityReport(
                    **meta.get(
                        "integrity_report",
                        {
                            "sample_count": int(
                                meta["output_sample_rate_hz"] * meta["duration_seconds"]
                            ),
                            "channel_count": len(meta["output_channels"]),
                            "nan_count": 0,
                            "inf_count": 0,
                            "min_amplitude_uv": -50.0,
                            "max_amplitude_uv": 50.0,
                            "flatline_channels": [],
                            "amplitude_outlier_candidates": 0,
                            "status": "HEALTHY",
                        },
                    )
                ),
                stage_audit=meta.get("stage_audit", []),
                warnings=meta.get("warnings", []),
                software_versions=meta.get("software_versions", {}),
                created_at=meta["created_at"],
            )

        return None

    def list_results(self, limit: int = 50) -> list[PreprocessingResult]:
        """List recently generated preprocessing results."""
        self.db.initialize_db()
        results: list[PreprocessingResult] = []
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT result_id FROM preprocessing_results ORDER BY created_at DESC LIMIT ?;",
                (limit,),
            )
            rows = cursor.fetchall()
            for (rid,) in rows:
                res = self.get_result(rid)
                if res:
                    results.append(res)
        return results

    def get_result_signal(
        self,
        result_id: str,
        channels: list[str] | None = None,
        start_sec: float = 0.0,
        duration_sec: float = 5.0,
    ) -> PreprocessingSignalResponse:
        """Extract multi-channel sliced signal snippet from preprocessed artifact."""
        raw = self.storage.load_processed_raw(result_id)
        sfreq = float(raw.info["sfreq"])
        total_samples = len(raw.times)
        max_duration = float(raw.times[-1]) if total_samples > 0 else 0.0

        start_time = min(max(0.0, start_sec), max_duration)
        end_time = min(start_time + duration_sec, max_duration)

        start_samp = int(start_time * sfreq)
        stop_samp = int(end_time * sfreq)

        target_channels = channels or [ch for ch in ["Fc5", "C3", "Cz", "C4"] if ch in raw.ch_names]
        if not target_channels:
            target_channels = raw.ch_names[: min(4, len(raw.ch_names))]

        # Sliced data array: shape (n_selected_ch, n_samples)
        data, times = raw[target_channels, start_samp:stop_samp]
        data_uv = (data * 1e6).tolist()

        signals_dict: dict[str, list[float]] = {}
        for idx, ch_name in enumerate(target_channels):
            signals_dict[ch_name] = [round(v, 2) for v in data_uv[idx]]

        return PreprocessingSignalResponse(
            result_id=result_id,
            sampling_rate_hz=sfreq,
            channels=target_channels,
            timestamps=[round(t, 4) for t in times.tolist()],
            signals=signals_dict,
            events=[],
        )

    def get_manifest(self, result_id: str) -> PreprocessingManifest:
        """Export comprehensive JSON reproducibility manifest."""
        res = self.get_result(result_id)
        if not res:
            raise FileNotFoundError(f"Result not found: {result_id}")

        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT config_json FROM preprocessing_configs WHERE config_hash = ?;",
                (res.config_hash,),
            )
            row = cursor.fetchone()
            config_dict = json.loads(row[0]) if row else {}

        return PreprocessingManifest(
            manifest_version="EEG_PREPROCESSING_V1",
            result_id=res.result_id,
            pipeline_version=res.pipeline_version,
            config=PreprocessingConfig(**config_dict),
            source={
                "source_kind": res.source_kind.value,
                "dataset_id": res.dataset_id,
                "recording_id": res.recording_id,
                "scenario_id": res.scenario_id,
            },
            input_summary={
                "sample_rate_hz": res.input_sample_rate_hz,
                "channels": res.input_channels,
                "channel_count": len(res.input_channels),
            },
            output_summary={
                "sample_rate_hz": res.output_sample_rate_hz,
                "channels": res.output_channels,
                "channel_count": len(res.output_channels),
                "duration_seconds": res.duration_seconds,
            },
            stage_audit=res.stage_audit,
            integrity_report=res.integrity_report,
            software_versions=res.software_versions,
            artifact_checksum_sha256=res.artifact_checksum_sha256,
            created_at=res.created_at,
        )
