"""SQLite persistence layer for Canonical Intent State Machine & Lifecycle (Phase 16)."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from neuromove.confidence.models import ConfidenceBand, ConfidenceEligibility
from neuromove.database.connection import default_db_manager
from neuromove.intent.models import (
    IntentLifecycleState,
    IntentPolicy,
    IntentRecord,
    IntentStateSnapshot,
    IntentStateTransition,
    IntentTransitionReason,
    IntentTransitionTrigger,
)

logger = logging.getLogger(__name__)


class IntentStorage:
    """Repository handling ACID SQLite storage for Intent policies, records, transitions, and snapshots."""

    def __init__(self) -> None:
        self.db = default_db_manager

    # -------------------------------------------------------------------------
    # Policy Storage
    # -------------------------------------------------------------------------
    def get_policy(self, policy_id: str = "default_intent_policy") -> IntentPolicy:
        """Retrieve active intent policy from database, or fallback to default."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT policy_id, version, candidate_timeout_ms, confirmation_acceptance_window_ms,
                       active_intent_timeout_ms, allow_replacement, replacement_requires_confirmation,
                       same_class_reconfirmation_cooldown_ms, cross_class_replacement_policy,
                       subject_change_policy, session_change_policy, model_change_policy,
                       rest_handling_policy, parameters_json, created_at, checksum
                FROM intent_policies
                WHERE policy_id = ?
                """,
                (policy_id,),
            )
            row = cursor.fetchone()
            if not row:
                default_policy = IntentPolicy()
                checksum = default_policy.compute_checksum()
                default_policy = default_policy.model_copy(update={"checksum": checksum})
                self.save_policy(default_policy)
                return default_policy

            return IntentPolicy(
                policy_id=row["policy_id"],
                version=row["version"],
                candidate_timeout_ms=row["candidate_timeout_ms"],
                confirmation_acceptance_window_ms=row["confirmation_acceptance_window_ms"],
                active_intent_timeout_ms=row["active_intent_timeout_ms"],
                allow_replacement=bool(row["allow_replacement"]),
                replacement_requires_confirmation=bool(row["replacement_requires_confirmation"]),
                same_class_reconfirmation_cooldown_ms=row["same_class_reconfirmation_cooldown_ms"],
                cross_class_replacement_policy=row["cross_class_replacement_policy"],
                subject_change_policy=row["subject_change_policy"],
                session_change_policy=row["session_change_policy"],
                model_change_policy=row["model_change_policy"],
                rest_handling_policy=row["rest_handling_policy"],
                parameters=json.loads(row["parameters_json"]),
                created_at=row["created_at"],
                checksum=row["checksum"],
            )

    def save_policy(self, policy: IntentPolicy) -> None:
        """Persist or update an intent policy."""
        checksum = policy.compute_checksum()
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO intent_policies (
                    policy_id, version, candidate_timeout_ms, confirmation_acceptance_window_ms,
                    active_intent_timeout_ms, allow_replacement, replacement_requires_confirmation,
                    same_class_reconfirmation_cooldown_ms, cross_class_replacement_policy,
                    subject_change_policy, session_change_policy, model_change_policy,
                    rest_handling_policy, parameters_json, created_at, checksum
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(policy_id) DO UPDATE SET
                    version = excluded.version,
                    candidate_timeout_ms = excluded.candidate_timeout_ms,
                    confirmation_acceptance_window_ms = excluded.confirmation_acceptance_window_ms,
                    active_intent_timeout_ms = excluded.active_intent_timeout_ms,
                    allow_replacement = excluded.allow_replacement,
                    replacement_requires_confirmation = excluded.replacement_requires_confirmation,
                    same_class_reconfirmation_cooldown_ms = excluded.same_class_reconfirmation_cooldown_ms,
                    cross_class_replacement_policy = excluded.cross_class_replacement_policy,
                    subject_change_policy = excluded.subject_change_policy,
                    session_change_policy = excluded.session_change_policy,
                    model_change_policy = excluded.model_change_policy,
                    rest_handling_policy = excluded.rest_handling_policy,
                    parameters_json = excluded.parameters_json,
                    checksum = excluded.checksum
                """,
                (
                    policy.policy_id,
                    policy.version,
                    policy.candidate_timeout_ms,
                    policy.confirmation_acceptance_window_ms,
                    policy.active_intent_timeout_ms,
                    1 if policy.allow_replacement else 0,
                    1 if policy.replacement_requires_confirmation else 0,
                    policy.same_class_reconfirmation_cooldown_ms,
                    policy.cross_class_replacement_policy,
                    policy.subject_change_policy,
                    policy.session_change_policy,
                    policy.model_change_policy,
                    policy.rest_handling_policy,
                    json.dumps(policy.parameters),
                    policy.created_at,
                    checksum,
                ),
            )
            conn.commit()

    # -------------------------------------------------------------------------
    # Snapshot Storage
    # -------------------------------------------------------------------------
    def get_snapshot(
        self, snapshot_id: str = "current_authoritative_snapshot"
    ) -> IntentStateSnapshot:
        """Retrieve current authoritative state snapshot."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT snapshot_id, active_intent_id, current_state, intent_class,
                       subject_id, session_id, model_version_id, confidence_score,
                       confidence_evaluation_id, temporal_confirmation_id,
                       created_at, updated_at, state_deadline, transition_reason,
                       policy_version, transition_count
                FROM intent_snapshots
                WHERE snapshot_id = ?
                """,
                (snapshot_id,),
            )
            row = cursor.fetchone()
            if not row:
                now_str = datetime.now(UTC).isoformat()
                initial = IntentStateSnapshot(
                    snapshot_id=snapshot_id,
                    active_intent_id=None,
                    current_state=IntentLifecycleState.NO_INTENT,
                    intent_class=None,
                    created_at=now_str,
                    updated_at=now_str,
                    transition_reason=IntentTransitionReason.STATE_RESTORE,
                )
                self.save_snapshot(initial)
                return initial

            return IntentStateSnapshot(
                snapshot_id=row["snapshot_id"],
                active_intent_id=row["active_intent_id"],
                current_state=IntentLifecycleState(row["current_state"]),
                intent_class=row["intent_class"],
                subject_id=row["subject_id"],
                session_id=row["session_id"],
                model_version_id=row["model_version_id"],
                confidence_score=row["confidence_score"],
                confidence_evaluation_id=row["confidence_evaluation_id"],
                temporal_confirmation_id=row["temporal_confirmation_id"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                state_deadline=row["state_deadline"],
                transition_reason=IntentTransitionReason(row["transition_reason"]),
                policy_version=row["policy_version"],
                transition_count=row["transition_count"],
            )

    def save_snapshot(self, snapshot: IntentStateSnapshot) -> None:
        """Save authoritative state snapshot."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO intent_snapshots (
                    snapshot_id, active_intent_id, current_state, intent_class,
                    subject_id, session_id, model_version_id, confidence_score,
                    confidence_evaluation_id, temporal_confirmation_id,
                    created_at, updated_at, state_deadline, transition_reason,
                    policy_version, transition_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(snapshot_id) DO UPDATE SET
                    active_intent_id = excluded.active_intent_id,
                    current_state = excluded.current_state,
                    intent_class = excluded.intent_class,
                    subject_id = excluded.subject_id,
                    session_id = excluded.session_id,
                    model_version_id = excluded.model_version_id,
                    confidence_score = excluded.confidence_score,
                    confidence_evaluation_id = excluded.confidence_evaluation_id,
                    temporal_confirmation_id = excluded.temporal_confirmation_id,
                    updated_at = excluded.updated_at,
                    state_deadline = excluded.state_deadline,
                    transition_reason = excluded.transition_reason,
                    policy_version = excluded.policy_version,
                    transition_count = excluded.transition_count
                """,
                (
                    snapshot.snapshot_id,
                    snapshot.active_intent_id,
                    snapshot.current_state.value,
                    snapshot.intent_class,
                    snapshot.subject_id,
                    snapshot.session_id,
                    snapshot.model_version_id,
                    snapshot.confidence_score,
                    snapshot.confidence_evaluation_id,
                    snapshot.temporal_confirmation_id,
                    snapshot.created_at,
                    snapshot.updated_at,
                    snapshot.state_deadline,
                    snapshot.transition_reason.value,
                    snapshot.policy_version,
                    snapshot.transition_count,
                ),
            )
            conn.commit()

    # -------------------------------------------------------------------------
    # Intent Record Storage
    # -------------------------------------------------------------------------
    def save_intent_record(self, record: IntentRecord) -> None:
        """Persist or update an intent record."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO intent_records (
                    intent_id, intent_class, current_state, subject_id, session_id,
                    model_version_id, confidence_score, confidence_band, eligibility,
                    source_event_id, confidence_evaluation_id, temporal_confirmation_id,
                    created_at, updated_at, state_deadline, is_terminal,
                    terminal_reason, policy_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(intent_id) DO UPDATE SET
                    current_state = excluded.current_state,
                    updated_at = excluded.updated_at,
                    state_deadline = excluded.state_deadline,
                    is_terminal = excluded.is_terminal,
                    terminal_reason = excluded.terminal_reason
                """,
                (
                    record.intent_id,
                    record.intent_class,
                    record.current_state.value,
                    record.subject_id,
                    record.session_id,
                    record.model_version_id,
                    record.confidence_score,
                    record.confidence_band.value,
                    record.eligibility.value,
                    record.source_event_id,
                    record.confidence_evaluation_id,
                    record.temporal_confirmation_id,
                    record.created_at,
                    record.updated_at,
                    record.state_deadline,
                    1 if record.is_terminal else 0,
                    record.terminal_reason.value if record.terminal_reason else None,
                    record.policy_version,
                ),
            )
            conn.commit()

    def get_intent_record(self, intent_id: str) -> IntentRecord | None:
        """Fetch a specific intent record by ID."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT intent_id, intent_class, current_state, subject_id, session_id,
                       model_version_id, confidence_score, confidence_band, eligibility,
                       source_event_id, confidence_evaluation_id, temporal_confirmation_id,
                       created_at, updated_at, state_deadline, is_terminal,
                       terminal_reason, policy_version
                FROM intent_records
                WHERE intent_id = ?
                """,
                (intent_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return IntentRecord(
                intent_id=row["intent_id"],
                intent_class=row["intent_class"],
                current_state=IntentLifecycleState(row["current_state"]),
                subject_id=row["subject_id"],
                session_id=row["session_id"],
                model_version_id=row["model_version_id"],
                confidence_score=row["confidence_score"],
                confidence_band=ConfidenceBand(row["confidence_band"]),
                eligibility=ConfidenceEligibility(row["eligibility"]),
                source_event_id=row["source_event_id"],
                confidence_evaluation_id=row["confidence_evaluation_id"],
                temporal_confirmation_id=row["temporal_confirmation_id"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                state_deadline=row["state_deadline"],
                is_terminal=bool(row["is_terminal"]),
                terminal_reason=IntentTransitionReason(row["terminal_reason"])
                if row["terminal_reason"]
                else None,
                policy_version=row["policy_version"],
            )

    def get_intent_records(
        self,
        limit: int = 50,
        state: IntentLifecycleState | None = None,
        subject_id: str | None = None,
    ) -> list[IntentRecord]:
        """Fetch historical intent records with optional filtering."""
        query = "SELECT * FROM intent_records WHERE 1=1"
        params: list[Any] = []
        if state:
            query += " AND current_state = ?"
            params.append(state.value)
        if subject_id:
            query += " AND subject_id = ?"
            params.append(subject_id)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()
            return [
                IntentRecord(
                    intent_id=r["intent_id"],
                    intent_class=r["intent_class"],
                    current_state=IntentLifecycleState(r["current_state"]),
                    subject_id=r["subject_id"],
                    session_id=r["session_id"],
                    model_version_id=r["model_version_id"],
                    confidence_score=r["confidence_score"],
                    confidence_band=ConfidenceBand(r["confidence_band"]),
                    eligibility=ConfidenceEligibility(r["eligibility"]),
                    source_event_id=r["source_event_id"],
                    confidence_evaluation_id=r["confidence_evaluation_id"],
                    temporal_confirmation_id=r["temporal_confirmation_id"],
                    created_at=r["created_at"],
                    updated_at=r["updated_at"],
                    state_deadline=r["state_deadline"],
                    is_terminal=bool(r["is_terminal"]),
                    terminal_reason=IntentTransitionReason(r["terminal_reason"])
                    if r["terminal_reason"]
                    else None,
                    policy_version=r["policy_version"],
                )
                for r in rows
            ]

    # -------------------------------------------------------------------------
    # Transition History Storage
    # -------------------------------------------------------------------------
    def record_transition(self, transition: IntentStateTransition) -> None:
        """Persist an immutable state transition record."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO intent_state_transitions (
                    transition_id, sequence_number, intent_id, intent_class,
                    previous_state, next_state, trigger_name, reason,
                    subject_id, session_id, model_version_id, source_event_id,
                    confidence_score, policy_version, timestamp, details
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    transition.transition_id,
                    transition.sequence_number,
                    transition.intent_id,
                    transition.intent_class,
                    transition.previous_state.value,
                    transition.next_state.value,
                    transition.trigger.value,
                    transition.reason.value,
                    transition.subject_id,
                    transition.session_id,
                    transition.model_version_id,
                    transition.source_event_id,
                    transition.confidence_score,
                    transition.policy_version,
                    transition.timestamp,
                    transition.details,
                ),
            )
            conn.commit()

    def get_transition_history(
        self,
        limit: int = 50,
        intent_id: str | None = None,
    ) -> list[IntentStateTransition]:
        """Fetch transition history."""
        query = "SELECT * FROM intent_state_transitions"
        params: list[Any] = []
        if intent_id:
            query += " WHERE intent_id = ?"
            params.append(intent_id)
        query += " ORDER BY sequence_number DESC LIMIT ?"
        params.append(limit)

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()
            return [
                IntentStateTransition(
                    transition_id=r["transition_id"],
                    sequence_number=r["sequence_number"],
                    intent_id=r["intent_id"],
                    intent_class=r["intent_class"],
                    previous_state=IntentLifecycleState(r["previous_state"]),
                    next_state=IntentLifecycleState(r["next_state"]),
                    trigger=IntentTransitionTrigger(r["trigger_name"]),
                    reason=IntentTransitionReason(r["reason"]),
                    subject_id=r["subject_id"],
                    session_id=r["session_id"],
                    model_version_id=r["model_version_id"],
                    source_event_id=r["source_event_id"],
                    confidence_score=r["confidence_score"],
                    policy_version=r["policy_version"],
                    timestamp=r["timestamp"],
                    details=r["details"],
                )
                for r in rows
            ]

    def has_processed_source_event(self, source_event_id: str) -> bool:
        """Check if an upstream source event has already triggered a transition (idempotency guard)."""
        if not source_event_id:
            return False
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM intent_state_transitions WHERE source_event_id = ?",
                (source_event_id,),
            )
            count = cursor.fetchone()[0]
            return count > 0
