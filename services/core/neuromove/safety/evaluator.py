"""Deterministic rule evaluator and explicit precedence resolver for Safety Arbitration."""

from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime
from typing import Any

from ..domain.enums import SafetyDecision
from .context import SafetyContext
from .models import (
    PrecedenceRank,
    RuleStatus,
    SafetyArbitrationState,
    SafetyEvaluation,
    SafetyRuleResult,
)
from .policies import SafetyPolicy
from .rules import DEFAULT_SAFETY_RULES, BaseSafetyRule


def generate_evaluation_id() -> str:
    """Generate a unique audit identifier for a safety evaluation."""
    return f"eval_{uuid.uuid4().hex[:12]}"


class SafetyRuleEngine:
    """Evaluates modular safety rules and resolves deterministic precedence."""

    def __init__(self, rules: list[BaseSafetyRule] | None = None) -> None:
        self.rules: list[BaseSafetyRule] = rules if rules is not None else DEFAULT_SAFETY_RULES

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyEvaluation:
        """Run all configured safety rules and resolve conflicts via fail-safe precedence."""
        start_time = time.perf_counter()
        eval_time_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )

        passed_rules: list[SafetyRuleResult] = []
        violated_rules: list[tuple[BaseSafetyRule, SafetyRuleResult]] = []

        # 1. Run all rules deterministically
        for rule in self.rules:
            res = rule.evaluate(intent_snapshot, context, policy, now_ts=now_ts)
            if res.status == RuleStatus.PASS:
                passed_rules.append(res)
            else:
                violated_rules.append((rule, res))

        # 2. Determine outcome based on precedence hierarchy
        all_reasons = [r[1].message for r in violated_rules]

        if not violated_rules:
            # Clean pass: all gates satisfied
            decision = SafetyDecision.AUTHORIZED
            state = SafetyArbitrationState.AUTHORIZED
            primary_reason = (
                "All configured software safety constraints pass. "
                "Admissible for downstream execution consideration."
            )
            precedence_rank = int(PrecedenceRank.AUTHORIZED)
        else:
            # Sort violations by PrecedenceRank (ascending order, 1 is highest priority)
            violated_rules.sort(key=lambda item: int(item[0].precedence_rank))
            winning_rule, winning_result = violated_rules[0]
            precedence_rank = int(winning_rule.precedence_rank)
            primary_reason = winning_result.message

            if precedence_rank == PrecedenceRank.EMERGENCY_STOP:
                decision = SafetyDecision.EMERGENCY_STOP
                state = SafetyArbitrationState.EMERGENCY_STOP
            elif precedence_rank == PrecedenceRank.LOCKED_OUT:
                decision = SafetyDecision.LOCKED_OUT
                state = SafetyArbitrationState.LOCKED_OUT
            elif precedence_rank == PrecedenceRank.INVALID_INPUT:
                decision = SafetyDecision.INVALID
                state = SafetyArbitrationState.DENIED
            elif precedence_rank == PrecedenceRank.CRITICAL_HEALTH:
                decision = SafetyDecision.DENIED
                state = SafetyArbitrationState.DENIED
            elif precedence_rank == PrecedenceRank.HARD_CONSTRAINT:
                decision = SafetyDecision.DENIED
                state = SafetyArbitrationState.DENIED
            elif precedence_rank == PrecedenceRank.CONTEXT_STALE:
                decision = SafetyDecision.DENIED
                state = SafetyArbitrationState.DENIED
            elif precedence_rank == PrecedenceRank.OPERATOR_HOLD:
                decision = SafetyDecision.HELD
                state = SafetyArbitrationState.HELD
            elif precedence_rank == PrecedenceRank.TEMPORARY_HOLD:
                decision = SafetyDecision.HELD
                state = SafetyArbitrationState.HELD
            else:
                decision = SafetyDecision.DENIED
                state = SafetyArbitrationState.DENIED

        duration_ms = (time.perf_counter() - start_time) * 1000.0

        # Extract provenance from intent snapshot
        intent_id = (intent_snapshot or {}).get("intent_id") or (intent_snapshot or {}).get(
            "active_intent_id"
        )
        intent_class = (intent_snapshot or {}).get("intent_class")
        subject_id = (intent_snapshot or {}).get("subject_id")
        session_id = (intent_snapshot or {}).get("session_id")
        model_version_id = (intent_snapshot or {}).get("model_version_id")
        confidence_score = (intent_snapshot or {}).get("confidence_score")
        confidence_eval_id = (intent_snapshot or {}).get("confidence_evaluation_id")
        temporal_conf_id = (intent_snapshot or {}).get("temporal_confirmation_id")

        return SafetyEvaluation(
            evaluation_id=generate_evaluation_id(),
            decision=decision,
            state=state,
            primary_reason=primary_reason,
            precedence_rank=precedence_rank,
            all_reasons=all_reasons,
            violated_rules=[v[1] for v in violated_rules],
            passed_rules=passed_rules,
            policy_version=policy.version,
            intent_id=intent_id,
            intent_class=intent_class,
            subject_id=subject_id,
            session_id=session_id,
            model_version_id=model_version_id,
            confidence_score=confidence_score,
            confidence_evaluation_id=confidence_eval_id,
            temporal_confirmation_id=temporal_conf_id,
            evaluated_at=eval_time_iso,
            duration_ms=round(duration_ms, 3),
        )

    def replay_evaluation(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyEvaluation:
        """Deterministically replay and reproduce an arbitration decision."""
        return self.evaluate(intent_snapshot, context, policy, now_ts=now_ts)
