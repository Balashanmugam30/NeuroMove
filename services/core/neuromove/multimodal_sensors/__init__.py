"""NeuroMove — Phase 23 Multimodal Sensors, Sensor Fusion & Context Engine Package."""

from neuromove.multimodal_sensors.calibration import MultimodalCalibrationManager
from neuromove.multimodal_sensors.clock import MultimodalClockNormalizer
from neuromove.multimodal_sensors.context import NeurophysiologyContextEngine
from neuromove.multimodal_sensors.contradiction import ContradictionDetector
from neuromove.multimodal_sensors.devices import SensorDeviceRegistry
from neuromove.multimodal_sensors.fusion import SensorFusionEngine
from neuromove.multimodal_sensors.models import (
    ContradictionRecord,
    FusionEvidence,
    FusionResult,
    MultimodalAnalyticsSummary,
    MultimodalContext,
    MultimodalReplayFixture,
    MultimodalSession,
    MultimodalSyncState,
    SensorCalibrationSnapshot,
    SensorChannelHealth,
    SensorDeviceDescriptor,
    SensorHealthSnapshot,
    SensorStreamPacket,
)
from neuromove.multimodal_sensors.qc import MultimodalQcEngine
from neuromove.multimodal_sensors.service import MultimodalSensorService, default_multimodal_service
from neuromove.multimodal_sensors.storage import MultimodalSensorStorage
from neuromove.multimodal_sensors.sync import MultimodalSyncCoordinator

__all__ = [
    "SensorDeviceDescriptor",
    "SensorChannelHealth",
    "SensorHealthSnapshot",
    "SensorStreamPacket",
    "MultimodalSyncState",
    "SensorCalibrationSnapshot",
    "FusionEvidence",
    "ContradictionRecord",
    "FusionResult",
    "MultimodalContext",
    "MultimodalSession",
    "MultimodalReplayFixture",
    "MultimodalAnalyticsSummary",
    "SensorDeviceRegistry",
    "MultimodalClockNormalizer",
    "MultimodalSyncCoordinator",
    "MultimodalQcEngine",
    "MultimodalCalibrationManager",
    "ContradictionDetector",
    "SensorFusionEngine",
    "NeurophysiologyContextEngine",
    "MultimodalReplayEngine",
    "MultimodalSensorStorage",
    "MultimodalSensorService",
    "MultimodalGoldenScenarios",
    "default_multimodal_service",
]

