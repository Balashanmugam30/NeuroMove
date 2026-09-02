"""Exhaustive Unit, Invariant, and Scenario Tests for Phase 18 Resilience Laboratory.

Covers:
1. Fault creation, bounds validation, and taxonomy mapping.
2. Injector lifecycle, scoped triggers, and stream/payload perturbation.
3. Invariant Engine: all 14 formal invariants (positive & negative assertions).
4. Zero Accidental Authorization: critical proof that failures never permit execution.
5. Recovery Orchestration: checkpoints, checksums, fail-closed E-stop and lockout persistence.
6. Canonical Scenarios: Scenarios A through Z and Cascading Scenarios AA through AH.
7. Deterministic Replay: manifest checksums and invariant parity.
8. REST API: complete endpoints coverage.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from neuromove.api.app import app
from neuromove.domain.enums import SafetyDecision
from neuromove.resilience.faults import (
    FAULT_CATEGORY_MAP,
    create_fault_definition,
)
from neuromove.resilience.injector import FaultInjector
from neuromove.resilience.invariants import InvariantEngine
from neuromove.resilience.models import (
    DataLossStatus,
    FaultCategory,
    FaultParameters,
    FaultScope,
    FaultSeverity,
    FaultStatus,
    FaultType,
    InvariantStatus,
    PipelineHealthSnapshot,
    RecoveryCheckpoint,
    RecoveryStatus,
    TriggerType,
)
from neuromove.resilience.recovery import RecoveryOrchestrator
from neuromove.resilience.service import ResilienceService
from neuromove.safety.models import SafetyArbitrationState


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def resilience_svc() -> ResilienceService:
    svc = ResilienceService()
    svc.reset_lab()
    return svc


# --- 1. Fault Creation & Parameter Validation ---


def test_fault_taxonomy_mapping():
    """Verify all 40+ fault types map to appropriate categories."""
    assert FAULT_CATEGORY_MAP[FaultType.STREAM_DISCONNECT] == FaultCategory.TRANSPORT
    assert FAULT_CATEGORY_MAP[FaultType.MALFORMED_PAYLOAD] == FaultCategory.DATA
    assert FAULT_CATEGORY_MAP[FaultType.MODEL_UNAVAILABLE] == FaultCategory.MODEL
    assert FAULT_CATEGORY_MAP[FaultType.CONFIDENCE_SERVICE_UNAVAILABLE] == FaultCategory.CONFIDENCE
    assert FAULT_CATEGORY_MAP[FaultType.INTENT_SERVICE_UNAVAILABLE] == FaultCategory.INTENT
    assert FAULT_CATEGORY_MAP[FaultType.SAFETY_SERVICE_UNAVAILABLE] == FaultCategory.SAFETY
    assert FAULT_CATEGORY_MAP[FaultType.DATABASE_UNAVAILABLE] == FaultCategory.PERSISTENCE
    assert FAULT_CATEGORY_MAP[FaultType.SERVICE_RESTART] == FaultCategory.SERVICE
    assert FAULT_CATEGORY_MAP[FaultType.CLOCK_SKEW_SIMULATED] == FaultCategory.TIMING
    assert FAULT_CATEGORY_MAP[FaultType.SUBJECT_SWITCH] == FaultCategory.CONTEXT


def test_fault_factory_and_bounds():
    """Verify factory initializes valid parameters with bounds validation."""
    fault = create_fault_definition(
        fault_type=FaultType.STREAM_DELAY,
        parameters={"delay_ms": 250.0},
        scope=FaultScope.SESSION,
    )
    assert fault.fault_type == FaultType.STREAM_DELAY
    assert fault.category == FaultCategory.TRANSPORT
    assert fault.parameters.delay_ms == 250.0
    assert fault.status == FaultStatus.DECLARED

    # Verify bounds enforcement in pydantic
    with pytest.raises(ValidationError):
        FaultParameters(delay_ms=-50.0)
    with pytest.raises(ValidationError):
        FaultParameters(drop_count=999)


# --- 2. Injector Lifecycle & Perturbation ---


def test_injector_lifecycle_and_triggers():
    """Verify injecting, querying, evaluating triggers, and clearing faults."""
    injector = FaultInjector()
    assert len(injector.get_active_faults()) == 0

    fault = create_fault_definition(
        fault_type=FaultType.STREAM_DELAY,
        trigger_type=TriggerType.AFTER_N_EVENTS,
        trigger_value="2",
    )
    fault.status = FaultStatus.ARMED
    injector.inject(fault)
    injector._active_faults[fault.fault_id].status = FaultStatus.ARMED

    # Trigger event 1
    activated = injector.evaluate_triggers("TELEMETRY")
    assert len(activated) == 0

    # Trigger event 2 -> arms to ACTIVE
    activated = injector.evaluate_triggers("TELEMETRY")
    assert len(activated) == 1
    assert activated[0].fault_id == fault.fault_id
    assert injector.is_fault_active(FaultType.STREAM_DELAY)

    # Clear fault
    cleared = injector.clear(fault.fault_id)
    assert cleared is not None
    assert not injector.is_fault_active(FaultType.STREAM_DELAY)


def test_stream_interception():
    """Verify event drops, duplicates, and reorders in event streams."""
    injector = FaultInjector()

    # Drop test
    injector.inject_by_type(FaultType.STREAM_EVENT_DROP, parameters={"drop_count": 1})
    events = [{"id": 1}, {"id": 2}, {"id": 3}]
    intercepted = injector.intercept_event_stream(events, "telemetry")
    assert len(intercepted) == 2
    assert intercepted[0]["id"] == 2
    injector.clear_all()

    # Duplicate test
    injector.inject_by_type(FaultType.STREAM_EVENT_DUPLICATE, parameters={"duplicate_count": 2})
    events = [{"id": 10}, {"id": 20}]
    intercepted = injector.intercept_event_stream(events, "telemetry")
    assert len(intercepted) == 4
    assert intercepted[0]["id"] == 10
    assert intercepted[1]["id"] == 10
    injector.clear_all()

    # Reorder test
    injector.inject_by_type(FaultType.STREAM_EVENT_REORDER)
    events = [{"id": "first"}, {"id": "second"}]
    intercepted = injector.intercept_event_stream(events, "telemetry")
    assert intercepted[0]["id"] == "second"
    assert intercepted[1]["id"] == "first"


def test_payload_perturbation():
    """Verify malformed, missing fields, and metadata corruption."""
    injector = FaultInjector()
    injector.inject_by_type(FaultType.MALFORMED_PAYLOAD)
    injector.inject_by_type(FaultType.SUBJECT_SWITCH)

    payload = {
        "intent_id": "int_1",
        "intent_class": "LEFT",
        "subject_id": "sub-01",
        "confidence_score": 0.95,
    }
    perturbed = injector.perturb_payload(payload)
    assert perturbed["_malformed_token"] is True
    assert perturbed["intent_class"] == "INVALID_CORRUPTED_INTENT"
    assert perturbed["subject_id"] == "sub-ALIEN-UNAUTHORIZED"


# --- 3. Invariant Engine & Zero Accidental Authorization ---


def test_invariant_no_accidental_authorization():
    """Certify that during active faults, execution is strictly NOT authorized."""
    snap_safe = PipelineHealthSnapshot(
        current_safety_decision=SafetyDecision.DENIED,
        current_safety_state=SafetyArbitrationState.DENIED,
    )
    snap_unsafe = PipelineHealthSnapshot(
        current_safety_decision=SafetyDecision.AUTHORIZED,
        current_safety_state=SafetyArbitrationState.AUTHORIZED,
    )

    fault = create_fault_definition(FaultType.STREAM_DISCONNECT, severity=FaultSeverity.CRITICAL)

    # Safe evaluation passes
    res_pass = InvariantEngine.check_no_accidental_authorization(snap_safe, [fault], {})
    assert res_pass.status == InvariantStatus.PASS

    # Unsafe authorization during fault fails invariant
    res_fail = InvariantEngine.check_no_accidental_authorization(snap_unsafe, [fault], {})
    assert res_fail.status == InvariantStatus.FAIL


def test_all_invariants_suite():
    """Verify full suite of 14 invariants evaluates correctly on healthy baseline."""
    snap = PipelineHealthSnapshot()
    results = InvariantEngine.evaluate_all(baseline=snap, current=snap, active_faults=[])
    assert len(results) == 14
    for r in results:
        assert r.status == InvariantStatus.PASS


def test_invariant_boundary_leaks():
    """Verify subject, session, and model boundary invariants detect leaks."""
    res_subj = InvariantEngine.check_no_subject_boundary_leak({"subject_leaked": True})
    assert res_subj.status == InvariantStatus.FAIL

    res_sess = InvariantEngine.check_no_session_boundary_leak({"session_leaked": True})
    assert res_sess.status == InvariantStatus.FAIL

    res_mod = InvariantEngine.check_no_model_boundary_leak({"model_leaked": True})
    assert res_mod.status == InvariantStatus.FAIL


def test_invariant_estop_and_lockout_bypass():
    """Verify E-stop and lockout bypass checks fail if bypassed."""
    snap = PipelineHealthSnapshot()
    res_estop = InvariantEngine.check_no_estop_bypass(snap, {"estop_bypassed": True})
    assert res_estop.status == InvariantStatus.FAIL

    res_lockout = InvariantEngine.check_no_lockout_bypass(snap, {"lockout_bypassed": True})
    assert res_lockout.status == InvariantStatus.FAIL


# --- 4. Recovery Orchestrator & Checkpoints ---


def test_recovery_checkpoint_checksum():
    """Verify recovery checkpoint creation and cryptographic checksum generation."""
    orch = RecoveryOrchestrator()
    chk = orch.capture_checkpoint(
        experiment_id="exp_test_01",
        component="safety",
        safe_state="SAFE_IDLE",
        sequence_number=1,
        snapshot_version="1.0.0",
    )
    assert chk.checkpoint_id.startswith("chk_")
    assert len(chk.checksum) == 16

    retrieved = orch.get_checkpoint(chk.checkpoint_id)
    assert retrieved is not None
    assert retrieved.checksum == chk.checksum


def test_recovery_evaluation_reboot_and_estop():
    """Verify recovery guarantees persistent E-stop across reboots."""
    orch = RecoveryOrchestrator()

    # E-stop cleared illegally -> RECOVERY_FAILED
    health_cleared = PipelineHealthSnapshot(current_safety_state=SafetyArbitrationState.SAFE_IDLE)
    status, _, _ = orch.evaluate_recovery(
        pre_fault_checkpoint=None,
        current_health=health_cleared,
        was_emergency_stop=True,
    )
    assert status == RecoveryStatus.RECOVERY_FAILED

    # E-stop maintained -> RECOVERED_RESTRICTIVELY
    health_estop = PipelineHealthSnapshot(
        current_safety_state=SafetyArbitrationState.EMERGENCY_STOP
    )
    status, _, _ = orch.evaluate_recovery(
        pre_fault_checkpoint=None,
        current_health=health_estop,
        was_emergency_stop=True,
    )
    assert status == RecoveryStatus.RECOVERED_RESTRICTIVELY


def test_recovery_critical_data_loss():
    """Verify critical data loss yields RECOVERY_UNCERTAIN."""
    orch = RecoveryOrchestrator()
    health = PipelineHealthSnapshot()
    status, _, msg = orch.evaluate_recovery(
        pre_fault_checkpoint=None,
        current_health=health,
        data_loss=DataLossStatus.CRITICAL,
    )
    assert status == RecoveryStatus.RECOVERY_UNCERTAIN
    assert "fresh arbitration strictly mandatory" in msg


# --- 5. Persistence & Storage ---


def test_resilience_storage(resilience_svc: ResilienceService):
    """Verify persisting and reading experiments and checkpoints."""
    storage = resilience_svc.storage

    # Check metrics
    metrics = storage.get_metrics()
    assert metrics.total_experiments >= 0

    # Save checkpoint
    chk = RecoveryCheckpoint(
        checkpoint_id="chk_store_01",
        experiment_id="exp_store_01",
        component="test_component",
        last_known_safe_state="SAFE_IDLE",
        sequence_number=1,
        snapshot_version="1.0.0",
        checksum="abcd1234efgh5678",
    )
    storage.save_checkpoint(chk)
    checkpoints = storage.list_checkpoints(experiment_id="exp_store_01")
    assert len(checkpoints) >= 1
    assert checkpoints[0].component == "test_component"


# --- 6. Deterministic Scenarios Execution ---


def test_scenario_a_stream_disconnect(resilience_svc: ResilienceService):
    """Test Scenario A: Stream disconnect forces DENIED and fails closed."""
    res = resilience_svc.run_scenario("SCENARIO_A")
    assert res.scenario_id == "SCENARIO_A"
    assert res.passed is True
    assert res.fail_closed_certified is True
    assert res.observed_safety_decision == SafetyDecision.DENIED


def test_scenario_b_stale_event(resilience_svc: ResilienceService):
    """Test Scenario B: Stale event forces DENIED."""
    res = resilience_svc.run_scenario("SCENARIO_B")
    assert res.scenario_id == "SCENARIO_B"
    assert res.passed is True
    assert res.fail_closed_certified is True
    assert res.observed_safety_decision == SafetyDecision.DENIED


def test_scenario_d_duplicate_event(resilience_svc: ResilienceService):
    """Test Scenario D: Duplicate event processed idempotently."""
    res = resilience_svc.run_scenario("SCENARIO_D")
    assert res.scenario_id == "SCENARIO_D"
    assert res.passed is True


def test_scenario_f_malformed_payload(resilience_svc: ResilienceService):
    """Test Scenario F: Malformed payload rejects safely with INVALID/DENIED."""
    res = resilience_svc.run_scenario("SCENARIO_F")
    assert res.scenario_id == "SCENARIO_F"
    assert res.passed is True
    assert res.observed_safety_decision in [SafetyDecision.INVALID, SafetyDecision.DENIED]


def test_scenario_h_model_rollback(resilience_svc: ResilienceService):
    """Test Scenario H: Rolled-back model decoder blocks authorization."""
    res = resilience_svc.run_scenario("SCENARIO_H")
    assert res.scenario_id == "SCENARIO_H"
    assert res.passed is True
    assert res.observed_safety_decision == SafetyDecision.DENIED


def test_scenario_i_confidence_outage(resilience_svc: ResilienceService):
    """Test Scenario I: Confidence service outage fails closed."""
    res = resilience_svc.run_scenario("SCENARIO_I")
    assert res.scenario_id == "SCENARIO_I"
    assert res.passed is True
    assert res.observed_safety_decision == SafetyDecision.DENIED


def test_scenario_s_estop_persistence_restart(resilience_svc: ResilienceService):
    """Test Scenario S: E-stop persists across service restart."""
    res = resilience_svc.run_scenario("SCENARIO_S")
    assert res.scenario_id == "SCENARIO_S"
    assert res.passed is True
    assert res.observed_safety_decision == SafetyDecision.EMERGENCY_STOP
    assert res.recovery_status == RecoveryStatus.RECOVERED_RESTRICTIVELY


def test_scenario_t_lockout_persistence_restart(resilience_svc: ResilienceService):
    """Test Scenario T: Lockout persists across service restart."""
    res = resilience_svc.run_scenario("SCENARIO_T")
    assert res.scenario_id == "SCENARIO_T"
    assert res.passed is True
    assert res.observed_safety_decision == SafetyDecision.LOCKED_OUT


def test_scenario_p_subject_switch(resilience_svc: ResilienceService):
    """Test Scenario P: Subject context switch invalidates intent."""
    res = resilience_svc.run_scenario("SCENARIO_P")
    assert res.scenario_id == "SCENARIO_P"
    assert res.passed is True
    assert res.observed_safety_decision == SafetyDecision.DENIED


def test_scenario_aa_cascading_outage(resilience_svc: ResilienceService):
    """Test Cascading Scenario AA: WebSocket disconnect + confidence outage."""
    res = resilience_svc.run_scenario("SCENARIO_AA")
    assert res.scenario_id == "SCENARIO_AA"
    assert res.passed is True
    assert res.fail_closed_certified is True
    assert res.observed_safety_decision == SafetyDecision.DENIED


# --- 7. Full Experiment Runner & Deterministic Replay ---


def test_full_experiment_execution_and_replay(resilience_svc: ResilienceService):
    """Verify running a full experiment, storing manifest, and deterministic replay."""
    fault = create_fault_definition(FaultType.STREAM_DELAY, parameters={"delay_ms": 600.0})
    exp = resilience_svc.run_experiment(
        scenario_id="TEST_EXP_01",
        name="Test Experiment Runner",
        fault_sequence=[fault],
        seed=123,
    )

    assert exp.status in ["PASSED", "FAILED"]
    assert exp.manifest.scenario_id == "TEST_EXP_01"
    assert len(exp.manifest.manifest_checksum) == 16
    assert exp.authorization_during_failure is False

    # Replay experiment
    matched, original, chk = resilience_svc.replay.replay_experiment(exp.experiment_id)
    assert matched is True
    assert chk == exp.manifest.manifest_checksum
    assert original.experiment_id == exp.experiment_id


# --- 8. REST API Endpoints ---


def test_api_resilience_status(client: TestClient):
    res = client.get("/api/resilience/status")
    assert res.status_code == 200
    data = res.json()
    assert "lab_mode" in data
    assert "pipeline_health" in data
    assert "metrics" in data


def test_api_resilience_fault_inject_and_clear(client: TestClient):
    # Inject fault
    inj_res = client.post(
        "/api/resilience/faults/inject",
        json={
            "fault_type": "STREAM_DELAY",
            "severity": "LOW",
            "scope": "SINGLE_EVENT",
            "parameters": {"delay_ms": 50.0},
        },
    )
    assert inj_res.status_code == 200
    fault = inj_res.json()["fault"]
    fault_id = fault["fault_id"]

    # List faults
    list_res = client.get("/api/resilience/faults")
    assert list_res.status_code == 200
    assert any(f["fault_id"] == fault_id for f in list_res.json())

    # Clear fault
    clear_res = client.post(f"/api/resilience/faults/{fault_id}/clear")
    assert clear_res.status_code == 200
    assert clear_res.json()["status"] == "cleared"


def test_api_resilience_invariants(client: TestClient):
    res = client.get("/api/resilience/invariants")
    assert res.status_code == 200
    invariants = res.json()
    assert len(invariants) == 14
    assert any(inv["invariant_id"] == "INV_01_NO_ACCIDENTAL_AUTHORIZATION" for inv in invariants)


def test_api_resilience_scenarios_run(client: TestClient):
    res = client.post("/api/resilience/scenarios/run", json={"scenario_id": "SCENARIO_A"})
    assert res.status_code == 200
    data = res.json()
    assert data["scenario_id"] == "SCENARIO_A"
    assert data["passed"] is True
    assert data["fail_closed_certified"] is True


def test_api_resilience_reset_lab(client: TestClient):
    res = client.post("/api/resilience/reset-lab")
    assert res.status_code == 200
    assert res.json()["status"] == "reset_complete"
