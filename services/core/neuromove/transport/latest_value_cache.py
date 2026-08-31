"""NeuroMove Latest-Value Cache for State Snapshot Delivery.

Maintains bounded in-memory cache of latest state attributes to provide zero-delay
initial state snapshots for newly connected WebSocket clients.
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Any

from neuromove.domain.enums import EventType, OperatingMode, RiskLevel, RuntimeState, SafetyDecision
from neuromove.domain.models import (
    ObstacleData,
    RobotState,
    SafetyState,
    Session,
    SignalQualityMetrics,
    Trial,
)
from neuromove.events.envelope import EventEnvelope
from neuromove.transport.models import SnapshotPayload


class LatestValueCache:
    """Thread-safe latest-value cache for system telemetry and snapshot generation."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._mode: OperatingMode = OperatingMode.SIMULATION
        self._latest_event_sequence: int = 0
        self._active_session: Session | None = None
        self._active_trial: Trial | None = None
        self._robot_state: RobotState | None = None
        self._safety_state: SafetyState | None = SafetyState(
            runtime_state=RuntimeState.IDLE,
            last_decision=SafetyDecision.STOP,
            risk_level=RiskLevel.SAFE,
            emergency_active=False,
            reason="System in safe default idle state.",
            updated_at=datetime.now(UTC),
        )
        self._signal_quality: SignalQualityMetrics | None = SignalQualityMetrics(
            overall_score=0.95,
            channels={"C3": 4.2, "Cz": 3.8, "C4": 4.5},
            dropped_samples=0,
            artifact_flags=[],
            sampling_rate_hz=250,
            is_acceptable=True,
        )
        self._obstacle_data: ObstacleData | None = ObstacleData(
            front_cm=200.0,
            left_cm=200.0,
            right_cm=200.0,
            obstacle_present=False,
            direction="NONE",
            distance_cm=200.0,
            confidence=0.98,
        )
        self._simulation_status: dict[str, Any] | None = None

    @property
    def latest_event_sequence(self) -> int:
        with self._lock:
            return self._latest_event_sequence

    def update_from_event(self, event: EventEnvelope[Any]) -> None:
        """Inspect and absorb canonical event payload into latest-value cache."""
        with self._lock:
            if event.sequence > self._latest_event_sequence:
                self._latest_event_sequence = event.sequence
            self._mode = event.mode

            evt_type = event.event_type
            p = event.payload

            # 1. Robot State
            if evt_type == EventType.ROBOT_STATE:
                if isinstance(p, RobotState):
                    self._robot_state = p
                elif isinstance(p, dict):
                    try:
                        self._robot_state = RobotState.model_validate(p)
                    except Exception:
                        pass

            # 2. Signal Quality
            elif evt_type == EventType.EEG_SIGNAL_QUALITY:
                if isinstance(p, SignalQualityMetrics):
                    self._signal_quality = p
                elif isinstance(p, dict):
                    try:
                        self._signal_quality = SignalQualityMetrics.model_validate(p)
                    except Exception:
                        pass

            # 3. Safety State & Arbitration
            elif evt_type in (
                EventType.SAFETY_APPROVED,
                EventType.SAFETY_BLOCKED,
                EventType.SAFETY_STOP,
                EventType.STATE_TRANSITION,
                EventType.EMERGENCY_STOP,
                EventType.SAFETY_ALERT,
            ):
                if evt_type == EventType.EMERGENCY_STOP:
                    self._safety_state = SafetyState(
                        runtime_state=RuntimeState.EMERGENCY,
                        last_decision=SafetyDecision.STOP,
                        risk_level=RiskLevel.CRITICAL,
                        emergency_active=True,
                        fault_code="EMERGENCY_HALT",
                        reason="Operator emergency stop engaged.",
                        updated_at=event.timestamp,
                    )
                elif evt_type == EventType.SAFETY_APPROVED:
                    self._safety_state = SafetyState(
                        runtime_state=RuntimeState.EXECUTING,
                        last_decision=SafetyDecision.APPROVED,
                        risk_level=RiskLevel.SAFE,
                        emergency_active=False,
                        reason="Trajectory clear. Safe execution approved.",
                        updated_at=event.timestamp,
                    )
                elif evt_type == EventType.SAFETY_BLOCKED:
                    self._safety_state = SafetyState(
                        runtime_state=RuntimeState.BLOCKED,
                        last_decision=SafetyDecision.BLOCKED,
                        risk_level=RiskLevel.WARNING,
                        emergency_active=False,
                        reason="Obstacle detected. Motion blocked.",
                        updated_at=event.timestamp,
                    )

            # 4. Session & Trial Lifecycle
            elif evt_type == EventType.SESSION_STARTED and isinstance(p, Session):
                self._active_session = p
            elif evt_type == EventType.SESSION_ENDED:
                self._active_session = None
            elif evt_type == EventType.TRIAL_STARTED and isinstance(p, Trial):
                self._active_trial = p
            elif evt_type == EventType.TRIAL_ENDED:
                self._active_trial = None

    def update_robot_state(self, state: RobotState) -> None:
        with self._lock:
            self._robot_state = state

    def update_signal_quality(self, sq: SignalQualityMetrics) -> None:
        with self._lock:
            self._signal_quality = sq

    def update_obstacle_data(self, obs: ObstacleData) -> None:
        with self._lock:
            self._obstacle_data = obs

    def update_simulation_status(self, status: dict[str, Any]) -> None:
        with self._lock:
            self._simulation_status = status

    def get_snapshot(self) -> SnapshotPayload:
        """Produce an atomic, immutable snapshot of the current latest values."""
        with self._lock:
            return SnapshotPayload(
                mode=self._mode,
                server_time=datetime.now(UTC),
                latest_event_sequence=self._latest_event_sequence,
                active_session=self._active_session.model_copy() if self._active_session else None,
                active_trial=self._active_trial.model_copy() if self._active_trial else None,
                robot_state=self._robot_state.model_copy() if self._robot_state else None,
                safety_state=self._safety_state.model_copy() if self._safety_state else None,
                signal_quality=self._signal_quality.model_copy() if self._signal_quality else None,
                obstacle_data=self._obstacle_data.model_copy() if self._obstacle_data else None,
                simulation_status=self._simulation_status.copy()
                if self._simulation_status
                else None,
            )


# Global singleton instance
latest_value_cache = LatestValueCache()
