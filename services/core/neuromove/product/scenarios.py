"""6 Golden Demonstration Scenarios for Competition Product Layer."""

from __future__ import annotations

from neuromove.domain.enums import (
    ProductDemoScenario,
    ProductExecutionOutcome,
    SafetyDecision,
    SensorSource,
)
from neuromove.product.models import DemoScenarioDescriptor


class ProductGoldenScenarios:
    """Registry and definitions for the 6 Golden Product Scenarios."""

    SCENARIOS: list[DemoScenarioDescriptor] = [
        DemoScenarioDescriptor(
            id=ProductDemoScenario.PRODUCT_A,
            name="Guided Happy Path Baseline",
            tagline="End-to-End Multimodal Acquisition to Virtual HIL Dispatch",
            description=(
                "Demonstrates the nominal complete flow: Simulated EEG + IMU streams, "
                "real-time clock synchronization, CSP/LDA intent decoding, temporal confidence "
                "confirmation (> 0.90), Phase 17 Safety Authorization, and ESP32 virtual HIL acknowledgment."
            ),
            expected_outcome=ProductExecutionOutcome.PASS,
            expected_safety=SafetyDecision.AUTHORIZED,
            is_deterministic=True,
            source=SensorSource.SIMULATOR,
        ),
        DemoScenarioDescriptor(
            id=ProductDemoScenario.PRODUCT_B,
            name="Safety Protection & Confidence Gating",
            tagline="Sub-Threshold Confidence Triggers Immediate Safety Hold",
            description=(
                "Simulates ambiguous EEG motor imagery with low confidence (0.42). "
                "The safety arbitration gate detects inadequate evidence and holds execution. "
                "Zero transport frames are transmitted and zero HIL actions occur."
            ),
            expected_outcome=ProductExecutionOutcome.BLOCKED,
            expected_safety=SafetyDecision.HELD,
            is_deterministic=True,
            source=SensorSource.SIMULATOR,
        ),
        DemoScenarioDescriptor(
            id=ProductDemoScenario.PRODUCT_C,
            name="Multimodal Sensor Context Invalidation",
            tagline="Auxiliary Motion Contradiction Blocks Downstream Actuation",
            description=(
                "Injects sudden head/chassis acceleration during candidate forward intent. "
                "The Sensor Fusion Engine detects an INTENT_VS_MOTION contradiction, "
                "capping confidence at 0.40 and activating the safety interlock."
            ),
            expected_outcome=ProductExecutionOutcome.BLOCKED,
            expected_safety=SafetyDecision.HELD,
            is_deterministic=True,
            source=SensorSource.SIMULATOR,
        ),
        DemoScenarioDescriptor(
            id=ProductDemoScenario.PRODUCT_D,
            name="Recorded Replay & Scientific Provenance",
            tagline="Deterministic Fixture Replay with Bit-for-Bit Checksum Verification",
            description=(
                "Replays a sealed multimodal dataset fixture (EEG + IMU). "
                "The evaluation pipeline yields an identical prediction, context score, "
                "and cryptographic provenance hash confirming scientific reproducibility."
            ),
            expected_outcome=ProductExecutionOutcome.PASS,
            expected_safety=SafetyDecision.AUTHORIZED,
            is_deterministic=True,
            source=SensorSource.RECORDED,
        ),
        DemoScenarioDescriptor(
            id=ProductDemoScenario.PRODUCT_E,
            name="Resilience Fault Injection & Auto-Recovery",
            tagline="Live Sensor Dropout Followed by Dynamic Recalibration Recovery",
            description=(
                "Injects a transient channel dropout fault triggering QC degradation, "
                "followed by an automated recalibration protocol that restores clean "
                "synchronized state and enables safe resumption."
            ),
            expected_outcome=ProductExecutionOutcome.PASS,
            expected_safety=SafetyDecision.AUTHORIZED,
            is_deterministic=True,
            source=SensorSource.SIMULATOR,
        ),
        DemoScenarioDescriptor(
            id=ProductDemoScenario.PRODUCT_F,
            name="Product Clean State Reset",
            tagline="Instant Non-Destructive Reset of Product State Machine & Session",
            description=(
                "Performs a one-click purge of active demo runs, transient cache, "
                "and WebSocket buffers while preserving underlying historical research databases."
            ),
            expected_outcome=ProductExecutionOutcome.PASS,
            expected_safety=SafetyDecision.AUTHORIZED,
            is_deterministic=True,
            source=SensorSource.SIMULATOR,
        ),
    ]

    @classmethod
    def list_scenarios(cls) -> list[DemoScenarioDescriptor]:
        """Return all scenario descriptors."""
        return cls.SCENARIOS

    @classmethod
    def get_scenario(cls, scenario_id: ProductDemoScenario | str) -> DemoScenarioDescriptor:
        """Find a scenario by id."""
        for sc in cls.SCENARIOS:
            if sc.id == scenario_id or sc.id.value == scenario_id:
                return sc
        raise ValueError(f"Unknown scenario identifier: {scenario_id}")
