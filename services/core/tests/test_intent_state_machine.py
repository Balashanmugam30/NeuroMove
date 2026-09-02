"""Comprehensive unit, integration, and API test suite for Canonical Intent State Machine (Phase 16)."""

import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import app
from neuromove.confidence.models import ConfidenceBand, ConfidenceEligibility
from neuromove.intent.models import (
    IntentCompleteRequest,
    IntentIngestRequest,
    IntentLifecycleState,
    IntentResetRequest,
    IntentTransitionReason,
    IntentTransitionTrigger,
)
from neuromove.intent.service import get_intent_service
from neuromove.intent.state_machine import IntentStateMachine


@pytest.fixture(autouse=True)
def reset_engine_state():
    """Ensure clean intent engine state for every test."""
    service = get_intent_service()
    service.set_mock_time(None)
    service.reset_state(IntentResetRequest(reason=IntentTransitionReason.MANUAL_RESET))
    yield
    service.set_mock_time(None)
    service.reset_state(IntentResetRequest(reason=IntentTransitionReason.MANUAL_RESET))


# =============================================================================
# 1. State Machine Unit Tests
# =============================================================================


def test_state_machine_legal_transitions():
    """Verify explicit transition matrix allowed paths."""
    sm = IntentStateMachine()

    # NO_INTENT transitions
    assert sm.can_transition(
        IntentLifecycleState.NO_INTENT, IntentTransitionTrigger.HANDOFF_CANDIDATE
    )
    assert sm.can_transition(
        IntentLifecycleState.NO_INTENT, IntentTransitionTrigger.HANDOFF_CONFIRMED
    )
    assert not sm.can_transition(
        IntentLifecycleState.NO_INTENT, IntentTransitionTrigger.EXPLICIT_COMPLETE
    )

    # CANDIDATE transitions
    assert sm.can_transition(
        IntentLifecycleState.CANDIDATE, IntentTransitionTrigger.HANDOFF_CONFIRMED
    )
    assert sm.can_transition(IntentLifecycleState.CANDIDATE, IntentTransitionTrigger.TIMEOUT)
    assert sm.can_transition(
        IntentLifecycleState.CANDIDATE, IntentTransitionTrigger.EXPLICIT_CANCEL
    )
    assert sm.can_transition(IntentLifecycleState.CANDIDATE, IntentTransitionTrigger.INTERRUPTION)

    # ACTIVE transitions
    assert sm.can_transition(IntentLifecycleState.ACTIVE, IntentTransitionTrigger.EXPLICIT_COMPLETE)
    assert sm.can_transition(IntentLifecycleState.ACTIVE, IntentTransitionTrigger.EXPLICIT_CANCEL)
    assert sm.can_transition(IntentLifecycleState.ACTIVE, IntentTransitionTrigger.TIMEOUT)
    assert sm.can_transition(
        IntentLifecycleState.ACTIVE, IntentTransitionTrigger.REPLACEMENT_REQUEST
    )


def test_terminal_state_mutation_strictly_blocked():
    """Verify terminal states (COMPLETED, CANCELLED, EXPIRED, INTERRUPTED) cannot transition."""
    sm = IntentStateMachine()

    for terminal in (
        IntentLifecycleState.COMPLETED,
        IntentLifecycleState.CANCELLED,
        IntentLifecycleState.EXPIRED,
        IntentLifecycleState.INTERRUPTED,
    ):
        assert sm.is_terminal(terminal)
        assert not sm.can_transition(terminal, IntentTransitionTrigger.ACCEPT_ACTIVE)
        assert not sm.can_transition(terminal, IntentTransitionTrigger.HANDOFF_CONFIRMED)
        with pytest.raises(ValueError, match="Terminal state mutation blocked"):
            sm.validate_transition(terminal, IntentTransitionTrigger.ACCEPT_ACTIVE)


def test_impossible_transitions_raise_value_error():
    """Verify invalid triggers raise explicit ValueError."""
    sm = IntentStateMachine()
    with pytest.raises(ValueError, match="Illegal transition"):
        sm.validate_transition(
            IntentLifecycleState.NO_INTENT, IntentTransitionTrigger.EXPLICIT_COMPLETE
        )


# =============================================================================
# 2. Lifecycle Engine & Handoff Ingestion Tests
# =============================================================================


def test_unconfirmed_handoff_creates_candidate():
    """Unconfirmed valid prediction creates a CANDIDATE intent."""
    service = get_intent_service()
    snapshot = service.ingest_handoff(
        IntentIngestRequest(
            prediction="LEFT_IMAGERY",
            confidence=0.82,
            confidence_band=ConfidenceBand.HIGH,
            eligibility=ConfidenceEligibility.VALID,
            temporal_status="TRACKING",
            temporally_confirmed=False,
            confirmation_reason="Tracking evidence",
            model_version_id="v1",
            subject_id="sub-001",
            session_id="ses-001",
        )
    )

    assert snapshot.current_state == IntentLifecycleState.CANDIDATE
    assert snapshot.intent_class == "LEFT_IMAGERY"
    assert snapshot.active_intent_id is not None
    assert snapshot.state_deadline is not None


def test_confirmed_handoff_activates_intent():
    """Temporally confirmed handoff promotes directly through to ACTIVE state."""
    service = get_intent_service()
    snapshot = service.ingest_handoff(
        IntentIngestRequest(
            prediction="RIGHT_IMAGERY",
            confidence=0.91,
            confidence_band=ConfidenceBand.HIGH,
            eligibility=ConfidenceEligibility.VALID,
            temporal_status="CONFIRMED",
            temporally_confirmed=True,
            confirmation_reason="Consecutive windows satisfied",
            model_version_id="v1",
            subject_id="sub-001",
            session_id="ses-001",
        )
    )

    assert snapshot.current_state == IntentLifecycleState.ACTIVE
    assert snapshot.intent_class == "RIGHT_IMAGERY"
    assert snapshot.active_intent_id is not None

    current = service.get_current_intent()
    assert current is not None
    assert current.intent_id == snapshot.active_intent_id
    assert current.current_state == IntentLifecycleState.ACTIVE
    assert not current.is_terminal


def test_intent_completion_lifecycle():
    """Active intent can be explicitly marked COMPLETED (software lifecycle)."""
    service = get_intent_service()
    service.ingest_handoff(
        IntentIngestRequest(
            prediction="LEFT_IMAGERY",
            confidence=0.90,
            confidence_band=ConfidenceBand.HIGH,
            eligibility=ConfidenceEligibility.VALID,
            temporal_status="CONFIRMED",
            temporally_confirmed=True,
            confirmation_reason="Confirmed",
            model_version_id="v1",
            subject_id="sub-001",
            session_id="ses-001",
        )
    )
    active_id = service.snapshot.active_intent_id
    assert active_id is not None

    snapshot = service.complete_intent(IntentCompleteRequest(intent_id=active_id))
    assert snapshot.current_state == IntentLifecycleState.COMPLETED
    assert snapshot.active_intent_id is None

    # Completed intent in storage is terminal
    rec = service.storage.get_intent_record(active_id)
    assert rec is not None
    assert rec.is_terminal
    assert rec.current_state == IntentLifecycleState.COMPLETED


def test_candidate_timeout_triggers_expiration():
    """Candidate that exceeds candidate_timeout_ms transitions to EXPIRED."""
    service = get_intent_service()
    service.set_mock_time(1000.0)
    service.ingest_handoff(
        IntentIngestRequest(
            prediction="LEFT_IMAGERY",
            confidence=0.80,
            confidence_band=ConfidenceBand.HIGH,
            eligibility=ConfidenceEligibility.VALID,
            temporal_status="TRACKING",
            temporally_confirmed=False,
            confirmation_reason="Tracking",
            model_version_id="v1",
            subject_id="sub-001",
            session_id="ses-001",
        )
    )
    assert service.snapshot.current_state == IntentLifecycleState.CANDIDATE

    # Advance beyond 1000ms deadline
    service.set_mock_time(1001.5)
    snapshot = service.get_snapshot()
    assert snapshot.current_state == IntentLifecycleState.EXPIRED
    assert snapshot.transition_reason == IntentTransitionReason.CANDIDATE_TIMEOUT


def test_context_switch_subject_isolation():
    """Subject switch immediately interrupts active intent and establishes clean context."""
    service = get_intent_service()
    service.ingest_handoff(
        IntentIngestRequest(
            prediction="LEFT_IMAGERY",
            confidence=0.90,
            confidence_band=ConfidenceBand.HIGH,
            eligibility=ConfidenceEligibility.VALID,
            temporal_status="CONFIRMED",
            temporally_confirmed=True,
            confirmation_reason="Confirmed",
            model_version_id="v1",
            subject_id="sub-001",
            session_id="ses-001",
        )
    )
    first_id = service.snapshot.active_intent_id

    # Switch subject to sub-002
    service.ingest_handoff(
        IntentIngestRequest(
            prediction="RIGHT_IMAGERY",
            confidence=0.88,
            confidence_band=ConfidenceBand.HIGH,
            eligibility=ConfidenceEligibility.VALID,
            temporal_status="CONFIRMED",
            temporally_confirmed=True,
            confirmation_reason="Confirmed",
            model_version_id="v1",
            subject_id="sub-002",
            session_id="ses-001",
        )
    )

    # Prior intent must be interrupted
    old_rec = service.storage.get_intent_record(first_id)
    assert old_rec.is_terminal
    assert old_rec.current_state == IntentLifecycleState.INTERRUPTED

    # New intent active for sub-002
    assert service.snapshot.current_state == IntentLifecycleState.ACTIVE
    assert service.snapshot.subject_id == "sub-002"
    assert service.snapshot.active_intent_id != first_id


def test_rest_prediction_cancels_candidate():
    """REST prediction cancels active candidate."""
    service = get_intent_service()
    service.ingest_handoff(
        IntentIngestRequest(
            prediction="LEFT_IMAGERY",
            confidence=0.80,
            confidence_band=ConfidenceBand.HIGH,
            eligibility=ConfidenceEligibility.VALID,
            temporal_status="TRACKING",
            temporally_confirmed=False,
            confirmation_reason="Tracking",
            model_version_id="v1",
            subject_id="sub-001",
            session_id="ses-001",
        )
    )
    assert service.snapshot.current_state == IntentLifecycleState.CANDIDATE

    service.ingest_handoff(
        IntentIngestRequest(
            prediction="REST",
            confidence=0.95,
            confidence_band=ConfidenceBand.HIGH,
            eligibility=ConfidenceEligibility.VALID,
            temporal_status="TRACKING",
            temporally_confirmed=False,
            confirmation_reason="Rest detected",
            model_version_id="v1",
            subject_id="sub-001",
            session_id="ses-001",
        )
    )
    assert service.snapshot.current_state == IntentLifecycleState.CANCELLED
    assert service.snapshot.transition_reason == IntentTransitionReason.REST_PREDICTION


def test_idempotent_duplicate_event_ingestion():
    """Duplicate source_event_id does not create duplicate transitions."""
    service = get_intent_service()
    event_id = "evt_dedup_001"
    req = IntentIngestRequest(
        prediction="LEFT_IMAGERY",
        confidence=0.90,
        confidence_band=ConfidenceBand.HIGH,
        eligibility=ConfidenceEligibility.VALID,
        temporal_status="CONFIRMED",
        temporally_confirmed=True,
        confirmation_reason="Confirmed",
        model_version_id="v1",
        subject_id="sub-001",
        session_id="ses-001",
        source_event_id=event_id,
    )
    service.ingest_handoff(req)
    t_count = service.snapshot.transition_count

    # Second duplicate ingestion
    service.ingest_handoff(req)
    assert service.snapshot.transition_count == t_count


def test_cross_class_replacement():
    """New confirmed opposing class replaces active intent."""
    service = get_intent_service()
    service.ingest_handoff(
        IntentIngestRequest(
            prediction="LEFT_IMAGERY",
            confidence=0.90,
            confidence_band=ConfidenceBand.HIGH,
            eligibility=ConfidenceEligibility.VALID,
            temporal_status="CONFIRMED",
            temporally_confirmed=True,
            confirmation_reason="Confirmed LEFT",
            model_version_id="v1",
            subject_id="sub-001",
            session_id="ses-001",
        )
    )
    first_id = service.snapshot.active_intent_id

    # RIGHT_IMAGERY confirmed
    service.ingest_handoff(
        IntentIngestRequest(
            prediction="RIGHT_IMAGERY",
            confidence=0.92,
            confidence_band=ConfidenceBand.HIGH,
            eligibility=ConfidenceEligibility.VALID,
            temporal_status="CONFIRMED",
            temporally_confirmed=True,
            confirmation_reason="Confirmed RIGHT",
            model_version_id="v1",
            subject_id="sub-001",
            session_id="ses-001",
        )
    )

    assert service.snapshot.current_state == IntentLifecycleState.ACTIVE
    assert service.snapshot.intent_class == "RIGHT_IMAGERY"
    assert service.snapshot.active_intent_id != first_id


# =============================================================================
# 3. Deterministic Scenario Lab Tests (A through L)
# =============================================================================


@pytest.mark.parametrize(
    "scenario_id",
    [
        "SCENARIO_A_NORMAL_LIFECYCLE",
        "SCENARIO_B_CANDIDATE_TIMEOUT",
        "SCENARIO_C_CANDIDATE_CANCEL",
        "SCENARIO_D_ACTIVE_INTERRUPTION",
        "SCENARIO_E_SESSION_BOUNDARY",
        "SCENARIO_F_MODEL_BOUNDARY",
        "SCENARIO_G_REST_HANDLING",
        "SCENARIO_H_SAME_CLASS_COOLDOWN",
        "SCENARIO_I_CROSS_CLASS_REPLACEMENT",
        "SCENARIO_J_DUPLICATE_IDEMPOTENCY",
        "SCENARIO_K_OUT_OF_ORDER",
        "SCENARIO_L_RECONNECT_RECOVERY",
    ],
)
def test_all_deterministic_scenarios(scenario_id: str):
    """Verify deterministic research scenarios A through L execute successfully."""
    service = get_intent_service()
    res = service.run_scenario(scenario_id)
    assert res.passed is True
    assert len(res.results) > 0


# =============================================================================
# 4. REST API Endpoint Tests
# =============================================================================


def test_api_intent_state_and_history():
    """Verify REST API state retrieval and transition history."""
    client = TestClient(app)

    # Ingest handoff via API
    ingest_res = client.post(
        "/api/intent/ingest",
        json={
            "prediction": "LEFT_IMAGERY",
            "confidence": 0.90,
            "confidence_band": "HIGH",
            "eligibility": "VALID",
            "temporal_status": "CONFIRMED",
            "temporally_confirmed": True,
            "confirmation_reason": "API confirmed",
            "model_version_id": "v1",
            "subject_id": "sub-api",
            "session_id": "ses-api",
        },
    )
    assert ingest_res.status_code == 200
    data = ingest_res.json()
    assert data["current_state"] == "ACTIVE"
    assert data["intent_class"] == "LEFT_IMAGERY"

    # Get state
    state_res = client.get("/api/intent/state")
    assert state_res.status_code == 200
    assert state_res.json()["current_state"] == "ACTIVE"

    # Get current intent
    curr_res = client.get("/api/intent/current")
    assert curr_res.status_code == 200
    assert curr_res.json()["intent_class"] == "LEFT_IMAGERY"

    # Get history
    hist_res = client.get("/api/intent/history")
    assert hist_res.status_code == 200
    assert len(hist_res.json()) > 0

    # Complete intent
    comp_res = client.post("/api/intent/complete", json={"reason": "EXPLICIT_COMPLETE"})
    assert comp_res.status_code == 200
    assert comp_res.json()["current_state"] == "COMPLETED"

    # Reset intent
    reset_res = client.post("/api/intent/reset", json={"reason": "MANUAL_RESET"})
    assert reset_res.status_code == 200
    assert reset_res.json()["current_state"] == "NO_INTENT"
