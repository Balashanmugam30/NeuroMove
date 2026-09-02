"""NeuroMove — Phase 23 Multimodal Sensors & Sensor Fusion Comprehensive Test Suite."""

from __future__ import annotations

import math
from datetime import UTC, datetime
import pytest

from neuromove.domain.enums import (
    ContradictionOutcome,
    MotionContaminationState,
    SafetyDecision,
    SensorModality,
    SensorSource,
    SensorState,
    SynchronizationStatus,
    TrialQuality,
)
from neuromove.multimodal_sensors.adapters.physical import PhysicalSensorAdapter
from neuromove.multimodal_sensors.adapters.recorded import RecordedSensorAdapter
from neuromove.multimodal_sensors.adapters.simulated import SimulatedSensorAdapter
from neuromove.multimodal_sensors.calibration import MultimodalCalibrationManager
from neuromove.multimodal_sensors.clock import MultimodalClockNormalizer
from neuromove.multimodal_sensors.context import NeurophysiologyContextEngine
from neuromove.multimodal_sensors.contradiction import ContradictionDetector
from neuromove.multimodal_sensors.devices import SensorDeviceRegistry
from neuromove.multimodal_sensors.fusion import SensorFusionEngine
from neuromove.multimodal_sensors.models import (
    ContradictionRecord,
    FusionEvidence,
    FusionResult,
    MultimodalContext,
    MultimodalReplayFixture,
    MultimodalSession,
    MultimodalSyncState,
    SensorCalibrationSnapshot,
    SensorChannelHealth,
    SensorDeviceDescriptor,
    SensorHealthSnapshot,
    SensorStreamPacket,
)
from neuromove.multimodal_sensors.qc import MultimodalQcEngine
from neuromove.multimodal_sensors.replay import MultimodalReplayEngine
from neuromove.multimodal_sensors.scenarios import MultimodalGoldenScenarios
from neuromove.multimodal_sensors.service import MultimodalSensorService
from neuromove.multimodal_sensors.sync import MultimodalSyncCoordinator


@pytest.fixture
def device_registry():
    return SensorDeviceRegistry()


@pytest.fixture
def service():
    from neuromove.safety.service import SafetyService
    from neuromove.safety.models import SafetyArbitrationState
    safety = SafetyService()
    if safety.state_machine.current_state == SafetyArbitrationState.EMERGENCY_STOP:
        safety.clear_emergency_stop()
    elif safety.state_machine.current_state == SafetyArbitrationState.LOCKED_OUT:
        safety.unlock()
    safety.context_provider.reset_state()
    safety.context_provider.set_emergency_stop(False)
    safety.context_provider.set_lockout(False)
    safety.context_provider.set_operator_hold(False)
    safety.execute_reset()

    MultimodalSensorService.reset_instance()
    svc = MultimodalSensorService.get_instance()
    svc.reset_service()
    return svc


@pytest.fixture
def golden_scenarios(service):
    return MultimodalGoldenScenarios(service)


# ============================================================================
# 1. Adapter & Device Registry Tests (1-15)
# ============================================================================

def test_registry_initialization(device_registry):
    devices = device_registry.list_devices()
    assert len(devices) >= 9
    modalities = {d.modality for d in devices}
    assert SensorModality.EEG in modalities
    assert SensorModality.IMU in modalities
    assert SensorModality.EMG in modalities
    assert SensorModality.EOG in modalities
    assert SensorModality.PPG in modalities
    assert SensorModality.PRESSURE in modalities
    assert SensorModality.AUXILIARY in modalities


def test_registry_filter_by_modality(device_registry):
    eeg_devices = device_registry.list_devices(SensorModality.EEG)
    assert all(d.modality == SensorModality.EEG for d in eeg_devices)
    assert len(eeg_devices) >= 2  # Sim and Physical


def test_simulated_adapter_lifecycle():
    desc = SensorDeviceDescriptor(
        device_id="sim_eeg_test",
        name="Sim EEG",
        modality=SensorModality.EEG,
        channel_count=8,
        channel_names=["F3", "F4", "C3", "Cz", "C4", "P3", "Pz", "P4"],
        default_sampling_rate=250,
    )
    adapter = SimulatedSensorAdapter(desc, seed=123)
    assert adapter.state == SensorState.DISCONNECTED

    assert adapter.connect() is True
    assert adapter.configure(sampling_rate=250) is True
    assert adapter.state == SensorState.STREAMING

    calib = adapter.calibrate()
    assert calib.is_calibrated is True
    assert len(calib.manifest_hash) > 0

    assert adapter.start_stream("session_test_01") is True
    pkt = adapter.read_chunk(chunk_size=10)
    assert pkt is not None
    assert pkt.sample_count == 10
    assert pkt.channel_count == 8
    assert len(pkt.data) == 8
    assert len(pkt.data[0]) == 10

    assert adapter.pause() is True
    assert adapter.read_chunk() is None

    assert adapter.resume() is True
    assert adapter.read_chunk() is not None

    assert adapter.stop_stream() is True
    assert adapter.disconnect() is True
    assert adapter.state == SensorState.DISCONNECTED


def test_simulated_adapter_determinism():
    desc = SensorDeviceDescriptor(
        device_id="sim_imu_det",
        name="Sim IMU",
        modality=SensorModality.IMU,
        channel_count=6,
        channel_names=["AX", "AY", "AZ", "GX", "GY", "GZ"],
        default_sampling_rate=100,
    )
    a1 = SimulatedSensorAdapter(desc, seed=42)
    a2 = SimulatedSensorAdapter(desc, seed=42)

    a1.connect()
    a1.start_stream("s1")
    p1 = a1.read_chunk(chunk_size=5)

    a2.connect()
    a2.start_stream("s1")
    p2 = a2.read_chunk(chunk_size=5)

    assert p1 is not None and p2 is not None
    assert p1.data == p2.data


def test_recorded_adapter_replay():
    desc = SensorDeviceDescriptor(
        device_id="rec_emg_test",
        name="Recorded EMG",
        modality=SensorModality.EMG,
        source=SensorSource.RECORDED,
        channel_count=2,
        channel_names=["EMG1", "EMG2"],
        default_sampling_rate=500,
    )
    data = [[float(i) for i in range(100)], [float(i * 2) for i in range(100)]]
    adapter = RecordedSensorAdapter(desc, recorded_data=data, sampling_rate=500)
    adapter.connect()
    adapter.start_stream("s_rec")

    pkt = adapter.read_chunk(chunk_size=10)
    assert pkt is not None
    assert pkt.source == SensorSource.RECORDED
    assert pkt.data[0] == [float(i) for i in range(10)]
    assert pkt.data[1] == [float(i * 2) for i in range(10)]


def test_physical_adapter_honest_availability():
    desc = SensorDeviceDescriptor(
        device_id="phys_eeg_unavail",
        name="Physical EEG",
        modality=SensorModality.EEG,
        source=SensorSource.PHYSICAL,
        connection_path="COM99_NON_EXISTENT",
    )
    adapter = PhysicalSensorAdapter(desc)
    discovered = adapter.discover()
    assert discovered[0].is_available is False
    assert adapter.connect() is False
    assert adapter.state == SensorState.ERROR


def test_simulated_adapter_imu_active_motion():
    desc = SensorDeviceDescriptor(
        device_id="sim_imu_motion",
        name="Sim IMU",
        modality=SensorModality.IMU,
        channel_count=6,
        channel_names=["AX", "AY", "AZ", "GX", "GY", "GZ"],
        default_sampling_rate=100,
    )
    adapter = SimulatedSensorAdapter(desc)
    adapter.connect()
    adapter.start_stream("s_motion")

    # Baseline quiet
    adapter.set_motion_active(False)
    p_quiet = adapter.read_chunk(chunk_size=10)
    # Active motion
    adapter.set_motion_active(True)
    p_active = adapter.read_chunk(chunk_size=10)

    assert p_quiet is not None and p_active is not None
    # Gyro Z in active motion has much higher amplitude
    assert max(abs(v) for v in p_active.data[5]) > max(abs(v) for v in p_quiet.data[5])


def test_simulated_adapter_emg_burst():
    desc = SensorDeviceDescriptor(
        device_id="sim_emg_burst",
        name="Sim EMG",
        modality=SensorModality.EMG,
        channel_count=2,
        channel_names=["EMG1", "EMG2"],
        default_sampling_rate=500,
    )
    adapter = SimulatedSensorAdapter(desc)
    adapter.connect()
    adapter.start_stream("s_emg")

    adapter.set_emg_burst(False)
    p_quiet = adapter.read_chunk(chunk_size=10)
    adapter.set_emg_burst(True)
    p_burst = adapter.read_chunk(chunk_size=10)

    assert p_quiet is not None and p_burst is not None
    assert max(abs(v) for v in p_burst.data[0]) > max(abs(v) for v in p_quiet.data[0])


def test_simulated_adapter_eog_blink():
    desc = SensorDeviceDescriptor(
        device_id="sim_eog_blink",
        name="Sim EOG",
        modality=SensorModality.EOG,
        channel_count=2,
        channel_names=["V", "H"],
        default_sampling_rate=250,
    )
    adapter = SimulatedSensorAdapter(desc)
    adapter.connect()
    adapter.start_stream("s_eog")

    adapter.set_eog_blink(False)
    p_quiet = adapter.read_chunk(chunk_size=20)
    adapter.set_eog_blink(True)
    p_blink = adapter.read_chunk(chunk_size=20)

    assert p_quiet is not None and p_blink is not None
    assert max(abs(v) for v in p_blink.data[0]) > max(abs(v) for v in p_quiet.data[0])


def test_simulated_adapter_ppg():
    desc = SensorDeviceDescriptor(
        device_id="sim_ppg",
        name="Sim PPG",
        modality=SensorModality.PPG,
        channel_count=1,
        channel_names=["PPG"],
        default_sampling_rate=100,
    )
    adapter = SimulatedSensorAdapter(desc)
    adapter.connect()
    adapter.start_stream("s_ppg")
    pkt = adapter.read_chunk(chunk_size=10)
    assert pkt is not None
    assert all(v > 0.0 for v in pkt.data[0])


def test_simulated_adapter_pressure():
    desc = SensorDeviceDescriptor(
        device_id="sim_press",
        name="Sim Pressure",
        modality=SensorModality.PRESSURE,
        channel_count=4,
        channel_names=["P1", "P2", "P3", "P4"],
        default_sampling_rate=50,
    )
    adapter = SimulatedSensorAdapter(desc)
    adapter.connect()
    adapter.start_stream("s_press")
    pkt = adapter.read_chunk(chunk_size=10)
    assert pkt is not None
    assert len(pkt.data) == 4
    assert all(v > 0.0 for v in pkt.data[0])


def test_simulated_adapter_fault_injection():
    desc = SensorDeviceDescriptor(
        device_id="sim_fault",
        name="Sim Fault",
        modality=SensorModality.EEG,
        channel_count=2,
        channel_names=["C3", "C4"],
    )
    adapter = SimulatedSensorAdapter(desc)
    adapter.connect()
    adapter.start_stream("s_fault")

    # Dropout (zeros)
    adapter.inject_fault(dropout=True)
    p_drop = adapter.read_chunk(chunk_size=5)
    assert p_drop is not None and all(v == 0.0 for v in p_drop.data[0])

    # Flatline (constant)
    adapter.inject_fault(flatline=True)
    p_flat = adapter.read_chunk(chunk_size=5)
    assert p_flat is not None and all(v == 42.0 for v in p_flat.data[0])

    # Saturation
    adapter.inject_fault(saturation=True)
    p_sat = adapter.read_chunk(chunk_size=5)
    assert p_sat is not None and all(v == 10000.0 for v in p_sat.data[0])


# ============================================================================
# 2. Clock Normalization & Synchronization Tests (16-30)
# ============================================================================

def test_clock_normalizer_monotonic():
    norm = MultimodalClockNormalizer(sensor_id="sensor_test", sampling_rate=250)
    ts1, is_mono1, offset1, drift1 = norm.normalize(device_timestamp=0.0, sample_count=10)
    ts2, is_mono2, offset2, drift2 = norm.normalize(device_timestamp=0.04, sample_count=10)
    assert is_mono1 is True
    assert is_mono2 is True
    assert ts2 > ts1


def test_clock_normalizer_backwards_timestamp_detection():
    norm = MultimodalClockNormalizer(sensor_id="sensor_test", sampling_rate=250)
    norm.normalize(device_timestamp=10.0, sample_count=10)
    ts, is_mono, offset, drift = norm.normalize(device_timestamp=5.0, sample_count=10)
    assert is_mono is False


def test_clock_normalizer_drift_calculation():
    norm = MultimodalClockNormalizer(sensor_id="sensor_test", sampling_rate=100)
    t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    norm.normalize(host_receive_dt=t0, device_timestamp=0.0, sample_count=10)

    # 1 second later on host, but device timestamp elapsed 1.001s (1000 ppm drift)
    t1 = datetime(2026, 1, 1, 12, 0, 1, tzinfo=UTC)
    ts, is_mono, offset, drift = norm.normalize(host_receive_dt=t1, device_timestamp=1.001, sample_count=10)
    assert abs(drift - 1000.0) < 50.0


def test_sync_coordinator_synchronized():
    coord = MultimodalSyncCoordinator(session_id="sync_sess_01", primary_sensor_id="eeg")
    coord.register_sensor("eeg", 250)
    coord.register_sensor("imu", 100)

    coord.update_packet("eeg", device_timestamp=0.0, sample_count=10)
    coord.update_packet("imu", device_timestamp=0.0, sample_count=4)

    state = coord.get_sync_state()
    assert state.status == SynchronizationStatus.SYNCHRONIZED
    assert state.is_aligned is True
    assert state.alignment_quality_pct == 100.0


def test_sync_coordinator_degraded_offset():
    coord = MultimodalSyncCoordinator(session_id="sync_sess_02", primary_sensor_id="eeg")
    coord.register_sensor("eeg", 250)
    coord.register_sensor("imu", 100)

    # Introduce 40ms offset
    coord._offsets_ms["eeg"] = 0.0
    coord._offsets_ms["imu"] = 40.0
    coord._recalculate_sync_status()

    state = coord.get_sync_state()
    assert state.status == SynchronizationStatus.DEGRADED
    assert state.is_aligned is False


def test_sync_coordinator_unsynchronized_large_disparity():
    coord = MultimodalSyncCoordinator(session_id="sync_sess_03", primary_sensor_id="eeg")
    coord.register_sensor("eeg", 250)
    coord.register_sensor("imu", 100)

    # Introduce 150ms offset disparity
    coord._offsets_ms["eeg"] = 0.0
    coord._offsets_ms["imu"] = 150.0
    coord._recalculate_sync_status()

    state = coord.get_sync_state()
    assert state.status == SynchronizationStatus.UNSYNCHRONIZED
    assert state.is_aligned is False
    assert state.alignment_quality_pct == 0.0


def test_sync_coordinator_reset():
    coord = MultimodalSyncCoordinator(session_id="sync_sess_04")
    coord.register_sensor("eeg", 250)
    coord._offsets_ms["eeg"] = 200.0
    coord._recalculate_sync_status()
    assert coord.get_sync_state().status == SynchronizationStatus.UNSYNCHRONIZED

    coord.reset()
    assert coord.get_sync_state().status == SynchronizationStatus.SYNCHRONIZED


# ============================================================================
# 3. Quality Control (QC) Engine Tests (31-45)
# ============================================================================

def test_qc_engine_clean_packet():
    qc = MultimodalQcEngine()
    pkt = SensorStreamPacket(
        sensor_id="s_eeg",
        modality=SensorModality.EEG,
        session_id="sess_01",
        sample_count=10,
        channel_count=2,
        channel_names=["C3", "C4"],
        data=[[10.0 + i for i in range(10)], [-5.0 + i for i in range(10)]],
    )
    ch_health, flags = qc.evaluate_packet(pkt)
    assert len(flags) == 0
    assert len(ch_health) == 2
    assert all(ch.is_usable for ch in ch_health)
    assert all(ch.qc_status == TrialQuality.VALID for ch in ch_health)


def test_qc_engine_sequence_gap():
    qc = MultimodalQcEngine()
    p1 = SensorStreamPacket(
        sensor_id="s_eeg",
        modality=SensorModality.EEG,
        session_id="s1",
        sequence_number=1,
        sample_count=5,
        channel_count=1,
        channel_names=["C3"],
        data=[[1.0, 2.0, 3.0, 4.0, 5.0]],
    )
    p2 = SensorStreamPacket(
        sensor_id="s_eeg",
        modality=SensorModality.EEG,
        session_id="s1",
        sequence_number=4,  # Gap of 2 packets (2 and 3 missing)
        sample_count=5,
        channel_count=1,
        channel_names=["C3"],
        data=[[1.0, 2.0, 3.0, 4.0, 5.0]],
    )
    qc.evaluate_packet(p1)
    ch_health, flags = qc.evaluate_packet(p2)
    assert any("SEQUENCE_GAP" in f for f in flags)
    assert qc.get_packet_loss_rate("s_eeg") > 0.0


def test_qc_engine_nonfinite_values():
    qc = MultimodalQcEngine()
    pkt = SensorStreamPacket(
        sensor_id="s_imu",
        modality=SensorModality.IMU,
        session_id="s1",
        sample_count=3,
        channel_count=1,
        channel_names=["AX"],
        data=[[1.0, float("nan"), 3.0]],
    )
    ch_health, flags = qc.evaluate_packet(pkt)
    assert any("NONFINITE" in f for f in flags)
    assert ch_health[0].is_usable is False


def test_qc_engine_flatline_detection():
    qc = MultimodalQcEngine()
    pkt = SensorStreamPacket(
        sensor_id="s_eeg",
        modality=SensorModality.EEG,
        session_id="s1",
        sample_count=10,
        channel_count=1,
        channel_names=["Cz"],
        data=[[5.0] * 10],  # zero variance flatline
    )
    ch_health, flags = qc.evaluate_packet(pkt)
    assert ch_health[0].flatline_rate == 1.0
    assert ch_health[0].is_usable is False
    assert ch_health[0].qc_status == TrialQuality.REJECTED


def test_qc_engine_saturation_detection():
    qc = MultimodalQcEngine()
    pkt = SensorStreamPacket(
        sensor_id="s_eeg",
        modality=SensorModality.EEG,
        session_id="s1",
        sample_count=5,
        channel_count=1,
        channel_names=["F3"],
        data=[[1000.0] * 5],  # > 500uV saturation
    )
    ch_health, flags = qc.evaluate_packet(pkt)
    assert ch_health[0].saturation_rate == 1.0
    assert ch_health[0].is_usable is False


def test_qc_engine_dropout_detection():
    qc = MultimodalQcEngine()
    pkt = SensorStreamPacket(
        sensor_id="s_eeg",
        modality=SensorModality.EEG,
        session_id="s1",
        sample_count=5,
        channel_count=1,
        channel_names=["Pz"],
        data=[[0.0] * 5],  # dropout zeros
    )
    ch_health, flags = qc.evaluate_packet(pkt)
    assert ch_health[0].dropout_rate == 1.0
    assert ch_health[0].is_usable is False


# ============================================================================
# 4. Calibration Manager Tests (46-55)
# ============================================================================

def test_calibration_manager_flow():
    mgr = MultimodalCalibrationManager()
    assert mgr.is_calibrated("sensor_imu_01") is False

    snap = mgr.calibrate_sensor(
        sensor_id="sensor_imu_01",
        modality=SensorModality.IMU,
        parameters={"zero_bias": [0.0, 0.0, 0.0]},
    )
    assert snap.is_calibrated is True
    assert mgr.is_calibrated("sensor_imu_01") is True

    mgr.invalidate_calibration("sensor_imu_01")
    assert mgr.is_calibrated("sensor_imu_01") is False


def test_calibration_manager_check_all_ready():
    mgr = MultimodalCalibrationManager()
    mgr.calibrate_sensor("s1", SensorModality.EEG)
    mgr.calibrate_sensor("s2", SensorModality.IMU)

    assert mgr.check_all_ready(["s1", "s2"]) is True
    assert mgr.check_all_ready(["s1", "s2", "s3_uncalib"]) is False


# ============================================================================
# 5. Contradiction Detection Tests (56-65)
# ============================================================================

def test_contradiction_intent_vs_motion():
    det = ContradictionDetector()
    health = {
        "eeg": SensorHealthSnapshot(sensor_id="eeg", modality=SensorModality.EEG, is_healthy=True),
        "imu": SensorHealthSnapshot(sensor_id="imu", modality=SensorModality.IMU, is_healthy=True),
    }
    # Violent motion energy 25.0 m/s^2 during intent FORWARD
    contras = det.evaluate_contradictions(
        candidate_intent="FORWARD",
        motion_state="MOVING",
        imu_energy=25.0,
        sync_state=None,
        sensor_healths=health,
        calibrations_ready=True,
    )
    assert len(contras) == 1
    assert contras[0].rule_name == "CONTRADICTION_INTENT_VS_MOTION"
    assert contras[0].outcome == ContradictionOutcome.HOLD


def test_contradiction_desynchronization():
    det = ContradictionDetector()
    sync = MultimodalSyncState(
        session_id="s1",
        global_session_time_iso=datetime.now(UTC).isoformat(),
        status=SynchronizationStatus.UNSYNCHRONIZED,
        primary_clock_sensor_id="eeg",
        max_jitter_ms=120.0,
        alignment_quality_pct=0.0,
        is_aligned=False,
    )
    contras = det.evaluate_contradictions(
        candidate_intent="FORWARD",
        motion_state="STATIONARY",
        imu_energy=0.5,
        sync_state=sync,
        sensor_healths={},
        calibrations_ready=True,
    )
    assert any(c.rule_name == "CONTRADICTION_DESYNCHRONIZATION" for c in contras)


def test_contradiction_degraded_sensor():
    det = ContradictionDetector()
    health = {
        "eeg": SensorHealthSnapshot(sensor_id="eeg", modality=SensorModality.EEG, is_healthy=False),
    }
    contras = det.evaluate_contradictions(
        candidate_intent="FORWARD",
        motion_state="STATIONARY",
        imu_energy=0.5,
        sync_state=None,
        sensor_healths=health,
        calibrations_ready=True,
    )
    assert any(c.rule_name == "CONTRADICTION_SENSOR_DEGRADED" for c in contras)


# ============================================================================
# 6. Sensor Fusion & Context Engine Tests (66-80)
# ============================================================================

def test_sensor_fusion_engine_healthy():
    engine = SensorFusionEngine()
    pkt_eeg = SensorStreamPacket(
        sensor_id="eeg", modality=SensorModality.EEG, session_id="s1", data=[[1.0] * 10]
    )
    pkt_imu = SensorStreamPacket(
        sensor_id="imu", modality=SensorModality.IMU, session_id="s1", data=[[0.05] * 10, [0.05] * 10, [9.81] * 10]
    )
    res = engine.fuse(
        eeg_confidence=0.90,
        candidate_intent="FORWARD",
        packets={"eeg": pkt_eeg, "imu": pkt_imu},
        sensor_healths={},
        sync_state=None,
        contradictions=[],
    )
    assert res.is_valid is True
    assert res.has_contradiction is False
    assert res.fused_context_score >= 0.80
    assert len(res.evidence) >= 1


def test_sensor_fusion_engine_with_hold_contradiction():
    engine = SensorFusionEngine()
    contra = ContradictionRecord(
        contradiction_id="c1",
        rule_name="CONTRADICTION_INTENT_VS_MOTION",
        conflicting_sensor_ids=["imu"],
        conflicting_modalities=[SensorModality.IMU],
        outcome=ContradictionOutcome.HOLD,
        reason="Violent motion",
    )
    res = engine.fuse(
        eeg_confidence=0.95,
        candidate_intent="FORWARD",
        packets={},
        sensor_healths={},
        sync_state=None,
        contradictions=[contra],
    )
    assert res.has_contradiction is True
    assert res.contradiction_outcome == ContradictionOutcome.HOLD
    assert res.context_confidence <= 0.40
    assert res.is_valid is False


def test_context_engine_quiet_vs_contaminated():
    ctx_engine = NeurophysiologyContextEngine()
    fusion = FusionResult(
        fusion_id="f1",
        participating_sensor_ids=["eeg", "imu"],
        participating_modalities=[SensorModality.EEG, SensorModality.IMU],
        is_valid=True,
    )

    # Quiet IMU
    pkt_quiet = SensorStreamPacket(
        sensor_id="imu", modality=SensorModality.IMU, session_id="s1", data=[[0.0] * 10, [0.0] * 10, [9.81] * 10]
    )
    ctx_quiet = ctx_engine.evaluate_context(
        session_id="s1",
        packets={"imu": pkt_quiet},
        fusion_result=fusion,
        contradictions=[],
    )
    assert ctx_quiet.motion_state == "STATIONARY"
    assert ctx_quiet.motion_contamination_state == MotionContaminationState.MOTION_QUIET
    assert ctx_quiet.is_eeg_contaminated is False

    # Moving / high variance IMU
    pkt_moving = SensorStreamPacket(
        sensor_id="imu", modality=SensorModality.IMU, session_id="s1", data=[[float(i % 5) for i in range(10)], [0.0] * 10, [9.81] * 10]
    )
    ctx_moving = ctx_engine.evaluate_context(
        session_id="s1",
        packets={"imu": pkt_moving},
        fusion_result=fusion,
        contradictions=[],
    )
    assert ctx_moving.motion_state == "MOVING"


# ============================================================================
# 7. 12 Golden Scenarios Tests (81-95)
# ============================================================================

def test_golden_scenario_a_eeg_imu_healthy(golden_scenarios):
    res = golden_scenarios.scenario_a_eeg_imu_healthy()
    assert res["passed"] is True
    assert res["data"]["is_authorized"] is True
    assert res["data"]["hil_dispatched"] is True


def test_golden_scenario_b_eeg_only(golden_scenarios):
    res = golden_scenarios.scenario_b_eeg_only()
    assert res["passed"] is True
    assert res["data"]["is_authorized"] is True
    assert res["data"]["participating_sensors"] == ["sensor_eeg_sim"]


def test_golden_scenario_c_imu_disconnect(golden_scenarios):
    res = golden_scenarios.scenario_c_imu_disconnect()
    assert res["passed"] is True
    assert "sensor_imu_sim" not in res["data"]["participating_sensors"]


def test_golden_scenario_d_timestamp_drift(golden_scenarios):
    res = golden_scenarios.scenario_d_timestamp_drift()
    assert res["passed"] is True
    assert res["data"]["sync_status"] in ("UNSYNCHRONIZED", "DEGRADED")


def test_golden_scenario_e_contradictory_context(golden_scenarios):
    res = golden_scenarios.scenario_e_contradictory_context()
    assert res["passed"] is True
    assert res["data"]["has_contradiction"] is True
    assert res["data"]["safety_verdict"] == "HELD"
    assert res["data"]["hil_dispatched"] is False


def test_golden_scenario_f_channel_dropout(golden_scenarios):
    res = golden_scenarios.scenario_f_channel_dropout()
    assert res["passed"] is True
    assert res["data"]["is_authorized"] is False


def test_golden_scenario_g_emg_context(golden_scenarios):
    res = golden_scenarios.scenario_g_emg_context()
    assert res["passed"] is True
    assert "sensor_emg_sim" in res["data"]["participating_sensors"]


def test_golden_scenario_h_eog_artifact(golden_scenarios):
    res = golden_scenarios.scenario_h_eog_artifact()
    assert res["passed"] is True
    assert "sensor_eog_sim" in res["data"]["participating_sensors"]


def test_golden_scenario_i_deterministic_replay(golden_scenarios):
    res = golden_scenarios.scenario_i_deterministic_replay()
    assert res["passed"] is True


def test_golden_scenario_j_fault_recovery(golden_scenarios):
    res = golden_scenarios.scenario_j_fault_recovery()
    assert res["passed"] is True


def test_golden_scenario_k_authorized_end_to_end(golden_scenarios):
    res = golden_scenarios.scenario_k_authorized_end_to_end()
    assert res["passed"] is True
    assert res["data"]["is_authorized"] is True
    assert res["data"]["hil_dispatched"] is True
    assert "virtual emulator" in res["data"]["hil_reason"].lower()


def test_golden_scenario_l_unsafe_state(golden_scenarios):
    res = golden_scenarios.scenario_l_unsafe_state()
    assert res["passed"] is True
    assert res["data"]["is_authorized"] is False
    assert res["data"]["hil_dispatched"] is False


# ============================================================================
# 8. End-to-End Multimodal Service Integration Tests (96-105)
# ============================================================================

def test_service_read_multimodal_frame(service):
    service.start_session("s_e2e", ["sensor_eeg_sim", "sensor_imu_sim"])
    packets, context, fusion, sync = service.read_multimodal_frame(chunk_size=10)
    assert len(packets) == 2
    assert context.session_id == "s_e2e"
    assert fusion.is_valid is True
    assert sync.is_aligned is True


def test_service_fault_injection_and_clear(service):
    service.start_session("s_faults", ["sensor_eeg_sim", "sensor_imu_sim"])
    assert service.inject_fault("sensor_imu_sim", "MOTION_BURST") is True

    res = service.process_inference_frame()
    assert res["has_contradiction"] is True

    service.clear_faults("sensor_imu_sim")
    res_clean = service.process_inference_frame()
    assert res_clean["has_contradiction"] is False


def test_service_analytics_summary(service):
    summary = service.get_analytics_summary()
    assert summary.session_count >= 1
    assert summary.sensor_availability_pct == 100.0
    assert summary.mean_sync_latency_ms < 5.0
    assert summary.mean_fusion_latency_ms < 5.0


# ============================================================================
# 9. Modality Ablation & Multi-Sensor Combinations (106-125)
# ============================================================================

def test_ablation_all_modalities_active(service):
    modalities = [
        "sensor_eeg_sim",
        "sensor_imu_sim",
        "sensor_emg_sim",
        "sensor_eog_sim",
        "sensor_ppg_sim",
        "sensor_press_sim",
    ]
    for s_id in modalities:
        service.connect_device(s_id)
        service.calibrate_device(s_id)

    service.start_session("s_all_mods", modalities)
    res = service.process_inference_frame()
    assert len(res["participating_sensors"]) == 6
    assert res["is_authorized"] is True


def test_ablation_eeg_plus_emg_only(service):
    service.connect_device("sensor_eeg_sim")
    service.connect_device("sensor_emg_sim")
    service.disconnect_device("sensor_imu_sim")
    service.calibrate_device("sensor_eeg_sim")
    service.calibrate_device("sensor_emg_sim")
    service.start_session("s_eeg_emg", ["sensor_eeg_sim", "sensor_emg_sim"])

    res = service.process_inference_frame()
    assert set(res["participating_sensors"]) == {"sensor_eeg_sim", "sensor_emg_sim"}
    assert res["is_authorized"] is True


def test_ablation_eeg_plus_eog_only(service):
    service.connect_device("sensor_eeg_sim")
    service.connect_device("sensor_eog_sim")
    service.disconnect_device("sensor_imu_sim")
    service.calibrate_device("sensor_eeg_sim")
    service.calibrate_device("sensor_eog_sim")
    service.start_session("s_eeg_eog", ["sensor_eeg_sim", "sensor_eog_sim"])

    res = service.process_inference_frame()
    assert set(res["participating_sensors"]) == {"sensor_eeg_sim", "sensor_eog_sim"}
    assert res["is_authorized"] is True


def test_ablation_eeg_plus_pressure_only(service):
    service.connect_device("sensor_eeg_sim")
    service.connect_device("sensor_press_sim")
    service.disconnect_device("sensor_imu_sim")
    service.calibrate_device("sensor_eeg_sim")
    service.calibrate_device("sensor_press_sim")
    service.start_session("s_eeg_press", ["sensor_eeg_sim", "sensor_press_sim"])

    res = service.process_inference_frame()
    assert set(res["participating_sensors"]) == {"sensor_eeg_sim", "sensor_press_sim"}
    assert res["is_authorized"] is True


def test_ablation_loss_of_seating_pressure(service):
    service.connect_device("sensor_eeg_sim")
    service.connect_device("sensor_press_sim")
    service.calibrate_device("sensor_eeg_sim")
    service.calibrate_device("sensor_press_sim")
    service.start_session("s_unseat", ["sensor_eeg_sim", "sensor_press_sim"])

    # Simulate 0 pressure (user stood up or disconnected)
    adapter = service.registry.get_adapter("sensor_press_sim")
    if isinstance(adapter, SimulatedSensorAdapter):
        adapter.inject_fault(dropout=True)

    res = service.process_inference_frame()
    assert res["is_movement_valid"] is False
    assert res["is_authorized"] is False


def test_sampling_rate_mismatch_synchronization(service):
    # EEG 250 Hz, IMU 100 Hz, EMG 500 Hz, Pressure 50 Hz
    service.connect_device("sensor_eeg_sim")
    service.connect_device("sensor_imu_sim")
    service.connect_device("sensor_emg_sim")
    service.connect_device("sensor_press_sim")
    service.calibrate_device("sensor_eeg_sim")
    service.calibrate_device("sensor_imu_sim")
    service.calibrate_device("sensor_emg_sim")
    service.calibrate_device("sensor_press_sim")

    service.start_session("s_mismatch_rate", ["sensor_eeg_sim", "sensor_imu_sim", "sensor_emg_sim", "sensor_press_sim"])
    packets, context, fusion, sync = service.read_multimodal_frame(chunk_size=10)

    assert len(packets) == 4
    assert sync.is_aligned is True
    assert sync.alignment_quality_pct >= 90.0


# ============================================================================
# 10. Storage & Serialization Verification (126-140)
# ============================================================================

def test_storage_save_and_retrieve_session(service):
    sess = MultimodalSession(
        session_id="storage_sess_01",
        subject_id="SUBJ_TEST_99",
        active_sensors=["sensor_eeg_sim", "sensor_imu_sim"],
        global_state=SensorState.STREAMING,
    )
    service.storage.save_session(sess)


def test_storage_save_device_descriptor(service):
    desc = SensorDeviceDescriptor(
        device_id="storage_dev_01",
        name="Storage Sensor",
        modality=SensorModality.IMU,
        channel_count=6,
    )
    service.storage.save_device(desc)


def test_storage_save_calibration(service):
    calib = SensorCalibrationSnapshot(
        calibration_id="storage_calib_01",
        sensor_id="sensor_eeg_sim",
        modality=SensorModality.EEG,
        parameters={"gain": 24},
        quality_metrics={"snr_db": 25.0},
        manifest_hash="calib_hash_01",
    )
    service.storage.save_calibration(calib)


def test_storage_save_fusion_result(service):
    fusion = FusionResult(
        fusion_id="storage_fuse_01",
        participating_sensor_ids=["s1", "s2"],
        participating_modalities=[SensorModality.EEG, SensorModality.IMU],
        is_valid=True,
    )
    service.storage.save_fusion_result("storage_sess_01", fusion)


def test_storage_save_context_event(service):
    ctx = MultimodalContext(
        context_id="storage_ctx_01",
        session_id="storage_sess_01",
        motion_state="STATIONARY",
        motion_contamination_state=MotionContaminationState.MOTION_QUIET,
        is_movement_valid=True,
    )
    service.storage.save_context_event(ctx)


# ============================================================================
# 11. Strict Non-Actuation & Safety Invariant Tests (141-150)
# ============================================================================

def test_safety_non_actuation_guarantee(service):
    service.connect_device("sensor_eeg_sim")
    service.calibrate_device("sensor_eeg_sim")
    service.start_session("s_safe", ["sensor_eeg_sim"])
    res = service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.95)

    # Downstream target must strictly be Phase 20 ESP32 virtual emulator (0 physical motors)
    assert res["is_authorized"] is True
    assert "virtual emulator" in res["hil_reason"].lower()
    assert "0 physical motors" in res["hil_reason"].lower()


def test_safety_hold_on_low_confidence(service):
    service.connect_device("sensor_eeg_sim")
    service.calibrate_device("sensor_eeg_sim")
    service.start_session("s_low_conf", ["sensor_eeg_sim"])
    res = service.process_inference_frame(candidate_intent="FORWARD", eeg_confidence=0.40)

    assert res["safety_verdict"] == "HELD"
    assert res["is_authorized"] is False
    assert res["hil_dispatched"] is False


def test_safety_hold_on_eog_blink_coincidence(service):
    service.connect_device("sensor_eeg_sim")
    service.connect_device("sensor_eog_sim")
    service.calibrate_device("sensor_eeg_sim")
    service.calibrate_device("sensor_eog_sim")
    service.start_session("s_eog_coincidence", ["sensor_eeg_sim", "sensor_eog_sim"])

    service.inject_fault("sensor_eog_sim", "BLINK")
    packets, context, fusion, sync = service.read_multimodal_frame()

    assert context.ocular_artifact_detected is True
    assert context.is_eeg_contaminated is True


def test_replay_fixture_immutability(service):
    f = service.replay_engine.get_fixture("fixture_eeg_imu_healthy")
    assert f is not None
    assert f.duration_sec == 10.0
    assert len(f.checksum) > 0
    data = service.replay_engine.get_fixture_data("fixture_eeg_imu_healthy")
    assert data is not None
    assert "sensor_eeg_sim" in data
    assert "sensor_imu_sim" in data


# ============================================================================
# 12. Parametric Modality & Protocol Verification (151-180)
# ============================================================================

@pytest.mark.parametrize("modality", [
    SensorModality.EEG,
    SensorModality.IMU,
    SensorModality.EMG,
    SensorModality.EOG,
    SensorModality.PPG,
    SensorModality.PRESSURE,
    SensorModality.AUXILIARY,
])
def test_modality_adapter_creation_and_streaming(modality):
    desc = SensorDeviceDescriptor(
        device_id=f"param_test_{modality.value.lower()}",
        name=f"Param {modality.value}",
        modality=modality,
        channel_count=2,
        channel_names=["CH1", "CH2"],
        default_sampling_rate=100,
    )
    adapter = SimulatedSensorAdapter(desc, seed=99)
    assert adapter.connect() is True
    assert adapter.start_stream("param_sess") is True
    pkt = adapter.read_chunk(chunk_size=10)
    assert pkt is not None
    assert pkt.modality == modality
    assert pkt.sample_count == 10
    assert pkt.channel_count == 2
    assert len(pkt.data) == 2
    assert len(pkt.data[0]) == 10
    adapter.disconnect()


@pytest.mark.parametrize("fault_type", [
    "DROPOUT",
    "FLATLINE",
    "SATURATION",
    "NOISE",
    "MOTION_BURST",
    "BLINK",
    "DISCONNECT",
])
def test_service_all_fault_types(service, fault_type):
    service.connect_device("sensor_eeg_sim")
    service.connect_device("sensor_imu_sim")
    service.connect_device("sensor_eog_sim")
    service.start_session(f"sess_fault_{fault_type}", ["sensor_eeg_sim", "sensor_imu_sim", "sensor_eog_sim"])

    target_sensor = "sensor_eog_sim" if fault_type == "BLINK" else "sensor_imu_sim" if fault_type == "MOTION_BURST" else "sensor_eeg_sim"
    assert service.inject_fault(target_sensor, fault_type) is True
    service.clear_faults()


@pytest.mark.parametrize("scenario_id", [
    "SCENARIO_A",
    "SCENARIO_B",
    "SCENARIO_C",
    "SCENARIO_D",
    "SCENARIO_E",
    "SCENARIO_F",
    "SCENARIO_G",
    "SCENARIO_H",
    "SCENARIO_I",
    "SCENARIO_J",
    "SCENARIO_K",
    "SCENARIO_L",
])
def test_golden_scenario_runner_dispatch(golden_scenarios, scenario_id):
    res = golden_scenarios.run_scenario(scenario_id)
    assert res["passed"] is True
    assert res["scenario_id"] == scenario_id


def test_sync_coordinator_drift_thresholds():
    coord = MultimodalSyncCoordinator(session_id="drift_thresh_sess")
    coord.register_sensor("s1", 250)
    coord.register_sensor("s2", 250)

    # 60 ppm drift -> DRIFT_DETECTED
    coord._drifts_ppm["s1"] = 0.0
    coord._drifts_ppm["s2"] = 60.0
    coord._offsets_ms["s1"] = 0.0
    coord._offsets_ms["s2"] = 5.0
    coord._recalculate_sync_status()
    assert coord.get_sync_state().status == SynchronizationStatus.DRIFT_DETECTED

    # 35ms offset -> DEGRADED
    coord._offsets_ms["s2"] = 35.0
    coord._recalculate_sync_status()
    assert coord.get_sync_state().status == SynchronizationStatus.DEGRADED

    # 120ms offset -> UNSYNCHRONIZED
    coord._offsets_ms["s2"] = 120.0
    coord._recalculate_sync_status()
    assert coord.get_sync_state().status == SynchronizationStatus.UNSYNCHRONIZED


def test_qc_engine_packet_loss_calculation():
    qc = MultimodalQcEngine()
    for seq in [1, 2, 5, 6, 10]:
        pkt = SensorStreamPacket(
            sensor_id="loss_test",
            modality=SensorModality.EEG,
            session_id="s1",
            sequence_number=seq,
            sample_count=5,
            channel_count=1,
            channel_names=["C3"],
            data=[[1.0] * 5],
        )
        qc.evaluate_packet(pkt)

    loss_rate = qc.get_packet_loss_rate("loss_test")
    assert 0.0 < loss_rate < 1.0


def test_service_connect_unknown_device(service):
    assert service.connect_device("non_existent_device_id") is False
    assert service.disconnect_device("non_existent_device_id") is False
    assert service.configure_device("non_existent_device_id") is False
    calib = service.calibrate_device("non_existent_device_id")
    assert calib.is_ready is False


def test_service_list_devices_filtered(service):
    imu_list = service.list_devices(SensorModality.IMU)
    assert all(d.modality == SensorModality.IMU for d in imu_list)
    assert len(imu_list) >= 1


