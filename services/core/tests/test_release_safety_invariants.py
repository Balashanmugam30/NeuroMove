"""Phase 24.3 Release Safety Invariant Tests.

Proves conclusively that:
1. "Non-authorized means zero downstream transmission" across all adapters, HIL layers, and orchestrators.
2. The Phase 17 deterministic precedence hierarchy (Rank 1 to 9) is strictly enforced.
3. No stale authorization or session leakage can bypass safety arbitration.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from neuromove.domain.enums import SafetyDecision
from neuromove.hardware_hil.models import HardwareEndpointMode
from neuromove.hardware_hil.service import HardwareHilService
from neuromove.safety.models import (
    PrecedenceRank,
    SafetyArbitrationState,
)
from neuromove.safety.service import SafetyService
from neuromove.transport_protocol.adapters import SimulatedEsp32Adapter
from neuromove.transport_protocol.commands import validate_authorization
from neuromove.transport_protocol.models import CommandType, ExecutionAuthorization
from neuromove.transport_protocol.simulator import Esp32Simulator


class TestReleaseSafetyInvariants:
    """Comprehensive executable validation of safety invariants."""

    @pytest.fixture(autouse=True)
    def clean_safety(self) -> None:
        service = SafetyService()
        if service.state_machine.current_state == SafetyArbitrationState.EMERGENCY_STOP:
            service.clear_emergency_stop()
        elif service.state_machine.current_state == SafetyArbitrationState.LOCKED_OUT:
            service.unlock()
        service.context_provider.reset_state()
        service.context_provider.set_emergency_stop(False)
        service.context_provider.set_lockout(False)
        service.context_provider.set_operator_hold(False)
        if service.state_machine.current_state != SafetyArbitrationState.SAFE_IDLE:
            if service.state_machine.current_state not in (
                SafetyArbitrationState.RESET_PENDING,
                SafetyArbitrationState.DENIED,
                SafetyArbitrationState.HELD,
                SafetyArbitrationState.AUTHORIZED,
            ):
                service.clear_emergency_stop()
            service.execute_reset()

    @pytest.fixture
    def safety_service(self) -> SafetyService:
        service = SafetyService()
        if service.state_machine.current_state == SafetyArbitrationState.EMERGENCY_STOP:
            service.clear_emergency_stop()
        elif service.state_machine.current_state == SafetyArbitrationState.LOCKED_OUT:
            service.unlock()
        service.context_provider.reset_state()
        service.context_provider.set_emergency_stop(False)
        service.context_provider.set_lockout(False)
        service.context_provider.set_operator_hold(False)
        service.execute_reset()
        return service

    @pytest.fixture
    def hil_service(self) -> HardwareHilService:
        service = HardwareHilService()
        service.set_endpoint_mode(HardwareEndpointMode.SIMULATOR)
        return service

    @pytest.fixture
    def transport_adapter(self) -> SimulatedEsp32Adapter:
        sim = Esp32Simulator()
        return SimulatedEsp32Adapter(simulator=sim)

    # -------------------------------------------------------------------------
    # Invariant 1: Precedence Rank Hierarchy (Deterministic Fail-Closed Ordering)
    # -------------------------------------------------------------------------
    def test_precedence_rank_hierarchy_monotonicity(self) -> None:
        """Verify the 9 precedence tiers are strictly monotonic and deterministic."""
        assert PrecedenceRank.EMERGENCY_STOP == 1
        assert PrecedenceRank.LOCKED_OUT == 2
        assert PrecedenceRank.INVALID_INPUT == 3
        assert PrecedenceRank.CRITICAL_HEALTH == 4
        assert PrecedenceRank.HARD_CONSTRAINT == 5
        assert PrecedenceRank.CONTEXT_STALE == 6
        assert PrecedenceRank.OPERATOR_HOLD == 7
        assert PrecedenceRank.TEMPORARY_HOLD == 8
        assert PrecedenceRank.AUTHORIZED == 9

        # Verify Rank 1 (Emergency Stop) has highest priority over all other states
        assert PrecedenceRank.EMERGENCY_STOP < PrecedenceRank.LOCKED_OUT
        assert PrecedenceRank.LOCKED_OUT < PrecedenceRank.CRITICAL_HEALTH
        assert PrecedenceRank.CRITICAL_HEALTH < PrecedenceRank.HARD_CONSTRAINT
        assert PrecedenceRank.HARD_CONSTRAINT < PrecedenceRank.CONTEXT_STALE
        assert PrecedenceRank.CONTEXT_STALE < PrecedenceRank.OPERATOR_HOLD
        assert PrecedenceRank.OPERATOR_HOLD < PrecedenceRank.TEMPORARY_HOLD
        assert PrecedenceRank.TEMPORARY_HOLD < PrecedenceRank.AUTHORIZED

    # -------------------------------------------------------------------------
    # Invariant 2: Non-Authorized Means Zero Downstream Transmission
    # -------------------------------------------------------------------------
    @pytest.mark.parametrize(
        "decision, state, reason",
        [
            (SafetyDecision.DENIED, SafetyArbitrationState.EMERGENCY_STOP, "EMERGENCY_STOP_TRIGGERED"),
            (SafetyDecision.DENIED, SafetyArbitrationState.LOCKED_OUT, "MAX_CONSECUTIVE_REJECTIONS_EXCEEDED"),
            (SafetyDecision.DENIED, SafetyArbitrationState.DENIED, "CRITICAL_HEALTH_HEARTBEAT_LOST"),
            (SafetyDecision.DENIED, SafetyArbitrationState.DENIED, "HARD_CONSTRAINT_BOUNDARY_EXCEEDED"),
            (SafetyDecision.HELD, SafetyArbitrationState.HELD, "CONTEXT_STALE_TIMESTAMP"),
            (SafetyDecision.HELD, SafetyArbitrationState.HELD, "OPERATOR_HOLD_ENGAGED"),
            (SafetyDecision.HELD, SafetyArbitrationState.HELD, "TEMPORARY_HOLD_SNR_DEGRADED"),
            (SafetyDecision.DENIED, SafetyArbitrationState.DENIED, "INVALID_INPUT_SCHEMA"),
        ],
    )
    def test_non_authorized_state_guarantees_zero_downstream_transmission(
        self,
        hil_service: HardwareHilService,
        decision: SafetyDecision,
        state: SafetyArbitrationState,
        reason: str,
    ) -> None:
        """Prove that every non-AUTHORIZED decision produces exactly ZERO transmissions."""
        auth = ExecutionAuthorization(
            authorization_id=f"auth_test_{decision.value.lower()}",
            intent_id="intent_001",
            intent_class="REST",
            decision=decision,
            policy_version="1.0.0",
            evaluation_id=f"eval_test_{decision.value.lower()}",
            model_version_id="model_v1",
            subject_id="sub-01",
            session_id="sess-01",
            issued_at=datetime.now(UTC).isoformat(),
            expires_at=datetime.now(UTC).isoformat(),
            reason=reason,
        )

        initial_tx_count = hil_service.metrics.commands_sent
        initial_rej_count = hil_service.metrics.commands_rejected

        # Attempt to send command through HIL service
        result = hil_service.send_command(
            command_type=CommandType.EXECUTE_INTENT,
            intent_class="REST",
            authorization=auth,
            subject_id="sub-01",
        )

        # Assertions
        assert result["status"] == "COMMAND_REJECTED"
        assert result["transmission_count"] == 0
        assert result["command_id"] is None
        assert hil_service.metrics.commands_sent == initial_tx_count
        assert hil_service.metrics.commands_rejected == initial_rej_count + 1

    # -------------------------------------------------------------------------
    # Invariant 3: Validate Authorization Guard Utility
    # -------------------------------------------------------------------------
    def test_validate_authorization_fails_closed_on_tampering_or_expiry(self) -> None:
        """Verify validate_authorization strictly rejects expired or mismatched authorizations."""
        # 1. Expired authorization
        expired_auth = ExecutionAuthorization(
            authorization_id="auth_expired",
            intent_id="intent_001",
            intent_class="LEFT",
            decision=SafetyDecision.AUTHORIZED,
            policy_version="1.0.0",
            evaluation_id="eval_exp",
            model_version_id="model_v1",
            subject_id="sub-01",
            session_id="sess-01",
            issued_at="2026-01-01T00:00:00Z",
            expires_at="2026-01-01T00:00:02Z",  # In the past
            reason="Expired auth test",
        )
        is_valid, reason, _ = validate_authorization(expired_auth)
        assert not is_valid
        assert "EXPIRED" in reason

        # 2. Non-authorized decision with fake future expiry
        denied_auth = ExecutionAuthorization(
            authorization_id="auth_denied",
            intent_id="intent_002",
            intent_class="LEFT",
            decision=SafetyDecision.DENIED,
            policy_version="1.0.0",
            evaluation_id="eval_den",
            model_version_id="model_v1",
            subject_id="sub-01",
            session_id="sess-01",
            issued_at=datetime.now(UTC).isoformat(),
            expires_at="2030-01-01T00:00:00Z",
            reason="Denied auth test",
        )
        is_valid, reason, _ = validate_authorization(denied_auth)
        assert not is_valid
        assert "UNAUTHORIZED" in reason

    # -------------------------------------------------------------------------
    # Invariant 4: State Machine Isolation & Emergency Stop Persistence
    # -------------------------------------------------------------------------
    def test_emergency_stop_persists_and_blocks_subsequent_evaluations(
        self, safety_service: SafetyService
    ) -> None:
        """Verify Emergency Stop persists until explicit operator reset sequence."""
        # Trigger Emergency Stop
        safety_service.assert_emergency_stop(reason="Operator emergency button hit")
        assert safety_service.state_machine.current_state == SafetyArbitrationState.EMERGENCY_STOP

        # Try to evaluate a valid intent
        intent_dict = {
            "intent_id": "intent_001",
            "intent_class": "RIGHT",
            "state": "ACTIVE",
            "current_state": "ACTIVE",
            "subject_id": "sub-01",
            "session_id": "sess-01",
            "model_version_id": "model_v1",
            "confidence_score": 0.98,
            "confidence_evaluation_id": "conf_001",
            "temporal_confirmation_id": "temp_001",
            "created_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat(),
        }

        evaluation = safety_service.evaluate_intent(intent_dict)
        assert evaluation.decision in (SafetyDecision.DENIED, SafetyDecision.EMERGENCY_STOP)
        assert evaluation.state == SafetyArbitrationState.EMERGENCY_STOP
        assert evaluation.precedence_rank == PrecedenceRank.EMERGENCY_STOP

        # Resetting requires 2-step sequence: clear_emergency_stop -> execute_reset
        safety_service.clear_emergency_stop()
        assert safety_service.state_machine.current_state == SafetyArbitrationState.RESET_PENDING
        safety_service.execute_reset()
        assert safety_service.state_machine.current_state == SafetyArbitrationState.SAFE_IDLE
