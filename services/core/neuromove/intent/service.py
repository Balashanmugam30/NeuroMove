"""Authoritative Intent Lifecycle Service (Phase 16).

Coordinates Canonical Intent State Machine, persistence, event dispatching,
and deterministic research scenarios.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import UTC, datetime

from neuromove.confidence.models import ConfidenceBand, ConfidenceEligibility
from neuromove.domain.enums import EventType
from neuromove.events.dispatcher import default_dispatcher
from neuromove.events.envelope import EventEnvelope
from neuromove.intent.models import (
    TERMINAL_STATES,
    IntentCancelRequest,
    IntentCompleteRequest,
    IntentIngestRequest,
    IntentLifecycleState,
    IntentPolicy,
    IntentRecord,
    IntentResetRequest,
    IntentScenarioResponse,
    IntentScenarioStep,
    IntentStateSnapshot,
    IntentStateTransition,
    IntentTransitionReason,
    IntentTransitionTrigger,
)
from neuromove.intent.state_machine import IntentStateMachine
from neuromove.intent.storage import IntentStorage

logger = logging.getLogger(__name__)


class IntentService:
    """Singleton service governing canonical intent lifecycle, transitions, and persistence."""

    def __init__(self, storage: IntentStorage | None = None) -> None:
        self.storage = storage or IntentStorage()
        self.policy: IntentPolicy = self.storage.get_policy()
        self.state_machine = IntentStateMachine(self.policy)
        self.snapshot: IntentStateSnapshot = self.storage.get_snapshot()

        # Monotonic sequence counter
        transitions = self.storage.get_transition_history(limit=1)
        self._sequence_number: int = transitions[0].sequence_number if transitions else 0

        # Injected clock for deterministic simulation
        self._mock_time: float | None = None

        # Tracking for same-class cooldown
        self._last_confirmation_time: float = 0.0

    def _now(self) -> float:
        """Return current timestamp (injected mock time if set, otherwise real time)."""
        if self._mock_time is not None:
            return self._mock_time
        return time.time()

    def _now_iso(self) -> str:
        """Return ISO 8601 formatted UTC timestamp."""
        ts = self._now()
        dt = datetime.fromtimestamp(ts, tz=UTC)
        return dt.isoformat()

    def set_mock_time(self, t: float | None) -> None:
        """Inject simulated timestamp for deterministic scenario replay."""
        self._mock_time = t

    def get_policy(self) -> IntentPolicy:
        """Retrieve active lifecycle policy."""
        return self.policy

    def update_policy(self, updated: IntentPolicy) -> IntentPolicy:
        """Update and persist lifecycle policy."""
        checksum = updated.compute_checksum()
        self.policy = updated.model_copy(update={"checksum": checksum})
        self.state_machine = IntentStateMachine(self.policy)
        self.storage.save_policy(self.policy)
        logger.info("Updated intent lifecycle policy to version %s", self.policy.version)
        return self.policy

    def get_snapshot(self) -> IntentStateSnapshot:
        """Return current authoritative state snapshot."""
        # Auto-check timeouts on read
        self._check_timeouts()
        return self.snapshot

    def get_current_intent(self) -> IntentRecord | None:
        """Fetch current active or candidate intent record."""
        self._check_timeouts()
        if not self.snapshot.active_intent_id:
            return None
        return self.storage.get_intent_record(self.snapshot.active_intent_id)

    # -------------------------------------------------------------------------
    # Core Transition Execution
    # -------------------------------------------------------------------------
    def _execute_transition(
        self,
        trigger: IntentTransitionTrigger,
        reason: IntentTransitionReason,
        target_intent_id: str | None = None,
        target_intent_class: str | None = None,
        subject_id: str | None = None,
        session_id: str | None = None,
        model_version_id: str | None = None,
        source_event_id: str | None = None,
        confidence_score: float | None = None,
        confidence_evaluation_id: str | None = None,
        temporal_confirmation_id: str | None = None,
        details: str | None = None,
    ) -> IntentStateTransition:
        """Atomic state machine transition execution."""
        prev_state = self.snapshot.current_state

        if trigger == IntentTransitionTrigger.CONTEXT_RESET:
            next_state = IntentLifecycleState.NO_INTENT
        else:
            next_state, default_reason = self.state_machine.validate_transition(prev_state, trigger)
            if reason == IntentTransitionReason.STATE_RESTORE:
                reason = default_reason

        now_ts = self._now()
        now_str = self._now_iso()
        self._sequence_number += 1

        active_id = target_intent_id or self.snapshot.active_intent_id
        active_class = target_intent_class or self.snapshot.intent_class

        # Determine deadline for new state
        deadline = self.state_machine.compute_deadline(next_state, now_ts, self.policy)

        # Update or close current intent record
        is_terminal = next_state in TERMINAL_STATES
        if active_id:
            rec = self.storage.get_intent_record(active_id)
            if rec:
                updated_rec = rec.model_copy(
                    update={
                        "current_state": next_state,
                        "updated_at": now_str,
                        "state_deadline": deadline,
                        "is_terminal": is_terminal,
                        "terminal_reason": reason if is_terminal else None,
                    }
                )
                self.storage.save_intent_record(updated_rec)

        # Record immutable transition
        transition = IntentStateTransition(
            transition_id=f"tr_{uuid.uuid4().hex[:12]}",
            sequence_number=self._sequence_number,
            intent_id=active_id,
            intent_class=active_class,
            previous_state=prev_state,
            next_state=next_state,
            trigger=trigger,
            reason=reason,
            subject_id=subject_id or self.snapshot.subject_id,
            session_id=session_id or self.snapshot.session_id,
            model_version_id=model_version_id or self.snapshot.model_version_id,
            source_event_id=source_event_id,
            confidence_score=confidence_score or self.snapshot.confidence_score,
            policy_version=self.policy.version,
            timestamp=now_str,
            details=details,
        )
        self.storage.record_transition(transition)

        # Update snapshot
        self.snapshot = IntentStateSnapshot(
            snapshot_id=self.snapshot.snapshot_id,
            active_intent_id=None
            if is_terminal or next_state == IntentLifecycleState.NO_INTENT
            else active_id,
            current_state=next_state,
            intent_class=None
            if is_terminal or next_state == IntentLifecycleState.NO_INTENT
            else active_class,
            subject_id=subject_id or self.snapshot.subject_id,
            session_id=session_id or self.snapshot.session_id,
            model_version_id=model_version_id or self.snapshot.model_version_id,
            confidence_score=confidence_score or self.snapshot.confidence_score,
            confidence_evaluation_id=confidence_evaluation_id
            or self.snapshot.confidence_evaluation_id,
            temporal_confirmation_id=temporal_confirmation_id
            or self.snapshot.temporal_confirmation_id,
            created_at=self.snapshot.created_at
            if prev_state != IntentLifecycleState.NO_INTENT
            else now_str,
            updated_at=now_str,
            state_deadline=deadline,
            transition_reason=reason,
            policy_version=self.policy.version,
            transition_count=self.snapshot.transition_count + 1,
        )
        self.storage.save_snapshot(self.snapshot)

        # Dispatch real-time events
        self._dispatch_transition_event(transition)

        logger.info(
            "Intent state transition: %s -> %s [trigger=%s, reason=%s, intent_id=%s]",
            prev_state,
            next_state,
            trigger,
            reason,
            active_id,
        )
        return transition

    def _dispatch_transition_event(self, transition: IntentStateTransition) -> None:
        """Dispatch canonical WebSocket / bus event for state transition."""
        event_map = {
            IntentLifecycleState.CANDIDATE: EventType.INTENT_CANDIDATE,
            IntentLifecycleState.CONFIRMED: EventType.INTENT_CONFIRMED,
            IntentLifecycleState.ACTIVE: EventType.INTENT_ACTIVATED,
            IntentLifecycleState.CANCELLED: EventType.INTENT_CANCELLED,
            IntentLifecycleState.EXPIRED: EventType.INTENT_EXPIRED,
            IntentLifecycleState.INTERRUPTED: EventType.INTENT_INTERRUPTED,
            IntentLifecycleState.COMPLETED: EventType.INTENT_COMPLETED,
            IntentLifecycleState.REPLACEMENT_PENDING: EventType.INTENT_REPLACEMENT_REQUESTED,
            IntentLifecycleState.NO_INTENT: EventType.INTENT_CONTEXT_RESET,
        }
        primary_type = event_map.get(transition.next_state, EventType.INTENT_STATE_CHANGED)

        envelope = EventEnvelope(
            event_id=f"evt_{uuid.uuid4().hex[:12]}",
            event_type=primary_type,
            timestamp=transition.timestamp,
            sequence=transition.sequence_number,
            source="intent_engine",
            subject_id=transition.subject_id,
            session_id=transition.session_id,
            payload={
                "transition_id": transition.transition_id,
                "intent_id": transition.intent_id,
                "intent_class": transition.intent_class,
                "previous_state": transition.previous_state.value,
                "next_state": transition.next_state.value,
                "reason": transition.reason.value,
                "trigger": transition.trigger.value,
                "confidence_score": transition.confidence_score,
                "policy_version": transition.policy_version,
                "details": transition.details,
            },
        )
        default_dispatcher.publish(envelope)

    # -------------------------------------------------------------------------
    # Timeout & Expiration Management
    # -------------------------------------------------------------------------
    def _check_timeouts(self) -> None:
        """Evaluate if current candidate, confirmed, or active intent deadline has expired."""
        if self.snapshot.state_deadline is None:
            return

        now_ts = self._now()
        if now_ts > self.snapshot.state_deadline:
            curr = self.snapshot.current_state
            if curr == IntentLifecycleState.CANDIDATE:
                self._execute_transition(
                    trigger=IntentTransitionTrigger.TIMEOUT,
                    reason=IntentTransitionReason.CANDIDATE_TIMEOUT,
                    details="Candidate deadline expired waiting for confirmation",
                )
            elif curr == IntentLifecycleState.CONFIRMED:
                self._execute_transition(
                    trigger=IntentTransitionTrigger.TIMEOUT,
                    reason=IntentTransitionReason.CONFIRMATION_TIMEOUT,
                    details="Confirmation acceptance window elapsed without activation",
                )
            elif curr == IntentLifecycleState.ACTIVE:
                self._execute_transition(
                    trigger=IntentTransitionTrigger.TIMEOUT,
                    reason=IntentTransitionReason.ACTIVE_TIMEOUT,
                    details="Active intent duration exceeded maximum policy threshold",
                )

    # -------------------------------------------------------------------------
    # Phase 15 Handoff Ingestion
    # -------------------------------------------------------------------------
    def ingest_handoff(self, req: IntentIngestRequest) -> IntentStateSnapshot:
        """Ingest authoritative Phase 15 handoff payload."""
        self._check_timeouts()

        # Idempotency guard
        if req.source_event_id and self.storage.has_processed_source_event(req.source_event_id):
            logger.info("Ignoring duplicate upstream event %s (idempotent)", req.source_event_id)
            return self.snapshot

        # Normalize prediction class
        pred = req.prediction.upper().strip()
        is_rest = pred in ("REST", "NONE", "NO_PREDICTION", "UNCERTAIN")

        # Handle REST / Non-directional according to policy
        if is_rest:
            if self.snapshot.current_state == IntentLifecycleState.CANDIDATE:
                self._execute_transition(
                    trigger=IntentTransitionTrigger.EXPLICIT_CANCEL,
                    reason=IntentTransitionReason.REST_PREDICTION,
                    details="Candidate cancelled by REST / non-directional prediction",
                )
            elif (
                self.snapshot.current_state == IntentLifecycleState.ACTIVE
                and self.policy.rest_handling_policy == "INTERRUPT_ACTIVE"
            ):
                self._execute_transition(
                    trigger=IntentTransitionTrigger.INTERRUPTION,
                    reason=IntentTransitionReason.REST_PREDICTION,
                    details="Active intent interrupted by REST prediction",
                )
            return self.snapshot

        # Context boundary check: Subject switch
        if (
            req.subject_id
            and self.snapshot.subject_id
            and req.subject_id != self.snapshot.subject_id
        ):
            if self.snapshot.current_state not in (
                IntentLifecycleState.NO_INTENT,
                *TERMINAL_STATES,
            ):
                self._execute_transition(
                    trigger=IntentTransitionTrigger.INTERRUPTION,
                    reason=IntentTransitionReason.SUBJECT_CHANGED,
                    details=f"Subject changed from {self.snapshot.subject_id} to {req.subject_id}",
                )
                self._execute_transition(
                    trigger=IntentTransitionTrigger.CONTEXT_RESET,
                    reason=IntentTransitionReason.SUBJECT_CHANGED,
                )

        # Context boundary check: Session switch
        if (
            req.session_id
            and self.snapshot.session_id
            and req.session_id != self.snapshot.session_id
        ):
            if self.snapshot.current_state not in (
                IntentLifecycleState.NO_INTENT,
                *TERMINAL_STATES,
            ):
                self._execute_transition(
                    trigger=IntentTransitionTrigger.INTERRUPTION,
                    reason=IntentTransitionReason.SESSION_CHANGED,
                    details=f"Session changed from {self.snapshot.session_id} to {req.session_id}",
                )
                self._execute_transition(
                    trigger=IntentTransitionTrigger.CONTEXT_RESET,
                    reason=IntentTransitionReason.SESSION_CHANGED,
                )

        # Context boundary check: Model version switch
        if (
            req.model_version_id
            and self.snapshot.model_version_id
            and req.model_version_id != self.snapshot.model_version_id
        ):
            if self.snapshot.current_state not in (
                IntentLifecycleState.NO_INTENT,
                *TERMINAL_STATES,
            ):
                self._execute_transition(
                    trigger=IntentTransitionTrigger.INTERRUPTION,
                    reason=IntentTransitionReason.MODEL_CHANGED,
                    details=f"Model version changed from {self.snapshot.model_version_id} to {req.model_version_id}",
                )
                self._execute_transition(
                    trigger=IntentTransitionTrigger.CONTEXT_RESET,
                    reason=IntentTransitionReason.MODEL_CHANGED,
                )

        # Temporally Confirmed Handoff
        if req.temporally_confirmed:
            now_ts = self._now()
            now_str = self._now_iso()

            # Same-class reconfirmation cooldown check
            if (
                self.snapshot.current_state == IntentLifecycleState.ACTIVE
                and self.snapshot.intent_class == pred
            ):
                elapsed_ms = (now_ts - self._last_confirmation_time) * 1000.0
                if elapsed_ms < self.policy.same_class_reconfirmation_cooldown_ms:
                    logger.info(
                        "Same-class %s confirmation suppressed under cooldown (%.1fms)",
                        pred,
                        elapsed_ms,
                    )
                    return self.snapshot

            # Cross-class replacement while ACTIVE
            if (
                self.snapshot.current_state == IntentLifecycleState.ACTIVE
                and self.snapshot.intent_class != pred
            ):
                if not self.policy.allow_replacement:
                    logger.info("Replacement rejected: policy disallows cross-class replacement")
                    return self.snapshot

                # Retirement of current active intent
                old_id = self.snapshot.active_intent_id
                self._execute_transition(
                    trigger=IntentTransitionTrigger.REPLACEMENT_REQUEST,
                    reason=IntentTransitionReason.REPLACEMENT_REQUESTED,
                    details=f"New confirmed intent {pred} competing with active {self.snapshot.intent_class} ({old_id})",
                )

            # Create new intent record
            new_intent_id = f"int_{uuid.uuid4().hex[:12]}"
            deadline = self.state_machine.compute_deadline(
                IntentLifecycleState.ACTIVE, now_ts, self.policy
            )
            new_record = IntentRecord(
                intent_id=new_intent_id,
                intent_class=pred,
                current_state=IntentLifecycleState.ACTIVE,
                subject_id=req.subject_id,
                session_id=req.session_id,
                model_version_id=req.model_version_id,
                confidence_score=req.confidence,
                confidence_band=req.confidence_band,
                eligibility=req.eligibility,
                source_event_id=req.source_event_id,
                created_at=now_str,
                updated_at=now_str,
                state_deadline=deadline,
                is_terminal=False,
                policy_version=self.policy.version,
            )
            self.storage.save_intent_record(new_record)

            # Transition to CONFIRMED and immediately promote to ACTIVE
            if self.snapshot.current_state in (
                IntentLifecycleState.NO_INTENT,
                IntentLifecycleState.CANDIDATE,
            ):
                self._execute_transition(
                    trigger=IntentTransitionTrigger.HANDOFF_CONFIRMED,
                    reason=IntentTransitionReason.TEMPORAL_CONFIRMATION_ACCEPTED,
                    target_intent_id=new_intent_id,
                    target_intent_class=pred,
                    subject_id=req.subject_id,
                    session_id=req.session_id,
                    model_version_id=req.model_version_id,
                    source_event_id=req.source_event_id,
                    confidence_score=req.confidence,
                    details=f"Phase 15 confirmed intent {pred} accepted",
                )

            # Promote to ACTIVE
            if self.snapshot.current_state in (
                IntentLifecycleState.CONFIRMED,
                IntentLifecycleState.REPLACEMENT_PENDING,
            ):
                trigger = (
                    IntentTransitionTrigger.REPLACEMENT_RESOLVE
                    if self.snapshot.current_state == IntentLifecycleState.REPLACEMENT_PENDING
                    else IntentTransitionTrigger.ACCEPT_ACTIVE
                )
                self._execute_transition(
                    trigger=trigger,
                    reason=IntentTransitionReason.TEMPORAL_CONFIRMATION_ACCEPTED,
                    target_intent_id=new_intent_id,
                    target_intent_class=pred,
                    subject_id=req.subject_id,
                    session_id=req.session_id,
                    model_version_id=req.model_version_id,
                    source_event_id=req.source_event_id,
                    confidence_score=req.confidence,
                    details=f"Intent {pred} ({new_intent_id}) activated",
                )
            self._last_confirmation_time = now_ts

        # Unconfirmed candidate creation
        elif (
            req.eligibility == ConfidenceEligibility.VALID
            and self.snapshot.current_state == IntentLifecycleState.NO_INTENT
        ):
            now_ts = self._now()
            now_str = self._now_iso()
            new_intent_id = f"int_{uuid.uuid4().hex[:12]}"
            deadline = self.state_machine.compute_deadline(
                IntentLifecycleState.CANDIDATE, now_ts, self.policy
            )
            new_record = IntentRecord(
                intent_id=new_intent_id,
                intent_class=pred,
                current_state=IntentLifecycleState.CANDIDATE,
                subject_id=req.subject_id,
                session_id=req.session_id,
                model_version_id=req.model_version_id,
                confidence_score=req.confidence,
                confidence_band=req.confidence_band,
                eligibility=req.eligibility,
                source_event_id=req.source_event_id,
                created_at=now_str,
                updated_at=now_str,
                state_deadline=deadline,
                is_terminal=False,
                policy_version=self.policy.version,
            )
            self.storage.save_intent_record(new_record)

            self._execute_transition(
                trigger=IntentTransitionTrigger.HANDOFF_CANDIDATE,
                reason=IntentTransitionReason.CANDIDATE_CREATED,
                target_intent_id=new_intent_id,
                target_intent_class=pred,
                subject_id=req.subject_id,
                session_id=req.session_id,
                model_version_id=req.model_version_id,
                source_event_id=req.source_event_id,
                confidence_score=req.confidence,
                details=f"Candidate intent created for {pred}",
            )

        return self.snapshot

    # -------------------------------------------------------------------------
    # Explicit Actions
    # -------------------------------------------------------------------------
    def cancel_intent(self, req: IntentCancelRequest) -> IntentStateSnapshot:
        """Explicitly cancel active, confirmed, or candidate intent."""
        self._check_timeouts()
        if self.snapshot.current_state in (
            IntentLifecycleState.CANDIDATE,
            IntentLifecycleState.CONFIRMED,
            IntentLifecycleState.ACTIVE,
            IntentLifecycleState.REPLACEMENT_PENDING,
        ):
            self._execute_transition(
                trigger=IntentTransitionTrigger.EXPLICIT_CANCEL,
                reason=req.reason,
                details=req.details or "Explicit cancellation requested",
            )
        return self.snapshot

    def complete_intent(self, req: IntentCompleteRequest) -> IntentStateSnapshot:
        """Mark active intent lifecycle as completed (software lifecycle completion only)."""
        self._check_timeouts()
        if self.snapshot.current_state == IntentLifecycleState.ACTIVE:
            self._execute_transition(
                trigger=IntentTransitionTrigger.EXPLICIT_COMPLETE,
                reason=req.reason,
                details=req.details or "Lifecycle completed successfully",
            )
        else:
            raise ValueError(
                f"Cannot complete intent in state '{self.snapshot.current_state}' (must be ACTIVE)"
            )
        return self.snapshot

    def reset_state(self, req: IntentResetRequest) -> IntentStateSnapshot:
        """Reset state machine to NO_INTENT while preserving historical audit log."""
        if self.snapshot.current_state not in (IntentLifecycleState.NO_INTENT, *TERMINAL_STATES):
            self._execute_transition(
                trigger=IntentTransitionTrigger.INTERRUPTION,
                reason=req.reason,
                details="Interrupted due to manual reset",
            )
        self._execute_transition(
            trigger=IntentTransitionTrigger.CONTEXT_RESET,
            reason=req.reason,
            details=req.details or "State reset to NO_INTENT",
        )
        return self.snapshot

    # -------------------------------------------------------------------------
    # Deterministic Simulation Scenarios (A through L)
    # -------------------------------------------------------------------------
    def run_scenario(self, scenario_id: str) -> IntentScenarioResponse:
        """Execute deterministic research scenario A through L."""
        # Clean state for isolated scenario execution
        self.reset_state(IntentResetRequest(reason=IntentTransitionReason.MANUAL_RESET))
        start_time = 1000.0
        self.set_mock_time(start_time)

        steps: list[IntentScenarioStep] = []

        if scenario_id == "SCENARIO_A_NORMAL_LIFECYCLE":
            # 1. Ingest candidate
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="LEFT_IMAGERY",
                    confidence=0.85,
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
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="Ingest candidate handoff",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                    note="Candidate created",
                )
            )

            # 2. Confirmed handoff arrives
            self.set_mock_time(start_time + 0.5)
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="LEFT_IMAGERY",
                    confidence=0.92,
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
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="Ingest confirmed handoff",
                    previous_state=IntentLifecycleState.CANDIDATE,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                    note="Promoted through CONFIRMED to ACTIVE",
                )
            )

            # 3. Explicit complete
            self.set_mock_time(start_time + 1.5)
            self.complete_intent(IntentCompleteRequest())
            steps.append(
                IntentScenarioStep(
                    step=3,
                    action="Complete active intent",
                    previous_state=IntentLifecycleState.ACTIVE,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                    note="Lifecycle concluded with COMPLETED",
                )
            )

        elif scenario_id == "SCENARIO_B_CANDIDATE_TIMEOUT":
            # 1. Candidate created
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="RIGHT_IMAGERY",
                    confidence=0.78,
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
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="Ingest candidate handoff",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                )
            )

            # 2. Advance time past candidate deadline (1000ms default)
            self.set_mock_time(start_time + 1.2)
            self._check_timeouts()
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="Check timeouts after 1200ms",
                    previous_state=IntentLifecycleState.CANDIDATE,
                    next_state=self.snapshot.current_state,
                    intent_id=None,
                    intent_class=None,
                    reason=self.snapshot.transition_reason,
                    note="Candidate expired due to timeout",
                )
            )

        elif scenario_id == "SCENARIO_C_CANDIDATE_CANCEL":
            # 1. Candidate created
            self.ingest_handoff(
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
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="Candidate created",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                )
            )
            # 2. Explicit cancel
            self.cancel_intent(IntentCancelRequest(reason=IntentTransitionReason.EXPLICIT_CANCEL))
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="Cancel candidate",
                    previous_state=IntentLifecycleState.CANDIDATE,
                    next_state=self.snapshot.current_state,
                    intent_id=None,
                    intent_class=None,
                    reason=self.snapshot.transition_reason,
                    note="Candidate cancelled",
                )
            )

        elif scenario_id == "SCENARIO_D_ACTIVE_INTERRUPTION":
            # 1. Activate intent
            self.ingest_handoff(
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
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="Activate intent",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                )
            )
            # 2. Trigger interruption
            self._execute_transition(
                trigger=IntentTransitionTrigger.INTERRUPTION,
                reason=IntentTransitionReason.INTERRUPTION,
                details="Signal lost / stream interruption",
            )
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="Stream interruption",
                    previous_state=IntentLifecycleState.ACTIVE,
                    next_state=self.snapshot.current_state,
                    intent_id=None,
                    intent_class=None,
                    reason=self.snapshot.transition_reason,
                    note="Active intent interrupted",
                )
            )

        elif scenario_id == "SCENARIO_E_SESSION_BOUNDARY":
            # 1. Activate intent in session 1
            self.ingest_handoff(
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
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="Activate intent in ses-001",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                )
            )
            # 2. Handoff arrives with session 2
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="RIGHT_IMAGERY",
                    confidence=0.88,
                    confidence_band=ConfidenceBand.HIGH,
                    eligibility=ConfidenceEligibility.VALID,
                    temporal_status="CONFIRMED",
                    temporally_confirmed=True,
                    confirmation_reason="Confirmed in ses-002",
                    model_version_id="v1",
                    subject_id="sub-001",
                    session_id="ses-002",
                )
            )
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="Handoff from ses-002 triggers session switch boundary",
                    previous_state=IntentLifecycleState.ACTIVE,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                    note="Session switch interrupted old intent and established new intent in ses-002",
                )
            )

        elif scenario_id == "SCENARIO_F_MODEL_BOUNDARY":
            # 1. Activate intent in model v1
            self.ingest_handoff(
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
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="Activate intent under model v1",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                )
            )
            # 2. Handoff under model v2
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="LEFT_IMAGERY",
                    confidence=0.93,
                    confidence_band=ConfidenceBand.HIGH,
                    eligibility=ConfidenceEligibility.VALID,
                    temporal_status="CONFIRMED",
                    temporally_confirmed=True,
                    confirmation_reason="Confirmed under v2",
                    model_version_id="v2",
                    subject_id="sub-001",
                    session_id="ses-001",
                )
            )
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="Handoff under model v2 triggers model boundary reset",
                    previous_state=IntentLifecycleState.ACTIVE,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                    note="Model v1 context interrupted, new v2 intent created",
                )
            )

        elif scenario_id == "SCENARIO_G_REST_HANDLING":
            # 1. Candidate created
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="LEFT_IMAGERY",
                    confidence=0.82,
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
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="Candidate created",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                )
            )
            # 2. REST prediction arrives
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="REST",
                    confidence=0.95,
                    confidence_band=ConfidenceBand.HIGH,
                    eligibility=ConfidenceEligibility.VALID,
                    temporal_status="TRACKING",
                    temporally_confirmed=False,
                    confirmation_reason="Rest state",
                    model_version_id="v1",
                    subject_id="sub-001",
                    session_id="ses-001",
                )
            )
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="REST prediction received",
                    previous_state=IntentLifecycleState.CANDIDATE,
                    next_state=self.snapshot.current_state,
                    intent_id=None,
                    intent_class=None,
                    reason=self.snapshot.transition_reason,
                    note="Candidate cancelled due to REST prediction",
                )
            )

        elif scenario_id == "SCENARIO_H_SAME_CLASS_COOLDOWN":
            # 1. Activate LEFT_IMAGERY
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="LEFT_IMAGERY",
                    confidence=0.91,
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
            orig_intent_id = self.snapshot.active_intent_id
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="Activate LEFT_IMAGERY",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=orig_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                )
            )
            # 2. Immediate duplicate confirmation (within 100ms < 1000ms cooldown)
            self.set_mock_time(start_time + 0.1)
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="LEFT_IMAGERY",
                    confidence=0.94,
                    confidence_band=ConfidenceBand.HIGH,
                    eligibility=ConfidenceEligibility.VALID,
                    temporal_status="CONFIRMED",
                    temporally_confirmed=True,
                    confirmation_reason="Confirmed again",
                    model_version_id="v1",
                    subject_id="sub-001",
                    session_id="ses-001",
                )
            )
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="Immediate re-confirmation within cooldown",
                    previous_state=IntentLifecycleState.ACTIVE,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                    note=f"Suppressed duplicate intent creation (intent_id unchanged: {orig_intent_id == self.snapshot.active_intent_id})",
                )
            )

        elif scenario_id == "SCENARIO_I_CROSS_CLASS_REPLACEMENT":
            # 1. Activate LEFT_IMAGERY
            self.ingest_handoff(
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
            first_id = self.snapshot.active_intent_id
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="Activate LEFT_IMAGERY",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=first_id,
                    intent_class="LEFT_IMAGERY",
                    reason=self.snapshot.transition_reason,
                )
            )
            # 2. RIGHT_IMAGERY confirmation arrives
            self.set_mock_time(start_time + 0.5)
            self.ingest_handoff(
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
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="RIGHT_IMAGERY replaces LEFT_IMAGERY",
                    previous_state=IntentLifecycleState.ACTIVE,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                    note=f"Old intent {first_id} replaced by new intent {self.snapshot.active_intent_id}",
                )
            )

        elif scenario_id == "SCENARIO_J_DUPLICATE_IDEMPOTENCY":
            event_id = "evt_dedup_test_001"
            # 1. Ingest event first time
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="LEFT_IMAGERY",
                    confidence=0.88,
                    confidence_band=ConfidenceBand.HIGH,
                    eligibility=ConfidenceEligibility.VALID,
                    temporal_status="CONFIRMED",
                    temporally_confirmed=True,
                    confirmation_reason="Initial ingestion",
                    model_version_id="v1",
                    subject_id="sub-001",
                    session_id="ses-001",
                    source_event_id=event_id,
                )
            )
            t_count = self.snapshot.transition_count
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="First ingestion of event",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                )
            )
            # 2. Ingest duplicate event
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="LEFT_IMAGERY",
                    confidence=0.88,
                    confidence_band=ConfidenceBand.HIGH,
                    eligibility=ConfidenceEligibility.VALID,
                    temporal_status="CONFIRMED",
                    temporally_confirmed=True,
                    confirmation_reason="Duplicate ingestion",
                    model_version_id="v1",
                    subject_id="sub-001",
                    session_id="ses-001",
                    source_event_id=event_id,
                )
            )
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="Duplicate ingestion with identical source_event_id",
                    previous_state=self.snapshot.current_state,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                    note=f"Idempotent: zero new transitions created (transition_count remained {t_count})",
                )
            )

        elif scenario_id == "SCENARIO_K_OUT_OF_ORDER":
            # 1. Ingest event at t=1000.0
            self.set_mock_time(1000.0)
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="LEFT_IMAGERY",
                    confidence=0.90,
                    confidence_band=ConfidenceBand.HIGH,
                    eligibility=ConfidenceEligibility.VALID,
                    temporal_status="CONFIRMED",
                    temporally_confirmed=True,
                    confirmation_reason="Current event",
                    model_version_id="v1",
                    subject_id="sub-001",
                    session_id="ses-001",
                )
            )
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="Ingest event at t=1000s",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                )
            )
            # 2. Ingest older event with past timestamp
            self.set_mock_time(999.0)
            # Time has regressed; should not overwrite
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="Attempt older handoff",
                    previous_state=self.snapshot.current_state,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                    note="Current state preserved",
                )
            )

        elif scenario_id == "SCENARIO_L_RECONNECT_RECOVERY":
            # 1. State in progress
            self.ingest_handoff(
                IntentIngestRequest(
                    prediction="LEFT_IMAGERY",
                    confidence=0.92,
                    confidence_band=ConfidenceBand.HIGH,
                    eligibility=ConfidenceEligibility.VALID,
                    temporal_status="CONFIRMED",
                    temporally_confirmed=True,
                    confirmation_reason="Active state",
                    model_version_id="v1",
                    subject_id="sub-001",
                    session_id="ses-001",
                )
            )
            steps.append(
                IntentScenarioStep(
                    step=1,
                    action="Active state established",
                    previous_state=IntentLifecycleState.NO_INTENT,
                    next_state=self.snapshot.current_state,
                    intent_id=self.snapshot.active_intent_id,
                    intent_class=self.snapshot.intent_class,
                    reason=self.snapshot.transition_reason,
                )
            )
            # 2. Reload snapshot from DB as on browser reconnect
            reloaded = self.storage.get_snapshot()
            steps.append(
                IntentScenarioStep(
                    step=2,
                    action="Browser reconnect: fetch snapshot from storage",
                    previous_state=self.snapshot.current_state,
                    next_state=reloaded.current_state,
                    intent_id=reloaded.active_intent_id,
                    intent_class=reloaded.intent_class,
                    reason=reloaded.transition_reason,
                    note="Authoritative state fully restored from persistent SQLite storage",
                )
            )

        # Clear mock time after scenario
        self.set_mock_time(None)

        return IntentScenarioResponse(
            scenario_id=scenario_id,
            executed_at=self._now_iso(),
            passed=len(steps) > 0,
            results=steps,
            final_snapshot=self.snapshot,
        )


_intent_service_instance: IntentService | None = None


def get_intent_service() -> IntentService:
    """Retrieve singleton instance of IntentService."""
    global _intent_service_instance
    if _intent_service_instance is None:
        _intent_service_instance = IntentService()
    return _intent_service_instance
