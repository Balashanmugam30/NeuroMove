"""SQLite persistence and transactional audit store for Safety Arbitration."""

from __future__ import annotations

import json
import logging

from ..database.connection import default_db_manager
from ..domain.enums import SafetyDecision
from .models import (
    SafetyArbitrationState,
    SafetyDiagnostics,
    SafetyEvaluation,
    SafetyRuleResult,
    SafetyStateSnapshot,
    SafetyStateTransition,
)
from .policies import SafetyPolicy

logger = logging.getLogger("neuromove.safety.storage")


class SafetyStorage:
    """Database persistence layer for safety policies, evaluations, transitions, and snapshots."""

    def __init__(self, db_manager=None) -> None:
        self.db = db_manager or default_db_manager

    def save_policy(self, policy: SafetyPolicy) -> None:
        """Persist or update versioned safety policy."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            params_dict = policy.model_dump()
            cursor.execute(
                """
                INSERT OR REPLACE INTO safety_policies (
                    policy_id, version, allowlisted_intents_json, blocked_intents_json,
                    max_intent_age_ms, max_evaluation_age_ms, max_context_age_ms,
                    max_authorized_duration_ms, maximum_command_rate, rate_window_ms,
                    minimum_command_gap_ms, critical_health_requirements_json,
                    operator_hold_enabled, emergency_stop_enabled, lockout_threshold,
                    lockout_policy, reset_requirements_json, parameters_json, created_at, checksum
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    policy.policy_id,
                    policy.version,
                    json.dumps(policy.allowlisted_intents),
                    json.dumps(policy.blocked_intents),
                    policy.max_intent_age_ms,
                    policy.max_evaluation_age_ms,
                    policy.max_context_age_ms,
                    policy.max_authorized_duration_ms,
                    policy.maximum_command_rate,
                    policy.rate_window_ms,
                    policy.minimum_command_gap_ms,
                    json.dumps(policy.critical_health_requirements),
                    1 if policy.operator_hold_enabled else 0,
                    1 if policy.emergency_stop_enabled else 0,
                    policy.lockout_threshold,
                    policy.lockout_policy,
                    json.dumps(policy.reset_requirements),
                    json.dumps(params_dict),
                    policy.created_at,
                    policy.checksum,
                ),
            )
            conn.commit()

    def get_policy(self, policy_id: str) -> SafetyPolicy | None:
        """Fetch safety policy by ID."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT parameters_json FROM safety_policies WHERE policy_id = ?;",
                (policy_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return SafetyPolicy(**json.loads(row[0]))

    def get_active_policy(self) -> SafetyPolicy | None:
        """Fetch latest active safety policy."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT parameters_json FROM safety_policies ORDER BY created_at DESC LIMIT 1;"
            )
            row = cursor.fetchone()
            if not row:
                return None
            return SafetyPolicy(**json.loads(row[0]))

    def save_evaluation(self, evaluation: SafetyEvaluation) -> None:
        """Atomically persist safety evaluation and its constituent rule outcomes."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO safety_evaluations (
                    evaluation_id, decision, safety_state, primary_reason, precedence_rank,
                    all_reasons_json, violated_rules_json, passed_rules_json, policy_version,
                    intent_id, intent_class, subject_id, session_id, model_version_id,
                    confidence_score, confidence_evaluation_id, temporal_confirmation_id,
                    evaluated_at, duration_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    evaluation.evaluation_id,
                    evaluation.decision.value,
                    evaluation.state.value,
                    evaluation.primary_reason,
                    evaluation.precedence_rank,
                    json.dumps(evaluation.all_reasons),
                    json.dumps([r.model_dump() for r in evaluation.violated_rules]),
                    json.dumps([r.model_dump() for r in evaluation.passed_rules]),
                    evaluation.policy_version,
                    evaluation.intent_id,
                    evaluation.intent_class,
                    evaluation.subject_id,
                    evaluation.session_id,
                    evaluation.model_version_id,
                    evaluation.confidence_score,
                    evaluation.confidence_evaluation_id,
                    evaluation.temporal_confirmation_id,
                    evaluation.evaluated_at,
                    evaluation.duration_ms,
                ),
            )

            # Insert rule results
            all_results = evaluation.passed_rules + evaluation.violated_rules
            for idx, r in enumerate(all_results):
                result_id = f"{evaluation.evaluation_id}_r{idx:02d}_{r.rule_id}"
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO safety_rule_results (
                        result_id, evaluation_id, rule_id, category, status, severity,
                        reason_code, message, evidence_json, evaluated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        result_id,
                        evaluation.evaluation_id,
                        r.rule_id,
                        r.category,
                        r.status.value,
                        r.severity.value,
                        r.reason_code,
                        r.message,
                        json.dumps(r.evidence),
                        r.evaluated_at,
                    ),
                )
            conn.commit()

    def get_evaluations(
        self, limit: int = 100, decision: str | None = None
    ) -> list[SafetyEvaluation]:
        """Fetch historical evaluation records."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            if decision:
                cursor.execute(
                    """
                    SELECT evaluation_id, decision, safety_state, primary_reason, precedence_rank,
                           all_reasons_json, violated_rules_json, passed_rules_json, policy_version,
                           intent_id, intent_class, subject_id, session_id, model_version_id,
                           confidence_score, confidence_evaluation_id, temporal_confirmation_id,
                           evaluated_at, duration_ms
                    FROM safety_evaluations
                    WHERE decision = ?
                    ORDER BY evaluated_at DESC LIMIT ?;
                    """,
                    (decision, limit),
                )
            else:
                cursor.execute(
                    """
                    SELECT evaluation_id, decision, safety_state, primary_reason, precedence_rank,
                           all_reasons_json, violated_rules_json, passed_rules_json, policy_version,
                           intent_id, intent_class, subject_id, session_id, model_version_id,
                           confidence_score, confidence_evaluation_id, temporal_confirmation_id,
                           evaluated_at, duration_ms
                    FROM safety_evaluations
                    ORDER BY evaluated_at DESC LIMIT ?;
                    """,
                    (limit,),
                )

            records: list[SafetyEvaluation] = []
            for row in cursor.fetchall():
                records.append(
                    SafetyEvaluation(
                        evaluation_id=row[0],
                        decision=SafetyDecision(row[1]),
                        state=SafetyArbitrationState(row[2]),
                        primary_reason=row[3],
                        precedence_rank=row[4],
                        all_reasons=json.loads(row[5]),
                        violated_rules=[SafetyRuleResult(**r) for r in json.loads(row[6])],
                        passed_rules=[SafetyRuleResult(**r) for r in json.loads(row[7])],
                        policy_version=row[8],
                        intent_id=row[9],
                        intent_class=row[10],
                        subject_id=row[11],
                        session_id=row[12],
                        model_version_id=row[13],
                        confidence_score=row[14],
                        confidence_evaluation_id=row[15],
                        temporal_confirmation_id=row[16],
                        evaluated_at=row[17],
                        duration_ms=row[18],
                    )
                )
            return records

    def get_evaluation(self, evaluation_id: str) -> SafetyEvaluation | None:
        """Fetch single evaluation record by ID."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT evaluation_id, decision, safety_state, primary_reason, precedence_rank,
                       all_reasons_json, violated_rules_json, passed_rules_json, policy_version,
                       intent_id, intent_class, subject_id, session_id, model_version_id,
                       confidence_score, confidence_evaluation_id, temporal_confirmation_id,
                       evaluated_at, duration_ms
                FROM safety_evaluations
                WHERE evaluation_id = ?;
                """,
                (evaluation_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return SafetyEvaluation(
                evaluation_id=row[0],
                decision=SafetyDecision(row[1]),
                state=SafetyArbitrationState(row[2]),
                primary_reason=row[3],
                precedence_rank=row[4],
                all_reasons=json.loads(row[5]),
                violated_rules=[SafetyRuleResult(**r) for r in json.loads(row[6])],
                passed_rules=[SafetyRuleResult(**r) for r in json.loads(row[7])],
                policy_version=row[8],
                intent_id=row[9],
                intent_class=row[10],
                subject_id=row[11],
                session_id=row[12],
                model_version_id=row[13],
                confidence_score=row[14],
                confidence_evaluation_id=row[15],
                temporal_confirmation_id=row[16],
                evaluated_at=row[17],
                duration_ms=row[18],
            )

    def save_transition(self, transition: SafetyStateTransition) -> None:
        """Append state machine transition to immutable audit log."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO safety_state_transitions (
                    transition_id, sequence_number, previous_state, next_state,
                    trigger_name, reason, evaluation_id, intent_id, policy_version,
                    timestamp, details
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    transition.transition_id,
                    transition.sequence_number,
                    transition.previous_state.value,
                    transition.next_state.value,
                    transition.trigger_name,
                    transition.reason,
                    transition.evaluation_id,
                    transition.intent_id,
                    transition.policy_version,
                    transition.timestamp,
                    json.dumps(transition.details) if transition.details else None,
                ),
            )
            conn.commit()

    def get_transitions(self, limit: int = 100) -> list[SafetyStateTransition]:
        """Fetch transition history in reverse chronological order."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT transition_id, sequence_number, previous_state, next_state,
                       trigger_name, reason, evaluation_id, intent_id, policy_version,
                       timestamp, details
                FROM safety_state_transitions
                ORDER BY sequence_number DESC LIMIT ?;
                """,
                (limit,),
            )
            transitions: list[SafetyStateTransition] = []
            for row in cursor.fetchall():
                transitions.append(
                    SafetyStateTransition(
                        transition_id=row[0],
                        sequence_number=row[1],
                        previous_state=SafetyArbitrationState(row[2]),
                        next_state=SafetyArbitrationState(row[3]),
                        trigger_name=row[4],
                        reason=row[5],
                        evaluation_id=row[6],
                        intent_id=row[7],
                        policy_version=row[8],
                        timestamp=row[9],
                        details=json.loads(row[10]) if row[10] else None,
                    )
                )
            return transitions

    def save_snapshot(self, snapshot: SafetyStateSnapshot) -> None:
        """Persist authoritative state snapshot."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO safety_snapshots (
                    snapshot_id, current_state, last_decision, active_intent_id,
                    intent_class, primary_reason, active_policy_version, emergency_stop,
                    emergency_stop_reason, operator_hold, operator_id, lockout,
                    lockout_reason, system_healthy, stream_healthy, last_evaluation_id,
                    state_deadline, transition_count, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    snapshot.snapshot_id,
                    snapshot.current_state.value,
                    snapshot.last_decision.value,
                    snapshot.active_intent_id,
                    snapshot.intent_class,
                    snapshot.primary_reason,
                    snapshot.active_policy_version,
                    1 if snapshot.emergency_stop else 0,
                    snapshot.emergency_stop_reason,
                    1 if snapshot.operator_hold else 0,
                    snapshot.operator_id,
                    1 if snapshot.lockout else 0,
                    snapshot.lockout_reason,
                    1 if snapshot.system_healthy else 0,
                    1 if snapshot.stream_healthy else 0,
                    snapshot.last_evaluation_id,
                    snapshot.state_deadline,
                    snapshot.transition_count,
                    snapshot.created_at,
                    snapshot.updated_at,
                ),
            )
            conn.commit()

    def get_current_snapshot(self) -> SafetyStateSnapshot | None:
        """Retrieve most recent safety state snapshot."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT snapshot_id, current_state, last_decision, active_intent_id,
                       intent_class, primary_reason, active_policy_version, emergency_stop,
                       emergency_stop_reason, operator_hold, operator_id, lockout,
                       lockout_reason, system_healthy, stream_healthy, last_evaluation_id,
                       state_deadline, transition_count, created_at, updated_at
                FROM safety_snapshots
                ORDER BY updated_at DESC LIMIT 1;
                """
            )
            row = cursor.fetchone()
            if not row:
                return None
            return SafetyStateSnapshot(
                snapshot_id=row[0],
                current_state=SafetyArbitrationState(row[1]),
                last_decision=SafetyDecision(row[2]),
                active_intent_id=row[3],
                intent_class=row[4],
                primary_reason=row[5],
                active_policy_version=row[6],
                emergency_stop=bool(row[7]),
                emergency_stop_reason=row[8],
                operator_hold=bool(row[9]),
                operator_id=row[10],
                lockout=bool(row[11]),
                lockout_reason=row[12],
                system_healthy=bool(row[13]),
                stream_healthy=bool(row[14]),
                last_evaluation_id=row[15],
                state_deadline=row[16],
                transition_count=row[17],
                created_at=row[18],
                updated_at=row[19],
            )

    def get_diagnostics(self) -> SafetyDiagnostics:
        """Compute operational metrics from historical evaluation and state records."""
        diag = SafetyDiagnostics()
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            # Evaluation counts by decision
            cursor.execute("SELECT decision, COUNT(*) FROM safety_evaluations GROUP BY decision;")
            for dec, count in cursor.fetchall():
                diag.evaluation_count += count
                if dec == SafetyDecision.AUTHORIZED.value:
                    diag.authorized_count = count
                elif dec == SafetyDecision.HELD.value:
                    diag.held_count = count
                elif dec == SafetyDecision.DENIED.value:
                    diag.denied_count = count
                elif dec == SafetyDecision.EMERGENCY_STOP.value:
                    diag.emergency_stop_count = count
                elif dec == SafetyDecision.LOCKED_OUT.value:
                    diag.lockout_count = count

            # Top denial reasons
            cursor.execute(
                """
                SELECT primary_reason, COUNT(*) as cnt
                FROM safety_evaluations
                WHERE decision IN ('DENIED', 'LOCKED_OUT', 'EMERGENCY_STOP')
                GROUP BY primary_reason
                ORDER BY cnt DESC LIMIT 5;
                """
            )
            for reason, count in cursor.fetchall():
                diag.top_denial_reasons[reason] = count

            # Health failure and rate limit violation counts
            cursor.execute(
                """
                SELECT COUNT(*) FROM safety_rule_results
                WHERE category = 'HEALTH' AND status != 'PASS';
                """
            )
            row = cursor.fetchone()
            if row:
                diag.health_failures = row[0]

            cursor.execute(
                """
                SELECT COUNT(*) FROM safety_rule_results
                WHERE category = 'RATE_LIMIT' AND status != 'PASS';
                """
            )
            row = cursor.fetchone()
            if row:
                diag.rate_limit_violations = row[0]

        return diag

    def recover_state_on_startup(
        self,
    ) -> tuple[SafetyArbitrationState, int, bool, str | None, bool, str | None]:
        """Recover persistent state on startup.

        Returns (state, sequence_number, is_e_stop, e_stop_reason, is_lockout, lockout_reason).
        Ensures EMERGENCY_STOP and LOCKED_OUT are never cleared by a process restart.
        """
        snapshot = self.get_current_snapshot()
        if not snapshot:
            return (SafetyArbitrationState.SAFE_IDLE, 0, False, None, False, None)

        seq = snapshot.transition_count
        # Preserve restrictive terminal conditions
        if (
            snapshot.emergency_stop
            or snapshot.current_state == SafetyArbitrationState.EMERGENCY_STOP
        ):
            logger.warning("Startup recovery: Restoring persistent EMERGENCY_STOP state.")
            return (
                SafetyArbitrationState.EMERGENCY_STOP,
                seq,
                True,
                snapshot.emergency_stop_reason or "Recovered active emergency stop from database.",
                snapshot.lockout,
                snapshot.lockout_reason,
            )

        if snapshot.lockout or snapshot.current_state == SafetyArbitrationState.LOCKED_OUT:
            logger.warning("Startup recovery: Restoring persistent LOCKED_OUT state.")
            return (
                SafetyArbitrationState.LOCKED_OUT,
                seq,
                False,
                None,
                True,
                snapshot.lockout_reason or "Recovered active lockout state from database.",
            )

        # Default safe recovery for non-restrictive states is SAFE_IDLE
        return (SafetyArbitrationState.SAFE_IDLE, seq, False, None, False, None)
