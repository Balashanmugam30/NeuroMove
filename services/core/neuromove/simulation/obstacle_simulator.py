"""NeuroMove Synthetic Obstacle & Proximity Sensor Simulator.

Provides independent environmental proximity telemetry for safety arbitration testing.
"""

from __future__ import annotations

import random

from neuromove.domain.models import ObstacleData, ObstacleDirection


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
