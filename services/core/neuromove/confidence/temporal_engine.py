"""Deterministic Temporal Confirmation Engine with Hysteresis and Cooldown."""

from __future__ import annotations

import time

from neuromove.confidence.models import (
    ConfidenceConfig,
    ConfidenceDecision,
    ConfidenceEligibility,
    Phase16IntentHandoffPayload,
    TemporalConfirmationDecision,
    TemporalConfirmationState,
    TemporalResetReason,
    TemporalStatus,
)


class TemporalConfirmationEngine:
    """Tracks consecutive predictive evidence, applies hysteresis, and issues temporal confirmations."""

    def __init__(self, config: ConfidenceConfig | None = None) -> None:
        self.config = config or ConfidenceConfig()
        self.state = TemporalConfirmationState()

    def update_config(self, config: ConfidenceConfig) -> None:
        """Update active configuration."""
        self.config = config

    def reset(self, reason: TemporalResetReason = TemporalResetReason.MANUAL_RESET) -> None:
        """Explicitly reset all temporal tracking state."""
        self.state.status = TemporalStatus.RESET
        self.state.current_candidate = None
        self.state.candidate_started_at = None
        self.state.consecutive_count = 0
        self.state.accumulated_duration_ms = 0.0
        self.state.last_evidence_at = None
        self.state.cooldown_until = None
        self.state.refractory_until = None
        self.state.last_reset_reason = reason
        self.state.reset_count += 1

    def process_decision(
        self,
        decision: ConfidenceDecision,
        now_timestamp: float | None = None,
    ) -> tuple[TemporalConfirmationDecision, Phase16IntentHandoffPayload]:
        """Evaluate temporal evidence continuity and determine confirmation status."""
        now = now_timestamp if now_timestamp is not None else time.time()

        # ====================================================================
        # 1. Subject / Session / Model Boundary Isolation
        # ====================================================================
        if (
            self.state.active_model_version_id is not None
            and decision.model_version_id != self.state.active_model_version_id
        ):
            self.reset(TemporalResetReason.MODEL_CHANGED)

        if (
            self.state.active_subject_id is not None
            and decision.subject_id != self.state.active_subject_id
        ):
            self.reset(TemporalResetReason.SUBJECT_CHANGED)

        if (
            self.state.active_session_id is not None
            and decision.session_id != self.state.active_session_id
        ):
            self.reset(TemporalResetReason.SESSION_CHANGED)

        # Update active context tracking
        self.state.active_model_version_id = decision.model_version_id
        self.state.active_subject_id = decision.subject_id
        self.state.active_session_id = decision.session_id

        # ====================================================================
        # 2. Cooldown & Refractory Check
        # ====================================================================
        in_cooldown = self.state.cooldown_until is not None and now < self.state.cooldown_until
        in_refractory = (
            self.state.refractory_until is not None and now < self.state.refractory_until
        )

        if in_cooldown or in_refractory:
            if not self.config.allow_same_class_reconfirmation:
                self.state.status = TemporalStatus.COOLDOWN
                reason_msg = (
                    f"Temporal engine in cooldown until t={self.state.cooldown_until:.2f}s."
                )
                return self._build_verdict(
                    decision=decision,
                    temporally_confirmed=False,
                    reason=reason_msg,
                    now=now,
                )

        # ====================================================================
        # 3. Gap Tolerance & Stream Interruption Check
        # ====================================================================
        if self.state.last_evidence_at is not None:
            gap_ms = (now - self.state.last_evidence_at) * 1000.0
            if gap_ms > self.config.max_gap_ms:
                self.reset(TemporalResetReason.STREAM_INTERRUPTION)

        # ====================================================================
        # 4. Eligibility & Gating Check
        # ====================================================================
        if decision.eligibility != ConfidenceEligibility.VALID:
            if decision.eligibility == ConfidenceEligibility.STALE:
                self.reset(TemporalResetReason.STALE_DATA)
            elif decision.eligibility == ConfidenceEligibility.LOW_SIGNAL:
                self.reset(TemporalResetReason.SIGNAL_INVALID)
            else:
                self.reset(TemporalResetReason.MANUAL_RESET)

            self.state.status = (
                TemporalStatus.STALE
                if decision.eligibility == ConfidenceEligibility.STALE
                else TemporalStatus.REJECTED
            )

            return self._build_verdict(
                decision=decision,
                temporally_confirmed=False,
                reason=f"Temporal accumulation blocked: {decision.decision_reason}",
                now=now,
            )

        # ====================================================================
        # 5. Hysteresis & Class Continuity Tracking
        # ====================================================================
        is_tracking_same_candidate = (
            self.state.current_candidate == decision.prediction
            and self.state.status in (TemporalStatus.TRACKING, TemporalStatus.CONFIRMED)
        )

        # Determine required threshold under hysteresis policy
        threshold_required = (
            self.config.hysteresis_exit
            if is_tracking_same_candidate
            else self.config.hysteresis_enter
        )

        if decision.calibrated_confidence < threshold_required:
            if is_tracking_same_candidate:
                self.reset(TemporalResetReason.MANUAL_RESET)
            self.state.status = TemporalStatus.IDLE
            return self._build_verdict(
                decision=decision,
                temporally_confirmed=False,
                reason=f"Confidence ({decision.calibrated_confidence:.1%}) below hysteresis floor ({threshold_required:.1%}).",
                now=now,
            )

        # Candidate persistence accumulation
        if self.state.current_candidate != decision.prediction:
            # Candidate switched
            self.state.current_candidate = decision.prediction
            self.state.candidate_started_at = now
            self.state.consecutive_count = 1
            self.state.accumulated_duration_ms = 0.0
            self.state.last_evidence_at = now
            self.state.status = TemporalStatus.TRACKING
        else:
            # Evidence continues for existing candidate
            duration_delta_ms = (
                (now - self.state.last_evidence_at) * 1000.0
                if self.state.last_evidence_at is not None
                else 0.0
            )
            # Default window duration assumption (e.g. 250ms) if delta is 0
            if duration_delta_ms <= 0.0:
                duration_delta_ms = 250.0

            self.state.consecutive_count += 1
            self.state.accumulated_duration_ms += duration_delta_ms
            self.state.last_evidence_at = now
            self.state.status = TemporalStatus.TRACKING

        # ====================================================================
        # 6. Temporal Confirmation Threshold Evaluation
        # ====================================================================
        has_min_windows = self.state.consecutive_count >= self.config.min_consecutive_windows
        has_min_duration = self.state.accumulated_duration_ms >= self.config.min_duration_ms

        if has_min_windows and has_min_duration:
            # Confirmation achieved!
            self.state.status = TemporalStatus.CONFIRMED
            self.state.confirmation_count += 1
            self.state.cooldown_until = now + (self.config.cooldown_ms / 1000.0)
            self.state.refractory_until = now + (self.config.refractory_ms / 1000.0)

            confirm_reason = (
                f"Candidate '{decision.prediction}' confirmed with {self.state.consecutive_count} consecutive windows "
                f"({self.state.accumulated_duration_ms:.0f}ms duration) at {decision.calibrated_confidence:.1%} confidence."
            )

            return self._build_verdict(
                decision=decision,
                temporally_confirmed=True,
                reason=confirm_reason,
                now=now,
            )

        # Evidence still accumulating
        tracking_reason = (
            f"Tracking '{decision.prediction}': {self.state.consecutive_count}/{self.config.min_consecutive_windows} windows, "
            f"{self.state.accumulated_duration_ms:.0f}/{self.config.min_duration_ms:.0f}ms duration."
        )

        return self._build_verdict(
            decision=decision,
            temporally_confirmed=False,
            reason=tracking_reason,
            now=now,
        )

    def _build_verdict(
        self,
        decision: ConfidenceDecision,
        temporally_confirmed: bool,
        reason: str,
        now: float,
    ) -> tuple[TemporalConfirmationDecision, Phase16IntentHandoffPayload]:
        """Construct typed decision and Phase 16 handoff records."""
        confirmation_decision = TemporalConfirmationDecision(
            temporally_confirmed=temporally_confirmed,
            confirmed_prediction=decision.prediction if temporally_confirmed else None,
            confidence=decision.calibrated_confidence,
            confidence_band=decision.confidence_band,
            eligibility=decision.eligibility,
            temporal_status=self.state.status,
            consecutive_count=self.state.consecutive_count,
            accumulated_duration_ms=round(self.state.accumulated_duration_ms, 1),
            required_count=self.config.min_consecutive_windows,
            required_duration_ms=self.config.min_duration_ms,
            confirmation_timestamp=now if temporally_confirmed else None,
            decision_reason=reason,
            model_version_id=decision.model_version_id,
            subject_id=decision.subject_id,
            session_id=decision.session_id,
        )

        handoff_payload = Phase16IntentHandoffPayload(
            prediction=decision.prediction,
            confidence=decision.calibrated_confidence,
            confidence_band=decision.confidence_band,
            eligibility=decision.eligibility,
            temporal_status=self.state.status,
            temporally_confirmed=temporally_confirmed,
            confirmation_timestamp=now if temporally_confirmed else None,
            confirmation_reason=reason,
            model_version_id=decision.model_version_id,
            subject_id=decision.subject_id,
            session_id=decision.session_id,
            evidence_window_count=self.state.consecutive_count,
            evidence_duration_ms=round(self.state.accumulated_duration_ms, 1),
        )

        return confirmation_decision, handoff_payload
