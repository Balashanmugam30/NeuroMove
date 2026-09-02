"""NeuroMove — Phase 21 Real EEG / BioAmp Acquisition Comprehensive Test Suite.

Validates adapters, clock normalization, bounded buffering, signal QC, calibration,
live neurophysiology pipeline bridge, 10 Golden E2E Scenarios, invariants, and persistence.
"""

from __future__ import annotations

from datetime import UTC, datetime

import numpy as np
import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import app
from neuromove.database.connection import default_db_manager
from neuromove.domain.enums import SafetyDecision
from neuromove.eeg_acquisition.adapters.physical import PhysicalEegAcquisitionAdapter
from neuromove.eeg_acquisition.adapters.recorded import RecordedEegAcquisitionAdapter
from neuromove.eeg_acquisition.adapters.simulated import SimulatedEegAcquisitionAdapter
from neuromove.eeg_acquisition.buffer import BoundedEegBuffer
from neuromove.eeg_acquisition.calibration import EegCalibrationWorkflow
from neuromove.eeg_acquisition.clock import EegClockNormalizer
from neuromove.eeg_acquisition.models import (
    ChannelQcStatus,
    EegAcquisitionConfig,
    EegAcquisitionDiagnostic,
    EegAcquisitionSource,
    EegAcquisitionState,
    EegChannelDescriptor,
    EegSamplePacket,
)
from neuromove.eeg_acquisition.pipeline_bridge import LiveNeurophysiologyBridge
from neuromove.eeg_acquisition.qc import EegSignalQcEngine
from neuromove.eeg_acquisition.scenarios import EegScenarioRegistry
from neuromove.eeg_acquisition.service import EegAcquisitionService
from neuromove.eeg_acquisition.storage import EegAcquisitionStorage


@pytest.fixture(autouse=True)
def setup_db():
    default_db_manager.initialize_db()
    yield


@pytest.fixture
def channel_descriptors() -> list[EegChannelDescriptor]:
    names = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]
    return [
        EegChannelDescriptor(channel_id=f"ch_{i}", name=n, canonical_name=n, index=i)
        for i, n in enumerate(names)
    ]


@pytest.fixture
def default_config(channel_descriptors) -> EegAcquisitionConfig:
    return EegAcquisitionConfig(
        session_id="test_sess_01",
        subject_id="sub-test",
        source_type=EegAcquisitionSource.SIMULATOR,
        device_id="sim_bioamp_01",
        sampling_rate=250,
        channels=channel_descriptors,
        chunk_size_samples=25,
        buffer_duration_sec=2.0,  # 500 samples max
        seed=42,
    )


# ============================================================================
# 1. Simulated Adapter Tests
# ============================================================================


def test_simulated_adapter_discover():
    adapter = SimulatedEegAcquisitionAdapter()
    devices = adapter.discover()
    assert len(devices) == 1
    assert devices[0].source_type == EegAcquisitionSource.SIMULATOR
    assert devices[0].channel_count == 8


def test_simulated_adapter_lifecycle(default_config):
    adapter = SimulatedEegAcquisitionAdapter(seed=42)
    assert adapter.get_status() == EegAcquisitionState.DISCONNECTED

    assert adapter.connect() is True
    assert adapter.get_status() == EegAcquisitionState.CONNECTING

    assert adapter.configure(default_config) is True
    assert adapter.get_status() == EegAcquisitionState.CONFIGURING

    assert adapter.start_stream() is True
    assert adapter.get_status() == EegAcquisitionState.STREAMING

    chunk = adapter.read_chunk()
    assert chunk is not None
    assert chunk.sample_count == 25
    assert chunk.channel_count == 8
    assert len(chunk.data) == 8
    assert len(chunk.data[0]) == 25

    assert adapter.pause() is True
    assert adapter.get_status() == EegAcquisitionState.PAUSED
    assert adapter.read_chunk() is None

    assert adapter.resume() is True
    assert adapter.get_status() == EegAcquisitionState.STREAMING

    assert adapter.stop_stream() is True
    assert adapter.get_status() == EegAcquisitionState.DISCONNECTED


def test_simulated_adapter_intent_modulation(default_config):
    adapter = SimulatedEegAcquisitionAdapter(seed=42)
    adapter.connect()
    adapter.configure(default_config)
    adapter.start_stream()

    adapter.set_target_intent("TURN_RIGHT")
    chunk_r = adapter.read_chunk()
    assert chunk_r is not None

    adapter.set_target_intent("TURN_LEFT")
    chunk_l = adapter.read_chunk()
    assert chunk_l is not None


def test_simulated_adapter_fault_injection(default_config):
    adapter = SimulatedEegAcquisitionAdapter(seed=42)
    adapter.connect()
    adapter.configure(default_config)
    adapter.start_stream()

    # Flatline fault
    adapter.inject_fault("FLATLINE_CHANNEL", {"channel": "C3"})
    chunk = adapter.read_chunk()
    assert chunk is not None
    c3_data = np.array(chunk.data[0])
    assert np.all(c3_data == 0.0)

    # Clear faults
    adapter.inject_fault("CLEAR")
    chunk_clean = adapter.read_chunk()
    assert chunk_clean is not None
    assert not np.all(np.array(chunk_clean.data[0]) == 0.0)


# ============================================================================
# 2. Recorded Adapter Tests
# ============================================================================


def test_recorded_adapter_load_and_checksum():
    adapter = RecordedEegAcquisitionAdapter()
    assert len(adapter._fixture_hash) == 64
    devices = adapter.discover()
    assert len(devices) == 1
    assert devices[0].source_type == EegAcquisitionSource.RECORDED


def test_recorded_adapter_lifecycle(default_config):
    adapter = RecordedEegAcquisitionAdapter()
    assert adapter.connect() is True
    assert adapter.configure(default_config) is True
    assert adapter.start_stream() is True

    chunk = adapter.read_chunk()
    assert chunk is not None
    assert chunk.sample_count == 25
    assert len(chunk.channels) == 8

    state = adapter.get_replay_state()
    assert state.current_sample == 25
    assert state.progress_pct > 0.0

    assert adapter.disconnect() is True
    assert adapter.get_status() == EegAcquisitionState.DISCONNECTED


# ============================================================================
# 3. Physical Adapter Tests
# ============================================================================


def test_physical_adapter_safe_probe():
    adapter = PhysicalEegAcquisitionAdapter()
    devices = adapter.discover()
    assert len(devices) >= 1
    # In test/CI environment, no physical BioAmp is connected
    assert devices[0].is_available is False or devices[0].is_connected is False


def test_physical_adapter_unavailable_connect():
    adapter = PhysicalEegAcquisitionAdapter()
    adapter._is_hardware_present = False
    connected = adapter.connect()
    assert connected is False
    assert adapter.get_status() == EegAcquisitionState.ERROR
    assert adapter.read_chunk() is None


# ============================================================================
# 4. Clock Normalization Tests
# ============================================================================


def test_clock_normalizer_monotonicity():
    normalizer = EegClockNormalizer(sampling_rate=250)
    now = datetime.now(UTC)

    iso1, is_mono1, info1 = normalizer.normalize(now, device_timestamp=0.0, sample_count=25)
    assert is_mono1 is True
    assert info1.discontinuity_count == 0

    iso2, is_mono2, info2 = normalizer.normalize(now, device_timestamp=0.1, sample_count=25)
    assert is_mono2 is True
    assert iso2 > iso1


def test_clock_normalizer_backwards_jump():
    normalizer = EegClockNormalizer(sampling_rate=250)
    now = datetime.now(UTC)

    normalizer.normalize(now, device_timestamp=10.0, sample_count=25)
    _, is_mono, info = normalizer.normalize(now, device_timestamp=2.0, sample_count=25)

    assert is_mono is False
    assert info.discontinuity_count == 1


def test_clock_normalizer_reset():
    normalizer = EegClockNormalizer(sampling_rate=250)
    normalizer.normalize(datetime.now(UTC), device_timestamp=1.0, sample_count=25)
    normalizer.reset()
    assert normalizer._sample_index == 0
    assert normalizer._session_start_host_dt is None


# ============================================================================
# 5. Bounded Ring Buffer Tests
# ============================================================================


def test_bounded_buffer_push_and_extract():
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]
    buf = BoundedEegBuffer(channel_names=channels, sampling_rate=250, max_duration_sec=1.0)
    assert buf.max_capacity_samples == 250

    # Push 100 samples
    pkt = EegSamplePacket(
        packet_id="pkt_01",
        session_id="sess_01",
        sequence_number=1,
        host_receive_timestamp=datetime.now(UTC).isoformat(),
        normalized_timestamp=datetime.now(UTC).isoformat(),
        sample_count=100,
        channel_count=8,
        channels=channels,
        data=[[1.0] * 100 for _ in range(8)],
    )
    buf.push_packet(pkt)
    assert buf.get_sample_count() == 100
    assert buf.get_fill_percentage() == 40.0

    data_uv, chs = buf.extract_recent_window(50)
    assert data_uv.shape == (8, 50)
    assert chs == channels


def test_bounded_buffer_overflow_drop_accounting():
    channels = ["C3", "Cz"]
    buf = BoundedEegBuffer(
        channel_names=channels, sampling_rate=100, max_duration_sec=1.0
    )  # max 100 samples

    pkt1 = EegSamplePacket(
        packet_id="pkt_1",
        session_id="s",
        sequence_number=1,
        host_receive_timestamp=datetime.now(UTC).isoformat(),
        normalized_timestamp=datetime.now(UTC).isoformat(),
        sample_count=60,
        channel_count=2,
        channels=channels,
        data=[[1.0] * 60, [1.0] * 60],
    )
    pkt2 = EegSamplePacket(
        packet_id="pkt_2",
        session_id="s",
        sequence_number=2,
        host_receive_timestamp=datetime.now(UTC).isoformat(),
        normalized_timestamp=datetime.now(UTC).isoformat(),
        sample_count=60,
        channel_count=2,
        channels=channels,
        data=[[2.0] * 60, [2.0] * 60],
    )

    buf.push_packet(pkt1)
    buf.push_packet(pkt2)

    # Older packet dropped to fit 100 max
    assert buf.total_samples_dropped == 60
    assert buf.total_packets_dropped == 1
    assert buf.overflow_events == 1
    assert buf.get_sample_count() == 60


# ============================================================================
# 6. Signal Quality Control Tests
# ============================================================================


def test_qc_engine_healthy():
    qc = EegSignalQcEngine()
    data = np.random.normal(0, 15.0, (8, 250))
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    snapshots, is_nominal, degraded_count = qc.evaluate_window(data, channels)
    assert is_nominal is True
    assert degraded_count == 0
    assert snapshots["C3"].qc_status == ChannelQcStatus.HEALTHY
    assert snapshots["C3"].is_healthy is True


def test_qc_engine_flatline():
    qc = EegSignalQcEngine()
    data = np.random.normal(0, 15.0, (8, 250))
    data[0, :] = 0.0  # C3 flatlines
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    snapshots, is_nominal, degraded_count = qc.evaluate_window(data, channels)
    assert is_nominal is False
    assert degraded_count >= 1
    assert snapshots["C3"].qc_status == ChannelQcStatus.FLATLINE


def test_qc_engine_saturation():
    qc = EegSignalQcEngine()
    data = np.random.normal(0, 15.0, (8, 250))
    data[1, :] = 490.0  # Cz saturation
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    snapshots, is_nominal, degraded_count = qc.evaluate_window(data, channels)
    assert is_nominal is False
    assert snapshots["Cz"].qc_status == ChannelQcStatus.SATURATION


def test_qc_engine_nonfinite():
    qc = EegSignalQcEngine()
    data = np.random.normal(0, 15.0, (8, 250))
    data[2, 10] = np.nan  # C4 contains NaN
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    snapshots, is_nominal, degraded_count = qc.evaluate_window(data, channels)
    assert is_nominal is False
    assert snapshots["C4"].qc_status == ChannelQcStatus.NONFINITE


# ============================================================================
# 7. Calibration Workflow Tests
# ============================================================================


def test_calibration_success():
    cal = EegCalibrationWorkflow()
    data = np.random.normal(0, 15.0, (8, 500))
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    snap = cal.calibrate("sess_01", "sub-01", data, channels)
    assert snap.is_ready is True
    assert snap.state == "CALIBRATED"
    assert len(snap.manifest_hash) == 64
    assert cal.get_latest_snapshot() == snap


def test_calibration_failure_on_flatline_c3():
    cal = EegCalibrationWorkflow()
    data = np.random.normal(0, 15.0, (8, 500))
    data[0, :] = 0.0  # Flatline C3
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    snap = cal.calibrate("sess_01", "sub-01", data, channels)
    assert snap.is_ready is False
    assert snap.state == "FAILED"


# ============================================================================
# 8. Live Pipeline Bridge Tests
# ============================================================================


def test_live_bridge_authorized_execution():
    bridge = LiveNeurophysiologyBridge()
    data = np.random.normal(0, 15.0, (8, 250))
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    summary = bridge.process_window(
        data_uv=data,
        channel_names=channels,
        calibration_ready=True,
        override_intent="MOVE_FORWARD",
    )
    assert summary.safety_decision == SafetyDecision.AUTHORIZED
    assert summary.will_transmit is True
    assert summary.predicted_class == "MOVE_FORWARD"
    assert summary.calibrated_confidence >= 0.75
    assert len(summary.lineage_hash) == 64


def test_live_bridge_held_on_low_confidence():
    bridge = LiveNeurophysiologyBridge()
    data = np.random.normal(0, 15.0, (8, 250))
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    summary = bridge.process_window(
        data_uv=data,
        channel_names=channels,
        calibration_ready=True,
        force_low_confidence=True,
    )
    assert summary.safety_decision == SafetyDecision.HELD
    assert summary.will_transmit is False
    assert summary.transport_status == "NOT_TRANSMITTED"


def test_live_bridge_denied_on_uncalibrated():
    bridge = LiveNeurophysiologyBridge()
    data = np.random.normal(0, 15.0, (8, 250))
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    summary = bridge.process_window(
        data_uv=data,
        channel_names=channels,
        calibration_ready=False,
    )
    assert summary.safety_decision == SafetyDecision.DENIED
    assert summary.will_transmit is False


# ============================================================================
# 9. Golden E2E Scenarios (A through J)
# ============================================================================


def test_scenario_a_simulator_full_pipeline():
    registry = EegScenarioRegistry()
    res = registry.run_scenario("SCENARIO_A")
    assert res.passed is True
    assert res.safety_decision == SafetyDecision.AUTHORIZED


def test_scenario_b_recorded_full_pipeline():
    registry = EegScenarioRegistry()
    res = registry.run_scenario("SCENARIO_B")
    assert res.passed is True


def test_scenario_c_physical_unavailable():
    registry = EegScenarioRegistry()
    res = registry.run_scenario("SCENARIO_C")
    assert res.passed is True
    assert res.safety_decision == SafetyDecision.DENIED


def test_scenario_d_channel_failure():
    registry = EegScenarioRegistry()
    res = registry.run_scenario("SCENARIO_D")
    assert res.passed is True
    assert res.safety_decision == SafetyDecision.DENIED


def test_scenario_e_timestamp_discontinuity():
    registry = EegScenarioRegistry()
    res = registry.run_scenario("SCENARIO_E")
    assert res.passed is True


def test_scenario_f_low_confidence():
    registry = EegScenarioRegistry()
    res = registry.run_scenario("SCENARIO_F")
    assert res.passed is True
    assert res.safety_decision == SafetyDecision.HELD


def test_scenario_g_authorized_e2e():
    registry = EegScenarioRegistry()
    res = registry.run_scenario("SCENARIO_G")
    assert res.passed is True


def test_scenario_h_disconnect_during_streaming():
    registry = EegScenarioRegistry()
    res = registry.run_scenario("SCENARIO_H")
    assert res.passed is True


def test_scenario_i_reconnect_session_boundary():
    registry = EegScenarioRegistry()
    res = registry.run_scenario("SCENARIO_I")
    assert res.passed is True


def test_scenario_j_deterministic_replay():
    registry = EegScenarioRegistry()
    res = registry.run_scenario("SCENARIO_J")
    assert res.passed is True


# ============================================================================
# 10. Service Coordinator & Persistence Tests
# ============================================================================


def test_service_initial_state():
    svc = EegAcquisitionService()
    assert svc.active_source == EegAcquisitionSource.SIMULATOR
    health = svc.get_stream_health()
    assert health.is_nominal is True
    assert health.sample_rate == 250


def test_service_source_switch():
    svc = EegAcquisitionService()
    success = svc.set_source_mode(EegAcquisitionSource.RECORDED)
    assert success is True
    assert svc.active_source == EegAcquisitionSource.RECORDED

    # Switch back to simulator
    success_sim = svc.set_source_mode(EegAcquisitionSource.SIMULATOR)
    assert success_sim is True
    assert svc.active_source == EegAcquisitionSource.SIMULATOR


def test_service_live_inference_and_waveforms():
    svc = EegAcquisitionService()
    wave = svc.get_waveform_window(200)
    assert len(wave["channels"]) == 8
    assert wave["sample_count"] > 0

    inf = svc.run_live_inference(override_intent="FORWARD")
    assert inf.predicted_class == "FORWARD"
    assert inf.safety_decision == SafetyDecision.AUTHORIZED


def test_service_run_scenario_persistence():
    svc = EegAcquisitionService()
    res = svc.run_scenario("SCENARIO_A")
    assert res.passed is True

    experiments = svc.storage.get_experiments(limit=10)
    assert len(experiments) >= 1
    assert any(e.scenario_id == "SCENARIO_A" for e in experiments)


def test_storage_diagnostic_recording():
    storage = EegAcquisitionStorage()
    diag = EegAcquisitionDiagnostic(
        diag_id="test_diag_01",
        session_id="test_sess",
        category="STREAM",
        severity="WARNING",
        code="STREAM_JITTER",
        message="Jitter detected in test stream",
        timestamp=datetime.now(UTC).isoformat(),
        details={"jitter_ms": 12.4},
    )
    storage.record_diagnostic(diag)
    diags = storage.get_diagnostics(limit=5)
    assert any(d.diag_id == "test_diag_01" for d in diags)


# ============================================================================
# 11. Invariant & Property Tests (Phase 21 Core Invariants)
# ============================================================================


def test_invariant_no_unbounded_buffer():
    """Buffer never grows past configured maximum duration in memory."""
    buf = BoundedEegBuffer(channel_names=["C3", "C4"], sampling_rate=250, max_duration_sec=1.0)
    assert buf.max_capacity_samples == 250

    for seq in range(20):  # Push 20 packets * 50 samples = 1000 samples
        pkt = EegSamplePacket(
            packet_id=f"pkt_{seq}",
            session_id="sess",
            sequence_number=seq,
            host_receive_timestamp=datetime.now(UTC).isoformat(),
            normalized_timestamp=datetime.now(UTC).isoformat(),
            sample_count=50,
            channel_count=2,
            channels=["C3", "C4"],
            data=[[1.0] * 50, [1.0] * 50],
        )
        buf.push_packet(pkt)

    assert buf.get_sample_count() <= 250
    assert buf.total_samples_dropped == 750
    assert buf.overflow_events == 15


def test_invariant_unauthorized_state_zero_hil_transmission():
    """Non-authorized safety decisions produce 0 transport transmissions."""
    bridge = LiveNeurophysiologyBridge()
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]
    data = np.random.normal(0, 15.0, (8, 250))

    # Uncalibrated -> DENIED
    res_denied = bridge.process_window(data, channels, calibration_ready=False)
    assert res_denied.safety_decision == SafetyDecision.DENIED
    assert res_denied.will_transmit is False
    assert res_denied.transport_status == "NOT_TRANSMITTED"

    # Low confidence -> HELD
    res_held = bridge.process_window(
        data, channels, calibration_ready=True, force_low_confidence=True
    )
    assert res_held.safety_decision == SafetyDecision.HELD
    assert res_held.will_transmit is False
    assert res_held.transport_status == "NOT_TRANSMITTED"


def test_invariant_physical_adapter_never_claims_fake_hardware():
    """Physical adapter never returns True for connection when hardware absent."""
    adapter = PhysicalEegAcquisitionAdapter()
    adapter._is_hardware_present = False
    assert adapter.connect() is False
    assert adapter.get_status() == EegAcquisitionState.ERROR
    devices = adapter.discover()
    assert devices[0].is_available is False


def test_invariant_session_disconnect_creates_clean_boundary():
    """Disconnect clears sequence index and stops active streaming."""
    adapter = SimulatedEegAcquisitionAdapter()
    adapter.connect()
    adapter.start_stream()
    assert adapter.read_chunk() is not None

    adapter.disconnect()
    assert adapter.get_status() == EegAcquisitionState.DISCONNECTED
    assert adapter.read_chunk() is None


def test_qc_excessive_variance_detection():
    qc = EegSignalQcEngine(max_variance_threshold_uv2=10000.0)
    data = np.clip(np.random.normal(0, 140.0, (8, 250)), -400.0, 400.0)
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    snapshots, is_nominal, degraded_count = qc.evaluate_window(data, channels)
    assert is_nominal is False
    assert snapshots["C3"].qc_status == ChannelQcStatus.EXCESSIVE_VARIANCE


def test_qc_low_variance_detection():
    qc = EegSignalQcEngine(flatline_std_threshold_uv=0.01, min_variance_threshold_uv2=0.05)
    data = np.random.normal(0, 0.1, (8, 250))  # var = 0.01 < 0.05 min variance
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    snapshots, is_nominal, degraded_count = qc.evaluate_window(data, channels)
    assert snapshots["C3"].qc_status in (ChannelQcStatus.LOW_VARIANCE, ChannelQcStatus.FLATLINE)


def test_qc_range_violation_detection():
    qc = EegSignalQcEngine(saturation_amp_threshold_uv=600.0)
    data = np.random.normal(0, 15.0, (8, 250))
    data[0, 50] = 550.0  # Outside normal range
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    snapshots, is_nominal, degraded_count = qc.evaluate_window(data, channels)
    assert snapshots["C3"].qc_status == ChannelQcStatus.RANGE_VIOLATION


def test_clock_normalizer_drift_estimation():
    normalizer = EegClockNormalizer(sampling_rate=250)
    now = datetime.now(UTC)

    for i in range(10):
        # 10 packets of 25 samples = 250 samples (1.0 sec)
        _, _, info = normalizer.normalize(
            host_receive_dt=now,
            device_timestamp=i * 0.1,
            sample_count=25,
        )

    assert info.discontinuity_count == 0
    assert info.monotonicity_verified is True


def test_bridge_lateralized_turn_left():
    bridge = LiveNeurophysiologyBridge()
    # C4 ERD (low variance in C4 compared to C3)
    data = np.zeros((8, 250), dtype=np.float64)
    data[0, :] = np.random.normal(0, 30.0, 250)  # C3 higher power
    data[2, :] = np.random.normal(0, 5.0, 250)  # C4 lower power (ERD)
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    summary = bridge.process_window(data, channels, calibration_ready=True)
    assert summary.predicted_class == "TURN_LEFT"


def test_bridge_lateralized_turn_right():
    bridge = LiveNeurophysiologyBridge()
    # C3 ERD (low variance in C3 compared to C4)
    data = np.zeros((8, 250), dtype=np.float64)
    data[0, :] = np.random.normal(0, 5.0, 250)  # C3 lower power (ERD)
    data[2, :] = np.random.normal(0, 30.0, 250)  # C4 higher power
    channels = ["C3", "Cz", "C4", "FC1", "FC2", "CP1", "CP2", "Pz"]

    summary = bridge.process_window(data, channels, calibration_ready=True)
    assert summary.predicted_class == "TURN_RIGHT"


def test_service_step_stream():
    svc = EegAcquisitionService()
    initial_count = svc.buffer.get_sample_count()
    packets = svc.step_stream(3)
    assert len(packets) == 3
    assert svc.buffer.get_sample_count() >= initial_count


def test_service_channel_health():
    svc = EegAcquisitionService()
    ch_health = svc.get_channel_health()
    assert len(ch_health) == 8
    assert all(c.is_healthy for c in ch_health)


def test_service_fault_injection_and_qc():
    svc = EegAcquisitionService()
    svc.inject_fault("FLATLINE_CHANNEL", {"channel": "C3"})
    svc.step_stream(10)
    ch_health = svc.get_channel_health()
    c3_snap = next(c for c in ch_health if c.channel_name == "C3")
    assert c3_snap.qc_status == ChannelQcStatus.FLATLINE

    # Clear fault
    svc.inject_fault("CLEAR")
    svc.step_stream(10)
    ch_health_cleared = svc.get_channel_health()
    c3_cleared = next(c for c in ch_health_cleared if c.channel_name == "C3")
    assert c3_cleared.qc_status == ChannelQcStatus.HEALTHY


# ============================================================================
# 12. REST API Endpoint Tests
# ============================================================================

client = TestClient(app)


def test_api_eeg_acquisition_status():
    resp = client.get("/api/eeg/acquisition/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "active_source" in data
    assert "health" in data


def test_api_eeg_acquisition_devices():
    resp = client.get("/api/eeg/acquisition/devices")
    assert resp.status_code == 200
    devices = resp.json()
    assert isinstance(devices, list)
    assert len(devices) >= 1


def test_api_eeg_acquisition_channels():
    resp = client.get("/api/eeg/acquisition/channels")
    assert resp.status_code == 200
    channels = resp.json()
    assert isinstance(channels, list)
    assert len(channels) == 8


def test_api_eeg_acquisition_health():
    resp = client.get("/api/eeg/acquisition/health")
    assert resp.status_code == 200
    health = resp.json()
    assert "sample_rate" in health
    assert "buffer_fill_pct" in health


def test_api_eeg_acquisition_waveforms():
    resp = client.get("/api/eeg/acquisition/waveforms?window_samples=100")
    assert resp.status_code == 200
    wave = resp.json()
    assert "channels" in wave
    assert "data" in wave


def test_api_eeg_acquisition_calibration():
    resp = client.get("/api/eeg/acquisition/calibration")
    assert resp.status_code == 200


def test_api_eeg_acquisition_diagnostics():
    resp = client.get("/api/eeg/acquisition/diagnostics?limit=10")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_api_eeg_acquisition_experiments():
    resp = client.get("/api/eeg/acquisition/experiments?limit=10")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_api_post_eeg_acquisition_discover():
    resp = client.post("/api/eeg/acquisition/discover")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_api_post_eeg_acquisition_source():
    resp = client.post("/api/eeg/acquisition/source", json={"source_type": "SIMULATOR"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_api_post_eeg_acquisition_pause_resume():
    resp_pause = client.post("/api/eeg/acquisition/pause")
    assert resp_pause.status_code == 200
    assert resp_pause.json()["state"] == "PAUSED"

    resp_resume = client.post("/api/eeg/acquisition/resume")
    assert resp_resume.status_code == 200
    assert resp_resume.json()["state"] == "STREAMING"


def test_api_post_eeg_acquisition_calibrate():
    resp = client.post("/api/eeg/acquisition/calibrate")
    assert resp.status_code == 200
    assert "manifest_hash" in resp.json()


def test_api_post_eeg_acquisition_inference():
    resp = client.post("/api/eeg/acquisition/inference", json={"override_intent": "MOVE_FORWARD"})
    assert resp.status_code == 200
    assert resp.json()["predicted_class"] == "MOVE_FORWARD"


def test_api_post_eeg_acquisition_scenario():
    resp = client.post("/api/eeg/acquisition/scenario/SCENARIO_A")
    assert resp.status_code == 200
    assert resp.json()["scenario_id"] == "SCENARIO_A"
    assert resp.json()["passed"] is True


def test_api_post_eeg_acquisition_fault_injection():
    resp = client.post("/api/eeg/acquisition/fault-injection", json={"fault_type": "CLEAR"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_api_post_eeg_acquisition_reset():
    resp = client.post("/api/eeg/acquisition/reset")
    assert resp.status_code == 200
    assert "sample_rate" in resp.json()
