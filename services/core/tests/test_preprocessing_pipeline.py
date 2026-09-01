"""Comprehensive scientific test suite for EEG Preprocessing & DSP Pipeline.

Verifies filtering, notch, referencing, resampling, ICA, determinism,
raw immutability, signal integrity, path security, and REST endpoints.
"""

from __future__ import annotations

import tempfile

import mne
import numpy as np
import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import create_app
from neuromove.preprocessing.models import (
    ArtifactMethod,
    ICAFitConfig,
    NotchConfig,
    PreprocessingConfig,
    ReferenceType,
    ResampleConfig,
)
from neuromove.preprocessing.pipeline import (
    apply_preprocessing_pipeline,
    compute_signal_integrity,
    fit_ica_decomposition,
    generate_pipeline_preview,
)
from neuromove.preprocessing.storage import PreprocessingStorage


@pytest.fixture
def test_raw() -> mne.io.BaseRaw:
    """Create a 4-channel, 250 Hz synthetic EEG Raw object for testing."""
    sfreq = 250.0
    n_samples = 1250  # 5 seconds
    channels = ["Fc5", "C3", "Cz", "C4"]

    t = np.linspace(0, 5.0, n_samples, endpoint=False)
    data = np.zeros((len(channels), n_samples))
    data[0, :] = 15e-6 * np.sin(2 * np.pi * 10.0 * t) + 2e-6 * np.random.RandomState(42).randn(
        n_samples
    )
    data[1, :] = 10e-6 * np.sin(2 * np.pi * 12.0 * t) + 5e-6 * np.sin(2 * np.pi * 22.0 * t)
    data[2, :] = 25e-6 * np.sin(2 * np.pi * 0.3 * t) + 8e-6 * np.sin(2 * np.pi * 10.0 * t)
    data[3, :] = 20e-6 * np.sin(2 * np.pi * 12.0 * t)

    info = mne.create_info(ch_names=channels, sfreq=sfreq, ch_types="eeg")
    raw = mne.io.RawArray(data, info, verbose=False)
    return raw


class TestFilterValidationAndPreview:
    """Tests for parameter validation and pipeline execution planning."""

    def test_valid_preview(self, test_raw: mne.io.BaseRaw) -> None:
        config = PreprocessingConfig(
            highpass_hz=0.5,
            lowpass_hz=40.0,
            reference_type=ReferenceType.AVERAGE,
            notch=NotchConfig(enabled=False),
            resample=ResampleConfig(enabled=False),
        )
        preview = generate_pipeline_preview(test_raw.info, config)
        assert preview.valid is True
        assert len(preview.errors) == 0
        assert preview.input_sample_rate_hz == 250.0
        assert preview.estimated_output_sample_rate_hz == 250.0
        assert len(preview.stage_plan) > 0

    def test_invalid_filter_range(self, test_raw: mne.io.BaseRaw) -> None:
        config = PreprocessingConfig(highpass_hz=15.0, lowpass_hz=10.0)
        preview = generate_pipeline_preview(test_raw.info, config)
        assert preview.valid is False
        assert any("High-pass" in err for err in preview.errors)

    def test_nyquist_exceeded(self) -> None:
        # sfreq = 160 Hz -> Nyquist = 80 Hz. lowpass = 90.0 Hz exceeds Nyquist.
        info_160 = mne.create_info(ch_names=["C3", "Cz"], sfreq=160.0, ch_types="eeg")
        config = PreprocessingConfig(highpass_hz=1.0, lowpass_hz=90.0)
        preview = generate_pipeline_preview(info_160, config)
        assert preview.valid is False
        assert any("Nyquist" in err for err in preview.errors)

    def test_notch_outside_passband_warning(self, test_raw: mne.io.BaseRaw) -> None:
        config = PreprocessingConfig(
            highpass_hz=0.5,
            lowpass_hz=40.0,
            notch=NotchConfig(enabled=True, frequencies_hz=[50.0]),
        )
        preview = generate_pipeline_preview(test_raw.info, config)
        assert preview.valid is True
        assert any("outside retained passband" in w for w in preview.warnings)


class TestPipelineExecutionAndImmutability:
    """Tests for non-destructive signal processing execution."""

    def test_raw_source_immutability(self, test_raw: mne.io.BaseRaw) -> None:
        """Verify that the raw source array is strictly unmodified after processing."""
        raw_copy = test_raw.copy()
        orig_data = raw_copy.get_data()

        config = PreprocessingConfig(
            highpass_hz=0.5,
            lowpass_hz=40.0,
            reference_type=ReferenceType.AVERAGE,
            notch=NotchConfig(enabled=False),
        )

        proc_raw, audits, warnings, integrity = apply_preprocessing_pipeline(test_raw, config)

        # Raw source data is 100% byte-identical
        assert np.array_equal(test_raw.get_data(), orig_data)
        # Processed data is altered by filter and reference
        assert not np.array_equal(proc_raw.get_data(), orig_data)
        assert integrity.status in ("HEALTHY", "ANOMALOUS")
        assert len(audits) == 7

    def test_referencing_modes(self, test_raw: mne.io.BaseRaw) -> None:
        # Average reference
        config_avg = PreprocessingConfig(reference_type=ReferenceType.AVERAGE)
        proc_avg, _, _, _ = apply_preprocessing_pipeline(test_raw, config_avg)
        # In average reference, sum of channels at each sample is approx 0
        avg_sum = np.abs(proc_avg.get_data().sum(axis=0))
        assert np.max(avg_sum) < 1e-12

        # Channel reference on Cz
        config_cz = PreprocessingConfig(
            reference_type=ReferenceType.CHANNEL,
            reference_channels=["Cz"],
        )
        proc_cz, _, _, _ = apply_preprocessing_pipeline(test_raw, config_cz)
        cz_idx = proc_cz.ch_names.index("Cz")
        assert np.max(np.abs(proc_cz.get_data()[cz_idx])) < 1e-12

    def test_resampling_stage(self, test_raw: mne.io.BaseRaw) -> None:
        config_resample = PreprocessingConfig(
            highpass_hz=0.5,
            lowpass_hz=40.0,
            resample=ResampleConfig(enabled=True, target_hz=128.0),
        )
        proc_resampled, audits, _, _ = apply_preprocessing_pipeline(test_raw, config_resample)
        assert abs(proc_resampled.info["sfreq"] - 128.0) < 1e-3
        assert len(proc_resampled.times) == int(5.0 * 128.0)
        resample_audit = next(a for a in audits if a.stage.value == "RESAMPLE")
        assert resample_audit.status.value == "COMPLETED"


class TestSignalIntegrityDiagnostics:
    """Tests for computational integrity metrics and anomaly detection."""

    def test_healthy_signal(self, test_raw: mne.io.BaseRaw) -> None:
        integrity = compute_signal_integrity(test_raw)
        assert integrity.nan_count == 0
        assert integrity.inf_count == 0
        assert integrity.sample_count == 1250
        assert integrity.channel_count == 4
        assert integrity.status == "HEALTHY"

    def test_corrupt_signal_nan(self, test_raw: mne.io.BaseRaw) -> None:
        raw_corrupt = test_raw.copy()
        data = raw_corrupt.get_data()
        data[0, 100] = np.nan
        raw_corrupt._data = data

        integrity = compute_signal_integrity(raw_corrupt)
        assert integrity.nan_count == 1
        assert integrity.status == "CORRUPT"

    def test_flatline_detection(self, test_raw: mne.io.BaseRaw) -> None:
        raw_flat = test_raw.copy()
        data = raw_flat.get_data()
        data[2, :] = 0.0  # Cz flatline
        raw_flat._data = data

        integrity = compute_signal_integrity(raw_flat)
        assert "Cz" in integrity.flatline_channels
        assert integrity.status == "ANOMALOUS"


class TestICADecomposition:
    """Tests for ICA fitting, decomposition, and component exclusion."""

    def test_ica_fit_and_apply(self, test_raw: mne.io.BaseRaw) -> None:
        ica_meta = fit_ica_decomposition(test_raw, n_components=3, random_state=42)
        assert ica_meta["n_components"] == 3
        assert len(ica_meta["components"]) == 3

        config_ica = PreprocessingConfig(
            artifact_method=ArtifactMethod.ICA,
            ica_config=ICAFitConfig(
                enabled=True,
                n_components=3,
                random_state=42,
                excluded_components=[0],
            ),
        )
        proc_ica, audits, _, _ = apply_preprocessing_pipeline(test_raw, config_ica)
        ica_audit = next(a for a in audits if a.stage.value == "ARTIFACT")
        assert ica_audit.status.value == "COMPLETED"
        assert ica_audit.parameters["excluded_components"] == [0]


class TestDeterminismAndStorage:
    """Tests for deterministic execution, content hashing, and path security."""

    def test_config_hash_determinism(self) -> None:
        cfg1 = PreprocessingConfig(highpass_hz=0.5, lowpass_hz=40.0)
        cfg2 = PreprocessingConfig(highpass_hz=0.5, lowpass_hz=40.0)
        assert cfg1.compute_config_hash() == cfg2.compute_config_hash()

        cfg3 = PreprocessingConfig(highpass_hz=1.0, lowpass_hz=40.0)
        assert cfg1.compute_config_hash() != cfg3.compute_config_hash()

    def test_storage_path_security(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            storage = PreprocessingStorage(base_dir=tmp_dir)

            # Valid safe path
            safe_p = storage.resolve_safe_path("artifact_123.fif")
            assert safe_p.name == "artifact_123.fif"

            # Path traversal attempts must raise ValueError
            with pytest.raises(ValueError, match="Path traversal"):
                storage.resolve_safe_path("../etc/passwd")

            with pytest.raises(ValueError, match="Path traversal"):
                storage.resolve_safe_path("sub/../../escape.txt")


class TestPreprocessingServiceAndFastAPI:
    """Integration tests for PreprocessingService and FastAPI endpoints."""

    @pytest.fixture
    def client(self) -> TestClient:
        return TestClient(create_app())

    def test_get_default_config(self, client: TestClient) -> None:
        res = client.get("/api/eeg/preprocessing/config/default")
        assert res.status_code == 200
        data = res.json()
        assert data["pipeline_version"] == "EEG_PREPROCESSING_V1"
        assert data["highpass_hz"] == 0.5
        assert data["lowpass_hz"] == 40.0

    def test_post_preview_synthetic(self, client: TestClient) -> None:
        payload = {
            "source_kind": "SYNTHETIC",
            "scenario_id": "right-turn",
            "config": {
                "highpass_hz": 0.5,
                "lowpass_hz": 40.0,
                "reference_type": "average",
            },
        }
        res = client.post("/api/eeg/preprocessing/preview", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is True
        assert data["input_sample_rate_hz"] == 250.0
        assert len(data["stage_plan"]) > 0

    def test_post_run_synthetic_and_retrieve(self, client: TestClient) -> None:
        payload = {
            "source_kind": "SYNTHETIC",
            "scenario_id": "right-turn",
            "config": {
                "highpass_hz": 1.0,
                "lowpass_hz": 35.0,
                "reference_type": "average",
                "notch": {"enabled": False},
                "resample": {"enabled": False},
            },
        }
        run_res = client.post("/api/eeg/preprocessing/run", json=payload)
        assert run_res.status_code == 200
        run_data = run_res.json()
        result_id = run_data["result_id"]
        assert result_id.startswith("pre_")
        assert run_data["input_sample_rate_hz"] == 250.0
        assert run_data["output_sample_rate_hz"] == 250.0
        assert len(run_data["stage_audit"]) == 7

        # Retrieve result details
        get_res = client.get(f"/api/eeg/preprocessing/results/{result_id}")
        assert get_res.status_code == 200
        assert get_res.json()["result_id"] == result_id

        # Retrieve sliced signal
        sig_res = client.get(
            f"/api/eeg/preprocessing/results/{result_id}/signal?start_sec=0.0&duration_sec=2.0"
        )
        assert sig_res.status_code == 200
        sig_data = sig_res.json()
        assert len(sig_data["timestamps"]) == int(2.0 * 250.0)
        assert "C3" in sig_data["signals"]

        # Retrieve manifest
        man_res = client.get(f"/api/eeg/preprocessing/results/{result_id}/manifest")
        assert man_res.status_code == 200
        man_data = man_res.json()
        assert man_data["result_id"] == result_id
        assert man_data["manifest_version"] == "EEG_PREPROCESSING_V1"
