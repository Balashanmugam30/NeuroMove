"""Fault definitions, categories, and parameter validation for Phase 18.

Implements taxonomy mapping, bounds checking, and factory constructors
for all 40+ supported fault types.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from neuromove.resilience.models import (
    FaultCategory,
    FaultDefinition,
    FaultParameters,
    FaultScope,
    FaultSeverity,
    FaultStatus,
    FaultType,
    TriggerType,
)

FAULT_CATEGORY_MAP: dict[FaultType, FaultCategory] = {
    # Transport
    FaultType.STREAM_DISCONNECT: FaultCategory.TRANSPORT,
    FaultType.STREAM_DELAY: FaultCategory.TRANSPORT,
    FaultType.STREAM_EVENT_DROP: FaultCategory.TRANSPORT,
    FaultType.STREAM_EVENT_DUPLICATE: FaultCategory.TRANSPORT,
    FaultType.STREAM_EVENT_REORDER: FaultCategory.TRANSPORT,
    FaultType.STREAM_SEQUENCE_GAP: FaultCategory.TRANSPORT,
    FaultType.WEBSOCKET_DISCONNECT: FaultCategory.TRANSPORT,
    # Data
    FaultType.MALFORMED_PAYLOAD: FaultCategory.DATA,
    FaultType.MISSING_FIELD: FaultCategory.DATA,
    FaultType.INVALID_TIMESTAMP: FaultCategory.DATA,
    FaultType.STALE_DATA: FaultCategory.DATA,
    FaultType.CORRUPTED_FEATURES: FaultCategory.DATA,
    FaultType.EMPTY_SAMPLE: FaultCategory.DATA,
    # Model
    FaultType.MODEL_UNAVAILABLE: FaultCategory.MODEL,
    FaultType.MODEL_VERSION_MISMATCH: FaultCategory.MODEL,
    FaultType.MODEL_ROLLBACK: FaultCategory.MODEL,
    FaultType.MODEL_CORRUPTION_SIMULATED: FaultCategory.MODEL,
    FaultType.CALIBRATION_UNAVAILABLE: FaultCategory.MODEL,
    # Confidence
    FaultType.CONFIDENCE_SERVICE_UNAVAILABLE: FaultCategory.CONFIDENCE,
    FaultType.CONFIDENCE_OUTPUT_MISSING: FaultCategory.CONFIDENCE,
    FaultType.CONFIDENCE_STALE: FaultCategory.CONFIDENCE,
    FaultType.TEMPORAL_STATE_RESET: FaultCategory.CONFIDENCE,
    # Intent
    FaultType.INTENT_SERVICE_UNAVAILABLE: FaultCategory.INTENT,
    FaultType.INTENT_SNAPSHOT_MISSING: FaultCategory.INTENT,
    FaultType.INTENT_EVENT_DUPLICATE: FaultCategory.INTENT,
    FaultType.INTENT_EVENT_OUT_OF_ORDER: FaultCategory.INTENT,
    FaultType.INTENT_STATE_CORRUPTION_SIMULATED: FaultCategory.INTENT,
    # Safety
    FaultType.SAFETY_SERVICE_UNAVAILABLE: FaultCategory.SAFETY,
    FaultType.SAFETY_CONTEXT_UNKNOWN: FaultCategory.SAFETY,
    FaultType.SAFETY_POLICY_UNAVAILABLE: FaultCategory.SAFETY,
    FaultType.SAFETY_EVALUATION_TIMEOUT: FaultCategory.SAFETY,
    # Persistence
    FaultType.DATABASE_UNAVAILABLE: FaultCategory.PERSISTENCE,
    FaultType.DATABASE_WRITE_FAILURE: FaultCategory.PERSISTENCE,
    FaultType.DATABASE_READ_FAILURE: FaultCategory.PERSISTENCE,
    FaultType.TRANSACTION_ROLLBACK: FaultCategory.PERSISTENCE,
    FaultType.SNAPSHOT_UNAVAILABLE: FaultCategory.PERSISTENCE,
    # Service
    FaultType.SERVICE_RESTART: FaultCategory.SERVICE,
    FaultType.SERVICE_TIMEOUT: FaultCategory.SERVICE,
    FaultType.SERVICE_LATENCY: FaultCategory.SERVICE,
    FaultType.DEPENDENCY_UNAVAILABLE: FaultCategory.SERVICE,
    # Timing
    FaultType.CLOCK_SKEW_SIMULATED: FaultCategory.TIMING,
    FaultType.TIMESTAMP_DELAY: FaultCategory.TIMING,
    FaultType.EVENT_DELAY: FaultCategory.TIMING,
    FaultType.TIMEOUT_ACCELERATION: FaultCategory.TIMING,
    # Context
    FaultType.SUBJECT_SWITCH: FaultCategory.CONTEXT,
    FaultType.SESSION_SWITCH: FaultCategory.CONTEXT,
    FaultType.MODEL_CONTEXT_SWITCH: FaultCategory.CONTEXT,
    FaultType.ENVIRONMENT_CONTEXT_LOSS: FaultCategory.CONTEXT,
}

DEFAULT_SEVERITY_MAP: dict[FaultType, FaultSeverity] = {
    FaultType.STREAM_DISCONNECT: FaultSeverity.HIGH,
    FaultType.STREAM_DELAY: FaultSeverity.MEDIUM,
    FaultType.STREAM_EVENT_DROP: FaultSeverity.MEDIUM,
    FaultType.STREAM_EVENT_DUPLICATE: FaultSeverity.LOW,
    FaultType.STREAM_EVENT_REORDER: FaultSeverity.MEDIUM,
    FaultType.STREAM_SEQUENCE_GAP: FaultSeverity.HIGH,
    FaultType.WEBSOCKET_DISCONNECT: FaultSeverity.MEDIUM,
    FaultType.MALFORMED_PAYLOAD: FaultSeverity.HIGH,
    FaultType.MISSING_FIELD: FaultSeverity.MEDIUM,
    FaultType.INVALID_TIMESTAMP: FaultSeverity.HIGH,
    FaultType.STALE_DATA: FaultSeverity.HIGH,
    FaultType.CORRUPTED_FEATURES: FaultSeverity.HIGH,
    FaultType.EMPTY_SAMPLE: FaultSeverity.MEDIUM,
    FaultType.MODEL_UNAVAILABLE: FaultSeverity.CRITICAL,
    FaultType.MODEL_VERSION_MISMATCH: FaultSeverity.HIGH,
    FaultType.MODEL_ROLLBACK: FaultSeverity.HIGH,
    FaultType.MODEL_CORRUPTION_SIMULATED: FaultSeverity.HIGH,
    FaultType.CALIBRATION_UNAVAILABLE: FaultSeverity.HIGH,
    FaultType.CONFIDENCE_SERVICE_UNAVAILABLE: FaultSeverity.CRITICAL,
    FaultType.CONFIDENCE_OUTPUT_MISSING: FaultSeverity.HIGH,
    FaultType.CONFIDENCE_STALE: FaultSeverity.HIGH,
    FaultType.TEMPORAL_STATE_RESET: FaultSeverity.MEDIUM,
    FaultType.INTENT_SERVICE_UNAVAILABLE: FaultSeverity.CRITICAL,
    FaultType.INTENT_SNAPSHOT_MISSING: FaultSeverity.HIGH,
    FaultType.INTENT_EVENT_DUPLICATE: FaultSeverity.LOW,
    FaultType.INTENT_EVENT_OUT_OF_ORDER: FaultSeverity.MEDIUM,
    FaultType.INTENT_STATE_CORRUPTION_SIMULATED: FaultSeverity.HIGH,
    FaultType.SAFETY_SERVICE_UNAVAILABLE: FaultSeverity.CRITICAL,
    FaultType.SAFETY_CONTEXT_UNKNOWN: FaultSeverity.CRITICAL,
    FaultType.SAFETY_POLICY_UNAVAILABLE: FaultSeverity.CRITICAL,
    FaultType.SAFETY_EVALUATION_TIMEOUT: FaultSeverity.HIGH,
    FaultType.DATABASE_UNAVAILABLE: FaultSeverity.CRITICAL,
    FaultType.DATABASE_WRITE_FAILURE: FaultSeverity.HIGH,
    FaultType.DATABASE_READ_FAILURE: FaultSeverity.HIGH,
    FaultType.TRANSACTION_ROLLBACK: FaultSeverity.HIGH,
    FaultType.SNAPSHOT_UNAVAILABLE: FaultSeverity.HIGH,
    FaultType.SERVICE_RESTART: FaultSeverity.HIGH,
    FaultType.SERVICE_TIMEOUT: FaultSeverity.HIGH,
    FaultType.SERVICE_LATENCY: FaultSeverity.MEDIUM,
    FaultType.DEPENDENCY_UNAVAILABLE: FaultSeverity.HIGH,
    FaultType.CLOCK_SKEW_SIMULATED: FaultSeverity.HIGH,
    FaultType.TIMESTAMP_DELAY: FaultSeverity.MEDIUM,
    FaultType.EVENT_DELAY: FaultSeverity.MEDIUM,
    FaultType.TIMEOUT_ACCELERATION: FaultSeverity.MEDIUM,
    FaultType.SUBJECT_SWITCH: FaultSeverity.HIGH,
    FaultType.SESSION_SWITCH: FaultSeverity.HIGH,
    FaultType.MODEL_CONTEXT_SWITCH: FaultSeverity.HIGH,
    FaultType.ENVIRONMENT_CONTEXT_LOSS: FaultSeverity.HIGH,
}


def create_fault_definition(
    fault_type: FaultType,
    severity: FaultSeverity | None = None,
    scope: FaultScope = FaultScope.SINGLE_EVENT,
    target_service: str | None = None,
    target_stream: str | None = None,
    target_session: str | None = None,
    trigger_type: TriggerType = TriggerType.MANUAL,
    trigger_value: str | None = None,
    parameters: dict[str, Any] | FaultParameters | None = None,
    description: str = "",
) -> FaultDefinition:
    """Factory function creating a validated, strongly typed fault definition."""
    category = FAULT_CATEGORY_MAP.get(fault_type, FaultCategory.SERVICE)
    resolved_severity = severity or DEFAULT_SEVERITY_MAP.get(fault_type, FaultSeverity.MEDIUM)

    if parameters is None:
        params_obj = FaultParameters()
    elif isinstance(parameters, dict):
        params_obj = FaultParameters(**parameters)
    else:
        params_obj = parameters

    return FaultDefinition(
        fault_id=f"flt_{uuid.uuid4().hex[:12]}",
        fault_type=fault_type,
        category=category,
        severity=resolved_severity,
        scope=scope,
        status=FaultStatus.DECLARED,
        target_service=target_service,
        target_stream=target_stream,
        target_session=target_session,
        trigger_type=trigger_type,
        trigger_value=trigger_value,
        parameters=params_obj,
        created_at=datetime.now(UTC).isoformat(),
        description=description or f"Controlled {fault_type.value} injection",
    )
