"""NeuroMove — Real EEG / BioAmp Acquisition, Device Ingestion & End-to-End Live Pipeline (Phase 21)."""

from neuromove.eeg_acquisition.adapters.base import EegAcquisitionAdapter
from neuromove.eeg_acquisition.adapters.physical import PhysicalEegAcquisitionAdapter
from neuromove.eeg_acquisition.adapters.recorded import RecordedEegAcquisitionAdapter
from neuromove.eeg_acquisition.adapters.simulated import SimulatedEegAcquisitionAdapter
from neuromove.eeg_acquisition.buffer import BoundedEegBuffer
from neuromove.eeg_acquisition.calibration import EegCalibrationWorkflow
from neuromove.eeg_acquisition.clock import EegClockNormalizer
from neuromove.eeg_acquisition.models import (
    ChannelQcStatus,
    EegAcquisitionConfig,
    EegAcquisitionDiagnostic,
    EegAcquisitionSession,
    EegAcquisitionSource,
    EegAcquisitionState,
    EegCalibrationSnapshot,
    EegChannelDescriptor,
    EegChannelHealthSnapshot,
    EegClockInfo,
    EegDeviceDescriptor,
    EegE2EExperiment,
    EegE2EResult,
    EegLiveInferenceSummary,
    EegRecordingManifest,
    EegReplayState,
    EegSamplePacket,
    EegStreamHealthSnapshot,
)
from neuromove.eeg_acquisition.pipeline_bridge import LiveNeurophysiologyBridge
from neuromove.eeg_acquisition.qc import EegSignalQcEngine
from neuromove.eeg_acquisition.scenarios import EegScenarioRegistry
from neuromove.eeg_acquisition.service import EegAcquisitionService, default_eeg_acquisition_service
from neuromove.eeg_acquisition.storage import EegAcquisitionStorage

__all__ = [
    "BoundedEegBuffer",
    "ChannelQcStatus",
    "EegAcquisitionAdapter",
    "EegAcquisitionConfig",
    "EegAcquisitionDiagnostic",
    "EegAcquisitionService",
    "EegAcquisitionSession",
    "EegAcquisitionSource",
    "EegAcquisitionState",
    "EegAcquisitionStorage",
    "EegCalibrationSnapshot",
    "EegCalibrationWorkflow",
    "EegChannelDescriptor",
    "EegChannelHealthSnapshot",
    "EegClockInfo",
    "EegClockNormalizer",
    "EegDeviceDescriptor",
    "EegE2EExperiment",
    "EegE2EResult",
    "EegLiveInferenceSummary",
    "EegRecordingManifest",
    "EegReplayState",
    "EegSamplePacket",
    "EegScenarioRegistry",
    "EegSignalQcEngine",
    "EegStreamHealthSnapshot",
    "LiveNeurophysiologyBridge",
    "PhysicalEegAcquisitionAdapter",
    "RecordedEegAcquisitionAdapter",
    "SimulatedEegAcquisitionAdapter",
    "default_eeg_acquisition_service",
]
