"""Tests for Safety State Machine deterministic transitions and guardrails."""

import pytest

from neuromove.domain.enums import (
    Intent,
    OperatingMode,
    RiskLevel,
    RuntimeState,
    SafetyDecision,
)
from neuromove.domain.models import SignalQuality
from neuromove.safety.rules import SafetyArbitrator
from neuromove.safety.state_machine import (
    InvalidStateTransitionError,
    SafetyStateMachine,
)


def test_initial_state_is_safe_idle() -> None:
    sm = SafetyStateMachine(mode=OperatingMode.SIMULATION)
    assert sm.current_state == RuntimeState.IDLE
    assert sm.is_safe_to_actuate is False
    assert sm.get_safety_state().emergency_active is False


def test_valid_state_transitions_flow() -> None:
    sm = SafetyStateMachine(mode=OperatingMode.SIMULATION)

    # IDLE -> READY
    sm.transition_to(RuntimeState.READY, trigger="system_init")
    assert sm.current_state == RuntimeState.READY

    # READY -> CANDIDATE
    sm.transition_to(RuntimeState.CANDIDATE, trigger="candidate_detected")
    assert sm.current_state == RuntimeState.CANDIDATE

    # CANDIDATE -> CONFIRMED
    sm.transition_to(RuntimeState.CONFIRMED, trigger="temporal_confirmation")
    assert sm.current_state == RuntimeState.CONFIRMED

    # CONFIRMED -> EXECUTING
    sm.transition_to(RuntimeState.EXECUTING, trigger="safety_approved")
    assert sm.current_state == RuntimeState.EXECUTING

    # EXECUTING -> READY
    sm.transition_to(RuntimeState.READY, trigger="execution_finished")
    assert sm.current_state == RuntimeState.READY


def test_disallowed_state_transition_raises_error() -> None:
    sm = SafetyStateMachine(mode=OperatingMode.SIMULATION)
    # Direct jump from IDLE to EXECUTING is strictly prohibited
    with pytest.raises(InvalidStateTransitionError):
        sm.transition_to(RuntimeState.EXECUTING, trigger="illegal_jump")


def test_emergency_stop_from_any_state() -> None:
    sm = SafetyStateMachine(mode=OperatingMode.SIMULATION)
    sm.transition_to(RuntimeState.READY)
    sm.transition_to(RuntimeState.CANDIDATE)

    sm.trigger_emergency_stop(reason="Obstacle detected")
    assert sm.current_state == RuntimeState.EMERGENCY
    assert sm.is_safe_to_actuate is False
    assert sm.get_safety_state().emergency_active is True

    # Cannot transition directly to EXECUTING while in EMERGENCY
    with pytest.raises(InvalidStateTransitionError):
        sm.transition_to(RuntimeState.EXECUTING)

    # Reset to IDLE
    sm.reset_to_idle(reason="Manual clear")
    assert sm.current_state == RuntimeState.IDLE
    assert sm.get_safety_state().emergency_active is False


def test_safety_arbitrator_thresholds() -> None:
    arbitrator = SafetyArbitrator(min_confidence_threshold=0.70, min_signal_quality_threshold=0.60)

    good_sq = SignalQuality(overall_score=0.85, is_acceptable=True)
    bad_sq = SignalQuality(overall_score=0.40, is_acceptable=False)

    # High confidence + good SQ -> APPROVED
    decision, _ = arbitrator.evaluate_intent(Intent.FORWARD, 0.85, good_sq, RiskLevel.SAFE)
    assert decision == SafetyDecision.APPROVED

    # Low confidence -> BLOCKED
    decision, _ = arbitrator.evaluate_intent(Intent.FORWARD, 0.50, good_sq, RiskLevel.SAFE)
    assert decision == SafetyDecision.BLOCKED

    # Bad signal quality -> BLOCKED
    decision, _ = arbitrator.evaluate_intent(Intent.FORWARD, 0.85, bad_sq, RiskLevel.SAFE)
    assert decision == SafetyDecision.BLOCKED

    # Critical risk -> STOP
    decision, _ = arbitrator.evaluate_intent(Intent.FORWARD, 0.95, good_sq, RiskLevel.CRITICAL)
    assert decision == SafetyDecision.STOP
