"""NeuroMove Phase 18 Resilience and Fault Laboratory Subsystem.

Provides deterministic failure injection, pipeline observation, invariant
evaluations, safe recovery checkpoints, scenario executions, and experiment replay.
"""

from neuromove.resilience.faults import (
    DEFAULT_SEVERITY_MAP,
    FAULT_CATEGORY_MAP,
    create_fault_definition,
)
from neuromove.resilience.injector import FaultInjector
from neuromove.resilience.invariants import InvariantEngine
from neuromove.resilience.models import (
    DataLossStatus,
    FailureScenarioResult,
    FaultCategory,
    FaultDefinition,
    FaultExperiment,
    FaultExperimentManifest,
    FaultInjectionRequest,
    FaultInjectionResult,
    FaultParameters,
    FaultScope,
    FaultSeverity,
    FaultStatus,
    FaultType,
    InvariantResult,
    InvariantStatus,
    PipelineHealthSnapshot,
    RecoveryCheckpoint,
    RecoveryStatus,
    ResilienceLabStatus,
    ResilienceMetrics,
    TriggerType,
)
from neuromove.resilience.observers import PipelineObserver
from neuromove.resilience.recovery import RecoveryOrchestrator
from neuromove.resilience.replay import ReplayEngine
from neuromove.resilience.scenarios import ScenarioRegistry
from neuromove.resilience.service import ResilienceService, default_resilience_service
from neuromove.resilience.storage import ResilienceStorage

__all__ = [
    "FAULT_CATEGORY_MAP",
    "DEFAULT_SEVERITY_MAP",
    "create_fault_definition",
    "FaultInjector",
    "InvariantEngine",
    "DataLossStatus",
    "FailureScenarioResult",
    "FaultCategory",
    "FaultDefinition",
    "FaultExperiment",
    "FaultExperimentManifest",
    "FaultInjectionRequest",
    "FaultInjectionResult",
    "FaultParameters",
    "FaultScope",
    "FaultSeverity",
    "FaultStatus",
    "FaultType",
    "InvariantResult",
    "InvariantStatus",
    "PipelineHealthSnapshot",
    "RecoveryCheckpoint",
    "RecoveryStatus",
    "ResilienceLabStatus",
    "ResilienceMetrics",
    "TriggerType",
    "PipelineObserver",
    "RecoveryOrchestrator",
    "ReplayEngine",
    "ScenarioRegistry",
    "ResilienceService",
    "default_resilience_service",
    "ResilienceStorage",
]
