"""Tests for Canonical Domain Enums and Models."""

import pytest
from pydantic import ValidationError

from neuromove.domain.enums import (
    ComponentStatus,
    Intent,
    OperatingMode,
    RuntimeState,
    SafetyDecision,
)
from neuromove.domain.models import (
    CommandPayload,
    SignalQuality,
    SystemStatus,
)


def test_domain_enums_contain_required_values() -> None:
    assert OperatingMode.LIVE == "LIVE"
    assert OperatingMode.REPLAY == "REPLAY"
    assert OperatingMode.SIMULATION == "SIMULATION"

    assert Intent.LEFT == "LEFT"
    assert Intent.RIGHT == "RIGHT"
    assert Intent.FORWARD == "FORWARD"
    assert Intent.BACKWARD == "BACKWARD"
    assert Intent.STOP == "STOP"
    assert Intent.NONE == "NONE"
    assert Intent.UNCERTAIN == "UNCERTAIN"

    assert RuntimeState.IDLE == "IDLE"
    assert RuntimeState.CANDIDATE == "CANDIDATE"
    assert RuntimeState.CONFIRMED == "CONFIRMED"
    assert RuntimeState.EXECUTING == "EXECUTING"
    assert RuntimeState.BLOCKED == "BLOCKED"
    assert RuntimeState.EMERGENCY == "EMERGENCY"
    assert RuntimeState.FAULT == "FAULT"

    assert SafetyDecision.APPROVED == "APPROVED"
    assert SafetyDecision.BLOCKED == "BLOCKED"
    assert SafetyDecision.STOP == "STOP"


def test_system_status_instantiation_defaults() -> None:
    status = SystemStatus()
    assert status.service == "neuromove-core"
    assert status.status == "ok"
    assert status.mode == OperatingMode.SIMULATION
    assert status.components.api == ComponentStatus.HEALTHY
    assert status.components.eeg == ComponentStatus.NOT_CONNECTED
    assert status.components.robot == ComponentStatus.NOT_CONNECTED


def test_signal_quality_validation() -> None:
    sq = SignalQuality(overall_score=0.85, c3_impedance_kohm=4.2, is_acceptable=True)
    assert sq.overall_score == 0.85
    assert sq.is_acceptable is True

    # Test out of bounds constraint
    with pytest.raises(ValidationError):
        SignalQuality(overall_score=1.5)


def test_command_payload_bounds() -> None:
    cmd = CommandPayload(intent=Intent.FORWARD, linear_velocity_mps=0.2)
    assert cmd.intent == Intent.FORWARD
    assert cmd.linear_velocity_mps == 0.2

    # Out of safety speed limit
    with pytest.raises(ValidationError):
        CommandPayload(intent=Intent.FORWARD, linear_velocity_mps=2.0)
