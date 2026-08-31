"""NeuroMove Synthetic Obstacle & Proximity Sensor Simulator.

Provides independent environmental proximity telemetry for safety arbitration testing.
"""

from __future__ import annotations

import random
from typing import Literal

from pydantic import BaseModel, Field

ObstacleDirection = Literal["FRONT", "LEFT", "RIGHT", "NONE"]


class ObstacleData(BaseModel):
    """Environmental proximity and obstacle telemetry."""

    front_cm: float = Field(
        default=200.0, ge=0.0, description="Front proximity sensor distance (cm)"
    )
    left_cm: float = Field(default=200.0, ge=0.0, description="Left proximity sensor distance (cm)")
    right_cm: float = Field(
        default=200.0, ge=0.0, description="Right proximity sensor distance (cm)"
    )
    obstacle_present: bool = Field(
        default=False, description="True if any sensor is below safe threshold"
    )
    direction: ObstacleDirection = Field(default="NONE", description="Closest obstacle sector")
    distance_cm: float = Field(
        default=200.0, ge=0.0, description="Minimum distance to nearest obstacle (cm)"
    )
    confidence: float = Field(default=0.99, ge=0.0, le=1.0, description="Sensor reading confidence")


class ObstacleSimulator:
    """Deterministic proximity sensor simulator."""

    def __init__(self, seed: int = 42) -> None:
        self._rng = random.Random(seed)
        self._front_cm: float = 200.0
        self._left_cm: float = 200.0
        self._right_cm: float = 200.0

    def set_obstacle(self, direction: ObstacleDirection, distance_cm: float) -> None:
        """Inject an obstacle at a specific direction and distance."""
        if direction == "FRONT":
            self._front_cm = distance_cm
        elif direction == "LEFT":
            self._left_cm = distance_cm
        elif direction == "RIGHT":
            self._right_cm = distance_cm
        else:
            self._front_cm = 200.0
            self._left_cm = 200.0
            self._right_cm = 200.0

    def clear(self) -> None:
        """Clear all proximity obstacles."""
        self._front_cm = 200.0
        self._left_cm = 200.0
        self._right_cm = 200.0

    def sample(self) -> ObstacleData:
        """Generate current proximity telemetry reading."""
        # Add subtle sensor noise (+- 1 cm)
        front_val = max(0.0, round(self._front_cm + self._rng.uniform(-0.5, 0.5), 1))
        left_val = max(0.0, round(self._left_cm + self._rng.uniform(-0.5, 0.5), 1))
        right_val = max(0.0, round(self._right_cm + self._rng.uniform(-0.5, 0.5), 1))

        min_dist = min(front_val, left_val, right_val)
        obstacle_present = min_dist < 60.0

        direction: ObstacleDirection = "NONE"
        if obstacle_present:
            if min_dist == front_val:
                direction = "FRONT"
            elif min_dist == left_val:
                direction = "LEFT"
            else:
                direction = "RIGHT"

        return ObstacleData(
            front_cm=front_val,
            left_cm=left_val,
            right_cm=right_val,
            obstacle_present=obstacle_present,
            direction=direction,
            distance_cm=min_dist,
            confidence=0.98,
        )
