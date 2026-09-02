"""Deterministic Fault Injection Engine for Phase 18.

Owns the active fault registry, scoped interception hooks, trigger
evaluations, and controlled perturbation of messages and subsystem context.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from neuromove.resilience.faults import create_fault_definition
from neuromove.resilience.models import (
    FaultDefinition,
    FaultScope,
    FaultStatus,
    FaultType,
    TriggerType,
)

logger = logging.getLogger(__name__)


class FaultInjector:
    """Deterministic fault injector managing lifecycle and scoped interception."""

    def __init__(self) -> None:
        self._active_faults: dict[str, FaultDefinition] = {}
        self._event_counters: dict[str, int] = {}
        self._intercepted_events: list[dict[str, Any]] = []
        self._clock_skew_ms: float = 0.0

    def inject(self, fault: FaultDefinition) -> FaultDefinition:
        """Register and activate a fault into the live test harness."""
        fault.status = FaultStatus.ACTIVE
        fault.activated_at = datetime.now(UTC).isoformat()
        self._active_faults[fault.fault_id] = fault

        if fault.fault_type == FaultType.CLOCK_SKEW_SIMULATED and fault.parameters.clock_skew_ms:
            self._clock_skew_ms = fault.parameters.clock_skew_ms

        logger.info(
            "Injected fault %s [%s] (Scope: %s, Severity: %s)",
            fault.fault_id,
            fault.fault_type.value,
            fault.scope.value,
            fault.severity.value,
        )
        return fault

    def inject_by_type(
        self,
        fault_type: FaultType,
        parameters: dict[str, Any] | None = None,
        scope: FaultScope = FaultScope.SINGLE_EVENT,
        target_service: str | None = None,
        target_stream: str | None = None,
        trigger_type: TriggerType = TriggerType.MANUAL,
        trigger_value: str | None = None,
        description: str = "",
    ) -> FaultDefinition:
        """Convenience method to construct and immediately activate a fault."""
        fault = create_fault_definition(
            fault_type=fault_type,
            parameters=parameters,
            scope=scope,
            target_service=target_service,
            target_stream=target_stream,
            trigger_type=trigger_type,
            trigger_value=trigger_value,
            description=description,
        )
        return self.inject(fault)

    def clear(self, fault_id: str) -> FaultDefinition | None:
        """Clear and deactivate a registered fault."""
        if fault_id in self._active_faults:
            fault = self._active_faults[fault_id]
            fault.status = FaultStatus.CLEARED
            fault.cleared_at = datetime.now(UTC).isoformat()
            del self._active_faults[fault_id]

            if fault.fault_type == FaultType.CLOCK_SKEW_SIMULATED:
                self._clock_skew_ms = 0.0

            logger.info("Cleared fault %s [%s]", fault_id, fault.fault_type.value)
            return fault
        return None

    def clear_all(self) -> int:
        """Clear all active faults, restoring baseline conditions."""
        count = len(self._active_faults)
        for fault_id in list(self._active_faults.keys()):
            self.clear(fault_id)
        self._clock_skew_ms = 0.0
        self._event_counters.clear()
        self._intercepted_events.clear()
        logger.info("Cleared all %d active faults", count)
        return count

    def get_active_faults(self) -> list[FaultDefinition]:
        """Return list of currently active faults."""
        return list(self._active_faults.values())

    def get_fault(self, fault_id: str) -> FaultDefinition | None:
        """Retrieve a specific fault by identifier."""
        return self._active_faults.get(fault_id)

    def is_fault_active(
        self,
        fault_type: FaultType,
        target_service: str | None = None,
        target_stream: str | None = None,
    ) -> bool:
        """Query whether a specific fault type is currently active for the given target."""
        for fault in self._active_faults.values():
            if fault.fault_type == fault_type and fault.status == FaultStatus.ACTIVE:
                if (
                    target_service
                    and fault.target_service
                    and fault.target_service != target_service
                ):
                    continue
                if target_stream and fault.target_stream and fault.target_stream != target_stream:
                    continue
                return True
        return False

    def get_clock_skew_seconds(self) -> float:
        """Return current simulated clock skew in seconds."""
        return self._clock_skew_ms / 1000.0

    def evaluate_triggers(
        self, event_type: str, sequence_number: int | None = None
    ) -> list[FaultDefinition]:
        """Evaluate trigger conditions on event arrival and arm/activate pending faults."""
        activated: list[FaultDefinition] = []
        counter = self._event_counters.get(event_type, 0) + 1
        self._event_counters[event_type] = counter

        for fault in list(self._active_faults.values()):
            if fault.status == FaultStatus.ARMED:
                should_activate = False
                if fault.trigger_type == TriggerType.AFTER_N_EVENTS:
                    target_n = int(fault.trigger_value or "1")
                    if counter >= target_n:
                        should_activate = True
                elif fault.trigger_type == TriggerType.AT_SEQUENCE and sequence_number is not None:
                    target_seq = int(fault.trigger_value or "0")
                    if sequence_number >= target_seq:
                        should_activate = True

                if should_activate:
                    fault.status = FaultStatus.ACTIVE
                    fault.activated_at = datetime.now(UTC).isoformat()
                    activated.append(fault)

        return activated

    def intercept_event_stream(
        self,
        events: list[dict[str, Any]],
        stream_name: str,
    ) -> list[dict[str, Any]]:
        """Apply active stream faults (drops, duplicates, reorders, delays, gaps) to an event batch."""
        if not events:
            return events

        result = list(events)

        # 1. Check STREAM_EVENT_DROP
        for fault in self.get_active_faults():
            if (
                fault.fault_type == FaultType.STREAM_EVENT_DROP
                and fault.status == FaultStatus.ACTIVE
            ):
                drop_count = fault.parameters.drop_count or 1
                result = result[drop_count:]
                logger.debug("Dropped %d events from stream %s", drop_count, stream_name)

        # 2. Check STREAM_EVENT_DUPLICATE
        for fault in self.get_active_faults():
            if (
                fault.fault_type == FaultType.STREAM_EVENT_DUPLICATE
                and fault.status == FaultStatus.ACTIVE
            ):
                if result:
                    dup_count = fault.parameters.duplicate_count or 1
                    duplicated = [result[0]] * dup_count
                    result = duplicated + result
                    logger.debug("Duplicated event %d times in stream %s", dup_count, stream_name)

        # 3. Check STREAM_EVENT_REORDER
        for fault in self.get_active_faults():
            if (
                fault.fault_type == FaultType.STREAM_EVENT_REORDER
                and fault.status == FaultStatus.ACTIVE
            ):
                if len(result) >= 2:
                    result[0], result[1] = result[1], result[0]
                    logger.debug("Reordered events in stream %s", stream_name)

        # 4. Check STREAM_SEQUENCE_GAP
        for fault in self.get_active_faults():
            if (
                fault.fault_type == FaultType.STREAM_SEQUENCE_GAP
                and fault.status == FaultStatus.ACTIVE
            ):
                if result and "sequence_number" in result[0]:
                    result[0]["sequence_number"] += 10
                    logger.debug("Simulated sequence gap in stream %s", stream_name)

        return result

    def perturb_payload(
        self,
        payload: dict[str, Any],
        fault_type: FaultType | None = None,
    ) -> dict[str, Any]:
        """Apply payload corruption or field stripping according to active faults."""
        perturbed = dict(payload)

        # Apply MALFORMED_PAYLOAD / MISSING_FIELD
        for fault in self.get_active_faults():
            if fault.status != FaultStatus.ACTIVE:
                continue

            if fault.fault_type == FaultType.MISSING_FIELD:
                for fld in fault.parameters.missing_fields:
                    perturbed.pop(fld, None)

            elif fault.fault_type == FaultType.MALFORMED_PAYLOAD:
                perturbed["_malformed_token"] = True
                if "intent_class" in perturbed:
                    perturbed["intent_class"] = "INVALID_CORRUPTED_INTENT"
                if "confidence_score" in perturbed:
                    perturbed["confidence_score"] = -999.0

            elif fault.fault_type == FaultType.INVALID_TIMESTAMP:
                perturbed["updated_at"] = "NOT_A_TIMESTAMP"
                perturbed["created_at"] = "INVALID_DATE"

            elif fault.fault_type == FaultType.STALE_DATA:
                perturbed["created_at"] = "1970-01-01T00:00:00Z"
                perturbed["updated_at"] = "1970-01-01T00:00:00Z"

            elif fault.fault_type == FaultType.SUBJECT_SWITCH:
                perturbed["subject_id"] = "sub-ALIEN-UNAUTHORIZED"

            elif fault.fault_type == FaultType.SESSION_SWITCH:
                perturbed["session_id"] = "sess-MISMATCHED"

            elif fault.fault_type == FaultType.MODEL_VERSION_MISMATCH:
                perturbed["model_version_id"] = "model_UNREGISTERED_OBSOLETE"

        return perturbed
