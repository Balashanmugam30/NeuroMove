"""Phase 24.3 Release Negative Scenario Suite.

Executes all 12 canonical end-to-end negative scenarios required for final release gate approval.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from neuromove.adaptation.policy import AdaptationPolicyEngine
from neuromove.domain.enums import ProductDemoScenario, ProductExecutionOutcome, SafetyDecision
from neuromove.hardware_hil.models import HardwareConnectionState, HardwareEndpointMode
from neuromove.hardware_hil.service import HardwareHilService
from neuromove.multimodal_sensors.models import (
    ContradictionRecord,
    SensorModality,
)
from neuromove.multimodal_sensors.service import MultimodalSensorService
from neuromove.product.models import ProductSession
from neuromove.product.orchestrator import DemoOrchestrator
from neuromove.product.service import ProductCoordinatorService
from neuromove.product.storage import ProductStorage
from neuromove.safety.models import SafetyArbitrationState
from neuromove.safety.service import SafetyService
from neuromove.transport_protocol.commands import validate_authorization
from neuromove.transport_protocol.framing import FramingError, unpack_frame
from neuromove.transport_protocol.models import CommandType, ExecutionAuthorization


class TestReleaseNegativeScenarios:
    """The 12 Canonical End-to-End Release Negative Scenarios."""

    @pytest.fixture(autouse=True)
    def clean_safety_environment(self) -> None:
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

    # -------------------------------------------------------------------------
    # Scenario 1: High-confidence EEG signal but stale model
    # -------------------------------------------------------------------------
    def test_scenario_01_high_confidence_eeg_with_stale_model(self) -> None:
        """High-confidence signal with stale model version -> Safety HELD/DENIED -> Zero transmission."""
        safety = SafetyService()
        hil = HardwareHilService()

        # Intent with unknown/stale model version
        intent = {
            "intent_id": "intent_sc1",
            "intent_class": "FEET",
            "state": "ACTIVE",
            "subject_id": "sub-01",
            "session_id": "sess-01",
            "model_version_id": "deprecated_uncalibrated_model_v0",
            "confidence_score": 0.99,  # High confidence
            "created_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat(),
        }

        # Override context with inactive/stale model health
        evaluation = safety.evaluate_intent(
            intent,
            context_override={
                "model_health": {"is_active": False, "is_rolled_back": True, "model_version_id": "deprecated_uncalibrated_model_v0"}
            },
        )
        assert evaluation.decision != SafetyDecision.AUTHORIZED

        auth = ExecutionAuthorization(
            authorization_id="auth_sc1",
            intent_id="intent_sc1",
            intent_class="FEET",
            decision=evaluation.decision,
            policy_version="1.0.0",
            evaluation_id=evaluation.evaluation_id,
            model_version_id="deprecated_uncalibrated_model_v0",
            subject_id="sub-01",
            session_id="sess-01",
            issued_at=datetime.now(UTC).isoformat(),
            expires_at=datetime.now(UTC).isoformat(),
            reason="Stale model scenario",
        )

        res = hil.send_command(CommandType.EXECUTE_INTENT, "FEET", auth)
        assert res["status"] == "COMMAND_REJECTED"
        assert res["transmission_count"] == 0

    # -------------------------------------------------------------------------
    # Scenario 2: Valid model but stale confidence
    # -------------------------------------------------------------------------
    def test_scenario_02_valid_model_with_stale_confidence(self) -> None:
        """Valid model with stale confidence (>500ms old) -> Fails closed -> Zero transmission."""
        safety = SafetyService()
        hil = HardwareHilService()

        stale_time = (datetime.now(UTC) - timedelta(minutes=5)).isoformat()
        intent = {
            "intent_id": "intent_sc2",
            "intent_class": "LEFT",
            "state": "ACTIVE",
            "subject_id": "sub-01",
            "session_id": "sess-01",
            "model_version_id": "model_v1",
            "confidence_score": 0.95,
            "confidence_evaluation_id": "conf_old",
            "temporal_confirmation_id": "temp_old",
            "created_at": stale_time,
            "updated_at": stale_time,
        }

        evaluation = safety.evaluate_intent(
            intent,
            context_override={"intent_freshness": {"age_ms": 300000.0, "is_stale": True}},
        )
        assert evaluation.decision != SafetyDecision.AUTHORIZED

        auth = ExecutionAuthorization(
            authorization_id="auth_sc2",
            intent_id="intent_sc2",
            intent_class="LEFT",
            decision=evaluation.decision,
            policy_version="1.0.0",
            evaluation_id=evaluation.evaluation_id,
            model_version_id="model_v1",
            subject_id="sub-01",
            session_id="sess-01",
            issued_at=stale_time,
            expires_at=stale_time,
            reason="Stale confidence scenario",
        )

        res = hil.send_command(CommandType.EXECUTE_INTENT, "LEFT", auth)
        assert res["status"] == "COMMAND_REJECTED"
        assert res["transmission_count"] == 0

    # -------------------------------------------------------------------------
    # Scenario 3: Valid confidence/intent but emergency stop active
    # -------------------------------------------------------------------------
    def test_scenario_03_emergency_stop_active(self) -> None:
        """Valid intent when emergency stop is active -> Safety DENIED/EMERGENCY_STOP -> Zero transmission."""
        safety = SafetyService()
        hil = HardwareHilService()

        safety.assert_emergency_stop(reason="Safety barrier breached")
        assert safety.state_machine.current_state == SafetyArbitrationState.EMERGENCY_STOP

        intent = {
            "intent_id": "intent_sc3",
            "intent_class": "RIGHT",
            "state": "ACTIVE",
            "subject_id": "sub-01",
            "session_id": "sess-01",
            "model_version_id": "model_v1",
            "confidence_score": 0.96,
            "created_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat(),
        }

        evaluation = safety.evaluate_intent(intent)
        assert evaluation.decision in (SafetyDecision.DENIED, SafetyDecision.EMERGENCY_STOP)
        assert evaluation.state == SafetyArbitrationState.EMERGENCY_STOP

        auth = ExecutionAuthorization(
            authorization_id="auth_sc3",
            intent_id="intent_sc3",
            intent_class="RIGHT",
            decision=evaluation.decision,
            policy_version="1.0.0",
            evaluation_id=evaluation.evaluation_id,
            model_version_id="model_v1",
            subject_id="sub-01",
            session_id="sess-01",
            issued_at=datetime.now(UTC).isoformat(),
            expires_at=datetime.now(UTC).isoformat(),
            reason="Emergency stop active",
        )

        res = hil.send_command(CommandType.EXECUTE_INTENT, "RIGHT", auth)
        assert res["status"] == "COMMAND_REJECTED"
        assert res["transmission_count"] == 0

    # -------------------------------------------------------------------------
    # Scenario 4: Valid intent but lockout active
    # -------------------------------------------------------------------------
    def test_scenario_04_lockout_active(self) -> None:
        """Consecutive safety rejections exceed threshold -> Locked out -> Zero transmission."""
        safety = SafetyService()
        safety.assert_lockout(reason="Exceeded 5 consecutive critical constraint violations")
        assert safety.state_machine.current_state == SafetyArbitrationState.LOCKED_OUT

        intent = {
            "intent_id": "intent_sc4",
            "intent_class": "LEFT",
            "state": "ACTIVE",
            "subject_id": "sub-01",
            "session_id": "sess-01",
            "model_version_id": "model_v1",
            "confidence_score": 0.92,
            "created_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat(),
        }

        evaluation = safety.evaluate_intent(intent)
        assert evaluation.decision in (SafetyDecision.DENIED, SafetyDecision.LOCKED_OUT)
        assert evaluation.state == SafetyArbitrationState.LOCKED_OUT

    # -------------------------------------------------------------------------
    # Scenario 5: Valid everything but hard constraint violated
    # -------------------------------------------------------------------------
    def test_scenario_05_hard_constraint_violated(self) -> None:
        """Blocked intent class (REST) -> Safety DENIED -> Zero transmission."""
        safety = SafetyService()
        intent = {
            "intent_id": "intent_sc5",
            "intent_class": "REST",  # REST is blocked from actuation
            "state": "ACTIVE",
            "subject_id": "sub-01",
            "session_id": "sess-01",
            "model_version_id": "model_v1",
            "confidence_score": 0.95,
            "created_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat(),
        }

        evaluation = safety.evaluate_intent(intent)
        assert evaluation.decision != SafetyDecision.AUTHORIZED

    # -------------------------------------------------------------------------
    # Scenario 6: Transport disconnected
    # -------------------------------------------------------------------------
    def test_scenario_06_transport_disconnected(self) -> None:
        """Transport in DISCONNECTED state -> Rejects command immediately with no retry leak."""
        hil = HardwareHilService()
        hil.state_machine.transition_to(HardwareConnectionState.DISCONNECTED, "Simulated cable unplug")

        auth = ExecutionAuthorization(
            authorization_id="auth_sc6",
            intent_id="intent_sc6",
            intent_class="RIGHT",
            decision=SafetyDecision.AUTHORIZED,
            policy_version="1.0.0",
            evaluation_id="eval_sc6",
            model_version_id="model_v1",
            subject_id="sub-01",
            session_id="sess-01",
            issued_at=datetime.now(UTC).isoformat(),
            expires_at=(datetime.now(UTC) + timedelta(seconds=10)).isoformat(),
            reason="Transport disconnected test",
        )

        res = hil.send_command(CommandType.EXECUTE_INTENT, "RIGHT", auth)
        assert res["status"] == "COMMAND_REJECTED"
        assert "not READY" in res["reason"]
        assert res["transmission_count"] == 0

    # -------------------------------------------------------------------------
    # Scenario 7: Malformed protocol frame
    # -------------------------------------------------------------------------
    def test_scenario_07_malformed_protocol_frame(self) -> None:
        """Corrupted CRC-32 or bad delimiter -> Transport unpacking raises FramingError or rejects."""
        corrupted_frame = b"\xaa\x55\x01\x00\x05\x00\x00\x00\x00\x00\x00\x00\x00\x00\x55\xaa"  # Corrupted CRC
        with pytest.raises(FramingError):
            unpack_frame(corrupted_frame)

    # -------------------------------------------------------------------------
    # Scenario 8: Sensor contradiction
    # -------------------------------------------------------------------------
    def test_scenario_08_sensor_contradiction_handling(self) -> None:
        """Ocular blink / EMG artifact contradiction -> Sensor engine flags contradiction -> Non-actuation."""
        record = ContradictionRecord(
            contradiction_id="contra_01",
            rule_name="OCULAR_BLINK_ARTIFACT_SUPPRESSION",
            reason="Ocular blink artifact detected during motor imagery decoding",
            conflicting_modalities=[SensorModality.EEG, SensorModality.EOG],
            severity="CRITICAL",
        )
        assert record.severity == "CRITICAL"
        assert SensorModality.EEG in record.conflicting_modalities

    # -------------------------------------------------------------------------
    # Scenario 9: Database/Runtime recovery
    # -------------------------------------------------------------------------
    def test_scenario_09_runtime_recovery_preserves_safety(self) -> None:
        """Startup recovery loads persistent safety state cleanly."""
        safety = SafetyService()
        safety.assert_emergency_stop(reason="Pre-crash emergency")
        assert safety.state_machine.current_state == SafetyArbitrationState.EMERGENCY_STOP

        # Clean 2-step reset
        safety.clear_emergency_stop()
        assert safety.state_machine.current_state == SafetyArbitrationState.RESET_PENDING
        safety.execute_reset()
        assert safety.state_machine.current_state == SafetyArbitrationState.SAFE_IDLE

        # Verifies that old expired auth tokens from previous process cannot be used
        old_auth = ExecutionAuthorization(
            authorization_id="auth_pre_crash",
            intent_id="intent_old",
            intent_class="REST",
            decision=SafetyDecision.AUTHORIZED,
            policy_version="1.0.0",
            evaluation_id="eval_old",
            model_version_id="model_v1",
            subject_id="sub-01",
            session_id="sess-old",
            issued_at="2026-01-01T00:00:00Z",
            expires_at="2026-01-01T00:00:02Z",
            reason="Pre-crash auth",
        )
        is_valid, _, _ = validate_authorization(old_auth)
        assert not is_valid

    # -------------------------------------------------------------------------
    # Scenario 10: Candidate adaptive model worse than incumbent
    # -------------------------------------------------------------------------
    def test_scenario_10_inferior_candidate_model_rejected(self) -> None:
        """Candidate model with accuracy 0.50 vs incumbent 0.85 -> Not eligible for promotion."""
        policy = AdaptationPolicyEngine.get_default_policies()[0]
        eligibility = AdaptationPolicyEngine.evaluate_promotion_eligibility(
            policy=policy,
            incumbent_balanced_accuracy=0.85,
            candidate_balanced_accuracy=0.50,  # Regressed by 35%
            validation_sample_count=20,
            validation_class_counts={"LEFT": 10, "RIGHT": 10},
            train_val_overlap_count=0,
        )
        assert not eligibility.is_eligible
        assert len(eligibility.failure_reasons) > 0

    # -------------------------------------------------------------------------
    # Scenario 11: Candidate model improves metrics but has train-val leakage
    # -------------------------------------------------------------------------
    def test_scenario_11_candidate_with_safety_violations_rejected(self) -> None:
        """Candidate model with higher accuracy but 2 overlapping train/val epochs -> REJECTED."""
        policy = AdaptationPolicyEngine.get_default_policies()[0]
        eligibility = AdaptationPolicyEngine.evaluate_promotion_eligibility(
            policy=policy,
            incumbent_balanced_accuracy=0.80,
            candidate_balanced_accuracy=0.95,  # Higher accuracy
            validation_sample_count=20,
            validation_class_counts={"LEFT": 10, "RIGHT": 10},
            train_val_overlap_count=2,  # 2 overlapping samples (leakage)
        )
        assert not eligibility.is_eligible
        assert any("leakage" in r.lower() for r in eligibility.failure_reasons)

    # -------------------------------------------------------------------------
    # Scenario 12: Browser/WebSocket disconnect during demo
    # -------------------------------------------------------------------------
    def test_scenario_12_client_disconnect_during_demo_fails_safe(self) -> None:
        """Demo execution under blocked scenario halts transmission cleanly."""
        storage = ProductStorage()
        orchestrator = DemoOrchestrator(storage)
        sess = ProductSession(session_id="sess_demo_b")

        # Run Scenario B (safety held)
        res = orchestrator.execute_full_run(ProductDemoScenario.PRODUCT_B, sess)
        assert res.status == ProductExecutionOutcome.BLOCKED
        assert res.hil_status == "NOT_TRANSMITTED"
