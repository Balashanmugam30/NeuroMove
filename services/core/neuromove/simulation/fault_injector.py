"""NeuroMove Simulation Fault & Failure Injector.

Enables deterministic chaos engineering and fault injection for resilience testing.
"""

from __future__ import annotations

from enum import StrEnum


class FaultType(StrEnum):
    EEG_DISCONNECT = "EEG_DISCONNECT"
    EEG_DROPOUT = "EEG_DROPOUT"
    NOISY_EEG = "NOISY_EEG"
    LOW_SIGNAL_QUALITY = "LOW_SIGNAL_QUALITY"
    PREDICTION_UNCERTAIN = "PREDICTION_UNCERTAIN"
    OBSTACLE_FRONT = "OBSTACLE_FRONT"
    OBSTACLE_LEFT = "OBSTACLE_LEFT"
    OBSTACLE_RIGHT = "OBSTACLE_RIGHT"
    ROBOT_DISCONNECT = "ROBOT_DISCONNECT"
    NETWORK_LOSS = "NETWORK_LOSS"
    EMERGENCY = "EMERGENCY"


class FaultInjector:
    """Manages active simulated faults."""

    def __init__(self) -> None:
        self._active_faults: set[FaultType] = set()

    def inject(self, fault: FaultType) -> None:
        """Arm a specific simulated fault."""
        self._active_faults.add(fault)

    def clear(self, fault: FaultType | None = None) -> None:
        """Clear a single fault or all active faults."""
        if fault is None:
            self._active_faults.clear()
        else:
            self._active_faults.discard(fault)

    def is_active(self, fault: FaultType) -> bool:
        """Check if a specific fault is active."""
        return fault in self._active_faults

    def active_faults(self) -> list[str]:
        """Return list of active fault names."""
        return [f.value for f in self._active_faults]
