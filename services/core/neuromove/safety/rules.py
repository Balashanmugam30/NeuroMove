"""Modular safety rules suite and legacy SafetyArbitrator compatibility layer."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from ..domain.enums import Intent, RiskLevel, SafetyDecision
from ..domain.models import SignalQuality
from .context import SafetyContext
from .models import PrecedenceRank, RuleSeverity, RuleStatus, SafetyRuleResult
from .policies import SafetyPolicy

# --- Legacy SafetyArbitrator (Preserved for backward compatibility) ---


class SafetyArbitrator:
    """Evaluates candidate intents against signal quality, risk, and boundaries."""

    def __init__(
        self,
        min_confidence_threshold: float = 0.65,
        min_signal_quality_threshold: float = 0.50,
    ) -> None:
        self.min_confidence = min_confidence_threshold
        self.min_signal_quality = min_signal_quality_threshold

    def evaluate_intent(
        self,
        intent: Intent,
        confidence: float,
        signal_quality: SignalQuality,
        risk_level: RiskLevel = RiskLevel.SAFE,
    ) -> tuple[SafetyDecision, str]:
        """Arbitrate candidate intent against safety thresholds."""
        if risk_level == RiskLevel.CRITICAL:
            return SafetyDecision.STOP, "Critical environmental or hardware risk active."

        if intent == Intent.STOP:
            return SafetyDecision.STOP, "Explicit STOP intent requested."

        if intent == Intent.NONE or intent == Intent.UNCERTAIN:
            return SafetyDecision.BLOCKED, f"Intent '{intent.value}' cannot be executed."

        if signal_quality.overall_score < self.min_signal_quality:
            return (
                SafetyDecision.BLOCKED,
                f"Signal quality {signal_quality.overall_score:.2f} below threshold {self.min_signal_quality:.2f}",
            )

        if confidence < self.min_confidence:
            return (
                SafetyDecision.BLOCKED,
                f"Confidence {confidence:.2f} below minimum threshold {self.min_confidence:.2f}",
            )

        return (
            SafetyDecision.APPROVED,
            "Intent satisfies confidence, signal quality, and risk gates.",
        )


# --- Phase 17 Modular Rule Engine Base & 13 Safety Rules ---


class BaseSafetyRule:
    """Abstract base class for deterministic software safety rules."""

    rule_id: str
    category: str
    precedence_rank: PrecedenceRank

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        raise NotImplementedError


class EmergencyStopRule(BaseSafetyRule):
    """Rule 1: Enforces active software emergency-stop state."""

    rule_id = "RULE_01_EMERGENCY_STOP"
    category = "EMERGENCY_STOP"
    precedence_rank = PrecedenceRank.EMERGENCY_STOP

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        e_state = context.emergency_stop_state
        if e_state.get("is_active"):
            reason = e_state.get("reason") or "Emergency stop actively asserted."
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.CRITICAL,
                reason_code="E_STOP_ACTIVE",
                message=f"Software Emergency Stop is active: {reason}",
                evidence={"asserted_by": e_state.get("asserted_by"), "reason": reason},
                evaluated_at=now_iso,
            )
        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="E_STOP_CLEAR",
            message="Emergency stop is not active.",
            evidence={"is_active": False},
            evaluated_at=now_iso,
        )


class LockoutRule(BaseSafetyRule):
    """Rule 2: Enforces software lockout state requiring explicit manual reset."""

    rule_id = "RULE_02_LOCKOUT"
    category = "LOCKOUT"
    precedence_rank = PrecedenceRank.LOCKED_OUT

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        l_state = context.lockout_state
        if l_state.get("is_locked_out"):
            reason = l_state.get("reason") or "System locked out due to safety violations."
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.CRITICAL,
                reason_code="SYSTEM_LOCKED_OUT",
                message=f"System is locked out: {reason}",
                evidence={
                    "failure_count": l_state.get("failure_count", 0),
                    "reason": reason,
                },
                evaluated_at=now_iso,
            )
        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="LOCKOUT_CLEAR",
            message="System is not locked out.",
            evidence={"is_locked_out": False},
            evaluated_at=now_iso,
        )


class IntentInputValidityRule(BaseSafetyRule):
    """Rule 3: Enforces valid, well-formed intent snapshot structure."""

    rule_id = "RULE_03_INPUT_VALIDITY"
    category = "MALFORMED_INPUT"
    precedence_rank = PrecedenceRank.INVALID_INPUT

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        if not intent_snapshot:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.CRITICAL,
                reason_code="INTENT_MISSING",
                message="No intent snapshot provided for safety arbitration.",
                evidence={},
                evaluated_at=now_iso,
            )
        missing_fields: list[str] = []
        for field in ["intent_id", "intent_class", "current_state"]:
            # accept both current_state and state
            if field == "current_state":
                if "current_state" not in intent_snapshot and "state" not in intent_snapshot:
                    missing_fields.append("state")
            elif field not in intent_snapshot:
                missing_fields.append(field)

        if missing_fields:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.CRITICAL,
                reason_code="INTENT_MALFORMED",
                message=f"Intent snapshot missing required fields: {', '.join(missing_fields)}",
                evidence={"missing_fields": missing_fields},
                evaluated_at=now_iso,
            )

        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="INPUT_VALID",
            message="Intent payload is structurally valid.",
            evidence={"intent_id": intent_snapshot.get("intent_id")},
            evaluated_at=now_iso,
        )


class CriticalSystemHealthRule(BaseSafetyRule):
    """Rule 4: Enforces healthy statuses across critical subsystems (fail-closed on unknown)."""

    rule_id = "RULE_04_CRITICAL_HEALTH"
    category = "HEALTH"
    precedence_rank = PrecedenceRank.CRITICAL_HEALTH

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        unhealthy: dict[str, str] = {}
        for req in policy.critical_health_requirements:
            status = context.system_health.get(req)
            if not status or status.lower() != "healthy":
                unhealthy[req] = status or "UNKNOWN"

        if unhealthy:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.CRITICAL,
                reason_code="HEALTH_CHECK_FAILED",
                message=f"Critical system health failure: {', '.join(f'{k}={v}' for k, v in unhealthy.items())}",
                evidence={"unhealthy_services": unhealthy},
                evaluated_at=now_iso,
            )

        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="HEALTH_OK",
            message="All critical system health checks passed.",
            evidence={"verified_services": policy.critical_health_requirements},
            evaluated_at=now_iso,
        )


class StreamHealthRule(BaseSafetyRule):
    """Rule 5: Enforces realtime stream connection and fresh upstream data."""

    rule_id = "RULE_05_STREAM_HEALTH"
    category = "STREAM"
    precedence_rank = PrecedenceRank.CONTEXT_STALE

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        stream_h = context.stream_health
        if not stream_h.get("stream_connected", False):
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="STREAM_DISCONNECTED",
                message="Realtime stream is disconnected.",
                evidence={"stream_connected": False},
                evaluated_at=now_iso,
            )

        last_age = stream_h.get("last_event_age_ms", 0.0)
        if last_age > policy.max_context_age_ms:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="STREAM_STALE",
                message=f"Stream last event age {last_age:.1f}ms exceeds context threshold {policy.max_context_age_ms:.1f}ms",
                evidence={"last_event_age_ms": last_age, "limit_ms": policy.max_context_age_ms},
                evaluated_at=now_iso,
            )

        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="STREAM_OK",
            message="Realtime stream is connected and within latency limits.",
            evidence={"last_event_age_ms": last_age},
            evaluated_at=now_iso,
        )


class IntentEligibilityRule(BaseSafetyRule):
    """Rule 6: Enforces that only Phase 16 ACTIVE state is eligible for execution authorization."""

    rule_id = "RULE_06_INTENT_ELIGIBILITY"
    category = "ELIGIBILITY"
    precedence_rank = PrecedenceRank.HARD_CONSTRAINT

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        if not intent_snapshot:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="NO_INTENT_SNAPSHOT",
                message="No intent snapshot available to evaluate eligibility.",
                evidence={},
                evaluated_at=now_iso,
            )

        state = intent_snapshot.get("current_state") or intent_snapshot.get("state")
        if state != "ACTIVE":
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="INTENT_NOT_ACTIVE",
                message=f"Intent lifecycle state '{state}' is not eligible for execution authorization (only ACTIVE is eligible).",
                evidence={"current_state": state},
                evaluated_at=now_iso,
            )

        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="INTENT_ACTIVE",
            message="Intent occupies canonical ACTIVE state.",
            evidence={"current_state": state},
            evaluated_at=now_iso,
        )


class IntentAllowlistRule(BaseSafetyRule):
    """Rule 7: Enforces configured allowlisted intent classes and rejects blocked classes."""

    rule_id = "RULE_07_INTENT_ALLOWLIST"
    category = "ALLOWLIST"
    precedence_rank = PrecedenceRank.HARD_CONSTRAINT

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        if not intent_snapshot:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="INTENT_CLASS_MISSING",
                message="Missing intent class.",
                evidence={},
                evaluated_at=now_iso,
            )

        intent_class = (intent_snapshot.get("intent_class") or "").upper()
        if intent_class in [b.upper() for b in policy.blocked_intents]:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="INTENT_CLASS_BLOCKED",
                message=f"Intent class '{intent_class}' is explicitly blocked by policy.",
                evidence={"intent_class": intent_class, "blocked_intents": policy.blocked_intents},
                evaluated_at=now_iso,
            )

        if intent_class not in [a.upper() for a in policy.allowlisted_intents]:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="INTENT_CLASS_NOT_ALLOWLISTED",
                message=f"Intent class '{intent_class}' is not in allowlisted set.",
                evidence={
                    "intent_class": intent_class,
                    "allowlisted_intents": policy.allowlisted_intents,
                },
                evaluated_at=now_iso,
            )

        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="INTENT_CLASS_ALLOWED",
            message=f"Intent class '{intent_class}' is allowlisted.",
            evidence={"intent_class": intent_class},
            evaluated_at=now_iso,
        )


class IntentFreshnessRule(BaseSafetyRule):
    """Rule 8: Enforces timestamp freshness of the active intent."""

    rule_id = "RULE_08_INTENT_FRESHNESS"
    category = "FRESHNESS"
    precedence_rank = PrecedenceRank.CONTEXT_STALE

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        current_time = now_ts or datetime.now(UTC).timestamp()

        if not intent_snapshot:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="INTENT_FRESHNESS_UNKNOWN",
                message="Cannot evaluate freshness without intent snapshot.",
                evidence={},
                evaluated_at=now_iso,
            )

        updated_at_str = intent_snapshot.get("updated_at") or intent_snapshot.get("created_at")
        if not updated_at_str:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="INTENT_TIMESTAMP_MISSING",
                message="Intent snapshot missing timestamp.",
                evidence={},
                evaluated_at=now_iso,
            )

        try:
            intent_ts = datetime.fromisoformat(updated_at_str.replace("Z", "+00:00")).timestamp()
            age_ms = max(0.0, (current_time - intent_ts) * 1000.0)
        except Exception:
            age_ms = context.intent_freshness.get("age_ms", 99999.0)

        if age_ms > policy.max_intent_age_ms:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="INTENT_STALE",
                message=f"Intent age {age_ms:.1f}ms exceeds maximum allowed {policy.max_intent_age_ms:.1f}ms",
                evidence={"age_ms": age_ms, "max_allowed_ms": policy.max_intent_age_ms},
                evaluated_at=now_iso,
            )

        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="INTENT_FRESH",
            message=f"Intent freshness validated ({age_ms:.1f}ms).",
            evidence={"age_ms": age_ms},
            evaluated_at=now_iso,
        )


class ModelProvenanceRule(BaseSafetyRule):
    """Rule 9: Validates originating decoder model version is active and not rolled back."""

    rule_id = "RULE_09_MODEL_PROVENANCE"
    category = "MODEL"
    precedence_rank = PrecedenceRank.CONTEXT_STALE

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        m_health = context.model_health
        if not m_health.get("is_active", True):
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="MODEL_INACTIVE",
                message="Decoder model is not active.",
                evidence={"is_active": False},
                evaluated_at=now_iso,
            )

        if m_health.get("is_rolled_back", False):
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="MODEL_ROLLED_BACK",
                message="Decoder model has been rolled back.",
                evidence={"is_rolled_back": True},
                evaluated_at=now_iso,
            )

        intent_model = (intent_snapshot or {}).get("model_version_id")
        active_model = m_health.get("model_version_id")
        if intent_model and active_model and intent_model != active_model:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="MODEL_VERSION_MISMATCH",
                message=f"Intent generated by model '{intent_model}' does not match active model '{active_model}'.",
                evidence={"intent_model": intent_model, "active_model": active_model},
                evaluated_at=now_iso,
            )

        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="MODEL_PROVENANCE_OK",
            message="Model provenance and active status validated.",
            evidence={"model_version_id": active_model},
            evaluated_at=now_iso,
        )


class EvidenceProvenanceRule(BaseSafetyRule):
    """Rule 10: Validates upstream Phase 15 evidence references and session context."""

    rule_id = "RULE_10_EVIDENCE_PROVENANCE"
    category = "PROVENANCE"
    precedence_rank = PrecedenceRank.CONTEXT_STALE

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        if not intent_snapshot:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="NO_EVIDENCE",
                message="No intent snapshot available to check provenance.",
                evidence={},
                evaluated_at=now_iso,
            )

        intent_sub = intent_snapshot.get("subject_id")
        active_sub = context.session_validity.get("active_subject_id")
        if intent_sub and active_sub and intent_sub != active_sub:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="SUBJECT_MISMATCH",
                message=f"Intent subject '{intent_sub}' does not match active session subject '{active_sub}'.",
                evidence={"intent_subject": intent_sub, "active_subject": active_sub},
                evaluated_at=now_iso,
            )

        intent_sess = intent_snapshot.get("session_id")
        active_sess = context.session_validity.get("active_session_id")
        if intent_sess and active_sess and intent_sess != active_sess:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.HIGH,
                reason_code="SESSION_MISMATCH",
                message=f"Intent session '{intent_sess}' does not match active session '{active_sess}'.",
                evidence={"intent_session": intent_sess, "active_session": active_sess},
                evaluated_at=now_iso,
            )

        # Verify temporal confirmation reference exists
        tc_id = intent_snapshot.get("temporal_confirmation_id")
        if not tc_id:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.WARN,
                severity=RuleSeverity.MEDIUM,
                reason_code="TEMPORAL_CONFIRMATION_MISSING",
                message="Intent lacks upstream temporal confirmation reference.",
                evidence={},
                evaluated_at=now_iso,
            )

        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="PROVENANCE_OK",
            message="Evidence and session context provenance verified.",
            evidence={
                "subject_id": intent_sub,
                "session_id": intent_sess,
                "temporal_confirmation_id": tc_id,
            },
            evaluated_at=now_iso,
        )


class OperatorHoldRule(BaseSafetyRule):
    """Rule 11: Enforces manual operator hold condition."""

    rule_id = "RULE_11_OPERATOR_HOLD"
    category = "OPERATOR"
    precedence_rank = PrecedenceRank.OPERATOR_HOLD

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        op_state = context.operator_state
        if policy.operator_hold_enabled and op_state.get("operator_hold", False):
            reason = op_state.get("hold_reason") or "Manual hold active by operator."
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.HOLD,
                severity=RuleSeverity.MEDIUM,
                reason_code="OPERATOR_HOLD_ACTIVE",
                message=f"Operator hold is active: {reason}",
                evidence={
                    "operator_id": op_state.get("operator_id"),
                    "hold_timestamp": op_state.get("hold_timestamp"),
                },
                evaluated_at=now_iso,
            )

        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="OPERATOR_HOLD_CLEAR",
            message="Operator hold is not engaged.",
            evidence={"operator_hold": False},
            evaluated_at=now_iso,
        )


class RateLimiterRule(BaseSafetyRule):
    """Rule 12: Enforces software execution rate limiting and minimum command gap."""

    rule_id = "RULE_12_RATE_LIMIT"
    category = "RATE_LIMIT"
    precedence_rank = PrecedenceRank.HARD_CONSTRAINT

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        current_time = now_ts or datetime.now(UTC).timestamp()

        ex_rate = context.execution_rate
        timestamps: list[float] = ex_rate.get("recent_authorizations_timestamps", [])
        window_start = current_time - (policy.rate_window_ms / 1000.0)
        recent = [t for t in timestamps if t >= window_start]

        if len(recent) >= policy.maximum_command_rate:
            return SafetyRuleResult(
                rule_id=self.rule_id,
                category=self.category,
                status=RuleStatus.FAIL,
                severity=RuleSeverity.MEDIUM,
                reason_code="COMMAND_RATE_EXCEEDED",
                message=f"Command rate limit exceeded ({len(recent)} >= {policy.maximum_command_rate} per {policy.rate_window_ms:.0f}ms window).",
                evidence={
                    "recent_count": len(recent),
                    "limit": policy.maximum_command_rate,
                    "window_ms": policy.rate_window_ms,
                },
                evaluated_at=now_iso,
            )

        if recent and policy.minimum_command_gap_ms > 0:
            last_t = max(recent)
            gap_ms = (current_time - last_t) * 1000.0
            if gap_ms < policy.minimum_command_gap_ms:
                return SafetyRuleResult(
                    rule_id=self.rule_id,
                    category=self.category,
                    status=RuleStatus.FAIL,
                    severity=RuleSeverity.MEDIUM,
                    reason_code="MINIMUM_GAP_VIOLATED",
                    message=f"Inter-command gap {gap_ms:.1f}ms is below minimum requirement {policy.minimum_command_gap_ms:.1f}ms.",
                    evidence={"gap_ms": gap_ms, "min_gap_ms": policy.minimum_command_gap_ms},
                    evaluated_at=now_iso,
                )

        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="RATE_LIMIT_OK",
            message="Command rate and gap constraints satisfied.",
            evidence={"recent_count": len(recent)},
            evaluated_at=now_iso,
        )


class ActiveDurationRule(BaseSafetyRule):
    """Rule 13: Enforces maximum duration for continuously active execution authorization."""

    rule_id = "RULE_13_ACTIVE_DURATION"
    category = "DURATION_LIMIT"
    precedence_rank = PrecedenceRank.HARD_CONSTRAINT

    def evaluate(
        self,
        intent_snapshot: dict[str, Any] | None,
        context: SafetyContext,
        policy: SafetyPolicy,
        now_ts: float | None = None,
    ) -> SafetyRuleResult:
        now_iso = (
            datetime.fromtimestamp(now_ts, tz=UTC).isoformat()
            if now_ts
            else datetime.now(UTC).isoformat()
        )
        current_time = now_ts or datetime.now(UTC).timestamp()

        act_state = context.current_action_state
        auth_since = act_state.get("active_authorized_since")
        if auth_since is not None:
            active_duration_ms = (current_time - auth_since) * 1000.0
            if active_duration_ms > policy.max_authorized_duration_ms:
                return SafetyRuleResult(
                    rule_id=self.rule_id,
                    category=self.category,
                    status=RuleStatus.FAIL,
                    severity=RuleSeverity.MEDIUM,
                    reason_code="MAX_DURATION_EXCEEDED",
                    message=f"Continuous authorized duration {active_duration_ms:.1f}ms exceeds maximum limit {policy.max_authorized_duration_ms:.1f}ms.",
                    evidence={
                        "active_duration_ms": active_duration_ms,
                        "limit_ms": policy.max_authorized_duration_ms,
                    },
                    evaluated_at=now_iso,
                )

        return SafetyRuleResult(
            rule_id=self.rule_id,
            category=self.category,
            status=RuleStatus.PASS,
            severity=RuleSeverity.INFO,
            reason_code="DURATION_OK",
            message="Continuous duration within safe boundaries.",
            evidence={},
            evaluated_at=now_iso,
        )


DEFAULT_SAFETY_RULES: list[BaseSafetyRule] = [
    EmergencyStopRule(),
    LockoutRule(),
    IntentInputValidityRule(),
    CriticalSystemHealthRule(),
    StreamHealthRule(),
    IntentEligibilityRule(),
    IntentAllowlistRule(),
    IntentFreshnessRule(),
    ModelProvenanceRule(),
    EvidenceProvenanceRule(),
    OperatorHoldRule(),
    RateLimiterRule(),
    ActiveDurationRule(),
]
