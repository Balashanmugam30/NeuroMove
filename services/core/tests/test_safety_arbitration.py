"""Exhaustive unit, integration, and API test suite for Phase 17 Safety Arbitration."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import app
from neuromove.domain.enums import SafetyDecision
from neuromove.safety.models import (
    PrecedenceRank,
    SafetyArbitrationState,
)
from neuromove.safety.service import SafetyService
from neuromove.safety.state_machine import (
    SafetyArbitrationStateMachine,
    SafetyArbitrationTransitionError,
)
from neuromove.safety.storage import SafetyStorage


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def clean_service() -> SafetyService:
    storage = SafetyStorage()
    service = SafetyService(storage=storage)
    service.context_provider.reset_state()
    service.context_provider.set_emergency_stop(False)
    service.context_provider.set_lockout(False)
    service.context_provider.set_operator_hold(False)
    service.execute_reset()
    return service


@pytest.fixture
def valid_active_intent() -> dict[str, Any]:
    now_ts = datetime.now(UTC).timestamp()
    return {
        "intent_id": "int_test_01",
        "intent_class": "LEFT",
        "state": "ACTIVE",
        "current_state": "ACTIVE",
        "subject_id": "sub_test_01",
        "session_id": "sess_test_01",
        "model_version_id": "model_v1",
        "confidence_score": 0.90,
        "confidence_evaluation_id": "conf_test_01",
        "temporal_confirmation_id": "tc_test_01",
        "created_at": datetime.fromtimestamp(now_ts - 0.05, tz=UTC).isoformat(),
        "updated_at": datetime.fromtimestamp(now_ts - 0.05, tz=UTC).isoformat(),
    }


# ==============================================================================
# 1. Decision Logic & Rule Evaluation Tests
# ==============================================================================


def test_valid_intent_yields_authorized(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    evaluation = clean_service.evaluate_intent(valid_active_intent)
    assert evaluation.decision == SafetyDecision.AUTHORIZED
    assert evaluation.state == SafetyArbitrationState.AUTHORIZED
    assert evaluation.precedence_rank == PrecedenceRank.AUTHORIZED
    assert len(evaluation.passed_rules) == 13
    assert len(evaluation.violated_rules) == 0


def test_operator_hold_yields_held(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    clean_service.assert_operator_hold(operator_id="OP_TEST", reason="Routine hold")
    evaluation = clean_service.evaluate_intent(valid_active_intent)
    assert evaluation.decision == SafetyDecision.HELD
    assert evaluation.state == SafetyArbitrationState.HELD
    assert evaluation.precedence_rank == PrecedenceRank.OPERATOR_HOLD
    assert any(r.reason_code == "OPERATOR_HOLD_ACTIVE" for r in evaluation.violated_rules)


def test_blocked_intent_class_yields_denied(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    blocked_intent = dict(valid_active_intent)
    blocked_intent["intent_class"] = "REST"
    evaluation = clean_service.evaluate_intent(blocked_intent)
    assert evaluation.decision == SafetyDecision.DENIED
    assert evaluation.state == SafetyArbitrationState.DENIED
    assert any(r.reason_code == "INTENT_CLASS_BLOCKED" for r in evaluation.violated_rules)


def test_unknown_critical_health_fails_closed(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    evaluation = clean_service.evaluate_intent(
        valid_active_intent,
        context_override={"system_health": {"model_service": "UNKNOWN"}},
    )
    assert evaluation.decision == SafetyDecision.DENIED
    assert evaluation.state == SafetyArbitrationState.DENIED
    assert evaluation.precedence_rank == PrecedenceRank.CRITICAL_HEALTH


def test_emergency_stop_yields_emergency_stop(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    clean_service.assert_emergency_stop(reason="Test E-Stop", asserted_by="OPERATOR")
    evaluation = clean_service.evaluate_intent(valid_active_intent)
    assert evaluation.decision == SafetyDecision.EMERGENCY_STOP
    assert evaluation.state == SafetyArbitrationState.EMERGENCY_STOP
    assert evaluation.precedence_rank == PrecedenceRank.EMERGENCY_STOP


def test_lockout_yields_locked_out(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    clean_service.assert_lockout(reason="Test Lockout")
    evaluation = clean_service.evaluate_intent(valid_active_intent)
    assert evaluation.decision == SafetyDecision.LOCKED_OUT
    assert evaluation.state == SafetyArbitrationState.LOCKED_OUT
    assert evaluation.precedence_rank == PrecedenceRank.LOCKED_OUT


# ==============================================================================
# 2. Precedence Hierarchy Invariant Tests
# ==============================================================================


def test_precedence_emergency_stop_dominates_all(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    clean_service.assert_emergency_stop(reason="Global E-Stop")
    clean_service.assert_operator_hold(reason="Secondary Hold")
    multi_fault_intent = dict(valid_active_intent)
    multi_fault_intent["intent_class"] = "REST"  # blocked
    multi_fault_intent["updated_at"] = "1970-01-01T00:00:00Z"  # stale

    evaluation = clean_service.evaluate_intent(
        multi_fault_intent,
        context_override={"system_health": {"database": "ERROR"}},
    )
    # E-Stop (Rank 1) must win
    assert evaluation.decision == SafetyDecision.EMERGENCY_STOP
    assert evaluation.precedence_rank == 1
    assert "Emergency Stop" in evaluation.primary_reason


def test_precedence_lockout_dominates_hard_constraints(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    clean_service.assert_lockout(reason="Lockout active")
    blocked_intent = dict(valid_active_intent)
    blocked_intent["intent_class"] = "REST"

    evaluation = clean_service.evaluate_intent(blocked_intent)
    assert evaluation.decision == SafetyDecision.LOCKED_OUT
    assert evaluation.precedence_rank == 2


def test_precedence_health_failure_dominates_operator_hold(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    clean_service.assert_operator_hold(reason="Hold active")
    evaluation = clean_service.evaluate_intent(
        valid_active_intent,
        context_override={"system_health": {"event_dispatcher": "ERROR"}},
    )
    # Critical Health (Rank 4) dominates Operator Hold (Rank 7)
    assert evaluation.decision == SafetyDecision.DENIED
    assert evaluation.precedence_rank == 4


# ==============================================================================
# 3. Intent Eligibility & Provenance Tests
# ==============================================================================


@pytest.mark.parametrize(
    "ineligible_state",
    ["CONFIRMED", "CANDIDATE", "NO_INTENT", "COMPLETED", "CANCELLED", "EXPIRED", "INTERRUPTED"],
)
def test_ineligible_intent_states_are_denied(
    clean_service: SafetyService, valid_active_intent: dict[str, Any], ineligible_state: str
) -> None:
    intent = dict(valid_active_intent)
    intent["state"] = ineligible_state
    intent["current_state"] = ineligible_state
    evaluation = clean_service.evaluate_intent(intent)
    assert evaluation.decision == SafetyDecision.DENIED
    assert any(r.reason_code == "INTENT_NOT_ACTIVE" for r in evaluation.violated_rules)


def test_stale_intent_exceeding_threshold_is_denied(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    intent = dict(valid_active_intent)
    now = 5000.0
    clean_service.set_time_override(now)
    intent["updated_at"] = datetime.fromtimestamp(
        now - 1.0, tz=UTC
    ).isoformat()  # 1000ms old > 500ms
    evaluation = clean_service.evaluate_intent(intent)
    clean_service.clear_time_override()
    assert evaluation.decision == SafetyDecision.DENIED
    assert any(r.reason_code == "INTENT_STALE" for r in evaluation.violated_rules)


def test_model_version_mismatch_is_denied(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    intent = dict(valid_active_intent)
    intent["model_version_id"] = "model_legacy_v0"
    evaluation = clean_service.evaluate_intent(
        intent,
        context_override={
            "model_health": {
                "is_active": True,
                "is_rolled_back": False,
                "model_version_id": "model_active_v2",
            }
        },
    )
    assert evaluation.decision == SafetyDecision.DENIED
    assert any(r.reason_code == "MODEL_VERSION_MISMATCH" for r in evaluation.violated_rules)


def test_rolled_back_model_is_denied(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    evaluation = clean_service.evaluate_intent(
        valid_active_intent,
        context_override={
            "model_health": {
                "is_active": True,
                "is_rolled_back": True,
                "model_version_id": "model_v1",
            }
        },
    )
    assert evaluation.decision == SafetyDecision.DENIED
    assert any(r.reason_code == "MODEL_ROLLED_BACK" for r in evaluation.violated_rules)


def test_subject_mismatch_is_denied(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    intent = dict(valid_active_intent)
    intent["subject_id"] = "sub_UNKNOWN"
    evaluation = clean_service.evaluate_intent(
        intent,
        context_override={
            "session_validity": {
                "active_subject_id": "sub_AUTHORIZED",
                "active_session_id": "sess_01",
            }
        },
    )
    assert evaluation.decision == SafetyDecision.DENIED
    assert any(r.reason_code == "SUBJECT_MISMATCH" for r in evaluation.violated_rules)


# ==============================================================================
# 4. Rate Limiting & Active Duration Tests
# ==============================================================================


def test_rate_limiter_blocks_excessive_authorizations(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    now = 10000.0
    clean_service.set_time_override(now)
    # Inject 5 recent timestamps within 1s window (limit is 5)
    timestamps = [now - 0.5, now - 0.4, now - 0.3, now - 0.2, now - 0.1]
    evaluation = clean_service.evaluate_intent(
        valid_active_intent,
        context_override={"execution_rate": {"recent_authorizations_timestamps": timestamps}},
    )
    clean_service.clear_time_override()
    assert evaluation.decision == SafetyDecision.DENIED
    assert any(r.reason_code == "COMMAND_RATE_EXCEEDED" for r in evaluation.violated_rules)


def test_minimum_command_gap_enforced(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    now = 10000.0
    clean_service.set_time_override(now)
    # Last command was 30ms ago (min gap is 100ms)
    timestamps = [now - 0.03]
    evaluation = clean_service.evaluate_intent(
        valid_active_intent,
        context_override={"execution_rate": {"recent_authorizations_timestamps": timestamps}},
    )
    clean_service.clear_time_override()
    assert evaluation.decision == SafetyDecision.DENIED
    assert any(r.reason_code == "MINIMUM_GAP_VIOLATED" for r in evaluation.violated_rules)


def test_continuous_duration_limit_enforced(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    now = 10000.0
    clean_service.set_time_override(now)
    # Active authorized since 3.0s ago (limit is 2.0s)
    evaluation = clean_service.evaluate_intent(
        valid_active_intent,
        context_override={"current_action_state": {"active_authorized_since": now - 3.0}},
    )
    clean_service.clear_time_override()
    assert evaluation.decision == SafetyDecision.DENIED
    assert any(r.reason_code == "MAX_DURATION_EXCEEDED" for r in evaluation.violated_rules)


# ==============================================================================
# 5. Emergency Stop, Lockout & Reset Sequence Tests
# ==============================================================================


def test_emergency_stop_lifecycle_never_auto_authorizes(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    # 1. Assert E-Stop
    snap1 = clean_service.assert_emergency_stop(reason="Operator halt", asserted_by="USER")
    assert snap1.current_state == SafetyArbitrationState.EMERGENCY_STOP
    assert snap1.emergency_stop is True

    # 2. Clear E-Stop -> moves to RESET_PENDING
    snap2 = clean_service.clear_emergency_stop(operator_id="USER")
    assert snap2.current_state == SafetyArbitrationState.RESET_PENDING
    assert snap2.last_decision != SafetyDecision.AUTHORIZED

    # 3. Evaluation in RESET_PENDING fails
    eval_pending = clean_service.evaluate_intent(valid_active_intent)
    assert eval_pending.decision == SafetyDecision.DENIED

    # 4. Execute verified reset -> SAFE_IDLE
    snap3 = clean_service.execute_reset(operator_id="USER")
    assert snap3.current_state == SafetyArbitrationState.SAFE_IDLE

    # 5. Fresh evaluation passes
    eval_fresh = clean_service.evaluate_intent(valid_active_intent)
    assert eval_fresh.decision == SafetyDecision.AUTHORIZED


def test_lockout_and_unlock_lifecycle(
    clean_service: SafetyService, valid_active_intent: dict[str, Any]
) -> None:
    # 1. Assert Lockout
    snap1 = clean_service.assert_lockout(reason="Threshold breached")
    assert snap1.current_state == SafetyArbitrationState.LOCKED_OUT
    assert snap1.lockout is True

    # 2. Unlock -> RESET_PENDING
    snap2 = clean_service.unlock(operator_id="ADMIN")
    assert snap2.current_state == SafetyArbitrationState.RESET_PENDING

    # 3. Reset -> SAFE_IDLE
    snap3 = clean_service.execute_reset(operator_id="ADMIN")
    assert snap3.current_state == SafetyArbitrationState.SAFE_IDLE


def test_illegal_state_transition_raises_error() -> None:
    sm = SafetyArbitrationStateMachine()
    # Direct jump from SAFE_IDLE to AUTHORIZED without EVALUATING is prohibited
    with pytest.raises(SafetyArbitrationTransitionError):
        sm.transition_to(
            target_state=SafetyArbitrationState.AUTHORIZED,
            trigger_name="ILLEGAL_BYPASS",
            reason="Illegal jump",
        )


# ==============================================================================
# 6. Deterministic Simulation Scenarios (Scenarios A through O)
# ==============================================================================


@pytest.mark.parametrize(
    "scenario_id",
    [
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
        "SCENARIO_M",
        "SCENARIO_N",
        "SCENARIO_O",
    ],
)
def test_simulation_scenarios_pass_deterministically(
    clean_service: SafetyService, scenario_id: str
) -> None:
    result = clean_service.run_scenario(scenario_id)
    assert result.passed is True
    assert result.actual_decision == result.expected_decision
    assert result.actual_state == result.expected_state


# ==============================================================================
# 7. REST API Endpoints Tests
# ==============================================================================


def test_api_get_safety_state(client: TestClient) -> None:
    res = client.get("/api/safety/state")
    assert res.status_code == 200
    data = res.json()
    assert "current_state" in data
    assert "last_decision" in data
    assert "active_policy_version" in data


def test_api_get_and_put_policy(client: TestClient) -> None:
    res = client.get("/api/safety/policy")
    assert res.status_code == 200
    policy = res.json()
    assert policy["max_intent_age_ms"] == 500.0

    # Modify policy
    policy["max_intent_age_ms"] = 650.0
    put_res = client.put("/api/safety/policy", json=policy)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["max_intent_age_ms"] == 650.0

    # Restore
    policy["max_intent_age_ms"] = 500.0
    client.put("/api/safety/policy", json=policy)


def test_api_evaluate_intent(client: TestClient, valid_active_intent: dict[str, Any]) -> None:
    res = client.post("/api/safety/evaluate", json={"intent_snapshot": valid_active_intent})
    assert res.status_code == 200
    eval_data = res.json()
    assert eval_data["decision"] in ("AUTHORIZED", "HELD", "DENIED", "EMERGENCY_STOP", "LOCKED_OUT")
    assert "violated_rules" in eval_data
    assert "passed_rules" in eval_data


def test_api_operator_hold_and_release(client: TestClient) -> None:
    hold_res = client.post(
        "/api/safety/hold", json={"operator_id": "API_TEST", "reason": "Hold test"}
    )
    assert hold_res.status_code == 200
    assert hold_res.json()["operator_hold"] is True

    rel_res = client.post("/api/safety/release-hold", json={"operator_id": "API_TEST"})
    assert rel_res.status_code == 200
    assert rel_res.json()["operator_hold"] is False


def test_api_emergency_stop_and_reset(client: TestClient) -> None:
    # Assert E-stop
    stop_res = client.post(
        "/api/safety/emergency-stop", json={"reason": "API E-Stop", "asserted_by": "API_TEST"}
    )
    assert stop_res.status_code == 200
    assert stop_res.json()["emergency_stop"] is True

    # Clear E-stop
    clear_res = client.post("/api/safety/clear-emergency-stop", json={"asserted_by": "API_TEST"})
    assert clear_res.status_code == 200
    assert clear_res.json()["current_state"] == "RESET_PENDING"

    # Reset
    reset_res = client.post("/api/safety/reset", json={"operator_id": "API_TEST"})
    assert reset_res.status_code == 200
    assert reset_res.json()["current_state"] == "SAFE_IDLE"


def test_api_lockout_and_unlock(client: TestClient) -> None:
    lock_res = client.post("/api/safety/lockout", json={"reason": "API Lockout test"})
    assert lock_res.status_code == 200
    assert lock_res.json()["lockout"] is True

    unlock_res = client.post("/api/safety/unlock", json={"operator_id": "API_TEST"})
    assert unlock_res.status_code == 200
    assert unlock_res.json()["current_state"] == "RESET_PENDING"

    reset_res = client.post("/api/safety/reset", json={"operator_id": "API_TEST"})
    assert reset_res.status_code == 200
    assert reset_res.json()["current_state"] == "SAFE_IDLE"


def test_api_list_rules(client: TestClient) -> None:
    res = client.get("/api/safety/rules")
    assert res.status_code == 200
    rules = res.json()
    assert len(rules) == 13
    rule_ids = [r["rule_id"] for r in rules]
    assert "RULE_01_EMERGENCY_STOP" in rule_ids
    assert "RULE_12_RATE_LIMIT" in rule_ids


def test_api_get_diagnostics(client: TestClient) -> None:
    res = client.get("/api/safety/diagnostics")
    assert res.status_code == 200
    diag = res.json()
    assert "evaluation_count" in diag
    assert "authorized_count" in diag
    assert "top_denial_reasons" in diag


def test_api_run_simulation_scenario(client: TestClient) -> None:
    res = client.post("/api/safety/simulation/scenarios", json={"scenario_id": "SCENARIO_A"})
    assert res.status_code == 200
    result = res.json()
    assert result["scenario_id"] == "SCENARIO_A"
    assert result["passed"] is True
    assert result["actual_decision"] == "AUTHORIZED"
