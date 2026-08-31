"""Test canonical domain invariants and error validation in Python."""

import pytest

from neuromove.domain.enums import (
    CommandStatus,
    Intent,
    RuntimeState,
    SafetyDecision,
)
from neuromove.domain.models import (
    ErrorResponse,
    RobotCommand,
    SafetyState,
    User,
    generate_user_id,
)


def test_pseudonymous_user_id() -> None:
    """Verify user ID generator produces pseudonymous ids without PII."""
    uid = generate_user_id()
    assert uid.startswith("usr_")
    user = User(user_id=uid, display_label="Subject_007")
    assert user.user_id.startswith("usr_")


def test_safety_state_emergency_approved_conflict() -> None:
    """Invariant: Emergency stop active cannot coexist with APPROVED safety decision."""
    with pytest.raises(ValueError, match="Emergency stop active cannot coexist with APPROVED"):
        SafetyState(
            runtime_state=RuntimeState.EMERGENCY,
            emergency_active=True,
            last_decision=SafetyDecision.APPROVED,
        )


def test_robot_command_uncertain_intent_not_approvable() -> None:
    """Invariant: UNCERTAIN intent cannot be approved for movement."""
    with pytest.raises(ValueError, match="cannot be approved for robot movement"):
        RobotCommand(
            intent=Intent.UNCERTAIN,
            status=CommandStatus.APPROVED,
            safety_decision=SafetyDecision.APPROVED,
        )


def test_robot_command_none_intent_not_approvable() -> None:
    """Invariant: NONE intent cannot be approved for movement."""
    with pytest.raises(ValueError, match="cannot be approved for robot movement"):
        RobotCommand(
            intent=Intent.NONE,
            status=CommandStatus.APPROVED,
            safety_decision=SafetyDecision.APPROVED,
        )


def test_error_response_serialization() -> None:
    """Test standard ErrorResponse serialization."""
    err = ErrorResponse(
        code="VALIDATION_ERROR",
        message="Invalid event payload",
        request_id="cor_123456",
        details=[],
    )
    assert err.code == "VALIDATION_ERROR"
    assert err.request_id == "cor_123456"
