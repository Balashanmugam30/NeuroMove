"""Safety arbitration service coordinator, event dispatcher, and scenario runner."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from ..domain.enums import EventType, OperatingMode, SafetyDecision
from ..events.dispatcher import default_event_dispatcher
from ..events.envelope import EventEnvelope
from .context import SafetyContextProvider
from .evaluator import SafetyRuleEngine
from .models import (
    PrecedenceRank,
    SafetyArbitrationState,
    SafetyDiagnostics,
    SafetyEvaluation,
    SafetyScenarioResult,
    SafetyStateSnapshot,
    SafetyStateTransition,
)
from .policies import SafetyPolicy, create_default_safety_policy
from .state_machine import SafetyArbitrationStateMachine
from .storage import SafetyStorage

logger = logging.getLogger("neuromove.safety.service")


class SafetyService:
    """Authoritative singleton coordinator for Phase 17 software safety arbitration."""

    def __init__(
        self,
        storage: SafetyStorage | None = None,
        context_provider: SafetyContextProvider | None = None,
        rule_engine: SafetyRuleEngine | None = None,
        mode: OperatingMode = OperatingMode.SIMULATION,
    ) -> None:
        self.mode = mode
        self.storage = storage or SafetyStorage()
        self.context_provider = context_provider or SafetyContextProvider()
        self.rule_engine = rule_engine or SafetyRuleEngine()

        # Load or initialize policy
        self._active_policy: SafetyPolicy = (
            self.storage.get_active_policy() or create_default_safety_policy()
        )
        self.storage.save_policy(self._active_policy)

        # Recover machine state fail-closed from database
        recovered_state, seq, is_e_stop, e_reason, is_lockout, l_reason = (
            self.storage.recover_state_on_startup()
        )
        self.state_machine = SafetyArbitrationStateMachine(initial_state=recovered_state)
        self.state_machine._sequence_number = seq

        if is_e_stop:
            self.context_provider.set_emergency_stop(True, reason=e_reason)
        if is_lockout:
            self.context_provider.set_lockout(True, reason=l_reason)

        self._time_override: float | None = None
        self._consecutive_failures: int = 0
        self._active_authorized_since: float | None = None

        # Ensure initial snapshot exists
        if not self.storage.get_current_snapshot():
            init_snapshot = SafetyStateSnapshot(
                snapshot_id=f"snap_{uuid.uuid4().hex[:12]}",
                current_state=self.state_machine.current_state,
                last_decision=SafetyDecision.DENIED
                if is_lockout or is_e_stop
                else SafetyDecision.AUTHORIZED
                if self.state_machine.current_state == SafetyArbitrationState.AUTHORIZED
                else SafetyDecision.DENIED,
                primary_reason="Initial startup safety state initialized.",
                active_policy_version=self._active_policy.version,
                emergency_stop=is_e_stop,
                emergency_stop_reason=e_reason,
                lockout=is_lockout,
                lockout_reason=l_reason,
                system_healthy=True,
                stream_healthy=True,
                created_at=datetime.now(UTC).isoformat(),
                updated_at=datetime.now(UTC).isoformat(),
            )
            self.storage.save_snapshot(init_snapshot)

    def set_time_override(self, timestamp: float | None) -> None:
        """Inject artificial clock time for deterministic testing."""
        self._time_override = timestamp

    def clear_time_override(self) -> None:
        """Clear artificial clock time."""
        self._time_override = None

    def get_current_time(self) -> float:
        """Return current real or injected clock time."""
        return (
            self._time_override
            if self._time_override is not None
            else datetime.now(UTC).timestamp()
        )

    def get_active_policy(self) -> SafetyPolicy:
        return self._active_policy

    def update_policy(self, new_policy: SafetyPolicy) -> SafetyPolicy:
        """Update active safety policy with recalculated checksum."""
        new_policy.checksum = new_policy.calculate_checksum()
        self._active_policy = new_policy
        self.storage.save_policy(new_policy)
        logger.info(
            "Updated safety policy to version %s (%s)", new_policy.version, new_policy.checksum
        )
        return self._active_policy

    def evaluate_intent(
        self,
        intent_snapshot: dict[str, Any] | None,
        context_override: dict[str, Any] | None = None,
        policy_id: str | None = None,
    ) -> SafetyEvaluation:
        """Execute full arbitration lifecycle against intent snapshot and safety rules."""
        now_ts = self.get_current_time()
        now_iso = datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
        policy = self.storage.get_policy(policy_id) if policy_id else self._active_policy
        if not policy:
            policy = self._active_policy

        curr = self.state_machine.current_state

        # Fail-closed check if reset is pending
        if curr == SafetyArbitrationState.RESET_PENDING:
            evaluation = SafetyEvaluation(
                evaluation_id=f"eval_{uuid.uuid4().hex[:12]}",
                decision=SafetyDecision.DENIED,
                state=SafetyArbitrationState.RESET_PENDING,
                primary_reason="Reset procedure pending; execute reset before authorization.",
                precedence_rank=int(PrecedenceRank.HARD_CONSTRAINT),
                all_reasons=["Reset procedure pending; execute reset before authorization."],
                violated_rules=[],
                passed_rules=[],
                policy_version=policy.version,
                intent_id=(intent_snapshot or {}).get("intent_id"),
                intent_class=(intent_snapshot or {}).get("intent_class"),
                evaluated_at=now_iso,
                duration_ms=0.0,
            )
            self.storage.save_evaluation(evaluation)
            return evaluation

        # Step 1: Transition machine to EVALUATING if in safe non-terminal state
        if curr not in (
            SafetyArbitrationState.EMERGENCY_STOP,
            SafetyArbitrationState.LOCKED_OUT,
            SafetyArbitrationState.RESET_PENDING,
        ):
            trans = self.state_machine.transition_to(
                target_state=SafetyArbitrationState.EVALUATING,
                trigger_name="EVALUATION_START",
                reason="Beginning rule evaluation for intent candidate.",
                intent_id=(intent_snapshot or {}).get("intent_id"),
                policy_version=policy.version,
                timestamp=now_iso,
            )
            self.storage.save_transition(trans)

        # Step 2: Build context & execute rules
        context = self.context_provider.get_context(
            intent_snapshot=intent_snapshot, overrides=context_override
        )
        evaluation = self.rule_engine.evaluate(
            intent_snapshot=intent_snapshot,
            context=context,
            policy=policy,
            now_ts=now_ts,
        )

        # Step 3: Transition state machine to target state
        target_state = evaluation.state
        if self.state_machine.current_state != target_state:
            # Validate if allowed
            if self.state_machine.can_transition_to(target_state):
                trans = self.state_machine.transition_to(
                    target_state=target_state,
                    trigger_name=f"DECISION_{evaluation.decision.value}",
                    reason=evaluation.primary_reason,
                    evaluation_id=evaluation.evaluation_id,
                    intent_id=evaluation.intent_id,
                    policy_version=policy.version,
                    timestamp=now_iso,
                )
                self.storage.save_transition(trans)
            else:
                logger.warning(
                    "State transition %s -> %s prohibited; remaining in %s",
                    self.state_machine.current_state.value,
                    target_state.value,
                    self.state_machine.current_state.value,
                )

        # Step 4: Handle outcomes & metrics
        if evaluation.decision == SafetyDecision.AUTHORIZED:
            self._consecutive_failures = 0
            self.context_provider.record_authorization(now_ts)
            if self._active_authorized_since is None:
                self._active_authorized_since = now_ts
        else:
            self._active_authorized_since = None
            if evaluation.decision in (SafetyDecision.DENIED, SafetyDecision.INVALID):
                self._consecutive_failures += 1
                if self._consecutive_failures >= policy.lockout_threshold:
                    logger.warning(
                        "Consecutive safety denials (%d) exceeded threshold (%d). Engaging LOCKOUT.",
                        self._consecutive_failures,
                        policy.lockout_threshold,
                    )
                    self.assert_lockout(
                        reason=f"Exceeded failure threshold ({self._consecutive_failures} denials).",
                        operator_id="SYSTEM_AUTO_LOCKOUT",
                    )
                    evaluation.decision = SafetyDecision.LOCKED_OUT
                    evaluation.state = SafetyArbitrationState.LOCKED_OUT

        # Step 5: Save evaluation record
        self.storage.save_evaluation(evaluation)

        # Step 6: Update authoritative snapshot
        e_stop_active = context.emergency_stop_state.get("is_active", False)
        lockout_active = context.lockout_state.get("is_locked_out", False)
        op_hold_active = context.operator_state.get("operator_hold", False)

        snapshot = SafetyStateSnapshot(
            snapshot_id=f"snap_{uuid.uuid4().hex[:12]}",
            current_state=self.state_machine.current_state,
            last_decision=evaluation.decision,
            active_intent_id=evaluation.intent_id,
            intent_class=evaluation.intent_class,
            primary_reason=evaluation.primary_reason,
            active_policy_version=policy.version,
            emergency_stop=e_stop_active,
            emergency_stop_reason=context.emergency_stop_state.get("reason"),
            operator_hold=op_hold_active,
            operator_id=context.operator_state.get("operator_id"),
            lockout=lockout_active,
            lockout_reason=context.lockout_state.get("reason"),
            system_healthy=all(s.lower() == "healthy" for s in context.system_health.values()),
            stream_healthy=context.stream_health.get("stream_connected", False),
            last_evaluation_id=evaluation.evaluation_id,
            state_deadline=now_ts + (policy.max_authorized_duration_ms / 1000.0)
            if evaluation.decision == SafetyDecision.AUTHORIZED
            else None,
            transition_count=self.state_machine.sequence_number,
            created_at=now_iso,
            updated_at=now_iso,
        )
        self.storage.save_snapshot(snapshot)

        # Step 7: Broadcast canonical event on TransportStream.SAFETY
        event_type_map = {
            SafetyDecision.AUTHORIZED: EventType.SAFETY_AUTHORIZED,
            SafetyDecision.HELD: EventType.SAFETY_HELD,
            SafetyDecision.DENIED: EventType.SAFETY_DENIED,
            SafetyDecision.EMERGENCY_STOP: EventType.SAFETY_EMERGENCY_STOP,
            SafetyDecision.LOCKED_OUT: EventType.SAFETY_LOCKED_OUT,
        }
        evt_type = event_type_map.get(evaluation.decision, EventType.SAFETY_EVALUATED)

        event = EventEnvelope[dict[str, Any]](
            event_type=evt_type,
            mode=self.mode,
            payload={
                "evaluation_id": evaluation.evaluation_id,
                "decision": evaluation.decision.value,
                "state": self.state_machine.current_state.value,
                "primary_reason": evaluation.primary_reason,
                "intent_id": evaluation.intent_id,
                "subject_id": evaluation.subject_id,
                "session_id": evaluation.session_id,
                "policy_version": evaluation.policy_version,
                "timestamp": now_iso,
            },
        )
        default_event_dispatcher.publish(event)

        return evaluation

    def assert_operator_hold(
        self, operator_id: str | None = None, reason: str | None = None
    ) -> SafetyStateSnapshot:
        """Engage manual operator hold."""
        now_iso = datetime.fromtimestamp(self.get_current_time(), tz=UTC).isoformat()
        self.context_provider.set_operator_hold(
            True,
            operator_id=operator_id or "OPERATOR",
            reason=reason or "Manual hold asserted.",
        )

        curr = self.state_machine.current_state
        if curr not in (
            SafetyArbitrationState.EMERGENCY_STOP,
            SafetyArbitrationState.LOCKED_OUT,
        ):
            if self.state_machine.can_transition_to(SafetyArbitrationState.HELD):
                trans = self.state_machine.transition_to(
                    target_state=SafetyArbitrationState.HELD,
                    trigger_name="OPERATOR_HOLD_ENGAGED",
                    reason=reason or "Manual operator hold engaged.",
                    policy_version=self._active_policy.version,
                    timestamp=now_iso,
                )
                self.storage.save_transition(trans)

        event = EventEnvelope[dict[str, Any]](
            event_type=EventType.SAFETY_HOLD_CHANGED,
            mode=self.mode,
            payload={"operator_hold": True, "operator_id": operator_id, "reason": reason},
        )
        default_event_dispatcher.publish(event)
        return self._sync_and_get_snapshot(
            decision=SafetyDecision.HELD,
            reason=reason or "Operator hold engaged.",
        )

    def release_operator_hold(self, operator_id: str | None = None) -> SafetyStateSnapshot:
        """Release manual operator hold."""
        now_iso = datetime.fromtimestamp(self.get_current_time(), tz=UTC).isoformat()
        self.context_provider.set_operator_hold(False)

        curr = self.state_machine.current_state
        if curr == SafetyArbitrationState.HELD:
            if self.state_machine.can_transition_to(SafetyArbitrationState.SAFE_IDLE):
                trans = self.state_machine.transition_to(
                    target_state=SafetyArbitrationState.SAFE_IDLE,
                    trigger_name="OPERATOR_HOLD_RELEASED",
                    reason="Operator hold released. Awaiting evaluation.",
                    policy_version=self._active_policy.version,
                    timestamp=now_iso,
                )
                self.storage.save_transition(trans)

        event = EventEnvelope[dict[str, Any]](
            event_type=EventType.SAFETY_HOLD_CHANGED,
            mode=self.mode,
            payload={"operator_hold": False, "operator_id": operator_id},
        )
        default_event_dispatcher.publish(event)
        return self._sync_and_get_snapshot(
            decision=SafetyDecision.DENIED,
            reason="Operator hold released. Fresh evaluation required.",
        )

    def assert_emergency_stop(
        self, reason: str | None = None, asserted_by: str | None = None
    ) -> SafetyStateSnapshot:
        """Assert software emergency stop (dominates all authorization)."""
        now_iso = datetime.fromtimestamp(self.get_current_time(), tz=UTC).isoformat()
        r = reason or "Software Emergency Stop triggered."
        self.context_provider.set_emergency_stop(True, asserted_by=asserted_by, reason=r)

        if self.state_machine.can_transition_to(SafetyArbitrationState.EMERGENCY_STOP):
            trans = self.state_machine.transition_to(
                target_state=SafetyArbitrationState.EMERGENCY_STOP,
                trigger_name="ASSERT_EMERGENCY_STOP",
                reason=r,
                policy_version=self._active_policy.version,
                timestamp=now_iso,
            )
            self.storage.save_transition(trans)

        event = EventEnvelope[dict[str, Any]](
            event_type=EventType.EMERGENCY_STOP,
            mode=self.mode,
            payload={"emergency_stop": True, "reason": r, "asserted_by": asserted_by},
        )
        default_event_dispatcher.publish(event)
        return self._sync_and_get_snapshot(
            decision=SafetyDecision.EMERGENCY_STOP,
            reason=r,
        )

    def clear_emergency_stop(self, operator_id: str | None = None) -> SafetyStateSnapshot:
        """Clear emergency stop flag and move to RESET_PENDING (never directly to AUTHORIZED)."""
        now_iso = datetime.fromtimestamp(self.get_current_time(), tz=UTC).isoformat()
        self.context_provider.set_emergency_stop(False)

        curr = self.state_machine.current_state
        if curr == SafetyArbitrationState.EMERGENCY_STOP:
            trans = self.state_machine.transition_to(
                target_state=SafetyArbitrationState.RESET_PENDING,
                trigger_name="CLEAR_EMERGENCY_STOP",
                reason="Emergency stop cleared by operator. Reset procedure required.",
                policy_version=self._active_policy.version,
                timestamp=now_iso,
            )
            self.storage.save_transition(trans)

        event = EventEnvelope[dict[str, Any]](
            event_type=EventType.SAFETY_RESET,
            mode=self.mode,
            payload={"status": "RESET_PENDING", "cleared_by": operator_id},
        )
        default_event_dispatcher.publish(event)
        return self._sync_and_get_snapshot(
            decision=SafetyDecision.DENIED,
            reason="Emergency stop cleared. Reset procedure pending verification.",
        )

    def assert_lockout(
        self, reason: str | None = None, operator_id: str | None = None
    ) -> SafetyStateSnapshot:
        """Enter lockout state."""
        now_iso = datetime.fromtimestamp(self.get_current_time(), tz=UTC).isoformat()
        r = reason or "System locked out due to critical safety condition."
        self.context_provider.set_lockout(True, reason=r)

        if self.state_machine.can_transition_to(SafetyArbitrationState.LOCKED_OUT):
            trans = self.state_machine.transition_to(
                target_state=SafetyArbitrationState.LOCKED_OUT,
                trigger_name="ASSERT_LOCKOUT",
                reason=r,
                policy_version=self._active_policy.version,
                timestamp=now_iso,
            )
            self.storage.save_transition(trans)

        event = EventEnvelope[dict[str, Any]](
            event_type=EventType.SAFETY_LOCKED_OUT,
            mode=self.mode,
            payload={"lockout": True, "reason": r, "operator_id": operator_id},
        )
        default_event_dispatcher.publish(event)
        return self._sync_and_get_snapshot(
            decision=SafetyDecision.LOCKED_OUT,
            reason=r,
        )

    def unlock(self, operator_id: str | None = None) -> SafetyStateSnapshot:
        """Unlock locked out state and transition to RESET_PENDING."""
        now_iso = datetime.fromtimestamp(self.get_current_time(), tz=UTC).isoformat()
        self.context_provider.set_lockout(False)
        self._consecutive_failures = 0

        curr = self.state_machine.current_state
        if curr == SafetyArbitrationState.LOCKED_OUT:
            trans = self.state_machine.transition_to(
                target_state=SafetyArbitrationState.RESET_PENDING,
                trigger_name="UNLOCK_PROCEDURE",
                reason="Lockout cleared by operator. Reset verification pending.",
                policy_version=self._active_policy.version,
                timestamp=now_iso,
            )
            self.storage.save_transition(trans)

        event = EventEnvelope[dict[str, Any]](
            event_type=EventType.SAFETY_RESET,
            mode=self.mode,
            payload={"status": "UNLOCK_SUCCESS", "operator_id": operator_id},
        )
        default_event_dispatcher.publish(event)
        return self._sync_and_get_snapshot(
            decision=SafetyDecision.DENIED,
            reason="Lockout unlocked. Reset pending verification.",
        )

    def unlock_lockout(self, operator_id: str | None = None) -> SafetyStateSnapshot:
        """Convenience alias for unlock."""
        return self.unlock(operator_id=operator_id)

    def execute_reset(
        self, operator_id: str | None = None, clear_lockout: bool = False
    ) -> SafetyStateSnapshot:
        """Execute complete safety reset sequence.

        Verifies preconditions: no active E-stop, healthy critical services, no lockout.
        Transitions to SAFE_IDLE on success, or remains in LOCKED_OUT if verification fails.
        """
        now_iso = datetime.fromtimestamp(self.get_current_time(), tz=UTC).isoformat()
        context = self.context_provider.get_context()

        # If clear_lockout is requested
        if clear_lockout:
            self.context_provider.set_lockout(False)
            self._consecutive_failures = 0

        # Check preconditions
        if context.emergency_stop_state.get("is_active"):
            logger.error("Reset failed: Emergency stop is actively asserted.")
            return self.get_current_snapshot()

        if context.lockout_state.get("is_locked_out"):
            logger.error("Reset failed: System remains in lockout.")
            return self.get_current_snapshot()

        # Verify critical health
        policy = self._active_policy
        unhealthy = [
            req
            for req in policy.critical_health_requirements
            if context.system_health.get(req, "").lower() not in ("healthy", "ready")
        ]
        if unhealthy:
            logger.error("Reset failed: Unhealthy critical services (%s).", unhealthy)
            self.assert_lockout(
                reason=f"Reset aborted: critical services unhealthy ({unhealthy})",
                operator_id=operator_id,
            )
            return self.get_current_snapshot()

        # Preconditions passed -> SAFE_IDLE
        curr = self.state_machine.current_state
        if curr in (
            SafetyArbitrationState.RESET_PENDING,
            SafetyArbitrationState.DENIED,
            SafetyArbitrationState.HELD,
            SafetyArbitrationState.AUTHORIZED,
        ):
            if self.state_machine.can_transition_to(SafetyArbitrationState.SAFE_IDLE):
                trans = self.state_machine.transition_to(
                    target_state=SafetyArbitrationState.SAFE_IDLE,
                    trigger_name="RESET_SUCCESS",
                    reason="Reset sequence verified all preconditions. Returned to SAFE_IDLE.",
                    policy_version=policy.version,
                    timestamp=now_iso,
                )
                self.storage.save_transition(trans)

        self._consecutive_failures = 0
        self._active_authorized_since = None

        event = EventEnvelope[dict[str, Any]](
            event_type=EventType.SAFETY_RESET,
            mode=self.mode,
            payload={"status": "SAFE_IDLE", "operator_id": operator_id},
        )
        default_event_dispatcher.publish(event)
        return self._sync_and_get_snapshot(
            decision=SafetyDecision.DENIED,
            reason="System reset to SAFE_IDLE. Fresh intent evaluation required.",
        )

    def _sync_and_get_snapshot(self, decision: SafetyDecision, reason: str) -> SafetyStateSnapshot:
        now_ts = self.get_current_time()
        now_iso = datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
        ctx = self.context_provider.get_context()

        snapshot = SafetyStateSnapshot(
            snapshot_id=f"snap_{uuid.uuid4().hex[:12]}",
            current_state=self.state_machine.current_state,
            last_decision=decision,
            primary_reason=reason,
            active_policy_version=self._active_policy.version,
            emergency_stop=ctx.emergency_stop_state.get("is_active", False),
            emergency_stop_reason=ctx.emergency_stop_state.get("reason"),
            operator_hold=ctx.operator_state.get("operator_hold", False),
            operator_id=ctx.operator_state.get("operator_id"),
            lockout=ctx.lockout_state.get("is_locked_out", False),
            lockout_reason=ctx.lockout_state.get("reason"),
            system_healthy=all(s.lower() == "healthy" for s in ctx.system_health.values()),
            stream_healthy=ctx.stream_health.get("stream_connected", False),
            transition_count=self.state_machine.sequence_number,
            created_at=now_iso,
            updated_at=now_iso,
        )
        self.storage.save_snapshot(snapshot)
        return snapshot

    def get_current_snapshot(self) -> SafetyStateSnapshot:
        snap = self.storage.get_current_snapshot()
        if snap:
            return snap
        return self._sync_and_get_snapshot(
            decision=SafetyDecision.DENIED,
            reason="Default idle snapshot.",
        )

    def get_evaluation_history(
        self, limit: int = 100, decision: str | None = None
    ) -> list[SafetyEvaluation]:
        return self.storage.get_evaluations(limit=limit, decision=decision)

    def get_transition_history(self, limit: int = 100) -> list[SafetyStateTransition]:
        return self.storage.get_transitions(limit=limit)

    def get_diagnostics(self) -> SafetyDiagnostics:
        return self.storage.get_diagnostics()

    # --- Deterministic Simulation Scenarios (Scenarios A through O) ---

    def run_scenario(self, scenario_id: str) -> SafetyScenarioResult:
        """Run standard deterministic safety scenario and return complete step audit."""
        scenario_key = scenario_id.upper().strip()
        curr_ts = self.get_current_time()

        # Baseline valid intent snapshot
        valid_intent = {
            "intent_id": "int_scen_valid",
            "intent_class": "LEFT",
            "state": "ACTIVE",
            "current_state": "ACTIVE",
            "subject_id": "sub_scen_01",
            "session_id": "sess_scen_01",
            "model_version_id": "model_v1",
            "confidence_score": 0.88,
            "confidence_evaluation_id": "conf_scen_01",
            "temporal_confirmation_id": "tc_scen_01",
            "created_at": datetime.fromtimestamp(curr_ts - 0.05, tz=UTC).isoformat(),
            "updated_at": datetime.fromtimestamp(curr_ts - 0.05, tz=UTC).isoformat(),
        }

        # Reset state provider to clean baseline
        self.context_provider.reset_state()
        self.context_provider.set_emergency_stop(False)
        self.context_provider.set_lockout(False)
        self.context_provider.set_operator_hold(False)
        self._consecutive_failures = 0
        self._active_authorized_since = None

        # Ensure state machine returns to SAFE_IDLE
        if self.state_machine.current_state in (
            SafetyArbitrationState.EMERGENCY_STOP,
            SafetyArbitrationState.LOCKED_OUT,
        ):
            self.state_machine._current_state = SafetyArbitrationState.RESET_PENDING
        if self.state_machine.current_state != SafetyArbitrationState.SAFE_IDLE:
            self.execute_reset()

        if scenario_key == "SCENARIO_A":
            # Scenario A — Fully valid intent
            # Expected: AUTHORIZED
            evaluation = self.evaluate_intent(valid_intent)
            return SafetyScenarioResult(
                scenario_id="SCENARIO_A",
                name="Fully Valid Active Intent",
                description="Active intent with healthy system, fresh timestamps, allowlisted class, no hold, no E-stop.",
                expected_decision=SafetyDecision.AUTHORIZED,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.AUTHORIZED,
                actual_state=evaluation.state,
                passed=(evaluation.decision == SafetyDecision.AUTHORIZED),
                steps_audit=[
                    {
                        "step": 1,
                        "action": "Ingest valid ACTIVE intent",
                        "result": evaluation.decision.value,
                    },
                    {"step": 2, "verified_rules": len(evaluation.passed_rules)},
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_B":
            # Scenario B — Unknown health
            # Expected: DENIED (fail closed)
            ctx_override = {"system_health": {"model_service": "UNKNOWN"}}
            evaluation = self.evaluate_intent(valid_intent, context_override=ctx_override)
            return SafetyScenarioResult(
                scenario_id="SCENARIO_B",
                name="Unknown Critical Service Health",
                description="Critical service model_service reports UNKNOWN. System must fail closed.",
                expected_decision=SafetyDecision.DENIED,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.DENIED,
                actual_state=evaluation.state,
                passed=(evaluation.decision == SafetyDecision.DENIED),
                steps_audit=[
                    {"step": 1, "action": "Inject UNKNOWN health for model_service"},
                    {"step": 2, "arbitration_decision": evaluation.decision.value},
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_C":
            # Scenario C — Stale intent
            # Expected: DENIED
            stale_intent = dict(valid_intent)
            stale_intent["updated_at"] = datetime.fromtimestamp(curr_ts - 10.0, tz=UTC).isoformat()
            evaluation = self.evaluate_intent(stale_intent)
            return SafetyScenarioResult(
                scenario_id="SCENARIO_C",
                name="Stale Intent Exceeding Threshold",
                description="Intent age exceeds policy max_intent_age_ms (500ms).",
                expected_decision=SafetyDecision.DENIED,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.DENIED,
                actual_state=evaluation.state,
                passed=(evaluation.decision == SafetyDecision.DENIED),
                steps_audit=[
                    {"step": 1, "action": "Submit intent with 10.0s latency"},
                    {
                        "step": 2,
                        "verdict": evaluation.decision.value,
                        "reason": evaluation.primary_reason,
                    },
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_D":
            # Scenario D — Blocked intent (e.g. REST)
            # Expected: DENIED
            blocked_intent = dict(valid_intent)
            blocked_intent["intent_class"] = "REST"
            evaluation = self.evaluate_intent(blocked_intent)
            return SafetyScenarioResult(
                scenario_id="SCENARIO_D",
                name="Explicitly Blocked Intent Class",
                description="Intent class is REST (configured in blocked_intents policy).",
                expected_decision=SafetyDecision.DENIED,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.DENIED,
                actual_state=evaluation.state,
                passed=(evaluation.decision == SafetyDecision.DENIED),
                steps_audit=[
                    {"step": 1, "action": "Submit REST intent"},
                    {"step": 2, "verdict": evaluation.decision.value},
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_E":
            # Scenario E — Operator hold
            # Expected: HELD
            self.assert_operator_hold(operator_id="OP_SCENARIO", reason="Operator safety check.")
            evaluation = self.evaluate_intent(valid_intent)
            self.release_operator_hold()
            return SafetyScenarioResult(
                scenario_id="SCENARIO_E",
                name="Manual Operator Hold Engaged",
                description="Operator hold is active. Intent must transition to HELD.",
                expected_decision=SafetyDecision.HELD,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.HELD,
                actual_state=evaluation.state,
                passed=(evaluation.decision == SafetyDecision.HELD),
                steps_audit=[
                    {"step": 1, "action": "Engage operator hold"},
                    {"step": 2, "verdict": evaluation.decision.value},
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_F":
            # Scenario F — Emergency stop
            # Expected: EMERGENCY_STOP
            self.assert_emergency_stop(reason="Scenario emergency halt.", asserted_by="OPERATOR")
            evaluation = self.evaluate_intent(valid_intent)
            self.clear_emergency_stop()
            self.execute_reset()
            return SafetyScenarioResult(
                scenario_id="SCENARIO_F",
                name="Software Emergency Stop Active",
                description="Emergency stop actively asserted. Dominates all authorization.",
                expected_decision=SafetyDecision.EMERGENCY_STOP,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.EMERGENCY_STOP,
                actual_state=evaluation.state,
                passed=(evaluation.decision == SafetyDecision.EMERGENCY_STOP),
                steps_audit=[
                    {"step": 1, "action": "Assert emergency stop"},
                    {"step": 2, "verdict": evaluation.decision.value},
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_G":
            # Scenario G — Lockout
            # Expected: LOCKED_OUT
            self.assert_lockout(reason="Scenario lockout.")
            evaluation = self.evaluate_intent(valid_intent)
            self.unlock()
            self.execute_reset()
            return SafetyScenarioResult(
                scenario_id="SCENARIO_G",
                name="System Lockout Active",
                description="Lockout engaged due to threshold violations.",
                expected_decision=SafetyDecision.LOCKED_OUT,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.LOCKED_OUT,
                actual_state=evaluation.state,
                passed=(evaluation.decision == SafetyDecision.LOCKED_OUT),
                steps_audit=[
                    {"step": 1, "action": "Assert system lockout"},
                    {"step": 2, "verdict": evaluation.decision.value},
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_H":
            # Scenario H — Rate limit exceeded
            # Expected: DENIED
            now_h = self.get_current_time()
            # Inject 5 recent authorizations within window
            timestamps = [now_h - 0.5, now_h - 0.4, now_h - 0.3, now_h - 0.2, now_h - 0.1]
            ctx_override = {"execution_rate": {"recent_authorizations_timestamps": timestamps}}
            evaluation = self.evaluate_intent(valid_intent, context_override=ctx_override)
            return SafetyScenarioResult(
                scenario_id="SCENARIO_H",
                name="Command Rate Limit Exceeded",
                description="5 commands already authorized within 1000ms sliding window.",
                expected_decision=SafetyDecision.DENIED,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.DENIED,
                actual_state=evaluation.state,
                passed=(evaluation.decision == SafetyDecision.DENIED),
                steps_audit=[
                    {"step": 1, "action": "Inject 5 authorizations in 1s window"},
                    {"step": 2, "verdict": evaluation.decision.value},
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_I":
            # Scenario I — Multiple simultaneous violations (Precedence Test)
            # E-stop (Rank 1) + Blocked Intent (Rank 5) + Stale Intent (Rank 6)
            # Expected: EMERGENCY_STOP (Rank 1 wins)
            self.assert_emergency_stop(reason="Multiple violation test.")
            multi_intent = dict(valid_intent)
            multi_intent["intent_class"] = "REST"
            multi_intent["updated_at"] = "2020-01-01T00:00:00Z"
            evaluation = self.evaluate_intent(multi_intent)
            self.clear_emergency_stop()
            self.execute_reset()
            return SafetyScenarioResult(
                scenario_id="SCENARIO_I",
                name="Multiple Simultaneous Violations (Precedence)",
                description="E-Stop, blocked intent, and stale timestamp present simultaneously. E-stop must dominate.",
                expected_decision=SafetyDecision.EMERGENCY_STOP,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.EMERGENCY_STOP,
                actual_state=evaluation.state,
                passed=(
                    evaluation.decision == SafetyDecision.EMERGENCY_STOP
                    and evaluation.precedence_rank == 1
                ),
                steps_audit=[
                    {"step": 1, "action": "Trigger E-stop + REST + Stale"},
                    {"step": 2, "winning_precedence_rank": evaluation.precedence_rank},
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_J":
            # Scenario J — E-stop Clear requires reset, does NOT auto-authorize
            # Expected: RESET_PENDING -> not AUTHORIZED
            self.assert_emergency_stop(reason="E-stop clear test.")
            snap_cleared = self.clear_emergency_stop()
            eval_pending = self.evaluate_intent(valid_intent)
            self.execute_reset()
            return SafetyScenarioResult(
                scenario_id="SCENARIO_J",
                name="Emergency Stop Clear Procedure",
                description="Clearing E-stop moves machine to RESET_PENDING, never automatically authorizing.",
                expected_decision=SafetyDecision.DENIED,
                actual_decision=eval_pending.decision,
                expected_state=SafetyArbitrationState.RESET_PENDING,
                actual_state=snap_cleared.current_state,
                passed=(
                    snap_cleared.current_state == SafetyArbitrationState.RESET_PENDING
                    and eval_pending.decision != SafetyDecision.AUTHORIZED
                ),
                steps_audit=[
                    {"step": 1, "action": "Assert and clear E-stop"},
                    {"step": 2, "intermediate_state": snap_cleared.current_state.value},
                    {"step": 3, "evaluation_during_pending": eval_pending.decision.value},
                ],
                evaluation=eval_pending,
            )

        elif scenario_key == "SCENARIO_K":
            # Scenario K — Context mismatch (Subject or Session mismatch)
            # Expected: DENIED
            mismatch_intent = dict(valid_intent)
            mismatch_intent["subject_id"] = "sub_OTHER_SUBJECT"
            evaluation = self.evaluate_intent(
                mismatch_intent,
                context_override={
                    "session_validity": {
                        "active_subject_id": "sub_scen_01",
                        "active_session_id": "sess_scen_01",
                    }
                },
            )
            return SafetyScenarioResult(
                scenario_id="SCENARIO_K",
                name="Session Subject Context Mismatch",
                description="Intent belongs to sub_OTHER_SUBJECT but active session belongs to sub_scen_01.",
                expected_decision=SafetyDecision.DENIED,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.DENIED,
                actual_state=evaluation.state,
                passed=(evaluation.decision == SafetyDecision.DENIED),
                steps_audit=[
                    {"step": 1, "action": "Submit intent with mismatched subject"},
                    {"step": 2, "verdict": evaluation.decision.value},
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_L":
            # Scenario L — Model invalid / rolled back
            # Expected: DENIED
            evaluation = self.evaluate_intent(
                valid_intent,
                context_override={
                    "model_health": {
                        "is_active": True,
                        "is_rolled_back": True,
                        "model_version_id": "model_v1",
                    }
                },
            )
            return SafetyScenarioResult(
                scenario_id="SCENARIO_L",
                name="Decoder Model Rolled Back",
                description="Active model has rolled_back=True flag set.",
                expected_decision=SafetyDecision.DENIED,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.DENIED,
                actual_state=evaluation.state,
                passed=(evaluation.decision == SafetyDecision.DENIED),
                steps_audit=[
                    {"step": 1, "action": "Set model is_rolled_back=True"},
                    {"step": 2, "verdict": evaluation.decision.value},
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_M":
            # Scenario M — Duplicate evaluation idempotency
            ctx = self.context_provider.get_context(valid_intent)
            eval1 = self.rule_engine.evaluate(
                valid_intent, ctx, self._active_policy, now_ts=curr_ts
            )
            eval2 = self.rule_engine.evaluate(
                valid_intent, ctx, self._active_policy, now_ts=curr_ts
            )
            return SafetyScenarioResult(
                scenario_id="SCENARIO_M",
                name="Idempotent Duplicate Evaluation",
                description="Evaluating the same input in the same context produces identical verdicts.",
                expected_decision=eval1.decision,
                actual_decision=eval2.decision,
                expected_state=eval1.state,
                actual_state=eval2.state,
                passed=(eval1.decision == eval2.decision and eval1.state == eval2.state),
                steps_audit=[
                    {"step": 1, "first_verdict": eval1.decision.value},
                    {"step": 2, "second_verdict": eval2.decision.value},
                ],
                evaluation=eval2,
            )

        elif scenario_key == "SCENARIO_N":
            # Scenario N — Stale / out-of-order event
            # Expected: Restrictive DENIED
            out_of_order_intent = dict(valid_intent)
            out_of_order_intent["updated_at"] = "1970-01-01T00:00:00Z"
            evaluation = self.evaluate_intent(out_of_order_intent)
            return SafetyScenarioResult(
                scenario_id="SCENARIO_N",
                name="Out-of-Order / Epoch 0 Timestamp",
                description="Incoming intent has an ancient timestamp. Restrictive fail-closed evaluation.",
                expected_decision=SafetyDecision.DENIED,
                actual_decision=evaluation.decision,
                expected_state=SafetyArbitrationState.DENIED,
                actual_state=evaluation.state,
                passed=(evaluation.decision == SafetyDecision.DENIED),
                steps_audit=[
                    {"step": 1, "action": "Submit intent with 1970 timestamp"},
                    {"step": 2, "verdict": evaluation.decision.value},
                ],
                evaluation=evaluation,
            )

        elif scenario_key == "SCENARIO_O":
            # Scenario O — Recovery after health restoration
            # 1. Health degraded -> DENIED
            # 2. Health restored -> AUTHORIZED
            eval_fail = self.evaluate_intent(
                valid_intent, context_override={"system_health": {"backend": "degraded"}}
            )
            now_o = self.get_current_time()
            valid_restored = dict(valid_intent)
            valid_restored["updated_at"] = datetime.fromtimestamp(now_o - 0.05, tz=UTC).isoformat()
            eval_pass = self.evaluate_intent(
                valid_restored, context_override={"system_health": {"backend": "healthy"}}
            )
            return SafetyScenarioResult(
                scenario_id="SCENARIO_O",
                name="Recovery After Subsystem Health Restoration",
                description="Subsystem fails closed during degradation, recovers to AUTHORIZED when healthy.",
                expected_decision=SafetyDecision.AUTHORIZED,
                actual_decision=eval_pass.decision,
                expected_state=SafetyArbitrationState.AUTHORIZED,
                actual_state=eval_pass.state,
                passed=(
                    eval_fail.decision == SafetyDecision.DENIED
                    and eval_pass.decision == SafetyDecision.AUTHORIZED
                ),
                steps_audit=[
                    {"step": 1, "degraded_verdict": eval_fail.decision.value},
                    {"step": 2, "restored_verdict": eval_pass.decision.value},
                ],
                evaluation=eval_pass,
            )

        else:
            raise ValueError(f"Unknown scenario ID: {scenario_id}")


# Default service singleton instance
default_safety_service = SafetyService()
