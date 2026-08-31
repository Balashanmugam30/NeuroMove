"""Test parsing and validation of canonical JSON contract fixtures in Python."""

import json
from pathlib import Path

import pytest

from neuromove.domain.enums import (
    EventType,
    Intent,
    OperatingMode,
    RiskLevel,
    SafetyDecision,
    SessionStatus,
    TrialQuality,
)
from neuromove.domain.models import Session, SystemStatus, Trial
from neuromove.events.envelope import (
    EventEnvelope,
    IntentConfirmedPayload,
    PredictionPayload,
    RobotStatePayload,
    SafetyDecisionPayload,
)

FIXTURES_DIR = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "contracts"


def test_system_status_fixture() -> None:
    """Validate system-status.json fixture against SystemStatus domain model."""
    file_path = FIXTURES_DIR / "system-status.json"
    assert file_path.exists(), f"Fixture {file_path} not found"
    data = json.loads(file_path.read_text(encoding="utf-8"))

    status = SystemStatus.model_validate(data)
    assert status.service == "neuromove-core"
    assert status.mode == OperatingMode.SIMULATION
    assert status.components.api.value == "healthy"
    assert status.components.database.value == "ready"


def test_prediction_event_fixture() -> None:
    """Validate prediction-event.json fixture against EventEnvelope[PredictionPayload]."""
    file_path = FIXTURES_DIR / "prediction-event.json"
    data = json.loads(file_path.read_text(encoding="utf-8"))

    event = EventEnvelope[PredictionPayload].model_validate(data)
    assert event.event_id.startswith("evt_")
    assert event.event_type == EventType.PREDICTION
    assert event.payload.intent == Intent.RIGHT
    assert event.payload.neural_confidence == pytest.approx(0.92)
    assert event.payload.class_probabilities["RIGHT"] == pytest.approx(0.92)


def test_intent_confirmed_event_fixture() -> None:
    """Validate intent-confirmed-event.json fixture."""
    file_path = FIXTURES_DIR / "intent-confirmed-event.json"
    data = json.loads(file_path.read_text(encoding="utf-8"))

    event = EventEnvelope[IntentConfirmedPayload].model_validate(data)
    assert event.event_type == EventType.INTENT_CONFIRMED
    assert event.payload.intent == Intent.RIGHT
    assert event.payload.confirmation_window_ms == 350
    assert event.payload.consecutive_epochs == 3


def test_safety_approved_event_fixture() -> None:
    """Validate safety-approved-event.json fixture."""
    file_path = FIXTURES_DIR / "safety-approved-event.json"
    data = json.loads(file_path.read_text(encoding="utf-8"))

    event = EventEnvelope[SafetyDecisionPayload].model_validate(data)
    assert event.event_type == EventType.SAFETY_APPROVED
    assert event.payload.decision == SafetyDecision.APPROVED
    assert event.payload.risk_level == RiskLevel.SAFE
    assert event.payload.obstacle_state == "CLEAR"
    assert not event.payload.emergency_state


def test_safety_blocked_event_fixture() -> None:
    """Validate safety-blocked-event.json fixture."""
    file_path = FIXTURES_DIR / "safety-blocked-event.json"
    data = json.loads(file_path.read_text(encoding="utf-8"))

    event = EventEnvelope[SafetyDecisionPayload].model_validate(data)
    assert event.event_type == EventType.SAFETY_BLOCKED
    assert event.payload.decision == SafetyDecision.BLOCKED
    assert event.payload.risk_level == RiskLevel.WARNING
    assert event.payload.reason_code == "PROXIMITY_OBSTACLE"


def test_robot_state_event_fixture() -> None:
    """Validate robot-state-event.json fixture."""
    file_path = FIXTURES_DIR / "robot-state-event.json"
    data = json.loads(file_path.read_text(encoding="utf-8"))

    event = EventEnvelope[RobotStatePayload].model_validate(data)
    assert event.event_type == EventType.ROBOT_STATE
    assert event.payload.motion_state == "MOVING"
    assert event.payload.battery == pytest.approx(88.5)
    assert event.payload.left_motor == 140


def test_session_fixture() -> None:
    """Validate session.json fixture."""
    file_path = FIXTURES_DIR / "session.json"
    data = json.loads(file_path.read_text(encoding="utf-8"))

    session = Session.model_validate(data)
    assert session.session_id.startswith("ses_")
    assert session.user_id.startswith("usr_")
    assert session.status == SessionStatus.ACTIVE
    assert session.mode == OperatingMode.SIMULATION


def test_trial_fixture() -> None:
    """Validate trial.json fixture."""
    file_path = FIXTURES_DIR / "trial.json"
    data = json.loads(file_path.read_text(encoding="utf-8"))

    trial = Trial.model_validate(data)
    assert trial.trial_id.startswith("trl_")
    assert trial.label == Intent.RIGHT
    assert trial.trial_index == 12
    assert trial.quality_status == TrialQuality.VALID
