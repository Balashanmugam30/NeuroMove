"""Domain models for Phase 24.1 Final Competition Product Foundation & Demo Orchestration."""

from __future__ import annotations

import datetime
from typing import Any

from pydantic import BaseModel, Field

from neuromove.domain.enums import (
    DemoState,
    ProductDemoScenario,
    ProductExecutionOutcome,
    ProductSessionStatus,
    ProductStage,
    SafetyDecision,
    SensorSource,
    SystemHealthStatus,
)


class SubsystemHealthCard(BaseModel):
    """Health indicator card for a technical subsystem."""

    subsystem_id: str
    name: str
    status: SystemHealthStatus = SystemHealthStatus.HEALTHY
    source_type: SensorSource = SensorSource.SIMULATOR
    summary: str
    key_metrics: dict[str, Any] = Field(default_factory=dict)
    last_updated: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC).isoformat()
    )
    is_operational: bool = True
    route_href: str = "/overview"


class SystemStatusSummary(BaseModel):
    """Unified system status aggregating all Phase 01-23 subsystems."""

    overall_status: SystemHealthStatus = SystemHealthStatus.HEALTHY
    product_session_id: str = "prod_sess_default"
    active_source: SensorSource = SensorSource.SIMULATOR
    is_live_streaming: bool = False
    subsystems: dict[str, SubsystemHealthCard] = Field(default_factory=dict)
    current_stage: ProductStage = ProductStage.SENSORS
    safety_armed: bool = True
    hil_ready: bool = True
    last_check_time: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC).isoformat()
    )


class ProductProvenance(BaseModel):
    """End-to-end scientific and cryptographic lineage for product execution."""

    product_session_id: str
    acquisition_session_id: str | None = None
    sensor_session_id: str | None = None
    experiment_id: str | None = None
    model_version_id: str = "csp_lda_v2.4"
    confidence_policy: str = "STRICT_RESEARCH_FUSION"
    intent_id: str | None = None
    safety_decision: SafetyDecision = SafetyDecision.AUTHORIZED
    hil_session_id: str | None = None
    source_checksum: str = ""
    manifest_hash: str = ""
    provenance_hash: str = ""


class ProductSession(BaseModel):
    """High-level product session connecting subsystem identifiers."""

    session_id: str
    title: str = "Competition Product Session"
    subject_id: str = "SUBJ_PILOT_01"
    source_type: SensorSource = SensorSource.SIMULATOR
    status: ProductSessionStatus = ProductSessionStatus.ACTIVE
    acquisition_session_id: str | None = None
    sensor_session_id: str | None = None
    model_version: str = "csp_lda_v2.4"
    confidence_policy: str = "STRICT_RESEARCH_FUSION"
    intent_id: str | None = None
    safety_decision: SafetyDecision = SafetyDecision.AUTHORIZED
    hil_session_id: str | None = None
    experiment_id: str | None = None
    manifest_hash: str = ""
    provenance_hash: str = ""
    created_at: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC).isoformat()
    )


class DemoStep(BaseModel):
    """Single step in the 9-step guided product demonstration."""

    step_index: int = Field(ge=1, le=9)
    step_key: str
    title: str
    description: str
    stage: ProductStage
    status: str = "PENDING"  # PENDING | IN_PROGRESS | COMPLETED | BLOCKED | FAILED
    metrics: dict[str, Any] = Field(default_factory=dict)
    explanation: str = ""


class DemoRun(BaseModel):
    """Active demonstration run driving the 9-step pipeline."""

    run_id: str
    scenario_id: ProductDemoScenario = ProductDemoScenario.PRODUCT_A
    product_session_id: str
    state: DemoState = DemoState.IDLE
    current_step: int = 1
    total_steps: int = 9
    source_type: SensorSource = SensorSource.SIMULATOR
    steps: list[DemoStep] = Field(default_factory=list)
    candidate_intent: str = "REST"
    confidence_score: float = 0.0
    safety_verdict: SafetyDecision = SafetyDecision.AUTHORIZED
    hil_ack: bool = False
    is_blocked: bool = False
    block_reason: str | None = None
    error_message: str | None = None
    reproducibility_status: str = "NOT_CHECKED"  # PASS | APPROXIMATE | FAIL | NOT_CHECKED
    duration_ms: float = 0.0
    created_at: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC).isoformat()
    )
    completed_at: str | None = None


class DemoResult(BaseModel):
    """Sealed evaluation result of an end-to-end demonstration."""

    result_id: str
    run_id: str
    scenario_id: ProductDemoScenario = ProductDemoScenario.PRODUCT_A
    status: ProductExecutionOutcome = ProductExecutionOutcome.PASS
    source_type: SensorSource = SensorSource.SIMULATOR
    candidate_intent: str = "REST"
    confidence_score: float = 0.0
    safety_verdict: SafetyDecision = SafetyDecision.AUTHORIZED
    hil_status: str = "ACKNOWLEDGED"
    latency_breakdown: dict[str, float] = Field(default_factory=dict)
    provenance: ProductProvenance | None = None
    explanation_text: str = ""
    created_at: str = Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC).isoformat()
    )


class DemoScenarioDescriptor(BaseModel):
    """Metadata descriptor for a demonstration scenario."""

    id: ProductDemoScenario
    name: str
    tagline: str
    description: str
    expected_outcome: ProductExecutionOutcome
    expected_safety: SafetyDecision
    is_deterministic: bool = True
    source: SensorSource = SensorSource.SIMULATOR
