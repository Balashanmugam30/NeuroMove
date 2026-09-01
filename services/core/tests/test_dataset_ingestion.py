"""Unit and integration test suite for Public EEG Dataset Ingestion & Research Workspace."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from neuromove.analysis.models import BandPowerRequest, PSDRequest
from neuromove.analysis.service import EEGAnalysisService
from neuromove.api.app import app
from neuromove.datasets.models import (
    DatasetCacheStatus,
    EventMappingStatus,
)
from neuromove.datasets.provider import PhysioNetEEGBCIProvider
from neuromove.datasets.registry import DatasetRegistry
from neuromove.datasets.service import DatasetService
from neuromove.datasets.storage import DatasetStorage


@pytest.fixture
def temp_storage(tmp_path: Path) -> DatasetStorage:
    """Create isolated temporary storage for testing."""
    return DatasetStorage(base_data_dir=tmp_path)


@pytest.fixture
def dataset_service(temp_storage: DatasetStorage) -> DatasetService:
    """Create isolated dataset service."""
    registry = DatasetRegistry()
    return DatasetService(registry=registry, storage=temp_storage)


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient."""
    return TestClient(app)


class TestDatasetStorage:
    """Tests for dataset storage security and integrity."""

    def test_safe_path_resolution(self, temp_storage: DatasetStorage) -> None:
        """Test safe path resolution within cache directory."""
        path = temp_storage.resolve_safe_path("physionet/S001/S001R04.edf", category="cache")
        assert path.parent.name == "S001"
        assert str(temp_storage.cache_dir) in str(path)

    def test_path_traversal_prevention(self, temp_storage: DatasetStorage) -> None:
        """Test that directory traversal attempts raise ValueError."""
        with pytest.raises(ValueError, match="Security violation"):
            temp_storage.resolve_safe_path("../../etc/passwd", category="cache")

    def test_sha256_calculation(self, tmp_path: Path) -> None:
        """Test SHA-256 calculation on known bytes."""
        test_file = tmp_path / "sample.bin"
        test_file.write_bytes(b"NeuroMove Research Grade EEG")
        checksum = DatasetStorage.calculate_sha256(test_file)
        assert len(checksum) == 64
        # Deterministic check
        assert DatasetStorage().verify_file_checksum(test_file, checksum)
        assert not DatasetStorage().verify_file_checksum(test_file, "wrong_hash")


class TestDatasetRegistryAndProvider:
    """Tests for dataset registry and provider metadata extraction."""

    def test_registry_registration(self) -> None:
        """Verify registry contains default PhysioNet EEGBCI provider."""
        reg = DatasetRegistry()
        assert reg.is_registered("physionet-eegbci")
        defn = reg.get_provider("physionet-eegbci").get_definition()
        assert defn.dataset_id == "physionet-eegbci"
        assert "PhysioNet" in defn.name
        assert defn.modality.startswith("EEG")
        assert "Open Data Commons" in defn.license

    def test_eegbci_subject_discovery(self) -> None:
        """Verify 109 subjects can be enumerated."""
        provider = PhysioNetEEGBCIProvider(total_subjects=109)
        subjects = provider.list_subjects()
        assert len(subjects) == 109
        assert subjects[0].subject_id == "public_subject_001"
        assert subjects[0].source_subject_id == "S001"
        assert len(subjects[0].runs) == 14

    def test_eegbci_recordings_and_events(self) -> None:
        """Verify canonical recording models and experimental event markers."""
        provider = PhysioNetEEGBCIProvider(total_subjects=5)
        recs = provider.list_recordings(subject_id="public_subject_001")
        assert len(recs) == 14

        # Run 4: Motor imagery fists
        r4 = next(r for r in recs if r.run_id == "R04")
        assert r4.task == "motor_imagery_fists"
        assert r4.sample_rate_hz == 160
        assert r4.channel_count == 64
        assert len(r4.events) > 0
        assert r4.events[0].mapping_status == EventMappingStatus.EXACT
        assert r4.events[0].neuromove_event_type in ("LEFT_IMAGERY", "RIGHT_IMAGERY")


class TestDatasetService:
    """Tests for dataset download, indexing, and replay extraction."""

    def test_download_and_verify(self, dataset_service: DatasetService) -> None:
        """Test downloading a run fixture and verifying checksum."""
        downloaded = dataset_service.download_recordings(
            dataset_id="physionet-eegbci",
            subject_ids=["public_subject_001"],
            run_ids=["R04"],
        )
        assert len(downloaded) == 1
        rec = downloaded[0]
        assert rec.recording_id == "rec_eegbci_S001_R04"
        assert rec.cache_status == DatasetCacheStatus.VERIFIED
        assert rec.checksum_sha256 != "0" * 64

        # Check verification report
        res = dataset_service.verify_dataset("physionet-eegbci")
        assert res["dataset_id"] == "physionet-eegbci"

    def test_get_signal_replay(self, dataset_service: DatasetService) -> None:
        """Test signal snippet extraction for interactive replay."""
        sig_res = dataset_service.get_signal(
            dataset_id="physionet-eegbci",
            recording_id="rec_eegbci_S001_R04",
            channels=["C3", "Cz", "C4"],
            start_sec=0.0,
            duration_sec=4.0,
        )
        assert sig_res.recording_id == "rec_eegbci_S001_R04"
        assert sig_res.sampling_rate_hz == 160
        assert "C3" in sig_res.signals
        assert len(sig_res.signals["C3"]) == 640  # 4 sec * 160 Hz
        assert len(sig_res.timestamps) == 640

    def test_manifest_generation(self, dataset_service: DatasetService) -> None:
        """Test dataset provenance manifest."""
        manifest = dataset_service.get_manifest("physionet-eegbci")
        assert manifest.dataset_id == "physionet-eegbci"
        assert manifest.ingestion_version == "EEG_DATASET_INGESTION_V1"
        assert manifest.source["provider"] == "PhysioNet / MNE-Python"

    def test_quality_report(self, dataset_service: DatasetService) -> None:
        """Test dataset quality report."""
        report = dataset_service.get_quality_report("physionet-eegbci")
        assert report.dataset_id == "physionet-eegbci"
        assert report.overall_status == "EXCELLENT"


class TestAnalysisWithRecordedEEG:
    """Tests for Phase 07 analysis compatibility with Phase 08 recorded EEG."""

    def test_psd_on_recorded_eeg(self) -> None:
        """Test computing PSD from recorded EEG run with 160 Hz sample rate."""
        analysis_srv = EEGAnalysisService()
        req = PSDRequest(
            dataset_id="physionet-eegbci",
            recording_id="rec_eegbci_S001_R04",
            channels=["C3", "Cz", "C4"],
            fmin=1.0,
            fmax=40.0,
            window_duration_seconds=4.0,
        )
        res = analysis_srv.compute_psd(req)
        assert res.metadata.sampling_rate_hz == 160
        assert res.metadata.source_kind == "RECORDED"
        assert res.metadata.mode == "REPLAY"
        assert "C3" in res.psd_by_channel
        assert len(res.frequencies) > 0
        assert res.frequencies[-1] <= 80.0  # Respects Nyquist

    def test_band_power_on_recorded_eeg(self) -> None:
        """Test computing frequency band powers on recorded EEG."""
        analysis_srv = EEGAnalysisService()
        req = BandPowerRequest(
            dataset_id="physionet-eegbci",
            recording_id="rec_eegbci_S001_R04",
            channels=["C3", "Cz", "C4"],
            window_duration_seconds=4.0,
        )
        res = analysis_srv.compute_band_power(req)
        assert res.metadata.sampling_rate_hz == 160
        assert res.metadata.source_kind == "RECORDED"
        assert "C3" in res.bands_by_channel
        bands = list(res.bands_by_channel["C3"].keys())
        assert "mu" in bands
        assert "beta" in bands


class TestDatasetAPIEndpoints:
    """Integration tests for FastAPI /api/datasets routes."""

    def test_api_list_datasets(self, client: TestClient) -> None:
        """Test GET /api/datasets."""
        res = client.get("/api/datasets")
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1
        assert data[0]["dataset_id"] == "physionet-eegbci"

    def test_api_get_dataset_details(self, client: TestClient) -> None:
        """Test GET /api/datasets/physionet-eegbci."""
        res = client.get("/api/datasets/physionet-eegbci")
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "PhysioNet EEG Motor Movement/Imagery Dataset"
        assert data["modality"] == "EEG (64-channel 10-10 montage, 160 Hz)"

    def test_api_list_subjects(self, client: TestClient) -> None:
        """Test GET /api/datasets/physionet-eegbci/subjects."""
        res = client.get("/api/datasets/physionet-eegbci/subjects")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 109

    def test_api_list_recordings(self, client: TestClient) -> None:
        """Test GET /api/datasets/physionet-eegbci/recordings."""
        res = client.get("/api/datasets/physionet-eegbci/recordings?subject_id=public_subject_001")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 14

    def test_api_get_recording_signal(self, client: TestClient) -> None:
        """Test GET /api/datasets/physionet-eegbci/recordings/rec_eegbci_S001_R04/signal."""
        res = client.get(
            "/api/datasets/physionet-eegbci/recordings/rec_eegbci_S001_R04/signal?channels=C3,Cz,C4"
        )
        assert res.status_code == 200
        data = res.json()
        assert data["recording_id"] == "rec_eegbci_S001_R04"
        assert data["sampling_rate_hz"] == 160
        assert "C3" in data["signals"]

    def test_api_download_and_verify(self, client: TestClient) -> None:
        """Test POST download and verify endpoints."""
        res = client.post(
            "/api/datasets/physionet-eegbci/download",
            json={"subject_ids": ["public_subject_001"], "run_ids": ["R04"]},
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1

        v_res = client.post("/api/datasets/physionet-eegbci/verify", json={})
        assert v_res.status_code == 200
        assert v_res.json()["dataset_id"] == "physionet-eegbci"

    def test_api_manifest_and_quality(self, client: TestClient) -> None:
        """Test manifest and quality report endpoints."""
        m_res = client.get("/api/datasets/physionet-eegbci/manifest")
        assert m_res.status_code == 200
        assert m_res.json()["dataset_id"] == "physionet-eegbci"

        q_res = client.get("/api/datasets/physionet-eegbci/quality-report")
        assert q_res.status_code == 200
        assert q_res.json()["overall_status"] == "EXCELLENT"
