"""Unit & Integration Tests for NeuroMove MNE-Based EEG Laboratory Analysis."""

import pytest
from fastapi.testclient import TestClient

from neuromove.analysis.models import (
    BandPowerRequest,
    PSDMethod,
    PSDRequest,
    TFRRequest,
)
from neuromove.analysis.service import analysis_service
from neuromove.api.app import app


@pytest.fixture
def client():
    return TestClient(app)


def test_compute_psd_welch():
    req = PSDRequest(
        channels=["C3", "Cz", "C4"],
        method=PSDMethod.WELCH,
        fmin=1.0,
        fmax=40.0,
        window_duration_seconds=4.0,
    )
    res = analysis_service.compute_psd(req)

    assert len(res.frequencies) > 10
    assert "C3" in res.psd_by_channel
    assert "Cz" in res.psd_by_channel
    assert "C4" in res.psd_by_channel
    assert len(res.psd_by_channel["C3"]) == len(res.frequencies)
    assert res.metadata.method == "welch"
    assert res.metadata.sampling_rate_hz == 250
    assert res.metadata.analysis_version == "EEG_ANALYSIS_V1"
    assert "C3" in res.peak_frequencies


def test_compute_psd_multitaper():
    req = PSDRequest(
        channels=["C3", "C4"],
        method=PSDMethod.MULTITAPER,
        fmin=2.0,
        fmax=35.0,
        window_duration_seconds=3.0,
    )
    res = analysis_service.compute_psd(req)

    assert len(res.frequencies) > 10
    assert "C3" in res.psd_by_channel
    assert "C4" in res.psd_by_channel
    assert res.metadata.method == "multitaper"
    assert res.frequencies[0] >= 1.9
    assert res.frequencies[-1] <= 35.1


def test_psd_nyquist_enforcement():
    req = PSDRequest(
        channels=["C3"],
        method=PSDMethod.WELCH,
        fmin=1.0,
        fmax=125.0,  # Exactly Nyquist (250 / 2) -> must be rejected
        window_duration_seconds=2.0,
    )
    with pytest.raises(ValueError, match="Nyquist"):
        analysis_service.compute_psd(req)


def test_compute_band_power():
    req = BandPowerRequest(
        channels=["C3", "Cz", "C4"],
        method=PSDMethod.WELCH,
        window_duration_seconds=4.0,
    )
    res = analysis_service.compute_band_power(req)

    assert "C3" in res.bands_by_channel
    c3_bands = res.bands_by_channel["C3"]
    assert "delta" in c3_bands
    assert "theta" in c3_bands
    assert "mu" in c3_bands
    assert "beta" in c3_bands
    assert "gamma" in c3_bands

    # Check relative power normalization (sums to approximately 1.0)
    rel_sum = sum(b.relative_power for b in c3_bands.values())
    assert 0.95 <= rel_sum <= 1.05

    # Check that lateralization index is computed
    assert isinstance(res.mu_erd_lateralization_index, float)


def test_compute_morlet_tfr():
    req = TFRRequest(
        channel="C3",
        fmin=4.0,
        fmax=40.0,
        window_duration_seconds=4.0,
    )
    res = analysis_service.compute_tfr(req)

    assert len(res.times) > 10
    assert len(res.frequencies) == 20
    assert len(res.power_matrix) == len(res.frequencies)
    assert len(res.power_matrix[0]) == len(res.times)
    assert res.channel == "C3"
    assert res.metadata.method == "morlet_wavelet"


def test_channel_topology_summary():
    channels = analysis_service.get_channels_summary()
    assert len(channels) == 3
    ch_names = [c.channel for c in channels]
    assert "C3" in ch_names
    assert "Cz" in ch_names
    assert "C4" in ch_names
    assert channels[0].position.x == -0.35  # Left hemisphere
    assert channels[2].position.x == 0.35  # Right hemisphere


def test_export_csv_and_json():
    req = PSDRequest(channels=["C3", "C4"], window_duration_seconds=2.0)
    psd_csv = analysis_service.export_psd_csv(req)
    assert "# NEUROMOVE EEG LABORATORY" in psd_csv
    assert "Frequency_Hz,C3,C4" in psd_csv

    bp_req = BandPowerRequest(channels=["C3", "C4"], window_duration_seconds=2.0)
    bp_csv = analysis_service.export_band_power_csv(bp_req)
    assert "# NEUROMOVE EEG LABORATORY — BAND POWER EXPORT" in bp_csv
    assert "Channel,Band,Freq_Min_Hz" in bp_csv

    analysis_json = analysis_service.export_analysis_json(session_id="ses_test_001")
    assert analysis_json["laboratory"] == "NeuroMove EEG Laboratory"
    assert "psd" in analysis_json
    assert "band_power" in analysis_json
    assert "time_frequency" in analysis_json


def test_api_endpoints(client):
    # 1. Channels
    resp = client.get("/api/eeg/channels")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3

    # 2. PSD
    resp = client.post(
        "/api/eeg/psd",
        json={"channels": ["C3", "Cz", "C4"], "method": "welch", "fmin": 1.0, "fmax": 40.0},
    )
    assert resp.status_code == 200
    psd = resp.json()
    assert "frequencies" in psd
    assert "psd_by_channel" in psd

    # 3. Band Power
    resp = client.post(
        "/api/eeg/band-power",
        json={"channels": ["C3", "Cz", "C4"], "method": "welch"},
    )
    assert resp.status_code == 200
    bp = resp.json()
    assert "bands_by_channel" in bp

    # 4. TFR
    resp = client.post(
        "/api/eeg/tfr",
        json={"channel": "C3", "fmin": 4.0, "fmax": 30.0},
    )
    assert resp.status_code == 200
    tfr = resp.json()
    assert "power_matrix" in tfr

    # 5. Export PSD CSV
    resp = client.post(
        "/api/eeg/export/psd",
        json={"channels": ["C3"], "fmin": 1.0, "fmax": 20.0},
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]

    # 6. Export Analysis JSON
    resp = client.get("/api/eeg/export/analysis")
    assert resp.status_code == 200
    assert resp.json()["laboratory"] == "NeuroMove EEG Laboratory"
