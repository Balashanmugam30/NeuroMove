"""Robot Protocol and Mobility Command Interface (Phase 02+).

Implements serial packet framing, CRC16 verification, watchdog heartbeats,
and velocity translation for ESP32 motor drivers.
"""

from services.core.neuromove.domain.models import CommandPayload, RobotState

__all__ = ["CommandPayload", "RobotState"]
