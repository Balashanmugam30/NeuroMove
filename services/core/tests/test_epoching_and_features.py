"""Unit and scientific test suite for Motor-Imagery Epoching & Feature Foundation (Phase 10)."""

import tempfile

import mne
import numpy as np
import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import create_app
from neuromove.epoching.engine import apply_epoch_segmentation, generate_epoching_preview
from neuromove.epoching.events import (
    discover_raw_events,
    get_default_event_mapping_config,
    normalize_events,
    validate_event_timing,
)
from neuromove.epoching.models import (
    EpochingConfig,
    EpochQCStatus,
    EventMappingConfig,
    EventMappingRule,
    NormalizedLabel,
)
from neuromove.features.extractor import (
    compute_covariance_representation,
    compute_welch_band_powers,
    extract_epoch_feature_vector,
    generate_feature_preview,
    validate_covariance_matrix,
)
from neuromove.features.models import (
    CovarianceMethod,
    FeatureBand,
    FeatureConfig,
)


@pytest.fixture
def test_raw() -> mne.io.BaseRaw:
    """Create a deterministic synthetic 250 Hz MNE Raw object with Graz-style annotations."""
    sfreq = 250.0
    duration_sec = 10.0
    n_samples = int(duration_sec * sfreq)
    channels = ["Fc5", "C3", "Cz", "C4"]

    t = np.linspace(0, duration_sec, n_samples, endpoint=False)
    data = np.zeros((len(channels), n_samples))

    # C3: 12 Hz (Mu) + 22 Hz (Beta)
    data[1, :] = 15e-6 * np.sin(2 * np.pi * 12.0 * t) + 8e-6 * np.sin(2 * np.pi * 22.0 * t)
    # Cz: 10 Hz (Alpha)
    data[2, :] = 20e-6 * np.sin(2 * np.pi * 10.0 * t)
    # C4: 12 Hz (Mu)
    data[3, :] = 25e-6 * np.sin(2 * np.pi * 12.0 * t)

    info = mne.create_info(ch_names=channels, sfreq=sfreq, ch_types="eeg")
    raw = mne.io.RawArray(data, info, verbose=False)

    # Attach annotations
    onsets = [1.0, 4.5, 7.5]
    durations = [3.0, 2.5, 2.0]
    descriptions = ["LEFT_IMAGERY", "RIGHT_IMAGERY", "REST"]
    raw.set_annotations(mne.Annotations(onset=onsets, duration=durations, description=descriptions))
    return raw


@pytest.fixture
def client() -> TestClient:
    """Create a FastAPI test client."""
    app = create_app()
    return TestClient(app)


class TestEventNormalizationAndValidation:
    """Tests for event discovery, mapping catalog, and timing validation."""

    def test_discover_raw_events(self, test_raw: mne.io.BaseRaw) -> None:
        events, event_id = discover_raw_events(test_raw)
        assert len(events) == 3
        assert "LEFT_IMAGERY" in event_id
        assert "RIGHT_IMAGERY" in event_id

    def test_normalize_events(self, test_raw: mne.io.BaseRaw) -> None:
        mapping = get_default_event_mapping_config()
        norm_events = normalize_events(test_raw, mapping_config=mapping)
        assert len(norm_events) == 3
        assert norm_events[0].normalized_label == NormalizedLabel.LEFT_IMAGERY
        assert norm_events[1].normalized_label == NormalizedLabel.RIGHT_IMAGERY
        assert norm_events[2].normalized_label == NormalizedLabel.REST
        assert all(e.mapping_status == "MAPPED" for e in norm_events)

    def test_unknown_event_mapping(self, test_raw: mne.io.BaseRaw) -> None:
        custom_mapping = EventMappingConfig(
            mapping_version="CUSTOM_V1",
            rules=[
                EventMappingRule(source_code="REST", normalized_label=NormalizedLabel.REST),
            ],
            default_label=NormalizedLabel.UNKNOWN,
        )
        norm_events = normalize_events(test_raw, mapping_config=custom_mapping)
        assert norm_events[0].mapping_status == "UNMAPPED"
        assert norm_events[0].normalized_label == NormalizedLabel.UNKNOWN
        assert norm_events[2].mapping_status == "MAPPED"

    def test_event_timing_validation(self) -> None:
        assert validate_event_timing(1.5, 375, 2500, 10.0) is True
        assert validate_event_timing(-0.5, 0, 2500, 10.0) is False
        assert validate_event_timing(12.0, 3000, 2500, 10.0) is False


class TestEpochSegmentationAndQC:
    """Tests for MNE epoch creation, baseline handling, and Quality Control."""

    def test_epoching_preview(self, test_raw: mne.io.BaseRaw) -> None:
        mapping = get_default_event_mapping_config()
        config = EpochingConfig(tmin=-1.0, tmax=3.0, baseline=(-1.0, 0.0))
        preview = generate_epoching_preview(test_raw, mapping, config)
        assert preview.valid is True
        assert preview.events_discovered == 3
        assert preview.mapped_events == 3
        assert len(preview.errors) == 0

    def test_epoch_segmentation_execution(self, test_raw: mne.io.BaseRaw) -> None:
        mapping = get_default_event_mapping_config()
        config = EpochingConfig(tmin=-0.5, tmax=2.0, baseline=(-0.5, 0.0), baseline_mode="APPLIED")
        epochs, trials, records, qc_list, rej_counts = apply_epoch_segmentation(
            raw_input=test_raw,
            mapping_config=mapping,
            epoch_config=config,
            epoch_set_id="test_set_01",
            subject_id="sub_01",
        )
        assert len(epochs) == 3
        assert len(trials) == 3
        assert len(records) == 3
        assert all(qc.status == EpochQCStatus.VALID for qc in qc_list)
        # Check raw source immutability
        assert len(test_raw.annotations) == 3

    def test_amplitude_rejection(self, test_raw: mne.io.BaseRaw) -> None:
        mapping = get_default_event_mapping_config()
        # Set tight amplitude threshold to trigger rejection
        config = EpochingConfig(tmin=-0.5, tmax=2.0, baseline=None, amplitude_rejection_uv=10.0)
        epochs, trials, records, qc_list, rej_counts = apply_epoch_segmentation(
            raw_input=test_raw,
            mapping_config=mapping,
            epoch_config=config,
            epoch_set_id="test_set_amp",
            subject_id="sub_01",
        )
        assert any(r.qc_status == EpochQCStatus.REJECTED for r in records)
        assert "AMPLITUDE_OUTLIER" in rej_counts


class TestFeatureExtractionAndCovariance:
    """Tests for multi-band power, lateralization, and covariance representations."""

    def test_welch_band_powers(self) -> None:
        sfreq = 250.0
        n_times = 500
        t = np.linspace(0, 2.0, n_times, endpoint=False)
        data = np.zeros((2, n_times))
        # 10 Hz pure sine on ch 0
        data[0, :] = 10e-6 * np.sin(2 * np.pi * 10.0 * t)
        # 20 Hz pure sine on ch 1
        data[1, :] = 15e-6 * np.sin(2 * np.pi * 20.0 * t)

        bands = [
            FeatureBand(name="mu", fmin_hz=8.0, fmax_hz=13.0),
            FeatureBand(name="beta", fmin_hz=13.0, fmax_hz=30.0),
        ]
        band_powers, total_pow = compute_welch_band_powers(data, sfreq, bands)
        # Ch 0 should have high Mu power
        assert band_powers["mu"][0] > band_powers["beta"][0]
        # Ch 1 should have high Beta power
        assert band_powers["beta"][1] > band_powers["mu"][1]

    def test_feature_vector_extraction(self) -> None:
        sfreq = 250.0
        n_times = 500
        data = np.random.randn(3, n_times) * 1e-6
        ch_names = ["C3", "Cz", "C4"]
        config = FeatureConfig(
            channels=["C3", "Cz", "C4"],
            include_lateralization=True,
            lateralization_pairs=[("C3", "C4")],
        )

        vec = extract_epoch_feature_vector(
            epoch_data=data,
            ch_names=ch_names,
            sfreq=sfreq,
            config=config,
            epoch_id="ep_001",
            trial_id="trl_001",
            subject_id="sub_01",
            label=NormalizedLabel.LEFT_IMAGERY,
        )
        assert "C3_mu_abs" in vec.values
        assert "C3_mu_rel" in vec.values
        assert "C3_mu_log" in vec.values
        assert "mu_lateralization_c3_c4" in vec.values
        assert np.isfinite(vec.values["mu_lateralization_c3_c4"])

    def test_covariance_representation_and_validation(self) -> None:
        n_channels = 3
        n_times = 250
        data = np.random.randn(n_channels, n_times)
        cov, trace_val = compute_covariance_representation(data, method=CovarianceMethod.NORMALIZED)

        assert cov.shape == (n_channels, n_channels)
        assert np.isclose(np.trace(cov), 1.0, atol=1e-5)

        is_finite, is_sym, is_psd = validate_covariance_matrix(cov)
        assert is_finite is True
        assert is_sym is True
        assert is_psd is True

    def test_shrinkage_covariance(self) -> None:
        data = np.random.randn(4, 200)
        cov_shrink, _ = compute_covariance_representation(data, method=CovarianceMethod.SHRINKAGE)
        is_finite, is_sym, is_psd = validate_covariance_matrix(cov_shrink)
        assert is_finite is True
        assert is_sym is True
        assert is_psd is True

    def test_feature_preview_nyquist_validation(self) -> None:
        # Sampling rate = 50 Hz -> Nyquist = 25 Hz. Beta (13-30 Hz) exceeds Nyquist.
        config = FeatureConfig(bands=[FeatureBand(name="beta", fmin_hz=13.0, fmax_hz=30.0)])
        preview = generate_feature_preview(
            epoch_count=10,
            available_channels=["C3", "Cz", "C4"],
            sampling_rate_hz=50.0,
            config=config,
        )
        assert preview.valid is False
        assert any("Nyquist" in err for err in preview.errors)


class TestEpochingAndFeatureServiceIntegration:
    """Integration tests for EpochingFeatureService, SQLite persistence, and FastAPI routes."""

    def test_end_to_end_synthetic_epoching_and_features(self, client: TestClient) -> None:
        with tempfile.TemporaryDirectory():
            # 1. Run Epoching on Synthetic Simulation
            epoch_req = {
                "source_kind": "SYNTHETIC",
                "scenario_id": "right-turn",
                "epoch_config": {
                    "epoching_version": "EEG_EPOCHING_V1",
                    "tmin": -0.5,
                    "tmax": 2.0,
                    "baseline": [-0.5, 0.0],
                    "baseline_mode": "APPLIED",
                    "analysis_window": [0.5, 2.0],
                },
            }
            ep_res = client.post("/api/eeg/epochs/run", json=epoch_req)
            assert ep_res.status_code == 200
            ep_data = ep_res.json()
            epoch_set_id = ep_data["epoch_set_id"]
            assert epoch_set_id.startswith("ep_")
            assert ep_data["valid_epochs"] > 0
            assert "artifact_checksum_sha256" in ep_data

            # 2. Retrieve Epoch Set & Manifest
            get_ep = client.get(f"/api/eeg/epochs/{epoch_set_id}")
            assert get_ep.status_code == 200
            assert get_ep.json()["epoch_set_id"] == epoch_set_id

            man_ep = client.get(f"/api/eeg/epochs/{epoch_set_id}/manifest")
            assert man_ep.status_code == 200
            assert man_ep.json()["epoching_version"] == "EEG_EPOCHING_V1"

            # 3. Retrieve Epoch Records and Waveform Signal
            records_res = client.get(f"/api/eeg/epochs/{epoch_set_id}/records")
            assert records_res.status_code == 200
            records = records_res.json()
            assert len(records) > 0
            first_ep_id = records[0]["epoch_id"]

            sig_res = client.get(f"/api/eeg/epochs/{epoch_set_id}/records/{first_ep_id}/signal")
            assert sig_res.status_code == 200
            assert "signals" in sig_res.json()

            # 4. Run Feature Extraction on Epoch Set
            feat_req = {
                "epoch_set_id": epoch_set_id,
                "config": {
                    "feature_version": "EEG_FEATURES_V1",
                    "channels": ["Fc5", "C3", "Cz", "C4"],
                    "bands": [
                        {"name": "mu", "fmin_hz": 8.0, "fmax_hz": 13.0},
                        {"name": "beta", "fmin_hz": 13.0, "fmax_hz": 30.0},
                    ],
                    "power_type": "ALL",
                    "include_lateralization": True,
                    "lateralization_pairs": [["C3", "C4"]],
                    "covariance_method": "NORMALIZED",
                },
            }
            feat_res = client.post("/api/eeg/features/run", json=feat_req)
            assert feat_res.status_code == 200
            feat_data = feat_res.json()
            feature_set_id = feat_data["feature_set_id"]
            assert feature_set_id.startswith("feat_")
            assert feat_data["row_count"] > 0
            assert feat_data["feature_count"] > 0

            # 5. Retrieve Feature Set Data & Covariance Matrices
            data_res = client.get(f"/api/eeg/features/{feature_set_id}/data")
            assert data_res.status_code == 200
            data_rows = data_res.json()
            assert len(data_rows) > 0
            assert "subject_id" in data_rows[0]
            assert "label" in data_rows[0]

            cov_res = client.get(f"/api/eeg/features/{feature_set_id}/covariance")
            assert cov_res.status_code == 200
            cov_data = cov_res.json()
            assert len(cov_data["matrices"]) > 0
            assert cov_data["matrices"][0]["is_symmetric"] is True

            # 6. Export Feature CSV & Manifest
            csv_res = client.get(f"/api/eeg/features/{feature_set_id}/export/csv")
            assert csv_res.status_code == 200
            assert "text/csv" in csv_res.headers["content-type"]
            assert "epoch_id,trial_id,subject_id,label" in csv_res.text
