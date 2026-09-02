"""Confidence Service Orchestrator and Realtime Event Dispatcher."""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any

import numpy as np

from neuromove.confidence.calibrator import ConfidenceCalibrator
from neuromove.confidence.evaluator import ConfidenceEvaluator
from neuromove.confidence.models import (
    CalibrationMethod,
    CalibrationScope,
    ConfidenceCalibrationProfile,
    ConfidenceConfig,
    ConfidenceDecision,
    ConfidenceHistoryRecord,
    ConfidenceInput,
    Phase16IntentHandoffPayload,
    ScoreType,
    TemporalConfirmationDecision,
    TemporalConfirmationEvent,
    TemporalResetReason,
    TemporalStatus,
)
from neuromove.confidence.storage import ConfidenceStorage
from neuromove.confidence.temporal_engine import TemporalConfirmationEngine
from neuromove.domain.enums import EventType
from neuromove.events.dispatcher import default_dispatcher
from neuromove.events.envelope import EventEnvelope

logger = logging.getLogger("neuromove.confidence.service")


class ConfidenceService:
    """Singleton service orchestrating confidence evaluation, temporal confirmation, and audit logs."""

    def __init__(self) -> None:
        self.storage = ConfidenceStorage()
        # Load or initialize default global configuration
        self.config = self.storage.get_latest_config() or ConfidenceConfig()
        self.storage.save_config(self.config)

        self.evaluator = ConfidenceEvaluator(self.config)
        self.temporal_engine = TemporalConfirmationEngine(self.config)
        self._sequence_counter = 0

    def update_config(self, config: ConfidenceConfig) -> ConfidenceConfig:
        """Update system confidence and temporal policies."""
        self.config = config
        self.storage.save_config(config)
        self.evaluator.update_config(config)
        self.temporal_engine.update_config(config)

        # Dispatch config change event
        self._dispatch_event(
            event_type=EventType.CONFIDENCE_CONFIG_CHANGED,
            payload={"config_id": config.config_id, "version": config.version},
        )
        return self.config

    def get_config(
        self,
        subject_id: str | None = None,
        model_version_id: str | None = None,
    ) -> ConfidenceConfig:
        """Retrieve active configuration."""
        if subject_id or model_version_id:
            cfg = self.storage.get_latest_config(subject_id, model_version_id)
            if cfg:
                return cfg
        return self.config

    def evaluate_prediction(
        self,
        input_data: ConfidenceInput,
        evaluation_timestamp: float | None = None,
    ) -> tuple[ConfidenceDecision, TemporalConfirmationDecision, Phase16IntentHandoffPayload]:
        """Perform end-to-end confidence evaluation, temporal tracking, and event broadcasting."""
        now = evaluation_timestamp if evaluation_timestamp is not None else time.time()

        # 1. Fetch calibration profile if available
        calibration_profile = self.storage.get_calibration_profile(input_data.model_version_id)

        # 2. Evaluate multi-factor confidence
        decision = self.evaluator.evaluate(
            input_data=input_data,
            calibration_profile=calibration_profile,
            evaluation_timestamp=now,
        )

        # 3. Process temporal confirmation
        prev_status = self.temporal_engine.state.status
        temporal_decision, handoff_payload = self.temporal_engine.process_decision(
            decision=decision,
            now_timestamp=now,
        )

        # 4. Audit History & Event Transitions
        self._sequence_counter += 1
        history_record = ConfidenceHistoryRecord(
            subject_id=input_data.subject_id,
            session_id=input_data.session_id,
            model_version_id=input_data.model_version_id,
            predicted_class=input_data.prediction,
            confidence=decision.calibrated_confidence,
            band=decision.confidence_band,
            eligibility=decision.eligibility,
            temporal_status=temporal_decision.temporal_status,
            decision_reason=temporal_decision.decision_reason,
            timestamp=datetime.fromtimestamp(now, tz=UTC).isoformat(),
        )
        self.storage.record_history(history_record)

        # Record significant temporal transition events
        if temporal_decision.temporally_confirmed:
            evt = TemporalConfirmationEvent(
                sequence_number=self._sequence_counter,
                event_type="CONFIRMATION_REACHED",
                candidate_class=decision.prediction,
                consecutive_windows=temporal_decision.consecutive_count,
                accumulated_duration_ms=temporal_decision.accumulated_duration_ms,
                confidence_score=decision.calibrated_confidence,
                decision_reason=temporal_decision.decision_reason,
                model_version_id=input_data.model_version_id,
                subject_id=input_data.subject_id,
                session_id=input_data.session_id,
                timestamp=datetime.fromtimestamp(now, tz=UTC).isoformat(),
            )
            self.storage.record_temporal_event(evt)
            self._dispatch_event(
                event_type=EventType.TEMPORAL_CONFIRMATION_REACHED,
                payload=handoff_payload.model_dump(mode="json"),
            )
        elif prev_status != temporal_decision.temporal_status:
            evt_name = (
                "CONFIRMATION_RESET"
                if temporal_decision.temporal_status == TemporalStatus.RESET
                else "EVIDENCE_UPDATED"
            )
            evt = TemporalConfirmationEvent(
                sequence_number=self._sequence_counter,
                event_type=evt_name,
                candidate_class=decision.prediction,
                consecutive_windows=temporal_decision.consecutive_count,
                accumulated_duration_ms=temporal_decision.accumulated_duration_ms,
                confidence_score=decision.calibrated_confidence,
                decision_reason=temporal_decision.decision_reason,
                model_version_id=input_data.model_version_id,
                subject_id=input_data.subject_id,
                session_id=input_data.session_id,
                timestamp=datetime.fromtimestamp(now, tz=UTC).isoformat(),
            )
            self.storage.record_temporal_event(evt)
            dispatch_type = (
                EventType.TEMPORAL_CONFIRMATION_RESET
                if temporal_decision.temporal_status == TemporalStatus.RESET
                else EventType.TEMPORAL_EVIDENCE_UPDATED
            )
            self._dispatch_event(
                event_type=dispatch_type,
                payload=handoff_payload.model_dump(mode="json"),
            )
        else:
            # Standard confidence evaluation dispatch
            self._dispatch_event(
                event_type=EventType.CONFIDENCE_EVALUATED,
                payload={
                    "decision": decision.model_dump(mode="json"),
                    "temporal": temporal_decision.model_dump(mode="json"),
                    "handoff": handoff_payload.model_dump(mode="json"),
                },
            )

        return decision, temporal_decision, handoff_payload

    def reset_temporal_state(
        self, reason: TemporalResetReason = TemporalResetReason.MANUAL_RESET
    ) -> None:
        """Reset temporal confirmation engine."""
        self.temporal_engine.reset(reason)
        self._dispatch_event(
            event_type=EventType.TEMPORAL_CONFIRMATION_RESET,
            payload={"reason": reason.value},
        )

    def calibrate_model(
        self,
        model_version_id: str,
        uncalibrated_scores: list[float],
        labels: list[int],
        method: CalibrationMethod = CalibrationMethod.PLATT,
        scope: CalibrationScope = CalibrationScope.GLOBAL,
        subject_id: str | None = None,
        dataset_reference: str = "validation_set",
        protected_eval_epoch_ids: set[str] | None = None,
        fit_epoch_ids: set[str] | None = None,
    ) -> ConfidenceCalibrationProfile:
        """Fit a calibration profile with zero data leakage guarantees."""
        profile = ConfidenceCalibrator.fit_calibration_profile(
            model_version_id=model_version_id,
            uncalibrated_scores=np.array(uncalibrated_scores),
            y_true=np.array(labels),
            method=method,
            scope=scope,
            subject_id=subject_id,
            dataset_reference=dataset_reference,
            protected_eval_epoch_ids=protected_eval_epoch_ids,
            fit_epoch_ids=fit_epoch_ids,
        )
        self.storage.save_calibration_profile(profile)
        return profile

    def run_deterministic_scenario(self, scenario_id: str) -> dict[str, Any]:
        """Execute deterministic test research scenarios A through H."""
        self.reset_temporal_state(TemporalResetReason.MANUAL_RESET)
        results: list[dict[str, Any]] = []
        t0 = 1000.0

        if scenario_id == "SCENARIO_A_STABLE_HIGH_CONFIDENCE":
            # LEFT, LEFT, LEFT -> Confirmed
            for i in range(4):
                t = t0 + i * 0.25
                inp = ConfidenceInput(
                    prediction="LEFT",
                    raw_score=0.92,
                    score_type=ScoreType.PROBABILITY,
                    class_scores={"LEFT": 0.92, "RIGHT": 0.08},
                    model_id="mdl_demo_v1",
                    model_version_id="mdl_scenario_v1",
                    prediction_timestamp=t,
                    data_timestamp=t,
                    signal_quality=0.95,
                )

                dec, temp, _ = self.evaluate_prediction(inp, evaluation_timestamp=t)
                results.append(
                    {
                        "step": i + 1,
                        "prediction": inp.prediction,
                        "confidence": dec.calibrated_confidence,
                        "temporal_status": temp.temporal_status.value,
                        "confirmed": temp.temporally_confirmed,
                    }
                )

        elif scenario_id == "SCENARIO_B_PREDICTION_FLICKER":
            # LEFT, RIGHT, LEFT, RIGHT -> No false confirmation
            preds = ["LEFT", "RIGHT", "LEFT", "RIGHT"]
            for i, p in enumerate(preds):
                t = t0 + i * 0.25
                inp = ConfidenceInput(
                    prediction=p,
                    raw_score=0.88,
                    score_type=ScoreType.PROBABILITY,
                    class_scores={
                        "LEFT": 0.88 if p == "LEFT" else 0.12,
                        "RIGHT": 0.88 if p == "RIGHT" else 0.12,
                    },
                    model_id="mdl_demo_v1",
                    model_version_id="v1",
                    prediction_timestamp=t,
                    data_timestamp=t,
                    signal_quality=0.95,
                )
                dec, temp, _ = self.evaluate_prediction(inp, evaluation_timestamp=t)
                results.append(
                    {
                        "step": i + 1,
                        "prediction": p,
                        "confidence": dec.calibrated_confidence,
                        "temporal_status": temp.temporal_status.value,
                        "confirmed": temp.temporally_confirmed,
                    }
                )

        elif scenario_id == "SCENARIO_C_POOR_SIGNAL_QUALITY":
            # High raw score but invalid signal -> Ineligible & rejected
            inp = ConfidenceInput(
                prediction="LEFT",
                raw_score=0.98,
                score_type=ScoreType.PROBABILITY,
                class_scores={"LEFT": 0.98, "RIGHT": 0.02},
                model_id="mdl_demo_v1",
                model_version_id="v1",
                prediction_timestamp=t0,
                data_timestamp=t0,
                signal_quality=0.25,  # Below quality_floor 0.50
            )
            dec, temp, _ = self.evaluate_prediction(inp, evaluation_timestamp=t0)
            results.append(
                {
                    "step": 1,
                    "prediction": inp.prediction,
                    "raw_score": inp.raw_score,
                    "signal_quality": inp.signal_quality,
                    "eligibility": dec.eligibility.value,
                    "temporal_status": temp.temporal_status.value,
                    "confirmed": temp.temporally_confirmed,
                    "reason": dec.decision_reason,
                }
            )

        elif scenario_id == "SCENARIO_D_STALE_DATA":
            # Data age 800ms > max_age_ms (400ms) -> STALE & blocked
            inp = ConfidenceInput(
                prediction="LEFT",
                raw_score=0.90,
                score_type=ScoreType.PROBABILITY,
                model_id="mdl_demo_v1",
                model_version_id="v1",
                prediction_timestamp=t0,
                data_timestamp=t0 - 0.80,  # 800ms old
                signal_quality=0.95,
            )
            dec, temp, _ = self.evaluate_prediction(inp, evaluation_timestamp=t0)
            results.append(
                {
                    "step": 1,
                    "freshness": dec.freshness.value,
                    "eligibility": dec.eligibility.value,
                    "temporal_status": temp.temporal_status.value,
                    "confirmed": temp.temporally_confirmed,
                    "reason": dec.decision_reason,
                }
            )

        elif scenario_id == "SCENARIO_E_MODEL_VERSION_SWITCH":
            # v1 -> v1 -> v2 (switch resets temporal evidence)
            steps = [("v1", "LEFT"), ("v1", "LEFT"), ("v2", "LEFT")]
            for i, (m_ver, p) in enumerate(steps):
                t = t0 + i * 0.25
                inp = ConfidenceInput(
                    prediction=p,
                    raw_score=0.90,
                    score_type=ScoreType.PROBABILITY,
                    model_id="mdl_demo",
                    model_version_id=m_ver,
                    prediction_timestamp=t,
                    data_timestamp=t,
                    signal_quality=0.95,
                )
                dec, temp, _ = self.evaluate_prediction(inp, evaluation_timestamp=t)
                results.append(
                    {
                        "step": i + 1,
                        "model_version": m_ver,
                        "consecutive_count": temp.consecutive_count,
                        "temporal_status": temp.temporal_status.value,
                        "confirmed": temp.temporally_confirmed,
                    }
                )

        elif scenario_id == "SCENARIO_F_SUBJECT_SWITCH":
            # sub-001 -> sub-002 (switch resets temporal evidence)
            steps = [("sub-001", "RIGHT"), ("sub-001", "RIGHT"), ("sub-002", "RIGHT")]
            for i, (sub, p) in enumerate(steps):
                t = t0 + i * 0.25
                inp = ConfidenceInput(
                    prediction=p,
                    raw_score=0.90,
                    score_type=ScoreType.PROBABILITY,
                    model_id="mdl_demo_v1",
                    model_version_id="v1",
                    subject_id=sub,
                    prediction_timestamp=t,
                    data_timestamp=t,
                    signal_quality=0.95,
                )
                dec, temp, _ = self.evaluate_prediction(inp, evaluation_timestamp=t)
                results.append(
                    {
                        "step": i + 1,
                        "subject_id": sub,
                        "consecutive_count": temp.consecutive_count,
                        "temporal_status": temp.temporal_status.value,
                        "confirmed": temp.temporally_confirmed,
                    }
                )

        elif scenario_id == "SCENARIO_G_HYSTERESIS_BOUNDARY":
            # Hovering near 0.65 (below enter 0.75, above exit 0.60)
            scores = [0.65, 0.65]  # Should not enter from idle
            for i, s in enumerate(scores):
                t = t0 + i * 0.25
                inp = ConfidenceInput(
                    prediction="LEFT",
                    raw_score=s,
                    score_type=ScoreType.PROBABILITY,
                    model_id="mdl_demo_v1",
                    model_version_id="v1",
                    prediction_timestamp=t,
                    data_timestamp=t,
                    signal_quality=0.95,
                )
                dec, temp, _ = self.evaluate_prediction(inp, evaluation_timestamp=t)
                results.append(
                    {
                        "step": i + 1,
                        "raw_score": s,
                        "temporal_status": temp.temporal_status.value,
                        "confirmed": temp.temporally_confirmed,
                    }
                )

        elif scenario_id == "SCENARIO_H_COOLDOWN_SUPPRESSION":
            # 3 windows confirm, 4th window immediately after is suppressed by cooldown
            for i in range(4):
                t = t0 + i * 0.25
                inp = ConfidenceInput(
                    prediction="LEFT",
                    raw_score=0.92,
                    score_type=ScoreType.PROBABILITY,
                    model_id="mdl_demo_v1",
                    model_version_id="v1",
                    prediction_timestamp=t,
                    data_timestamp=t,
                    signal_quality=0.95,
                )
                dec, temp, _ = self.evaluate_prediction(inp, evaluation_timestamp=t)
                results.append(
                    {
                        "step": i + 1,
                        "temporal_status": temp.temporal_status.value,
                        "confirmed": temp.temporally_confirmed,
                        "reason": temp.decision_reason,
                    }
                )

        return {
            "scenario_id": scenario_id,
            "executed_at": datetime.now(UTC).isoformat(),
            "results": results,
        }

    def _dispatch_event(self, event_type: EventType, payload: dict[str, Any]) -> None:
        """Create and publish canonical event envelope."""
        try:
            envelope = EventEnvelope(
                event_type=event_type,
                timestamp=datetime.now(UTC),
                source="neuromove.confidence.service",
                payload=payload,
            )
            default_dispatcher.publish(envelope)
        except Exception as exc:
            logger.warning("Failed to dispatch canonical event %s: %s", event_type, exc)


# Global singleton instance
_confidence_service_instance: ConfidenceService | None = None


def get_confidence_service() -> ConfidenceService:
    """Obtain or initialize the global ConfidenceService singleton."""
    global _confidence_service_instance
    if _confidence_service_instance is None:
        _confidence_service_instance = ConfidenceService()
    return _confidence_service_instance
