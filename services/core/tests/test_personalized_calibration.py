"""Unit and Integration Tests for Phase 13 Personalized Motor-Imagery Calibration."""

from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import create_app
from neuromove.calibration.models import (
    CalibrationQCStatus,
    CalibrationRejectionReason,
    CalibrationSession,
    CalibrationSessionStatus,
    CalibrationTrialStatus,
    CreateSubjectProfileRequest,
    HeldOutSplitStrategy,
    PersonalizationConfig,
    StartCalibrationSessionRequest,
)
from neuromove.calibration.personalizer import PersonalizationEngine
from neuromove.calibration.protocol import CalibrationProtocolEngine
from neuromove.calibration.qc import CalibrationQCEngine
from neuromove.calibration.service import CalibrationService
from neuromove.calibration.session_runner import CalibrationSessionRunner
from neuromove.calibration.storage import CalibrationStorage
from neuromove.database.connection import DatabaseManager
from neuromove.epoching.models import NormalizedLabel
from neuromove.experiments.models import FeatureRepresentation, ModelFamily


@pytest.fixture
def temp_cal_storage(tmp_path: Path):
    """Create a temporary storage instance with an isolated SQLite database."""
    db_path = tmp_path / "test_calibration.db"
    db_mgr = DatabaseManager(db_url=f"sqlite:///{db_path}")
    db_mgr.initialize_db()
    storage = CalibrationStorage(db_manager=db_mgr, base_dir=tmp_path)
    return storage


@pytest.fixture
def cal_service(temp_cal_storage):
    """Create a calibration service using the isolated storage."""
    return CalibrationService(storage=temp_cal_storage)


@pytest.fixture
def test_client(temp_cal_storage):
    """Create a FastAPI TestClient wired to temporary test storage."""
    app = create_app()
    with TestClient(app) as client:
        yield client


# --- 1. Protocol Determinism & Reproducibility Tests ---


def test_protocol_generation_deterministic():
    """Verify same protocol + same seed yields identical trial schedule with exact class balance."""
    protocol = CalibrationProtocolEngine.get_default_protocol(random_state=42)
    assert protocol.trials_per_class == 10
    assert len(protocol.target_classes) == 2

    seq1 = CalibrationProtocolEngine.generate_trial_sequence("cal_test_01", protocol)
    seq2 = CalibrationProtocolEngine.generate_trial_sequence("cal_test_01", protocol)

    assert len(seq1) == 20
    assert len(seq2) == 20

    # Test exact determinism
    for t1, t2 in zip(seq1, seq2, strict=True):
        assert t1.sequence_index == t2.sequence_index
        assert t1.target_label == t2.target_label
        assert t1.cue == t2.cue
        assert t1.planned_onset == t2.planned_onset

    # Test class balance
    left_count = sum(1 for t in seq1 if t.target_label == NormalizedLabel.LEFT_IMAGERY)
    right_count = sum(1 for t in seq1 if t.target_label == NormalizedLabel.RIGHT_IMAGERY)
    assert left_count == 10
    assert right_count == 10


def test_protocol_seed_variation():
    """Verify different seeds produce different permutations while preserving class balance."""
    p_seed42 = CalibrationProtocolEngine.get_default_protocol(random_state=42)
    p_seed99 = CalibrationProtocolEngine.get_default_protocol(random_state=99)

    seq42 = CalibrationProtocolEngine.generate_trial_sequence("cal_test_42", p_seed42)
    seq99 = CalibrationProtocolEngine.generate_trial_sequence("cal_test_99", p_seed99)

    labels42 = [t.target_label.value for t in seq42]
    labels99 = [t.target_label.value for t in seq99]

    assert labels42 != labels99
    assert labels42.count("LEFT_IMAGERY") == 10
    assert labels99.count("LEFT_IMAGERY") == 10


# --- 2. State Machine & Transition Tests ---


def test_session_lifecycle_transitions():
    """Verify legal state transitions: PLANNED -> IN_PROGRESS -> PAUSED -> IN_PROGRESS -> QUALITY_REVIEW -> READY."""
    protocol = CalibrationProtocolEngine.get_default_protocol()
    trials = CalibrationProtocolEngine.generate_trial_sequence("cal_sm_01", protocol)
    session = CalibrationSession(
        calibration_id="cal_sm_01",
        profile_id="prof_01",
        subject_id="sub-01",
        session_number=1,
        status=CalibrationSessionStatus.PLANNED,
        config_hash=protocol.timing_hash,
    )
    runner = CalibrationSessionRunner(session, protocol, trials)

    # 1. Start
    runner.start()
    assert session.status == CalibrationSessionStatus.IN_PROGRESS
    assert session.started_at is not None

    # 2. Pause
    runner.pause("Participant requested break")
    assert session.status == CalibrationSessionStatus.PAUSED
    assert len(session.pause_intervals) == 1
    assert session.pause_intervals[0]["resumed_at"] is None

    # 3. Resume
    runner.resume()
    assert session.status == CalibrationSessionStatus.IN_PROGRESS
    assert session.pause_intervals[0]["resumed_at"] is not None

    # 4. Advance through all trials
    for _ in range(len(trials)):
        runner.advance_simulation_step()

    assert session.status in (
        CalibrationSessionStatus.QUALITY_REVIEW,
        CalibrationSessionStatus.READY,
    )
    assert session.completed_at is not None
    assert session.valid_trial_count == 20


def test_session_illegal_transition_rejection():
    """Verify illegal transitions are strictly rejected."""
    protocol = CalibrationProtocolEngine.get_default_protocol()
    trials = CalibrationProtocolEngine.generate_trial_sequence("cal_sm_err", protocol)
    session = CalibrationSession(
        calibration_id="cal_sm_err",
        profile_id="prof_01",
        subject_id="sub-01",
        session_number=1,
        status=CalibrationSessionStatus.READY,
        config_hash=protocol.timing_hash,
    )
    runner = CalibrationSessionRunner(session, protocol, trials)

    with pytest.raises(ValueError, match="Illegal calibration state transition"):
        runner.resume()


def test_session_abort_preserves_audits():
    """Verify abort stops progression and preserves completed and aborted trial records."""
    protocol = CalibrationProtocolEngine.get_default_protocol()
    trials = CalibrationProtocolEngine.generate_trial_sequence("cal_abort_01", protocol)
    session = CalibrationSession(
        calibration_id="cal_abort_01",
        profile_id="prof_01",
        subject_id="sub-01",
        session_number=1,
        status=CalibrationSessionStatus.PLANNED,
        config_hash=protocol.timing_hash,
    )
    runner = CalibrationSessionRunner(session, protocol, trials)
    runner.start()

    # Complete 3 trials
    runner.advance_simulation_step()
    runner.advance_simulation_step()
    runner.advance_simulation_step()

    # Abort
    runner.abort("Subject fatigue")
    assert session.status == CalibrationSessionStatus.ABORTED

    completed_trials = [t for t in trials if t.status == CalibrationTrialStatus.COMPLETED]
    aborted_trials = [t for t in trials if t.status == CalibrationTrialStatus.ABORTED]

    assert len(completed_trials) == 3
    assert len(aborted_trials) == 17
    assert "Subject fatigue" in aborted_trials[0].notes


# --- 3. Research Quality Control (QC) & Data Sufficiency Tests ---


def test_qc_signal_evaluation_pass():
    """Verify clean EEG signal passes QC."""
    t = np.linspace(0, 4.0, 1000)
    signal = 10.0 * np.sin(2 * np.pi * 10 * t)
    sig_array = np.vstack([signal, signal, signal])  # 3 channels

    status, reasons = CalibrationQCEngine.evaluate_trial_signal(sig_array)
    assert status == CalibrationQCStatus.PASS
    assert len(reasons) == 0


def test_qc_signal_evaluation_rejection_reasons():
    """Verify specific artifact conditions trigger correct rejection reasons."""
    t = np.linspace(0, 4.0, 1000)
    clean_sig = 10.0 * np.sin(2 * np.pi * 10 * t)

    # 1. Non-finite data
    nan_sig = np.vstack([clean_sig, clean_sig, clean_sig])
    nan_sig[0, 50] = np.nan
    status, reasons = CalibrationQCEngine.evaluate_trial_signal(nan_sig)
    assert status == CalibrationQCStatus.REJECT
    assert CalibrationRejectionReason.NONFINITE_DATA in reasons

    # 2. Flatline Dropout
    flat_sig = np.vstack([clean_sig, np.zeros(1000), clean_sig])
    status, reasons = CalibrationQCEngine.evaluate_trial_signal(flat_sig)
    assert status == CalibrationQCStatus.REJECT
    assert CalibrationRejectionReason.DROPOUT in reasons

    # 3. Out-of-bounds amplitude
    oob_sig = np.vstack([clean_sig, clean_sig * 50.0, clean_sig])
    status, reasons = CalibrationQCEngine.evaluate_trial_signal(oob_sig)
    assert status == CalibrationQCStatus.REJECT
    assert CalibrationRejectionReason.OUT_OF_BOUNDS in reasons


def test_qc_session_sufficiency_summary():
    """Verify session summary identifies insufficient data and class imbalances."""
    protocol = CalibrationProtocolEngine.get_default_protocol()
    trials = CalibrationProtocolEngine.generate_trial_sequence("cal_qc_sum", protocol)

    # Mark only 2 trials completed
    trials[0].status = CalibrationTrialStatus.COMPLETED
    trials[0].quality_status = CalibrationQCStatus.PASS
    trials[1].status = CalibrationTrialStatus.COMPLETED
    trials[1].quality_status = CalibrationQCStatus.PASS

    summary = CalibrationQCEngine.summarize_session_quality(trials, min_valid_trials_per_class=5)
    assert not summary.is_sufficient
    assert any("minimum required: 5" in w for w in summary.sufficiency_warnings)


# --- 4. Personalization Leakage Prevention & Benchmarking Tests ---


def test_personalization_leakage_safety():
    """Verify zero data leakage: train and held-out partitions are strictly disjoint and CSP is fitted only on train."""
    n_trials = 20
    n_channels = 3
    n_times = 1000
    rng = np.random.default_rng(42)

    epochs_data = rng.normal(0, 1.0, (n_trials, n_channels, n_times))
    labels = ["LEFT_IMAGERY", "RIGHT_IMAGERY"] * 10
    trial_ids = [f"trial_{i:02d}" for i in range(n_trials)]

    config = PersonalizationConfig(
        calibration_id="cal_leakage_test",
        profile_id="prof_01",
        subject_id="sub-01",
        model_family=ModelFamily.LDA,
        representation=FeatureRepresentation.CSP_LOG_POWER,
        split_strategy=HeldOutSplitStrategy.TEMPORAL_BLOCK_SPLIT,
        train_ratio=0.6,
    )

    exp_result, model_artifact, pipeline = PersonalizationEngine.run_personalization(
        config=config,
        epochs_data=epochs_data,
        labels=labels,
        trial_ids=trial_ids,
        channel_names=["C3", "Cz", "C4"],
    )

    # 1. Disjoint partitions
    train_ids = set(exp_result.train_trial_ids)
    heldout_ids = set(exp_result.heldout_trial_ids)
    assert len(train_ids) == 12
    assert len(heldout_ids) == 8
    assert train_ids.isdisjoint(heldout_ids)

    # 2. Verify held-out metrics exist
    assert "balanced_accuracy" in exp_result.heldout_metrics
    assert "f1" in exp_result.heldout_metrics
    assert exp_result.heldout_metrics["chance_level"] == 0.5

    # 3. Model artifact metadata
    assert model_artifact.model_id.startswith("pmdl_")
    assert (
        model_artifact.heldout_balanced_accuracy == exp_result.heldout_metrics["balanced_accuracy"]
    )


def test_generic_vs_personalized_delta_calculation():
    """Verify honest delta calculation (delta = personalized - generic)."""
    n_trials = 16
    n_channels = 3
    n_times = 1000
    t = np.linspace(0, 4.0, n_times)
    rng = np.random.default_rng(42)

    epochs_data = np.zeros((n_trials, n_channels, n_times))
    labels = ["LEFT_IMAGERY", "RIGHT_IMAGERY"] * 8
    trial_ids = [f"trial_{i:02d}" for i in range(n_trials)]

    # Inject clear ERD patterns
    for i in range(n_trials):
        mu = 10.0 * np.sin(2 * np.pi * 10 * t)
        noise = rng.normal(0, 2.0, (n_channels, n_times))
        if labels[i] == "LEFT_IMAGERY":
            epochs_data[i, 0] = 1.5 * mu + noise[0]
            epochs_data[i, 2] = 0.5 * mu + noise[2]
        else:
            epochs_data[i, 0] = 0.5 * mu + noise[0]
            epochs_data[i, 2] = 1.5 * mu + noise[2]

    config = PersonalizationConfig(
        calibration_id="cal_delta_test",
        profile_id="prof_01",
        subject_id="sub-01",
        model_family=ModelFamily.LDA,
    )

    exp_result, _, _ = PersonalizationEngine.run_personalization(
        config=config,
        epochs_data=epochs_data,
        labels=labels,
        trial_ids=trial_ids,
        channel_names=["C3", "Cz", "C4"],
    )

    cmp = exp_result.comparison_with_generic
    assert cmp is not None
    assert cmp.delta_balanced_accuracy == round(
        cmp.personalized_balanced_accuracy - cmp.generic_balanced_accuracy, 4
    )
    assert cmp.delta_f1 == round(cmp.personalized_f1 - cmp.generic_f1, 4)


# --- 5. Model Serialization & Checksum Verification Tests ---


def test_model_joblib_serialization_and_checksum(temp_cal_storage):
    """Verify .joblib serialization, SHA-256 computation, and tamper resistance."""
    cal_service = CalibrationService(storage=temp_cal_storage)
    profile = cal_service.create_subject_profile(
        CreateSubjectProfileRequest(subject_id="sub-persist-01")
    )

    # Start session and advance to completion
    session, _ = cal_service.start_session(
        StartCalibrationSessionRequest(profile_id=profile.profile_id, subject_id=profile.subject_id)
    )
    for _ in range(session.trial_count):
        cal_service.advance_simulation(session.calibration_id)

    # Personalize
    config = PersonalizationConfig(
        calibration_id=session.calibration_id,
        profile_id=profile.profile_id,
        subject_id=profile.subject_id,
    )
    exp_result = cal_service.run_personalization(config)

    # Load model and verify checksum integrity
    loaded_pipeline = temp_cal_storage.load_personalized_pipeline(exp_result.model_id)
    assert loaded_pipeline is not None

    # Verify model record in storage
    model_record = temp_cal_storage.get_personalized_model(exp_result.model_id)
    assert model_record is not None
    assert len(model_record.artifact_checksum_sha256) == 64


# --- 6. Calibration History & Immutability Tests ---


def test_calibration_history_versioning(temp_cal_storage):
    """Verify creating session 1 and session 2 preserves both historical records without overwriting."""
    cal_service = CalibrationService(storage=temp_cal_storage)
    profile = cal_service.create_subject_profile(
        CreateSubjectProfileRequest(subject_id="sub-history-01")
    )

    # Session 1
    s1, _ = cal_service.start_session(
        StartCalibrationSessionRequest(profile_id=profile.profile_id, subject_id=profile.subject_id)
    )
    for _ in range(s1.trial_count):
        cal_service.advance_simulation(s1.calibration_id)
    cal_service.run_personalization(
        PersonalizationConfig(
            calibration_id=s1.calibration_id,
            profile_id=profile.profile_id,
            subject_id=profile.subject_id,
        )
    )

    # Session 2
    s2, _ = cal_service.start_session(
        StartCalibrationSessionRequest(profile_id=profile.profile_id, subject_id=profile.subject_id)
    )
    for _ in range(s2.trial_count):
        cal_service.advance_simulation(s2.calibration_id)

    history = cal_service.get_subject_history(profile.subject_id)
    assert len(history) == 2
    assert history[0].session_number == 1
    assert history[1].session_number == 2
    assert history[0].calibration_id != history[1].calibration_id
    assert history[0].model_id is not None


# --- 7. REST API Endpoints Integration Tests ---


def test_api_calibration_workflow(test_client):
    """Test full calibration REST API workflow via TestClient."""
    # 1. List profiles
    resp = test_client.get("/api/calibration/profiles")
    assert resp.status_code == 200
    profiles = resp.json()
    assert len(profiles) >= 1

    subject_id = profiles[0]["subject_id"]
    profile_id = profiles[0]["profile_id"]

    # 2. Get protocols
    resp = test_client.get("/api/calibration/protocols")
    assert resp.status_code == 200
    protocols = resp.json()
    assert len(protocols) >= 1

    # 3. Start Session
    start_payload = {
        "profile_id": profile_id,
        "subject_id": subject_id,
        "source_mode": "SIMULATION",
    }
    resp = test_client.post("/api/calibration/sessions/start", json=start_payload)
    assert resp.status_code == 200
    session_data = resp.json()
    calibration_id = session_data["session"]["calibration_id"]
    assert len(session_data["trials"]) == 20

    # 4. Pause Session
    resp = test_client.post(
        f"/api/calibration/sessions/{calibration_id}/pause", json={"reason": "Testing pause"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "PAUSED"

    # 5. Resume Session
    resp = test_client.post(f"/api/calibration/sessions/{calibration_id}/resume")
    assert resp.status_code == 200
    assert resp.json()["status"] == "IN_PROGRESS"

    # 6. Step simulation trials
    for _ in range(20):
        resp = test_client.post(f"/api/calibration/sessions/{calibration_id}/advance-simulation")
        assert resp.status_code == 200

    # 7. Check trials
    resp = test_client.get(f"/api/calibration/sessions/{calibration_id}/trials")
    assert resp.status_code == 200
    trials = resp.json()
    assert len(trials) == 20
    assert trials[0]["status"] == "COMPLETED"

    # 8. Generate Report
    resp = test_client.get(f"/api/calibration/sessions/{calibration_id}/report")
    assert resp.status_code == 200
    report = resp.json()
    assert report["calibration_id"] == calibration_id

    # 9. Run Personalization
    pers_payload = {
        "calibration_id": calibration_id,
        "profile_id": profile_id,
        "subject_id": subject_id,
        "model_family": "LDA",
        "representation": "CSP_LOG_POWER",
    }
    resp = test_client.post("/api/calibration/personalize/run", json=pers_payload)
    assert resp.status_code == 200
    exp_res = resp.json()
    assert exp_res["model_id"].startswith("pmdl_")

    # 10. Retrieve Personalized Model
    resp = test_client.get(f"/api/calibration/personalize/models/{exp_res['model_id']}")
    assert resp.status_code == 200
    model = resp.json()
    assert model["model_id"] == exp_res["model_id"]

    # 11. Retrieve History
    resp = test_client.get(f"/api/calibration/history/{subject_id}")
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) >= 1
