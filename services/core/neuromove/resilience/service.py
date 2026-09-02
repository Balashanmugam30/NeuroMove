"""Authoritative Resilience & Fault Laboratory Service for Phase 18.

Orchestrates deterministic fault injection, pipeline observation, invariant
evaluations, safe recovery checkpoints, scenario executions, and event broadcast
over TransportStream.RESILIENCE.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from neuromove.domain.enums import EventType, SafetyDecision
from neuromove.events.envelope import EventEnvelope
from neuromove.resilience.faults import create_fault_definition
from neuromove.resilience.injector import FaultInjector
from neuromove.resilience.invariants import InvariantEngine
from neuromove.resilience.models import (
    DataLossStatus,
    FailureScenarioResult,
    FaultDefinition,
    FaultExperiment,
    FaultExperimentManifest,
    FaultInjectionRequest,
    FaultInjectionResult,
    FaultType,
    PipelineHealthSnapshot,
    ResilienceLabStatus,
)
from neuromove.resilience.observers import PipelineObserver
from neuromove.resilience.recovery import RecoveryOrchestrator
from neuromove.resilience.replay import ReplayEngine
from neuromove.resilience.scenarios import ScenarioRegistry
from neuromove.resilience.storage import ResilienceStorage
from neuromove.safety.models import SafetyArbitrationState, SafetyEvaluation
from neuromove.safety.service import default_safety_service
from neuromove.transport.models import TransportStream
from neuromove.transport.stream_router import stream_router

logger = logging.getLogger(__name__)


class ResilienceService:
    """Singleton service managing the resilience and fault laboratory."""

    def __init__(
        self,
        storage: ResilienceStorage | None = None,
        safety_svc: Any = None,
    ) -> None:
        self.storage = storage or ResilienceStorage()
        self.safety_service = safety_svc or default_safety_service

        self.injector = FaultInjector()
        self.invariants = InvariantEngine()
        self.recovery = RecoveryOrchestrator()
        self.observer = PipelineObserver(injector=self.injector)
        self.replay = ReplayEngine(resilience_service=self)

        self._lab_mode: str = "IDLE"  # IDLE, EXPERIMENT_ACTIVE, RECOVERING, SIMULATION
        self._sequence_counter: int = 0

    def get_status(self) -> ResilienceLabStatus:
        """Return live authoritative status of the resilience lab."""
        health = self.observer.capture_snapshot()
        metrics = self.storage.get_metrics()
        active_faults = self.injector.get_active_faults()
        metrics.active_faults_count = len(active_faults)

        mode = "IDLE"
        if active_faults:
            mode = "EXPERIMENT_ACTIVE"

        return ResilienceLabStatus(
            lab_mode=mode,
            active_faults=active_faults,
            pipeline_health=health,
            metrics=metrics,
            updated_at=datetime.now(UTC).isoformat(),
        )

    def inject_fault(self, req: FaultInjectionRequest) -> FaultInjectionResult:
        """Inject a parameterized fault into the platform."""
        fault = create_fault_definition(
            fault_type=req.fault_type,
            severity=req.severity,
            scope=req.scope,
            target_service=req.target_service,
            target_stream=req.target_stream,
            target_session=req.target_session,
            trigger_type=req.trigger_type,
            trigger_value=req.trigger_value,
            parameters=req.parameters,
            description=req.description or "",
        )

        injected = self.injector.inject(fault)
        self.storage.save_fault(injected)

        # Broadcast FAULT_ACTIVE event
        self._broadcast_event(
            event_type=EventType.FAULT_ACTIVE,
            payload={
                "fault_id": injected.fault_id,
                "fault_type": injected.fault_type.value,
                "severity": injected.severity.value,
                "scope": injected.scope.value,
            },
        )

        return FaultInjectionResult(
            success=True,
            fault=injected,
            message=f"Fault {injected.fault_id} [{injected.fault_type.value}] activated successfully.",
        )

    def clear_fault(self, fault_id: str) -> FaultDefinition | None:
        """Clear a specific active fault."""
        cleared = self.injector.clear(fault_id)
        if cleared:
            self.storage.save_fault(cleared)
            self._broadcast_event(
                event_type=EventType.FAULT_CLEARED,
                payload={"fault_id": fault_id, "fault_type": cleared.fault_type.value},
            )
        return cleared

    def reset_lab(self) -> int:
        """Emergency lab reset: clears all active faults and restores clean baseline context."""
        cleared_count = self.injector.clear_all()
        self.cleanup_experiment()
        self._lab_mode = "IDLE"
        logger.info("Resilience lab reset: cleared %d faults, baseline restored", cleared_count)
        return cleared_count

    def capture_baseline(self) -> PipelineHealthSnapshot:
        """Capture baseline pipeline snapshot before launching an experiment."""
        return self.observer.capture_snapshot()

    def evaluate_test_intent(
        self,
        intent_class: str = "LEFT",
        state: str = "ACTIVE",
        subject_id: str = "sub-01",
        session_id: str = "sess-01",
        model_version_id: str = "model_v1",
        confidence_score: float = 0.92,
        age_offset_ms: float = 20.0,
        malformed: bool = False,
    ) -> SafetyEvaluation:
        """Inject a test intent candidate through the perturbed safety gate."""
        # Check active stream delays
        for f in self.injector.get_active_faults():
            if f.fault_type in (FaultType.STREAM_DELAY, FaultType.TIMESTAMP_DELAY, FaultType.EVENT_DELAY):
                delay_val = f.parameters.delay_ms if f.parameters.delay_ms is not None else 600.0
                age_offset_ms += delay_val

        now = time.time()
        # Apply simulated clock skew if active
        now += self.injector.get_clock_skew_seconds()

        ts = datetime.fromtimestamp(now - (age_offset_ms / 1000.0), tz=UTC).isoformat()

        # Propagate health overrides into context provider based on active faults
        if (
            self.injector.is_fault_active(FaultType.STREAM_DISCONNECT)
            or self.injector.is_fault_active(FaultType.WEBSOCKET_DISCONNECT)
        ):
            self.safety_service.context_provider.set_stream_health("realtime", False, latency_ms=9999.0)

        if self.injector.is_fault_active(FaultType.CONFIDENCE_SERVICE_UNAVAILABLE):
            self.safety_service.context_provider.set_system_health("confidence_service", False)

        if self.injector.is_fault_active(FaultType.MODEL_ROLLBACK):
            self.safety_service.context_provider.set_active_model("model_v1", is_active=True, is_rolled_back=True)

        if self.injector.is_fault_active(FaultType.MODEL_UNAVAILABLE):
            self.safety_service.context_provider.set_active_model("model_v1", is_active=False)

        if (
            self.injector.is_fault_active(FaultType.DATABASE_UNAVAILABLE)
            or self.injector.is_fault_active(FaultType.DATABASE_WRITE_FAILURE)
        ):
            self.safety_service.context_provider.set_system_health("database", False)

        if self.injector.is_fault_active(FaultType.SAFETY_SERVICE_UNAVAILABLE):
            self.safety_service.context_provider.set_system_health("backend", False)

        if (
            self.injector.is_fault_active(FaultType.SUBJECT_SWITCH)
            or self.injector.is_fault_active(FaultType.SESSION_SWITCH)
        ):
            self.safety_service.context_provider.set_session_context("sub-01", "sess-01")

        intent_data: dict[str, Any] = {
            "intent_id": f"int_res_{uuid.uuid4().hex[:8]}",
            "intent_class": intent_class,
            "state": state,
            "current_state": state,
            "subject_id": subject_id,
            "session_id": session_id,
            "model_version_id": model_version_id,
            "confidence_score": confidence_score,
            "confidence_evaluation_id": f"conf_{uuid.uuid4().hex[:8]}",
            "temporal_confirmation_id": f"tc_{uuid.uuid4().hex[:8]}",
            "created_at": ts,
            "updated_at": ts,
        }

        # Apply payload perturbations from active faults
        if malformed or self.injector.is_fault_active(FaultType.MALFORMED_PAYLOAD):
            intent_data = self.injector.perturb_payload(intent_data)
        elif self.injector.get_active_faults():
            intent_data = self.injector.perturb_payload(intent_data)

        # Inject into Phase 17 Safety Arbitration Service
        evaluation = self.safety_service.evaluate_intent(intent_data)
        return evaluation

    def run_experiment(
        self,
        scenario_id: str,
        name: str,
        fault_sequence: list[FaultDefinition],
        seed: int = 42,
    ) -> FaultExperiment:
        """Run a full resilience experiment with manifest, checkpoint, invariants, and recovery."""
        start_time = time.time()
        exp_id = f"exp_{uuid.uuid4().hex[:12]}"
        self._lab_mode = "EXPERIMENT_ACTIVE"

        # 1. Capture baseline snapshot & checkpoint
        baseline = self.capture_baseline()
        checkpoint = self.recovery.capture_checkpoint(
            experiment_id=exp_id,
            component="pipeline",
            safe_state=baseline.current_safety_state.value,
            sequence_number=self._next_sequence(),
            snapshot_version="1.0.0",
        )
        self.storage.save_checkpoint(checkpoint)

        manifest = FaultExperimentManifest(
            experiment_id=exp_id,
            experiment_name=name,
            scenario_id=scenario_id,
            seed=seed,
            fault_sequence=fault_sequence,
            expected_invariants=[
                "INV_01_NO_ACCIDENTAL_AUTHORIZATION",
                "INV_08_NO_UNKNOWN_TO_ALLOW",
            ],
        )
        manifest.manifest_checksum = manifest.compute_checksum()

        steps_audit: list[dict[str, Any]] = []
        steps_audit.append({"step": 1, "action": "Captured baseline and checkpoint"})

        # Check authorization BEFORE failure
        auth_before = (baseline.current_safety_decision == SafetyDecision.AUTHORIZED)

        # 2. Inject specified fault sequence
        for fault in fault_sequence:
            self.injector.inject(fault)
        steps_audit.append({"step": 2, "action": f"Injected {len(fault_sequence)} faults"})

        # 3. Evaluate candidate intent under fault conditions
        eval_during = self.evaluate_test_intent()
        auth_during = (eval_during.decision == SafetyDecision.AUTHORIZED)
        steps_audit.append({"step": 3, "action": "Evaluated candidate intent under fault", "decision": eval_during.decision.value})

        # 4. Observe system health and evaluate invariants
        mid_snapshot = self.observer.capture_snapshot()
        invariants = self.invariants.evaluate_all(
            baseline=baseline,
            current=mid_snapshot,
            active_faults=self.injector.get_active_faults(),
        )

        # 5. Recover and clear faults
        self.cleanup_experiment()
        steps_audit.append({"step": 4, "action": "Cleared faults and recovered pipeline"})

        final_snap = self.observer.capture_snapshot()
        auth_after = (final_snap.current_safety_decision == SafetyDecision.AUTHORIZED)

        # 6. Evaluate recovery certification
        rec_status, data_loss, rec_msg = self.recovery.evaluate_recovery(
            pre_fault_checkpoint=checkpoint,
            current_health=final_snap,
            data_loss=DataLossStatus.NONE,
        )
        steps_audit.append({"step": 5, "action": "Recovery certified", "status": rec_status.value, "msg": rec_msg})

        duration_ms = (time.time() - start_time) * 1000.0

        all_invariants_pass = all(inv.status == "PASS" for inv in invariants)
        exp_status = "PASSED" if all_invariants_pass and not auth_during else "FAILED"

        experiment = FaultExperiment(
            experiment_id=exp_id,
            scenario_id=scenario_id,
            name=name,
            seed=seed,
            status=exp_status,
            manifest=manifest,
            baseline_snapshot=baseline,
            final_snapshot=final_snap,
            invariants=invariants,
            recovery_status=rec_status,
            data_loss_status=data_loss,
            authorization_before_failure=auth_before,
            authorization_during_failure=auth_during,
            authorization_after_failure=auth_after,
            steps_audit=steps_audit,
            replay_hash=f"rep_{hash(exp_id) & 0xFFFFFFFF:08x}",
            artifact_checksum=manifest.manifest_checksum,
            started_at=datetime.fromtimestamp(start_time, tz=UTC).isoformat(),
            ended_at=datetime.now(UTC).isoformat(),
            duration_ms=duration_ms,
        )

        self.storage.save_experiment(experiment)
        self._lab_mode = "IDLE"

        # Broadcast completion
        self._broadcast_event(
            event_type=EventType.RESILIENCE_EXPERIMENT_COMPLETED,
            payload={
                "experiment_id": exp_id,
                "scenario_id": scenario_id,
                "status": exp_status,
                "duration_ms": duration_ms,
            },
        )

        return experiment

    def run_scenario(self, scenario_id: str) -> FailureScenarioResult:
        """Run a registered scenario from ScenarioRegistry."""
        return ScenarioRegistry.run_scenario(scenario_id, self)

    def cleanup_experiment(self) -> None:
        """Clean up active faults and restore context provider health to default."""
        self.injector.clear_all()
        self.safety_service.context_provider.reset_to_healthy_defaults()
        try:
            curr = self.safety_service.state_machine.current_state
            if curr == SafetyArbitrationState.EMERGENCY_STOP:
                self.safety_service.clear_emergency_stop()
                self.safety_service.execute_reset()
            elif curr == SafetyArbitrationState.LOCKED_OUT:
                self.safety_service.unlock()
                self.safety_service.execute_reset(clear_lockout=True)
            elif curr != SafetyArbitrationState.SAFE_IDLE:
                self.safety_service.execute_reset()
        except Exception as exc:
            logger.debug("Safe cleanup state reset encountered: %s", exc)

    def _next_sequence(self) -> int:
        self._sequence_counter += 1
        return self._sequence_counter

    def _broadcast_event(self, event_type: EventType, payload: dict[str, Any]) -> None:
        """Broadcast resilience lifecycle events over WebSocket TransportStream.RESILIENCE."""
        try:
            envelope = EventEnvelope(
                event_id=f"evt_res_{uuid.uuid4().hex[:8]}",
                event_type=event_type,
                timestamp=datetime.now(UTC).isoformat(),
                sequence_number=self._next_sequence(),
                payload=payload,
            )
            stream_router.publish(TransportStream.RESILIENCE, envelope)
        except Exception as exc:
            logger.debug("Failed to broadcast resilience event: %s", exc)


default_resilience_service = ResilienceService()
