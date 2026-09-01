"""High-level orchestration service for Motor-Imagery Epoching & Feature Extraction."""

import datetime
import hashlib
import json
import logging
import platform
import sqlite3
from typing import Any

import mne
import numpy as np

from neuromove.analysis.models import EEGSourceKind
from neuromove.database.connection import DatabaseManager, default_db_manager
from neuromove.datasets.provider import PhysioNetEEGBCIProvider
from neuromove.epoching.engine import apply_epoch_segmentation, generate_epoching_preview
from neuromove.epoching.events import get_default_event_mapping_config
from neuromove.epoching.models import (
    EpochingConfig,
    EpochingPreview,
    EpochingRequest,
    EpochManifest,
    EpochQCStatus,
    EpochRecord,
    EpochSignalResponse,
    EpochSummary,
    EventMappingConfig,
    NormalizedLabel,
)
from neuromove.epoching.storage import EpochStorage
from neuromove.features.extractor import extract_feature_set, generate_feature_preview
from neuromove.features.models import (
    CovarianceMatrixRecord,
    CovarianceSet,
    FeatureConfig,
    FeatureExtractionRequest,
    FeatureManifest,
    FeaturePreview,
    FeatureSet,
)
from neuromove.features.storage import FeatureStorage
from neuromove.preprocessing.service import PreprocessingService

logger = logging.getLogger(__name__)


class EpochingFeatureService:
    """Orchestrates scientific Motor-Imagery epoching, feature engineering, and database lineage."""

    def __init__(
        self,
        db_manager: DatabaseManager | None = None,
        epoch_storage: EpochStorage | None = None,
        feature_storage: FeatureStorage | None = None,
        preprocessing_service: PreprocessingService | None = None,
        dataset_provider: PhysioNetEEGBCIProvider | None = None,
    ) -> None:
        self.db = db_manager or default_db_manager
        self.epoch_storage = epoch_storage or EpochStorage()
        self.feature_storage = feature_storage or FeatureStorage()
        self.preprocessing_service = preprocessing_service or PreprocessingService()
        self.dataset_provider = dataset_provider or PhysioNetEEGBCIProvider()

    def _get_software_versions(self) -> dict[str, str]:
        """Capture environment versions for scientific reproducibility."""
        return {
            "mne": mne.__version__,
            "numpy": np.__version__,
            "python": platform.python_version(),
            "os": platform.system(),
        }

    def _get_source_raw(
        self, request: EpochingRequest
    ) -> tuple[mne.io.BaseRaw, str, str, str | None, str | None]:
        """Load source MNE Raw object from synthetic generator, dataset, or preprocessed result."""
        subject_id = "subject_default"
        session_id = "session_01"
        run_id = None

        if request.preprocessing_result_id:
            # Load preprocessed FIF artifact from Phase 09
            res = self.preprocessing_service.get_result(request.preprocessing_result_id)
            if not res:
                raise FileNotFoundError(
                    f"Preprocessing result '{request.preprocessing_result_id}' not found."
                )
            raw = self.preprocessing_service.storage.load_processed_raw(
                request.preprocessing_result_id
            )
            source_id = request.preprocessing_result_id
            if res.recording_id:
                parts = res.recording_id.split("_")
                for p in parts:
                    if p.startswith("S"):
                        subject_id = f"subject_{p.replace('S', '')}"
                    if p.startswith("R"):
                        run_id = p
            return raw, source_id, subject_id, session_id, run_id

        if request.source_kind == EEGSourceKind.SYNTHETIC:
            # Synthetic 250 Hz Raw with standard motor imagery annotations
            raw = self.preprocessing_service._get_synthetic_raw(duration_sec=12.0)
            source_id = f"sim_{request.scenario_id or 'default'}"
            subject_id = "subject_simulation"
            return raw, source_id, subject_id, session_id, run_id

        # Recorded PhysioNet EDF
        recording_id = request.recording_id or "rec_eegbci_S001_R04"
        raw = self.dataset_provider.get_raw_mne(recording_id)
        source_id = f"rec_{recording_id}"
        parts = recording_id.split("_")
        for p in parts:
            if p.startswith("S"):
                subject_id = f"subject_{p.replace('S', '')}"
            if p.startswith("R"):
                run_id = p
        return raw, source_id, subject_id, session_id, run_id

    # --- Epoching Operations ---

    def preview_epoching(self, request: EpochingRequest) -> EpochingPreview:
        """Validate configuration and compute expected epoch counts."""
        raw, _, _, _, run_id = self._get_source_raw(request)
        mapping_config = request.mapping_config or get_default_event_mapping_config(
            dataset_id=request.dataset_id, run_id=run_id
        )
        return generate_epoching_preview(raw, mapping_config, request.epoch_config)

    def run_epoching(self, request: EpochingRequest) -> EpochSummary:
        """Execute motor-imagery segmentation, save MNE Epochs artifact, and index in SQLite."""
        raw, source_id, subject_id, session_id, run_id = self._get_source_raw(request)
        mapping_config = request.mapping_config or get_default_event_mapping_config(
            dataset_id=request.dataset_id, run_id=run_id
        )

        mapping_hash = mapping_config.compute_mapping_hash()
        config_hash = request.epoch_config.compute_config_hash()
        source_hash = hashlib.sha256(source_id.encode("utf-8")).hexdigest()[:12]
        epoch_set_id = f"ep_{config_hash[:8]}_{mapping_hash[:4]}_{source_hash}"

        # Check cache
        if self.epoch_storage.exists(epoch_set_id):
            cached = self.get_epoch_summary(epoch_set_id)
            if cached:
                logger.info("Returning cached epoch set: %s", epoch_set_id)
                return cached

        now_iso = datetime.datetime.now(datetime.UTC).isoformat()

        # Execute segmentation
        epochs, trials, records, qc_list, rej_counts = apply_epoch_segmentation(
            raw_input=raw,
            mapping_config=mapping_config,
            epoch_config=request.epoch_config,
            epoch_set_id=epoch_set_id,
            subject_id=subject_id,
            session_id=session_id,
            run_id=run_id,
            now_iso=now_iso,
        )

        # Count labels and valid epochs
        valid_epochs = sum(1 for r in records if r.qc_status == EpochQCStatus.VALID)
        rejected_epochs = sum(1 for r in records if r.qc_status != EpochQCStatus.VALID)
        label_dist: dict[str, int] = {}
        for r in records:
            if r.qc_status == EpochQCStatus.VALID:
                label_dist[r.label.value] = label_dist.get(r.label.value, 0) + 1

        software_versions = self._get_software_versions()

        metadata_dict = {
            "epoch_set_id": epoch_set_id,
            "epoching_version": request.epoch_config.epoching_version,
            "config_hash": config_hash,
            "source_kind": request.source_kind.value,
            "dataset_id": request.dataset_id,
            "recording_id": request.recording_id,
            "scenario_id": request.scenario_id,
            "preprocessing_result_id": request.preprocessing_result_id,
            "subject_id": subject_id,
            "session_id": session_id,
            "run_id": run_id,
            "sampling_rate_hz": float(raw.info["sfreq"]),
            "channels": list(raw.ch_names),
            "tmin": request.epoch_config.tmin,
            "tmax": request.epoch_config.tmax,
            "total_events": len(records),
            "mapped_events": sum(1 for r in records if r.label != NormalizedLabel.UNKNOWN),
            "valid_epochs": valid_epochs,
            "rejected_epochs": rejected_epochs,
            "rejection_counts": rej_counts,
            "label_distribution": label_dist,
            "mapping_config": mapping_config.model_dump(),
            "epoch_config": request.epoch_config.model_dump(),
            "created_at": now_iso,
            "software_versions": software_versions,
        }

        # Save FIF artifact and JSON sidecar
        fif_path, checksum = self.epoch_storage.save_epochs(epochs, epoch_set_id, metadata_dict)

        summary = EpochSummary(
            epoch_set_id=epoch_set_id,
            epoching_version=request.epoch_config.epoching_version,
            config_hash=config_hash,
            source_kind=request.source_kind,
            dataset_id=request.dataset_id,
            recording_id=request.recording_id,
            scenario_id=request.scenario_id,
            preprocessing_result_id=request.preprocessing_result_id,
            subject_id=subject_id,
            session_id=session_id,
            run_id=run_id,
            sampling_rate_hz=float(raw.info["sfreq"]),
            channel_names=list(raw.ch_names),
            tmin=request.epoch_config.tmin,
            tmax=request.epoch_config.tmax,
            total_events=len(records),
            mapped_events=sum(1 for r in records if r.label != NormalizedLabel.UNKNOWN),
            valid_epochs=valid_epochs,
            rejected_epochs=rejected_epochs,
            rejection_counts=rej_counts,
            label_distribution=label_dist,
            artifact_file_path=str(fif_path),
            artifact_checksum_sha256=checksum,
            created_at=now_iso,
        )

        # Persist in SQLite
        self._persist_epoch_set(summary, mapping_config, request.epoch_config, records)
        return summary

    def _persist_epoch_set(
        self,
        summary: EpochSummary,
        mapping: EventMappingConfig,
        config: EpochingConfig,
        records: list[EpochRecord],
    ) -> None:
        """Persist epoch summary, config, and records in SQLite."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()

            # Save mapping
            cursor.execute(
                """
                INSERT OR REPLACE INTO event_mappings (
                    mapping_id, mapping_version, dataset_id, rules_json, default_label, created_at
                ) VALUES (?, ?, ?, ?, ?, ?);
                """,
                (
                    f"map_{mapping.compute_mapping_hash()}",
                    mapping.mapping_version,
                    mapping.dataset_id,
                    json.dumps([r.model_dump() for r in mapping.rules]),
                    mapping.default_label.value,
                    summary.created_at,
                ),
            )

            # Save config
            cursor.execute(
                """
                INSERT OR REPLACE INTO epoching_configs (
                    config_hash, epoching_version, config_json, created_at
                ) VALUES (?, ?, ?, ?);
                """,
                (
                    summary.config_hash,
                    summary.epoching_version,
                    config.model_dump_json(),
                    summary.created_at,
                ),
            )

            # Save epoch set summary
            cursor.execute(
                """
                INSERT OR REPLACE INTO epoch_sets (
                    epoch_set_id, epoching_version, config_hash, source_kind,
                    dataset_id, recording_id, scenario_id, preprocessing_result_id,
                    subject_id, session_id, run_id,
                    sampling_rate_hz, channels_json, tmin, tmax,
                    total_events, mapped_events, valid_epochs, rejected_epochs,
                    rejection_counts_json, label_distribution_json,
                    artifact_file_path, artifact_checksum_sha256, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    summary.epoch_set_id,
                    summary.epoching_version,
                    summary.config_hash,
                    summary.source_kind.value,
                    summary.dataset_id,
                    summary.recording_id,
                    summary.scenario_id,
                    summary.preprocessing_result_id,
                    summary.subject_id,
                    summary.session_id,
                    summary.run_id,
                    summary.sampling_rate_hz,
                    json.dumps(summary.channel_names),
                    summary.tmin,
                    summary.tmax,
                    summary.total_events,
                    summary.mapped_events,
                    summary.valid_epochs,
                    summary.rejected_epochs,
                    json.dumps(summary.rejection_counts),
                    json.dumps(summary.label_distribution),
                    summary.artifact_file_path,
                    summary.artifact_checksum_sha256,
                    summary.created_at,
                ),
            )

            # Save epoch records
            for r in records:
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO epoch_records (
                        epoch_id, epoch_set_id, trial_id, event_id,
                        subject_id, session_id, run_id,
                        label, onset_seconds, qc_status, rejection_reason, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        r.epoch_id,
                        r.epoch_set_id,
                        r.trial_id,
                        r.event_id,
                        r.subject_id,
                        r.session_id,
                        r.run_id,
                        r.label.value,
                        r.onset_seconds,
                        r.qc_status.value,
                        r.rejection_reason,
                        r.created_at,
                    ),
                )

            conn.commit()

    def get_epoch_summary(self, epoch_set_id: str) -> EpochSummary | None:
        """Retrieve epoch set summary from database or storage sidecar."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM epoch_sets WHERE epoch_set_id = ?;", (epoch_set_id,))
            row = cursor.fetchone()
            if row:
                return EpochSummary(
                    epoch_set_id=row[0],
                    epoching_version=row[1],
                    config_hash=row[2],
                    source_kind=EEGSourceKind(row[3]),
                    dataset_id=row[4],
                    recording_id=row[5],
                    scenario_id=row[6],
                    preprocessing_result_id=row[7],
                    subject_id=row[8],
                    session_id=row[9],
                    run_id=row[10],
                    sampling_rate_hz=row[11],
                    channel_names=json.loads(row[12]),
                    tmin=row[13],
                    tmax=row[14],
                    total_events=row[15],
                    mapped_events=row[16],
                    valid_epochs=row[17],
                    rejected_epochs=row[18],
                    rejection_counts=json.loads(row[19]),
                    label_distribution=json.loads(row[20]),
                    artifact_file_path=row[21],
                    artifact_checksum_sha256=row[22],
                    created_at=row[23],
                )

        if self.epoch_storage.exists(epoch_set_id):
            meta = self.epoch_storage.load_metadata(epoch_set_id)
            return EpochSummary(
                epoch_set_id=meta["epoch_set_id"],
                epoching_version=meta["epoching_version"],
                config_hash=meta["config_hash"],
                source_kind=EEGSourceKind(meta["source_kind"]),
                dataset_id=meta.get("dataset_id"),
                recording_id=meta.get("recording_id"),
                scenario_id=meta.get("scenario_id"),
                preprocessing_result_id=meta.get("preprocessing_result_id"),
                subject_id=meta.get("subject_id"),
                session_id=meta.get("session_id"),
                run_id=meta.get("run_id"),
                sampling_rate_hz=meta["sampling_rate_hz"],
                channel_names=meta["channels"],
                tmin=meta["tmin"],
                tmax=meta["tmax"],
                total_events=meta["total_events"],
                mapped_events=meta["mapped_events"],
                valid_epochs=meta["valid_epochs"],
                rejected_epochs=meta["rejected_epochs"],
                rejection_counts=meta.get("rejection_counts", {}),
                label_distribution=meta.get("label_distribution", {}),
                artifact_file_path=meta["artifact_file_path"],
                artifact_checksum_sha256=meta["artifact_checksum_sha256"],
                created_at=meta["created_at"],
            )
        return None

    def list_epoch_sets(self, limit: int = 50) -> list[EpochSummary]:
        """List recently extracted epoch sets."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        results: list[EpochSummary] = []
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT epoch_set_id FROM epoch_sets ORDER BY created_at DESC LIMIT ?;", (limit,)
            )
            rows = cursor.fetchall()
            for r in rows:
                summary = self.get_epoch_summary(r[0])
                if summary:
                    results.append(summary)
        return results

    def list_epoch_records(self, epoch_set_id: str, limit: int = 100) -> list[EpochRecord]:
        """Retrieve individual epoch records for an epoch set."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        records: list[EpochRecord] = []
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT epoch_id, epoch_set_id, trial_id, event_id, subject_id,
                       session_id, run_id, label, onset_seconds, qc_status, rejection_reason, created_at
                FROM epoch_records
                WHERE epoch_set_id = ?
                ORDER BY onset_seconds ASC
                LIMIT ?;
                """,
                (epoch_set_id, limit),
            )
            rows = cursor.fetchall()
            for r in rows:
                records.append(
                    EpochRecord(
                        epoch_id=r[0],
                        epoch_set_id=r[1],
                        trial_id=r[2],
                        event_id=r[3],
                        subject_id=r[4],
                        session_id=r[5],
                        run_id=r[6],
                        label=NormalizedLabel(r[7]),
                        onset_seconds=r[8],
                        qc_status=EpochQCStatus(r[9]),
                        rejection_reason=r[10],
                        created_at=r[11],
                    )
                )
        return records

    def get_epoch_signal(self, epoch_set_id: str, epoch_id: str) -> EpochSignalResponse:
        """Extract time-series slice for an individual epoch waveform."""
        epochs = self.epoch_storage.load_epochs(epoch_set_id)
        meta = self.epoch_storage.load_metadata(epoch_set_id)
        records = self.list_epoch_records(epoch_set_id)

        target_rec = next((r for r in records if r.epoch_id == epoch_id), None)
        if not target_rec:
            raise FileNotFoundError(f"Epoch record '{epoch_id}' not found in set '{epoch_set_id}'.")

        # Find index among valid epochs
        valid_records = [r for r in records if r.qc_status == EpochQCStatus.VALID]
        epoch_idx = next((i for i, r in enumerate(valid_records) if r.epoch_id == epoch_id), 0)

        data = epochs.get_data()
        if epoch_idx >= len(data):
            epoch_idx = 0

        ep_slice = data[epoch_idx]  # Shape: (n_channels, n_times) in Volts
        times = epochs.times.tolist()
        channels = list(epochs.ch_names)

        signals = {
            ch: (ep_slice[i, :] * 1e6).tolist()
            for i, ch in enumerate(channels)
            if i < 8  # Limit channels for responsive UI
        }

        return EpochSignalResponse(
            epoch_id=epoch_id,
            trial_id=target_rec.trial_id,
            label=target_rec.label,
            sampling_rate_hz=float(epochs.info["sfreq"]),
            channels=list(signals.keys()),
            time_points=times,
            signals=signals,
            cue_onset_relative_seconds=0.0,
            baseline_window=meta["epoch_config"].get("baseline"),
            analysis_window=meta["epoch_config"].get("analysis_window", [0.5, 4.0]),
            qc_status=target_rec.qc_status,
        )

    def get_epoch_manifest(self, epoch_set_id: str) -> EpochManifest:
        """Export complete JSON manifest for an epoch set."""
        meta = self.epoch_storage.load_metadata(epoch_set_id)
        return EpochManifest(
            epoch_set_id=meta["epoch_set_id"],
            epoching_version=meta["epoching_version"],
            config_hash=meta["config_hash"],
            source_kind=EEGSourceKind(meta["source_kind"]),
            dataset_id=meta.get("dataset_id"),
            recording_id=meta.get("recording_id"),
            scenario_id=meta.get("scenario_id"),
            preprocessing_result_id=meta.get("preprocessing_result_id"),
            subject_id=meta.get("subject_id"),
            session_id=meta.get("session_id"),
            run_id=meta.get("run_id"),
            mapping_config=EventMappingConfig(**meta["mapping_config"]),
            epoch_config=EpochingConfig(**meta["epoch_config"]),
            sampling_rate_hz=meta["sampling_rate_hz"],
            channels=meta["channels"],
            tmin=meta["tmin"],
            tmax=meta["tmax"],
            total_events=meta["total_events"],
            valid_epochs=meta["valid_epochs"],
            rejected_epochs=meta["rejected_epochs"],
            rejection_counts=meta.get("rejection_counts", {}),
            label_distribution=meta.get("label_distribution", {}),
            artifact_file_path=meta["artifact_file_path"],
            artifact_checksum_sha256=meta["artifact_checksum_sha256"],
            created_at=meta["created_at"],
            software_versions=meta.get("software_versions", {}),
        )

    # --- Feature Extraction Operations ---

    def preview_features(self, request: FeatureExtractionRequest) -> FeaturePreview:
        """Validate feature parameters against epoch metadata."""
        summary = self.get_epoch_summary(request.epoch_set_id)
        if not summary:
            raise FileNotFoundError(f"Epoch set '{request.epoch_set_id}' not found.")
        return generate_feature_preview(
            epoch_count=summary.valid_epochs,
            available_channels=summary.channel_names,
            sampling_rate_hz=summary.sampling_rate_hz,
            config=request.config,
        )

    def extract_features(self, request: FeatureExtractionRequest) -> FeatureSet:
        """Extract multi-band spectral features and covariance matrices from epoch set."""
        summary = self.get_epoch_summary(request.epoch_set_id)
        if not summary:
            raise FileNotFoundError(f"Epoch set '{request.epoch_set_id}' not found.")

        epochs = self.epoch_storage.load_epochs(request.epoch_set_id)
        records = self.list_epoch_records(request.epoch_set_id)

        config_hash = request.config.compute_config_hash()
        feature_set_id = f"feat_{config_hash[:8]}_{request.epoch_set_id[3:]}"

        # Check cache
        if self.feature_storage.exists(feature_set_id):
            cached = self.get_feature_set(feature_set_id)
            if cached:
                logger.info("Returning cached feature set: %s", feature_set_id)
                return cached

        now_iso = datetime.datetime.now(datetime.UTC).isoformat()

        # Extract features and covariance tensors
        vectors, covariances, feature_names, label_dist = extract_feature_set(
            epochs=epochs,
            epoch_records=records,
            config=request.config,
        )

        subject_ids = sorted({v.subject_id for v in vectors})
        session_ids = sorted({v.session_id for v in vectors if v.session_id})
        run_ids = sorted({v.run_id for v in vectors if v.run_id})
        trial_ids = [v.trial_id for v in vectors]
        labels = [v.label for v in vectors]

        software_versions = self._get_software_versions()

        metadata_dict = {
            "feature_set_id": feature_set_id,
            "feature_version": request.config.feature_version,
            "config_hash": config_hash,
            "source_epoch_set_id": request.epoch_set_id,
            "source_dataset_id": summary.dataset_id,
            "recording_ids": [summary.recording_id] if summary.recording_id else [],
            "preprocessing_result_ids": [summary.preprocessing_result_id]
            if summary.preprocessing_result_id
            else [],
            "subject_ids": subject_ids,
            "session_ids": session_ids,
            "run_ids": run_ids,
            "trial_ids": trial_ids,
            "labels": [lbl.value for lbl in labels],
            "feature_names": feature_names,
            "feature_count": len(feature_names),
            "row_count": len(vectors),
            "label_distribution": label_dist,
            "feature_config": request.config.model_dump(),
            "created_at": now_iso,
            "software_versions": software_versions,
        }

        # Save NPZ, CSV, and metadata sidecar
        npz_path, checksum = self.feature_storage.save_feature_set(
            feature_set_id=feature_set_id,
            vectors=vectors,
            covariances=covariances,
            feature_names=feature_names,
            metadata=metadata_dict,
        )

        feat_set = FeatureSet(
            feature_set_id=feature_set_id,
            feature_version=request.config.feature_version,
            config_hash=config_hash,
            source_epoch_set_id=request.epoch_set_id,
            subject_ids=subject_ids,
            session_ids=session_ids,
            run_ids=run_ids,
            trial_ids=trial_ids,
            labels=labels,
            feature_names=feature_names,
            row_count=len(vectors),
            feature_count=len(feature_names),
            label_distribution=label_dist,
            artifact_file_path=str(npz_path),
            artifact_checksum_sha256=checksum,
            created_at=now_iso,
            software_versions=software_versions,
        )

        # Persist in SQLite
        self._persist_feature_set(feat_set, request.config, summary)
        return feat_set

    def _persist_feature_set(
        self,
        feat_set: FeatureSet,
        config: FeatureConfig,
        epoch_summary: EpochSummary,
    ) -> None:
        """Persist feature set, config, and data lineage in SQLite."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()

            # Save feature config
            cursor.execute(
                """
                INSERT OR REPLACE INTO feature_configs (
                    config_hash, feature_version, config_json, created_at
                ) VALUES (?, ?, ?, ?);
                """,
                (
                    feat_set.config_hash,
                    feat_set.feature_version,
                    config.model_dump_json(),
                    feat_set.created_at,
                ),
            )

            # Save feature set
            cursor.execute(
                """
                INSERT OR REPLACE INTO feature_sets (
                    feature_set_id, feature_version, config_hash, source_epoch_set_id,
                    subject_ids_json, session_ids_json, run_ids_json, trial_ids_json,
                    labels_json, feature_names_json, row_count, feature_count,
                    label_distribution_json, artifact_file_path, artifact_checksum_sha256,
                    software_versions_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    feat_set.feature_set_id,
                    feat_set.feature_version,
                    feat_set.config_hash,
                    feat_set.source_epoch_set_id,
                    json.dumps(feat_set.subject_ids),
                    json.dumps(feat_set.session_ids),
                    json.dumps(feat_set.run_ids),
                    json.dumps(feat_set.trial_ids),
                    json.dumps([lbl.value for lbl in feat_set.labels]),
                    json.dumps(feat_set.feature_names),
                    feat_set.row_count,
                    feat_set.feature_count,
                    json.dumps(feat_set.label_distribution),
                    feat_set.artifact_file_path,
                    feat_set.artifact_checksum_sha256,
                    json.dumps(feat_set.software_versions),
                    feat_set.created_at,
                ),
            )

            # Save feature lineage
            cursor.execute(
                """
                INSERT OR REPLACE INTO feature_lineage (
                    feature_set_id, epoch_set_id, preprocessing_result_id, recording_id, dataset_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?);
                """,
                (
                    feat_set.feature_set_id,
                    feat_set.source_epoch_set_id,
                    epoch_summary.preprocessing_result_id,
                    epoch_summary.recording_id,
                    epoch_summary.dataset_id,
                    feat_set.created_at,
                ),
            )

            conn.commit()

    def get_feature_set(self, feature_set_id: str) -> FeatureSet | None:
        """Retrieve feature set record from database or storage sidecar."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM feature_sets WHERE feature_set_id = ?;", (feature_set_id,)
            )
            row = cursor.fetchone()
            if row:
                return FeatureSet(
                    feature_set_id=row[0],
                    feature_version=row[1],
                    config_hash=row[2],
                    source_epoch_set_id=row[3],
                    subject_ids=json.loads(row[4]),
                    session_ids=json.loads(row[5]),
                    run_ids=json.loads(row[6]),
                    trial_ids=json.loads(row[7]),
                    labels=[NormalizedLabel(lbl_item) for lbl_item in json.loads(row[8])],
                    feature_names=json.loads(row[9]),
                    row_count=row[10],
                    feature_count=row[11],
                    label_distribution=json.loads(row[12]),
                    artifact_file_path=row[13],
                    artifact_checksum_sha256=row[14],
                    software_versions=json.loads(row[15]),
                    created_at=row[16],
                )

        if self.feature_storage.exists(feature_set_id):
            meta = self.feature_storage.load_metadata(feature_set_id)
            return FeatureSet(
                feature_set_id=meta["feature_set_id"],
                feature_version=meta["feature_version"],
                config_hash=meta["config_hash"],
                source_epoch_set_id=meta["source_epoch_set_id"],
                subject_ids=meta["subject_ids"],
                session_ids=meta.get("session_ids", []),
                run_ids=meta.get("run_ids", []),
                trial_ids=meta["trial_ids"],
                labels=[NormalizedLabel(lbl_item) for lbl_item in meta["labels"]],
                feature_names=meta["feature_names"],
                row_count=meta["row_count"],
                feature_count=meta["feature_count"],
                label_distribution=meta["label_distribution"],
                artifact_file_path=meta["artifact_file_path"],
                artifact_checksum_sha256=meta["artifact_checksum_sha256"],
                created_at=meta["created_at"],
                software_versions=meta.get("software_versions", {}),
            )
        return None

    def list_feature_sets(self, limit: int = 50) -> list[FeatureSet]:
        """List recently generated feature sets."""
        self.db.initialize_db()
        db_path = self.db.get_db_path()
        results: list[FeatureSet] = []
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT feature_set_id FROM feature_sets ORDER BY created_at DESC LIMIT ?;",
                (limit,),
            )
            rows = cursor.fetchall()
            for r in rows:
                fs = self.get_feature_set(r[0])
                if fs:
                    results.append(fs)
        return results

    def get_feature_data(self, feature_set_id: str, limit: int = 100) -> list[dict[str, Any]]:
        """Retrieve rows of feature values with grouping identifiers."""
        npz_dict = self.feature_storage.load_feature_matrix(feature_set_id)
        features = npz_dict["features"]
        names = npz_dict["feature_names"].tolist()
        labels = npz_dict["labels"].tolist()
        epoch_ids = npz_dict["epoch_ids"].tolist()
        subject_ids = npz_dict["subject_ids"].tolist()
        trial_ids = npz_dict["trial_ids"].tolist()

        rows = []
        for i in range(min(len(features), limit)):
            row_dict: dict[str, Any] = {
                "epoch_id": str(epoch_ids[i]),
                "trial_id": str(trial_ids[i]),
                "subject_id": str(subject_ids[i]),
                "label": str(labels[i]),
            }
            for j, name in enumerate(names):
                row_dict[str(name)] = round(float(features[i, j]), 6)
            rows.append(row_dict)
        return rows

    def get_covariance_set(self, feature_set_id: str) -> CovarianceSet:
        """Retrieve CSP-ready covariance matrices for a feature set."""
        meta = self.feature_storage.load_metadata(feature_set_id)
        npz_dict = self.feature_storage.load_feature_matrix(feature_set_id)
        cov_tensor = npz_dict["covariances"]  # (n_samples, n_channels, n_channels)
        labels = npz_dict["labels"].tolist()
        epoch_ids = npz_dict["epoch_ids"].tolist()

        channels = meta["feature_config"].get("channels", ["C3", "Cz", "C4"])
        records: list[CovarianceMatrixRecord] = []

        for i in range(len(cov_tensor)):
            mat = cov_tensor[i]
            records.append(
                CovarianceMatrixRecord(
                    epoch_id=str(epoch_ids[i]),
                    label=NormalizedLabel(labels[i]),
                    channels=channels,
                    matrix=mat.tolist(),
                    trace=float(np.trace(mat)),
                    is_symmetric=True,
                    is_positive_semi_definite=True,
                )
            )

        return CovarianceSet(
            covariance_set_id=f"cov_{feature_set_id[5:]}",
            epoch_set_id=meta["source_epoch_set_id"],
            channels=channels,
            shape=(cov_tensor.shape[0], cov_tensor.shape[1], cov_tensor.shape[2]),
            regularization=meta["feature_config"].get("covariance_method", "NORMALIZED"),
            matrices=records,
            artifact_file_path=meta["artifact_file_path"],
            artifact_checksum_sha256=meta["artifact_checksum_sha256"],
            created_at=meta["created_at"],
        )

    def get_feature_manifest(self, feature_set_id: str) -> FeatureManifest:
        """Export JSON reproducibility manifest for a feature set."""
        meta = self.feature_storage.load_metadata(feature_set_id)
        return FeatureManifest(
            feature_set_id=meta["feature_set_id"],
            feature_version=meta["feature_version"],
            config_hash=meta["config_hash"],
            source_epoch_set_id=meta["source_epoch_set_id"],
            source_dataset_id=meta.get("source_dataset_id"),
            subject_ids=meta["subject_ids"],
            session_ids=meta.get("session_ids", []),
            run_ids=meta.get("run_ids", []),
            recording_ids=meta.get("recording_ids", []),
            preprocessing_result_ids=meta.get("preprocessing_result_ids", []),
            feature_config=FeatureConfig(**meta["feature_config"]),
            feature_names=meta["feature_names"],
            feature_count=meta["feature_count"],
            row_count=meta["row_count"],
            label_distribution=meta["label_distribution"],
            artifact_file_path=meta["artifact_file_path"],
            artifact_checksum_sha256=meta["artifact_checksum_sha256"],
            created_at=meta["created_at"],
            software_versions=meta.get("software_versions", {}),
        )


default_epoching_feature_service = EpochingFeatureService()


def get_epoching_feature_service() -> EpochingFeatureService:
    """Dependency provider for EpochingFeatureService singleton."""
    return default_epoching_feature_service
