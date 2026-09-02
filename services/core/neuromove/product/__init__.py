"""NeuroMove Phase 24.1 Final Competition Product Foundation Package."""

from neuromove.product.models import (
    DemoResult,
    DemoRun,
    DemoScenarioDescriptor,
    DemoStep,
    ProductProvenance,
    ProductSession,
    SubsystemHealthCard,
    SystemStatusSummary,
)
from neuromove.product.orchestrator import DemoOrchestrator
from neuromove.product.scenarios import ProductGoldenScenarios
from neuromove.product.service import ProductCoordinatorService, default_product_service
from neuromove.product.state_machine import DemoStateMachine, DemoStateMachineError
from neuromove.product.storage import ProductStorage

__all__ = [
    "DemoOrchestrator",
    "DemoResult",
    "DemoRun",
    "DemoScenarioDescriptor",
    "DemoStateMachine",
    "DemoStateMachineError",
    "DemoStep",
    "ProductCoordinatorService",
    "ProductGoldenScenarios",
    "ProductProvenance",
    "ProductSession",
    "ProductStorage",
    "SubsystemHealthCard",
    "SystemStatusSummary",
    "default_product_service",
]
