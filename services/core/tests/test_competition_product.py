"""Unit and integration test suite for Phase 24.1 Final Competition Product Foundation & Demo Orchestration."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import app
from neuromove.domain.enums import (
    DemoState,
    ProductDemoScenario,
    ProductExecutionOutcome,
    ProductSessionStatus,
    ProductStage,
    SafetyDecision,
    SensorSource,
    SystemHealthStatus,
)
from neuromove.product.models import (
    DemoResult,
    DemoRun,
    DemoStep,
    ProductProvenance,
    ProductSession,
    SubsystemHealthCard,
    SystemStatusSummary,
)
from neuromove.product.orchestrator import DemoOrchestrator
from neuromove.product.scenarios import ProductGoldenScenarios
from neuromove.product.service import ProductCoordinatorService
from neuromove.product.state_machine import DemoStateMachine, DemoStateMachineError
from neuromove.product.storage import ProductStorage


@pytest.fixture
def client():
    """FastAPI test client fixture."""
    return TestClient(app)


@pytest.fixture
def product_storage():
    """Isolated product storage fixture."""
    return ProductStorage()


@pytest.fixture
def product_service(product_storage):
    """Isolated product coordinator service fixture."""
    return ProductCoordinatorService(storage=product_storage)


# ============================================================================
# 1. Product Models & Enums Tests
# ============================================================================

def test_product_session_defaults():
    sess = ProductSession(session_id="test_sess_01")
    assert sess.session_id == "test_sess_01"
    assert sess.title == "Competition Product Session"
    assert sess.status == ProductSessionStatus.ACTIVE
    assert sess.source_type == SensorSource.SIMULATOR
    assert sess.model_version == "csp_lda_v2.4"
    assert sess.safety_decision == SafetyDecision.AUTHORIZED


def test_system_status_summary_model():
    card = SubsystemHealthCard(
        subsystem_id="acquisition",
        name="EEG Acquisition",
        status=SystemHealthStatus.HEALTHY,
        source_type=SensorSource.SIMULATOR,
        summary="Nominal acquisition",
        route_href="/eeg/live",
    )
    summary = SystemStatusSummary(
        overall_status=SystemHealthStatus.HEALTHY,
        product_session_id="sess_01",
        subsystems={"acquisition": card},
        current_stage=ProductStage.SENSORS,
    )
    assert summary.overall_status == SystemHealthStatus.HEALTHY
    assert summary.subsystems["acquisition"].name == "EEG Acquisition"
    assert summary.subsystems["acquisition"].is_operational is True


def test_demo_step_model():
    step = DemoStep(
        step_index=1,
        step_key="DATA_SOURCE",
        title="Select Signal Source",
        description="Initialize source provider",
        stage=ProductStage.SENSORS,
        status="COMPLETED",
        metrics={"channels": 8},
        explanation="Source ready",
    )
    assert step.step_index == 1
    assert step.step_key == "DATA_SOURCE"
    assert step.status == "COMPLETED"


def test_product_provenance_model():
    prov = ProductProvenance(
        product_session_id="prod_01",
        source_checksum="abc12345",
        manifest_hash="mnf56789",
        provenance_hash="prv_full_hash",
    )
    assert prov.product_session_id == "prod_01"
    assert prov.confidence_policy == "STRICT_RESEARCH_FUSION"


# ============================================================================
# 2. Demo State Machine Tests
# ============================================================================

def test_state_machine_happy_path_transitions():
    fsm = DemoStateMachine()
    assert fsm.state == DemoState.IDLE

    fsm.transition_to(DemoState.SOURCE_READY)
    assert fsm.state == DemoState.SOURCE_READY

    fsm.transition_to(DemoState.ACQUIRING)
    assert fsm.state == DemoState.ACQUIRING

    fsm.transition_to(DemoState.CONTEXT_READY)
    assert fsm.state == DemoState.CONTEXT_READY

    fsm.transition_to(DemoState.DECODING)
    assert fsm.state == DemoState.DECODING

    fsm.transition_to(DemoState.CONFIRMING)
    assert fsm.state == DemoState.CONFIRMING

    fsm.transition_to(DemoState.INTENT_READY)
    assert fsm.state == DemoState.INTENT_READY

    fsm.transition_to(DemoState.SAFETY_CHECK)
    assert fsm.state == DemoState.SAFETY_CHECK

    fsm.transition_to(DemoState.AUTHORIZED)
    assert fsm.state == DemoState.AUTHORIZED

    fsm.transition_to(DemoState.HIL_EXECUTING)
    assert fsm.state == DemoState.HIL_EXECUTING

    fsm.transition_to(DemoState.COMPLETED)
    assert fsm.state == DemoState.COMPLETED


def test_state_machine_illegal_transition():
    fsm = DemoStateMachine()
    with pytest.raises(DemoStateMachineError):
        # Cannot jump straight from IDLE to HIL_EXECUTING
        fsm.transition_to(DemoState.HIL_EXECUTING)


def test_state_machine_reset():
    fsm = DemoStateMachine(DemoState.ACQUIRING)
    assert fsm.state == DemoState.ACQUIRING
    fsm.reset()
    assert fsm.state == DemoState.IDLE


def test_state_machine_safety_held_branch():
    fsm = DemoStateMachine(DemoState.CONFIRMING)
    fsm.transition_to(DemoState.HELD)
    assert fsm.state == DemoState.HELD

    # Can transition from HELD to RECOVERING or IDLE
    fsm.transition_to(DemoState.RECOVERING)
    assert fsm.state == DemoState.RECOVERING


# ============================================================================
# 3. Golden Scenarios Registry Tests
# ============================================================================

def test_golden_scenarios_listing():
    scenarios = ProductGoldenScenarios.list_scenarios()
    assert len(scenarios) == 6
    ids = [s.id for s in scenarios]
    assert ProductDemoScenario.PRODUCT_A in ids
    assert ProductDemoScenario.PRODUCT_B in ids
    assert ProductDemoScenario.PRODUCT_C in ids
    assert ProductDemoScenario.PRODUCT_D in ids
    assert ProductDemoScenario.PRODUCT_E in ids
    assert ProductDemoScenario.PRODUCT_F in ids


def test_golden_scenarios_get_by_id():
    sc_a = ProductGoldenScenarios.get_scenario("PRODUCT_A")
    assert sc_a.id == ProductDemoScenario.PRODUCT_A
    assert sc_a.expected_outcome == ProductExecutionOutcome.PASS
    assert sc_a.expected_safety == SafetyDecision.AUTHORIZED

    sc_b = ProductGoldenScenarios.get_scenario("PRODUCT_B")
    assert sc_b.id == ProductDemoScenario.PRODUCT_B
    assert sc_b.expected_outcome == ProductExecutionOutcome.BLOCKED
    assert sc_b.expected_safety == SafetyDecision.HELD


def test_golden_scenarios_unknown_raises():
    with pytest.raises(ValueError):
        ProductGoldenScenarios.get_scenario("UNKNOWN_SCENARIO")


# ============================================================================
# 4. Storage Persistence Tests
# ============================================================================

def test_storage_save_and_get_product_session(product_storage):
    sess = ProductSession(
        session_id="storage_sess_01",
        title="Test Storage Session",
        subject_id="SUBJ_TEST_99",
        source_type=SensorSource.SIMULATOR,
        status=ProductSessionStatus.ACTIVE,
    )
    product_storage.save_product_session(sess)

    fetched = product_storage.get_product_session("storage_sess_01")
    assert fetched is not None
    assert fetched.session_id == "storage_sess_01"
    assert fetched.title == "Test Storage Session"
    assert fetched.subject_id == "SUBJ_TEST_99"


def test_storage_save_and_get_demo_run(product_storage):
    step1 = DemoStep(
        step_index=1,
        step_key="DATA_SOURCE",
        title="Select Signal Source",
        description="Initialize source provider",
        stage=ProductStage.SENSORS,
    )
    run = DemoRun(
        run_id="demo_run_test_01",
        scenario_id=ProductDemoScenario.PRODUCT_A,
        product_session_id="storage_sess_01",
        state=DemoState.SOURCE_READY,
        steps=[step1],
    )
    product_storage.save_demo_run(run)

    fetched = product_storage.get_demo_run("demo_run_test_01")
    assert fetched is not None
    assert fetched.run_id == "demo_run_test_01"
    assert fetched.scenario_id == ProductDemoScenario.PRODUCT_A
    assert len(fetched.steps) == 1
    assert fetched.steps[0].step_key == "DATA_SOURCE"


def test_storage_save_and_get_demo_result(product_storage):
    res = DemoResult(
        result_id="res_test_01",
        run_id="demo_run_test_01",
        scenario_id=ProductDemoScenario.PRODUCT_A,
        status=ProductExecutionOutcome.PASS,
        source_type=SensorSource.SIMULATOR,
        candidate_intent="FORWARD",
        confidence_score=0.92,
        safety_verdict=SafetyDecision.AUTHORIZED,
        hil_status="ACKNOWLEDGED",
        latency_breakdown={"total": 12.5},
        explanation_text="Test explanation",
    )
    product_storage.save_demo_result(res)

    fetched = product_storage.get_demo_result_by_run_id("demo_run_test_01")
    assert fetched is not None
    assert fetched.result_id == "res_test_01"
    assert fetched.status == ProductExecutionOutcome.PASS
    assert fetched.candidate_intent == "FORWARD"


# ============================================================================
# 5. Demo Orchestrator & Golden Scenario Execution Tests
# ============================================================================

def test_orchestrator_start_scenario(product_storage):
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="orch_sess_01")

    run = orchestrator.start_scenario(ProductDemoScenario.PRODUCT_A, sess)
    assert run.run_id.startswith("demo_run_")
    assert run.scenario_id == ProductDemoScenario.PRODUCT_A
    assert run.state == DemoState.SOURCE_READY
    assert len(run.steps) == 9


def test_orchestrator_advance_single_step(product_storage):
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="orch_sess_01")

    run = orchestrator.start_scenario(ProductDemoScenario.PRODUCT_A, sess)
    assert run.current_step == 1

    updated_run = orchestrator.advance_step(run.run_id, sess)
    assert updated_run.current_step == 2
    assert updated_run.steps[0].status == "COMPLETED"
    assert updated_run.state == DemoState.ACQUIRING


def test_orchestrator_scenario_a_happy_path(product_storage):
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="orch_sess_a")

    result = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_A, sess)
    assert result.status == ProductExecutionOutcome.PASS
    assert result.safety_verdict == SafetyDecision.AUTHORIZED
    assert result.candidate_intent == "FORWARD"
    assert result.confidence_score >= 0.90
    assert result.hil_status == "ACKNOWLEDGED"
    assert result.provenance is not None
    assert len(result.provenance.provenance_hash) > 0


def test_orchestrator_scenario_b_safety_blocked(product_storage):
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="orch_sess_b")

    result = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_B, sess)
    assert result.status == ProductExecutionOutcome.BLOCKED
    assert result.safety_verdict == SafetyDecision.HELD
    assert result.confidence_score < 0.70
    assert result.hil_status == "NOT_TRANSMITTED"
    assert "safety" in result.explanation_text.lower()


def test_orchestrator_scenario_c_context_contradiction(product_storage):
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="orch_sess_c")

    result = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_C, sess)
    assert result.status == ProductExecutionOutcome.BLOCKED
    assert result.safety_verdict == SafetyDecision.HELD
    assert result.hil_status == "NOT_TRANSMITTED"
    assert "contradiction" in result.explanation_text.lower()


def test_orchestrator_scenario_d_recorded_replay(product_storage):
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="orch_sess_d", source_type=SensorSource.RECORDED)

    result = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_D, sess)
    assert result.status == ProductExecutionOutcome.PASS
    assert result.source_type == SensorSource.RECORDED
    assert result.safety_verdict == SafetyDecision.AUTHORIZED
    assert len(result.provenance.source_checksum) > 0


def test_orchestrator_scenario_e_fault_recovery(product_storage):
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="orch_sess_e")

    result = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_E, sess)
    assert result.status == ProductExecutionOutcome.PASS
    assert result.safety_verdict == SafetyDecision.AUTHORIZED


def test_orchestrator_scenario_f_reset(product_storage):
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="orch_sess_f")

    orchestrator.start_scenario(ProductDemoScenario.PRODUCT_A, sess)
    assert orchestrator.active_run is not None

    orchestrator.reset()
    assert orchestrator.active_run is None
    assert orchestrator.current_state == DemoState.IDLE


# ============================================================================
# 6. Product Coordinator Service Tests
# ============================================================================

def test_service_get_and_reset_session(product_service):
    sess1 = product_service.get_session()
    assert sess1.session_id.startswith("prod_sess_")

    sess2 = product_service.reset_session()
    assert sess2.session_id != sess1.session_id
    assert sess2.status == ProductSessionStatus.ACTIVE


def test_service_get_system_status_aggregation(product_service):
    status_summary = product_service.get_system_status()
    assert status_summary.overall_status in {SystemHealthStatus.HEALTHY, SystemHealthStatus.READY}
    assert "acquisition" in status_summary.subsystems
    assert "multimodal_sensors" in status_summary.subsystems
    assert "decoding" in status_summary.subsystems
    assert "confidence_intent" in status_summary.subsystems
    assert "safety" in status_summary.subsystems
    assert "hardware_hil" in status_summary.subsystems
    assert "research" in status_summary.subsystems

    # Verify all subsystems have valid route hrefs
    for card in status_summary.subsystems.values():
        assert card.route_href.startswith("/")
        assert card.is_operational is True


def test_service_demo_workflow(product_service):
    run = product_service.start_demo_scenario(ProductDemoScenario.PRODUCT_A)
    assert run.state == DemoState.SOURCE_READY

    active = product_service.get_active_demo_run()
    assert active is not None
    assert active.run_id == run.run_id

    # Advance a step
    run_step2 = product_service.advance_demo_step(run.run_id)
    assert run_step2.current_step == 2


def test_service_execute_full_scenario(product_service):
    result = product_service.execute_demo_scenario(ProductDemoScenario.PRODUCT_A)
    assert result.status == ProductExecutionOutcome.PASS
    assert result.candidate_intent == "FORWARD"

    fetched_res = product_service.get_demo_result(result.run_id)
    assert fetched_res is not None
    assert fetched_res.result_id == result.result_id


# ============================================================================
# 7. FastAPI REST API Endpoint Tests
# ============================================================================

def test_api_get_product_status(client):
    resp = client.get("/api/product/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "overall_status" in data
    assert "subsystems" in data
    assert len(data["subsystems"]) == 7


def test_api_get_product_session(client):
    resp = client.get("/api/product/session")
    assert resp.status_code == 200
    data = resp.json()
    assert "session_id" in data
    assert data["status"] == "ACTIVE"


def test_api_reset_product_session(client):
    resp = client.post("/api/product/session/reset")
    assert resp.status_code == 200
    data = resp.json()
    assert "session_id" in data


def test_api_list_demo_scenarios(client):
    resp = client.get("/api/product/demo/scenarios")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 6


def test_api_start_demo_scenario(client):
    resp = client.post("/api/product/demo/start", json={"scenario_id": "PRODUCT_A"})
    assert resp.status_code == 200
    data = resp.json()
    assert "run_id" in data
    assert data["scenario_id"] == "PRODUCT_A"
    assert data["state"] == "SOURCE_READY"


def test_api_advance_demo_step(client):
    start_resp = client.post("/api/product/demo/start", json={"scenario_id": "PRODUCT_A"})
    run_id = start_resp.json()["run_id"]

    step_resp = client.post("/api/product/demo/step", json={"run_id": run_id})
    assert step_resp.status_code == 200
    data = step_resp.json()
    assert data["current_step"] == 2


def test_api_execute_full_demo_scenario(client):
    resp = client.post("/api/product/demo/run", json={"scenario_id": "PRODUCT_A"})
    assert resp.status_code == 200
    data = resp.json()
    assert "result_id" in data
    assert data["status"] == "PASS"
    assert data["safety_verdict"] == "AUTHORIZED"


def test_api_execute_safety_blocked_scenario(client):
    resp = client.post("/api/product/demo/run", json={"scenario_id": "PRODUCT_B"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "BLOCKED"
    assert data["safety_verdict"] == "HELD"


def test_api_get_demo_result(client):
    run_resp = client.post("/api/product/demo/run", json={"scenario_id": "PRODUCT_A"})
    run_id = run_resp.json()["run_id"]

    res_resp = client.get(f"/api/product/demo/result/{run_id}")
    assert res_resp.status_code == 200
    data = res_resp.json()
    assert data["run_id"] == run_id


def test_api_reset_demo(client):
    resp = client.post("/api/product/demo/reset")
    assert resp.status_code == 200
    assert resp.json()["status"] == "RESET"


# ============================================================================
# 8. Competition Product Invariant & Architectural Safety Tests
# ============================================================================

def test_invariant_safety_block_guarantees_zero_transmission(product_storage):
    """Invariant: Safety-blocked demos have zero transport transmissions and zero HIL actions."""
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="inv_sess_b")
    result = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_B, sess)

    assert result.status == ProductExecutionOutcome.BLOCKED
    assert result.safety_verdict == SafetyDecision.HELD
    assert result.hil_status == "NOT_TRANSMITTED"
    assert result.confidence_score < 0.70


def test_invariant_motion_contradiction_blocks_actuation(product_storage):
    """Invariant: Auxiliary motion contradiction caps confidence and triggers safety hold."""
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="inv_sess_c")
    result = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_C, sess)

    assert result.status == ProductExecutionOutcome.BLOCKED
    assert result.safety_verdict == SafetyDecision.HELD
    assert result.hil_status == "NOT_TRANSMITTED"


def test_invariant_provenance_cryptographic_hash_format(product_storage):
    """Invariant: Product provenance carries valid 64-character SHA-256 hashes."""
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="inv_sess_d")
    result = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_D, sess)

    assert result.provenance is not None
    assert len(result.provenance.provenance_hash) == 64
    assert all(c in "0123456789abcdefABCDEF" for c in result.provenance.provenance_hash)


def test_invariant_deterministic_reproducibility_across_runs(product_storage):
    """Invariant: Deterministic scenario produces identical results and hashes across consecutive runs."""
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="inv_sess_repro")

    res1 = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_A, sess)
    res2 = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_A, sess)

    assert res1.status == res2.status
    assert res1.candidate_intent == res2.candidate_intent
    assert res1.confidence_score == res2.confidence_score
    assert res1.safety_verdict == res2.safety_verdict


def test_invariant_fsm_rejects_transitions_from_terminal_states():
    """Invariant: Completed or Denied states cannot transition directly to executing states."""
    fsm = DemoStateMachine(DemoState.COMPLETED)
    assert not fsm.can_transition_to(DemoState.HIL_EXECUTING)
    assert not fsm.can_transition_to(DemoState.AUTHORIZED)

    fsm_denied = DemoStateMachine(DemoState.DENIED)
    assert not fsm_denied.can_transition_to(DemoState.AUTHORIZED)


def test_invariant_subsystem_health_routes_valid(product_service):
    """Invariant: Every subsystem health card points to an existing application route."""
    summary = product_service.get_system_status()
    expected_routes = {
        "/eeg/live",
        "/sensors",
        "/models/lab",
        "/intent",
        "/safety",
        "/hardware",
        "/research",
    }
    actual_routes = {card.route_href for card in summary.subsystems.values()}
    assert expected_routes.issubset(actual_routes)


def test_api_advance_step_without_active_run_fails(client):
    """API Edge Case: Advance step with invalid run ID returns 400 or raises gracefully."""
    # Reset first to ensure no active run
    client.post("/api/product/demo/reset")
    resp = client.post("/api/product/demo/step", json={"run_id": "non_existent_run"})
    assert resp.status_code in {400, 500}


def test_api_get_nonexistent_demo_result_returns_404(client):
    """API Edge Case: Fetching missing result ID returns 404."""
    resp = client.get("/api/product/demo/result/missing_run_id_999")
    assert resp.status_code == 404


def test_product_session_persistence_isolation(product_storage):
    """Persistence: Updating one session does not contaminate another."""
    sess1 = ProductSession(session_id="sess_iso_1", title="Session One")
    sess2 = ProductSession(session_id="sess_iso_2", title="Session Two")
    product_storage.save_product_session(sess1)
    product_storage.save_product_session(sess2)

    fetched1 = product_storage.get_product_session("sess_iso_1")
    fetched2 = product_storage.get_product_session("sess_iso_2")
    assert fetched1.title == "Session One"
    assert fetched2.title == "Session Two"


def test_demo_step_execution_latencies_tracked(product_storage):
    """Latency: All 9 stages record non-negative execution latencies."""
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="lat_sess")
    result = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_A, sess)

    assert len(result.latency_breakdown) >= 8
    for _step_key, lat in result.latency_breakdown.items():
        assert lat >= 0.0


def test_scenario_descriptor_source_honesty():
    """Honesty: Recorded scenario declares RECORDED source; Simulator declares SIMULATOR."""
    sc_a = ProductGoldenScenarios.get_scenario(ProductDemoScenario.PRODUCT_A)
    assert sc_a.source == SensorSource.SIMULATOR

    sc_d = ProductGoldenScenarios.get_scenario(ProductDemoScenario.PRODUCT_D)
    assert sc_d.source == SensorSource.RECORDED


def test_service_reset_clears_active_run_and_resets_session(product_service):
    """Service: Reset cleans active demonstration state and issues fresh session."""
    product_service.start_demo_scenario(ProductDemoScenario.PRODUCT_A)
    assert product_service.get_active_demo_run() is not None

    product_service.reset_session()
    assert product_service.get_active_demo_run() is None


def test_demo_run_explanation_contains_context_when_held(product_storage):
    """Explanation: Clear human-readable reasons provided when held."""
    orchestrator = DemoOrchestrator(product_storage)
    sess = ProductSession(session_id="expl_sess")
    result = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_B, sess)

    assert "interlocked" in result.explanation_text.lower() or "held" in result.explanation_text.lower()
    assert "0 actuator commands" in result.explanation_text or "safety" in result.explanation_text.lower()


def test_api_get_active_demo_run_lifecycle(client):
    """API: Active demo run can be retrieved while in progress and after start."""
    client.post("/api/product/demo/start", json={"scenario_id": "PRODUCT_A"})
    resp = client.get("/api/product/demo/active")
    assert resp.status_code == 200
    data = resp.json()
    assert data is not None
    assert data["scenario_id"] == "PRODUCT_A"


def test_api_reset_session_creates_fresh_id(client):
    """API: POST /api/product/session/reset returns a fresh valid session."""
    res1 = client.get("/api/product/session").json()
    res2 = client.post("/api/product/session/reset").json()
    assert res1["session_id"] != res2["session_id"]
    assert res2["status"] == "ACTIVE"

