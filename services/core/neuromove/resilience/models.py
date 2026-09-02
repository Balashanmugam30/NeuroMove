"""Domain Models and Enums for Phase 18 Resilience & Fault Laboratory.

Defines canonical fault types, severity, lifecycle states, triggers,
manifests, recovery checkpoints, invariant outcomes, and experiment results.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from neuromove.domain.enums import SafetyDecision
from neuromove.safety.models import SafetyArbitrationState


class FaultCategory(StrEnum):
    """Universal fault category taxonomy."""

    TRANSPORT = "TRANSPORT"
    DATA = "DATA"
    MODEL = "MODEL"
    CONFIDENCE = "CONFIDENCE"
    INTENT = "INTENT"
    SAFETY = "SAFETY"
    PERSISTENCE = "PERSISTENCE"
    SERVICE = "SERVICE"
    TIMING = "TIMING"
    CONTEXT = "CONTEXT"


class FaultType(StrEnum):
    """Canonical classification of fault types across all subsystem boundaries."""

    # Transport
    STREAM_DISCONNECT = "STREAM_DISCONNECT"
    STREAM_DELAY = "STREAM_DELAY"
    STREAM_EVENT_DROP = "STREAM_EVENT_DROP"
    STREAM_EVENT_DUPLICATE = "STREAM_EVENT_DUPLICATE"
    STREAM_EVENT_REORDER = "STREAM_EVENT_REORDER"
    STREAM_SEQUENCE_GAP = "STREAM_SEQUENCE_GAP"
    WEBSOCKET_DISCONNECT = "WEBSOCKET_DISCONNECT"

    # Data
    MALFORMED_PAYLOAD = "MALFORMED_PAYLOAD"
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_TIMESTAMP = "INVALID_TIMESTAMP"
    STALE_DATA = "STALE_DATA"
    CORRUPTED_FEATURES = "CORRUPTED_FEATURES"
    EMPTY_SAMPLE = "EMPTY_SAMPLE"

    # Model
    MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
    MODEL_VERSION_MISMATCH = "MODEL_VERSION_MISMATCH"
    MODEL_ROLLBACK = "MODEL_ROLLBACK"
    MODEL_CORRUPTION_SIMULATED = "MODEL_CORRUPTION_SIMULATED"
    CALIBRATION_UNAVAILABLE = "CALIBRATION_UNAVAILABLE"

    # Confidence
    CONFIDENCE_SERVICE_UNAVAILABLE = "CONFIDENCE_SERVICE_UNAVAILABLE"
    CONFIDENCE_OUTPUT_MISSING = "CONFIDENCE_OUTPUT_MISSING"
    CONFIDENCE_STALE = "CONFIDENCE_STALE"
    TEMPORAL_STATE_RESET = "TEMPORAL_STATE_RESET"

    # Intent
    INTENT_SERVICE_UNAVAILABLE = "INTENT_SERVICE_UNAVAILABLE"
    INTENT_SNAPSHOT_MISSING = "INTENT_SNAPSHOT_MISSING"
    INTENT_EVENT_DUPLICATE = "INTENT_EVENT_DUPLICATE"
    INTENT_EVENT_OUT_OF_ORDER = "INTENT_EVENT_OUT_OF_ORDER"
    INTENT_STATE_CORRUPTION_SIMULATED = "INTENT_STATE_CORRUPTION_SIMULATED"

    # Safety
    SAFETY_SERVICE_UNAVAILABLE = "SAFETY_SERVICE_UNAVAILABLE"
    SAFETY_CONTEXT_UNKNOWN = "SAFETY_CONTEXT_UNKNOWN"
    SAFETY_POLICY_UNAVAILABLE = "SAFETY_POLICY_UNAVAILABLE"
    SAFETY_EVALUATION_TIMEOUT = "SAFETY_EVALUATION_TIMEOUT"

    # Persistence
    DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"
    DATABASE_WRITE_FAILURE = "DATABASE_WRITE_FAILURE"
    DATABASE_READ_FAILURE = "DATABASE_READ_FAILURE"
    TRANSACTION_ROLLBACK = "TRANSACTION_ROLLBACK"
    SNAPSHOT_UNAVAILABLE = "SNAPSHOT_UNAVAILABLE"

    # Service
    SERVICE_RESTART = "SERVICE_RESTART"
    SERVICE_TIMEOUT = "SERVICE_TIMEOUT"
    SERVICE_LATENCY = "SERVICE_LATENCY"
    DEPENDENCY_UNAVAILABLE = "DEPENDENCY_UNAVAILABLE"

    # Timing
    CLOCK_SKEW_SIMULATED = "CLOCK_SKEW_SIMULATED"
    TIMESTAMP_DELAY = "TIMESTAMP_DELAY"
    EVENT_DELAY = "EVENT_DELAY"
    TIMEOUT_ACCELERATION = "TIMEOUT_ACCELERATION"

    # Context
    SUBJECT_SWITCH = "SUBJECT_SWITCH"
    SESSION_SWITCH = "SESSION_SWITCH"
    MODEL_CONTEXT_SWITCH = "MODEL_CONTEXT_SWITCH"
    ENVIRONMENT_CONTEXT_LOSS = "ENVIRONMENT_CONTEXT_LOSS"


class FaultSeverity(StrEnum):
    """Explicit fault severity level."""

    INFO = "INFO"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FaultScope(StrEnum):
    """Boundary of fault application."""

    SINGLE_EVENT = "SINGLE_EVENT"
    WINDOW = "WINDOW"
    SESSION = "SESSION"
    SERVICE = "SERVICE"
    GLOBAL_SIMULATION = "GLOBAL_SIMULATION"


class FaultStatus(StrEnum):
    """Lifecycle state of an injected fault."""

    DECLARED = "DECLARED"
    ARMED = "ARMED"
    ACTIVE = "ACTIVE"
    DETECTED = "DETECTED"
    RECOVERING = "RECOVERING"
    CLEARED = "CLEARED"
    FAILED = "FAILED"


class TriggerType(StrEnum):
    """Deterministic activation trigger for faults."""

    MANUAL = "MANUAL"
    AFTER_N_EVENTS = "AFTER_N_EVENTS"
    AT_SEQUENCE = "AT_SEQUENCE"
    AT_TIMESTAMP = "AT_TIMESTAMP"
    AFTER_STATE = "AFTER_STATE"
    AFTER_SCENARIO_STEP = "AFTER_SCENARIO_STEP"


class InvariantStatus(StrEnum):
    """Formal verification verdict for an invariant rule."""

    PASS = "PASS"
    FAIL = "FAIL"
    UNCERTAIN = "UNCERTAIN"


class RecoveryStatus(StrEnum):
    """Post-fault recovery outcome classification."""

    RECOVERED_CLEANLY = "RECOVERED_CLEANLY"
    RECOVERED_RESTRICTIVELY = "RECOVERED_RESTRICTIVELY"
    RECOVERED_WITH_DATA_LOSS = "RECOVERED_WITH_DATA_LOSS"
    RECOVERY_FAILED = "RECOVERY_FAILED"
    RECOVERY_UNCERTAIN = "RECOVERY_UNCERTAIN"


class DataLossStatus(StrEnum):
    """Data loss classification during recovery."""

    NONE = "NONE"
    TRANSIENT = "TRANSIENT"
    AUDIT_ONLY = "AUDIT_ONLY"
    NON_CRITICAL = "NON_CRITICAL"
    CRITICAL = "CRITICAL"


class FaultParameters(BaseModel):
    """Bounded, validated configuration parameters for fault behavior."""

    delay_ms: float | None = Field(default=None, ge=0.0, le=60000.0)
    drop_count: int | None = Field(default=None, ge=1, le=100)
    duplicate_count: int | None = Field(default=None, ge=1, le=100)
    reorder_offset: int | None = Field(default=None, ge=1, le=50)
    clock_skew_ms: float | None = Field(default=None, ge=-86400000.0, le=86400000.0)
    missing_fields: list[str] = Field(default_factory=list)
    invalid_values: dict[str, Any] = Field(default_factory=dict)
    target_component: str | None = None
    operation: str | None = None
    failure_count: int | None = Field(default=None, ge=1, le=100)
    duration_ms: float | None = Field(default=None, ge=0.0, le=300000.0)
    custom_params: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="ignore")


class FaultDefinition(BaseModel):
    """Full immutable specification of an individual fault."""

    fault_id: str = Field(default_factory=lambda: f"flt_{uuid.uuid4().hex[:12]}")
    fault_type: FaultType
    category: FaultCategory
    severity: FaultSeverity = FaultSeverity.MEDIUM
    scope: FaultScope = FaultScope.SINGLE_EVENT
    status: FaultStatus = FaultStatus.DECLARED
    target_service: str | None = None
    target_stream: str | None = None
    target_session: str | None = None
    trigger_type: TriggerType = TriggerType.MANUAL
    trigger_value: str | None = None
    parameters: FaultParameters = Field(default_factory=FaultParameters)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    armed_at: str | None = None
    activated_at: str | None = None
    cleared_at: str | None = None
    description: str = ""

    model_config = ConfigDict(extra="ignore")


class FaultInjectionRequest(BaseModel):
    """Client request schema to inject a fault."""

    fault_type: FaultType
    severity: FaultSeverity = FaultSeverity.MEDIUM
    scope: FaultScope = FaultScope.SINGLE_EVENT
    target_service: str | None = None
    target_stream: str | None = None
    target_session: str | None = None
    trigger_type: TriggerType = TriggerType.MANUAL
    trigger_value: str | None = None
    parameters: FaultParameters = Field(default_factory=FaultParameters)
    description: str = ""

    model_config = ConfigDict(extra="ignore")


class FaultInjectionResult(BaseModel):
    """Response returned after fault injection."""

    success: bool = True
    fault: FaultDefinition
    message: str = ""

    model_config = ConfigDict(extra="ignore")


class InvariantResult(BaseModel):
    """Result of an invariant verification check."""

    invariant_id: str
    name: str
    status: InvariantStatus
    severity: FaultSeverity = FaultSeverity.HIGH
    observed_value: str
    expected_value: str
    evidence: dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())

    model_config = ConfigDict(extra="ignore")


class RecoveryCheckpoint(BaseModel):
    """Deterministic snapshot captured before fault injection or after recovery."""

    checkpoint_id: str = Field(default_factory=lambda: f"chk_{uuid.uuid4().hex[:12]}")
    experiment_id: str
    component: str
    last_known_safe_state: str
    sequence_number: int
    snapshot_version: str
    checksum: str
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    details: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="ignore")


class PipelineHealthSnapshot(BaseModel):
    """Unified, read-only observer diagnostic snapshot across all subsystems."""

    transport_healthy: bool = True
    confidence_healthy: bool = True
    intent_healthy: bool = True
    safety_healthy: bool = True
    database_healthy: bool = True
    active_model_healthy: bool = True
    active_faults_count: int = 0
    current_safety_state: SafetyArbitrationState = SafetyArbitrationState.SAFE_IDLE
    current_safety_decision: SafetyDecision = SafetyDecision.DENIED
    current_intent_state: str | None = None
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())

    model_config = ConfigDict(extra="ignore")


class FaultExperimentManifest(BaseModel):
    """Immutable experiment manifest detailing conditions, parameters, and expected invariants."""

    experiment_id: str = Field(default_factory=lambda: f"exp_{uuid.uuid4().hex[:12]}")
    experiment_name: str
    scenario_id: str
    seed: int = 42
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    operator: str = "researcher"
    subject_id: str = "sub-01"
    session_id: str = "sess-01"
    starting_model_version: str = "model_v1"
    starting_confidence_config: str = "default_v1"
    starting_intent_policy: str = "v1.0.0"
    starting_safety_policy: str = "1.0.0"
    fault_sequence: list[FaultDefinition] = Field(default_factory=list)
    expected_invariants: list[str] = Field(default_factory=list)
    manifest_checksum: str = ""

    model_config = ConfigDict(extra="ignore")

    def compute_checksum(self) -> str:
        """Compute SHA-256 manifest hash for cryptographic audit and replay."""
        serialized = json.dumps(
            {
                "experiment_name": self.experiment_name,
                "scenario_id": self.scenario_id,
                "seed": self.seed,
                "subject_id": self.subject_id,
                "session_id": self.session_id,
                "starting_model_version": self.starting_model_version,
                "starting_confidence_config": self.starting_confidence_config,
                "starting_intent_policy": self.starting_intent_policy,
                "starting_safety_policy": self.starting_safety_policy,
                "faults": [f.fault_type.value for f in self.fault_sequence],
                "expected_invariants": self.expected_invariants,
            },
            sort_keys=True,
        )
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]


class FaultExperiment(BaseModel):
    """Full historical record of an executed resilience experiment."""

    experiment_id: str
    scenario_id: str
    name: str
    seed: int
    status: str = "PASSED"  # RUNNING, PASSED, FAILED, UNCERTAIN
    manifest: FaultExperimentManifest
    baseline_snapshot: PipelineHealthSnapshot
    final_snapshot: PipelineHealthSnapshot
    invariants: list[InvariantResult] = Field(default_factory=list)
    recovery_status: RecoveryStatus = RecoveryStatus.RECOVERED_CLEANLY
    data_loss_status: DataLossStatus = DataLossStatus.NONE
    authorization_before_failure: bool = False
    authorization_during_failure: bool = False
    authorization_after_failure: bool = False
    steps_audit: list[dict[str, Any]] = Field(default_factory=list)
    replay_hash: str = ""
    artifact_checksum: str = ""
    started_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    ended_at: str | None = None
    duration_ms: float = 0.0

    model_config = ConfigDict(extra="ignore")


class ResilienceMetrics(BaseModel):
    """Operational reliability and fail-closed certification metrics."""

    total_experiments: int = 0
    passed_experiments: int = 0
    failed_experiments: int = 0
    uncertain_experiments: int = 0
    total_invariants_checked: int = 0
    invariants_passed: int = 0
    invariants_failed: int = 0
    accidental_authorizations: int = 0
    fail_closed_certifications: int = 0
    replays_executed: int = 0
    replays_matched: int = 0
    active_faults_count: int = 0

    model_config = ConfigDict(extra="ignore")


class FailureScenarioResult(BaseModel):
    """Result of executing a canonical scenario from the failure registry."""

    scenario_id: str
    name: str
    category: FaultCategory
    description: str
    passed: bool
    fail_closed_certified: bool
    expected_safety_decision: SafetyDecision
    observed_safety_decision: SafetyDecision
    expected_safety_state: SafetyArbitrationState
    observed_safety_state: SafetyArbitrationState
    recovery_status: RecoveryStatus
    experiment_id: str
    steps_audit: list[dict[str, Any]] = Field(default_factory=list)
    replay_hash: str = ""

    model_config = ConfigDict(extra="ignore")


class ResilienceLabStatus(BaseModel):
    """Authoritative status of the resilience laboratory."""

    lab_mode: str = "IDLE"  # IDLE, EXPERIMENT_ACTIVE, RECOVERING, SIMULATION
    active_faults: list[FaultDefinition] = Field(default_factory=list)
    pipeline_health: PipelineHealthSnapshot
    metrics: ResilienceMetrics
    updated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())

    model_config = ConfigDict(extra="ignore")
