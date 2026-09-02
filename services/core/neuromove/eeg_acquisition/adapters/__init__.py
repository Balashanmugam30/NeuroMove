"""NeuroMove — Phase 21 Acquisition Adapters."""

from neuromove.eeg_acquisition.adapters.base import EegAcquisitionAdapter
from neuromove.eeg_acquisition.adapters.physical import PhysicalEegAcquisitionAdapter
from neuromove.eeg_acquisition.adapters.recorded import RecordedEegAcquisitionAdapter
from neuromove.eeg_acquisition.adapters.simulated import SimulatedEegAcquisitionAdapter

__all__ = [
    "EegAcquisitionAdapter",
    "PhysicalEegAcquisitionAdapter",
    "RecordedEegAcquisitionAdapter",
    "SimulatedEegAcquisitionAdapter",
]
