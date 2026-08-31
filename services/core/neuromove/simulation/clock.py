"""NeuroMove Simulation Clock Abstraction.

Provides deterministic, controllable virtual time progression independent
of system wall-clock timers.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta
from enum import StrEnum


class ClockMode(StrEnum):
    REALTIME = "REALTIME"
    ACCELERATED = "ACCELERATED"
    PAUSED = "PAUSED"
    STEP = "STEP"


class SimulationClock:
    """Controllable simulation clock supporting real-time, accelerated, paused,

    and deterministic stepping modes.
    """

    def __init__(
        self,
        start_time: datetime | None = None,
        speed: float = 1.0,
        mode: ClockMode = ClockMode.REALTIME,
    ) -> None:
        self._initial_time: datetime = start_time or datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)
        self._current_sim_time: datetime = self._initial_time
        self._speed: float = max(0.1, float(speed))
        self._mode: ClockMode = mode
        self._is_running: bool = False
        self._last_wall_time: float | None = None
        self._elapsed_sim_seconds: float = 0.0

    @property
    def speed(self) -> float:
        return self._speed

    @property
    def mode(self) -> ClockMode:
        return self._mode

    @property
    def is_running(self) -> bool:
        return self._is_running

    def start(self) -> None:
        """Start or resume clock progression."""
        self._is_running = True
        self._last_wall_time = time.monotonic()
        self._mode = ClockMode.ACCELERATED if self._speed > 1.0 else ClockMode.REALTIME

    def pause(self) -> None:
        """Pause clock progression."""
        if self._is_running and self._mode != ClockMode.STEP:
            self._update_time()
        self._is_running = False
        self._last_wall_time = None
        self._mode = ClockMode.PAUSED

    def resume(self) -> None:
        """Resume paused clock progression."""
        self._is_running = True
        self._last_wall_time = time.monotonic()
        self._mode = ClockMode.ACCELERATED if self._speed > 1.0 else ClockMode.REALTIME

    def set_speed(self, speed: float) -> None:
        """Set simulation speed multiplier (e.g. 1.0, 2.0, 5.0, 10.0)."""
        if self._is_running and self._mode != ClockMode.STEP:
            self._update_time()
        self._speed = max(0.1, float(speed))
        if self._is_running and self._mode != ClockMode.STEP:
            self._mode = ClockMode.ACCELERATED if self._speed > 1.0 else ClockMode.REALTIME

    def reset(self, start_time: datetime | None = None) -> None:
        """Reset clock back to initial timestamp."""
        self._initial_time = start_time or datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)
        self._current_sim_time = self._initial_time
        self._elapsed_sim_seconds = 0.0
        self._is_running = False
        self._last_wall_time = None
        self._mode = ClockMode.REALTIME

    def step(self, delta_seconds: float = 0.1) -> datetime:
        """Deterministically advance simulation time by exact delta_seconds."""
        if self._mode != ClockMode.STEP:
            self._mode = ClockMode.STEP
            self._is_running = False
            self._last_wall_time = None
            self._elapsed_sim_seconds = 0.0

        self._elapsed_sim_seconds = round(self._elapsed_sim_seconds + delta_seconds, 6)
        self._current_sim_time = self._initial_time + timedelta(seconds=self._elapsed_sim_seconds)
        return self._current_sim_time

    def now(self) -> datetime:
        """Return the current simulation timestamp in UTC."""
        if self._is_running and self._mode != ClockMode.STEP:
            self._update_time()
        return self._current_sim_time

    def now_iso(self) -> str:
        """Return ISO 8601 formatted simulation timestamp string."""
        return self.now().isoformat()

    def elapsed_seconds(self) -> float:
        """Return total elapsed simulation seconds since start."""
        if self._is_running and self._mode != ClockMode.STEP:
            self._update_time()
        return self._elapsed_sim_seconds

    def _update_time(self) -> None:
        """Update internal simulation time based on wall-clock progression and

        speed.
        """
        if not self._is_running or self._last_wall_time is None or self._mode == ClockMode.STEP:
            return

        now_wall = time.monotonic()
        delta_wall = now_wall - self._last_wall_time
        self._last_wall_time = now_wall

        sim_delta = delta_wall * self._speed
        self._elapsed_sim_seconds += sim_delta
        self._current_sim_time = self._initial_time + timedelta(seconds=self._elapsed_sim_seconds)
