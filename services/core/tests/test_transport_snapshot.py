"""Tests for NeuroMove Latest-Value Cache and State Snapshot Generation.

Verifies that state changes from canonical event streams are accurately reflected
in atomic snapshots.
"""

from __future__ import annotations

from datetime import UTC, datetime

from neuromove.domain.enums import EventType, OperatingMode
from neuromove.domain.models import RobotState, SignalQualityMetrics
from neuromove.events.envelope import EventEnvelope
from neuromove.transport.latest_value_cache import LatestValueCache


def test_latest_value_cache_updates_from_events() -> None:
    """Verify cache reflects changes from canonical RobotState and SignalQuality events."""
    cache = LatestValueCache()

    # 1. Update Robot State
    robot_st = RobotState(
        connection_state="CONNECTED",
        motion_state="MOVING",
        heading_deg=180.0,
        battery_pct=88.0,
        linear_velocity_mps=0.25,
        angular_velocity_radps=0.0,
        mode=OperatingMode.SIMULATION,
    )
    evt1 = EventEnvelope(
        event_id="evt_01",
        schema_version="1.0.0",
        timestamp=datetime.now(UTC),
        occurred_at=datetime.now(UTC),
        mode=OperatingMode.SIMULATION,
        event_type=EventType.ROBOT_STATE,
        sequence=10,
        payload=robot_st,
    )
    cache.update_from_event(evt1)

    snap = cache.get_snapshot()
    assert snap.latest_event_sequence == 10
    assert snap.robot_state is not None
    assert snap.robot_state.heading_deg == 180.0
    assert snap.robot_state.linear_velocity_mps == 0.25

    # 2. Update Signal Quality
    sq = SignalQualityMetrics(
        overall_score=0.92,
        channels={"C3": 4.1, "Cz": 3.2, "C4": 4.8},
        dropped_samples=2,
        artifact_flags=[],
        sampling_rate_hz=250,
        is_acceptable=True,
    )
    evt2 = EventEnvelope(
        event_id="evt_02",
        schema_version="1.0.0",
        timestamp=datetime.now(UTC),
        occurred_at=datetime.now(UTC),
        mode=OperatingMode.SIMULATION,
        event_type=EventType.EEG_SIGNAL_QUALITY,
        sequence=11,
        payload=sq,
    )
    cache.update_from_event(evt2)

    snap2 = cache.get_snapshot()
    assert snap2.latest_event_sequence == 11
    assert snap2.signal_quality is not None
    assert snap2.signal_quality.overall_score == 0.92
