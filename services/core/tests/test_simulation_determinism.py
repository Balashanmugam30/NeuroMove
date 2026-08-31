"""Determinism tests for NeuroMove Simulation Engine.

Verifies that running a scenario with the same seed produces exactly identical
event counts, sequence indices, event types, and payload values.
"""

from neuromove.events.dispatcher import EventDispatcher
from neuromove.simulation.config import SimulationConfig
from neuromove.simulation.runner import SimulationEngine


def test_scenario_execution_determinism() -> None:
    """Verify that running scenario 'right-turn' twice with seed 42 produces identical event sequences."""
    # Run 1
    disp1 = EventDispatcher()
    engine1 = SimulationEngine(config=SimulationConfig(seed=42), dispatcher=disp1)
    events1 = engine1.run_scenario_sync("right-turn", seed=42, step_dt=0.2)

    # Run 2
    disp2 = EventDispatcher()
    engine2 = SimulationEngine(config=SimulationConfig(seed=42), dispatcher=disp2)
    events2 = engine2.run_scenario_sync("right-turn", seed=42, step_dt=0.2)

    assert len(events1) > 0
    assert len(events1) == len(events2), "Total emitted event count must be deterministic"

    for idx, (e1, e2) in enumerate(zip(events1, events2, strict=True)):
        assert e1.sequence == e2.sequence, (
            f"Event {idx} sequence mismatch: {e1.sequence} vs {e2.sequence}"
        )
        assert e1.event_type == e2.event_type, (
            f"Event {idx} type mismatch: {e1.event_type} vs {e2.event_type}"
        )
        assert e1.mode == e2.mode == "SIMULATION"

        # Compare logical payload content
        p1 = e1.payload if isinstance(e1.payload, dict) else e1.payload.model_dump(mode="json")
        p2 = e2.payload if isinstance(e2.payload, dict) else e2.payload.model_dump(mode="json")
        assert p1 == p2, f"Event {idx} ({e1.event_type.value}) payload value mismatch"


def test_scenario_obstacle_hazard_determinism() -> None:
    """Verify scenario 'right-obstacle' deterministically produces safety blocked events."""
    disp = EventDispatcher()
    engine = SimulationEngine(config=SimulationConfig(seed=45), dispatcher=disp)
    events = engine.run_scenario_sync("right-obstacle", seed=45, step_dt=0.2)

    event_types = [e.event_type.value for e in events]
    assert "PREDICTION" in event_types
    assert "INTENT_CONFIRMED" in event_types
    assert "SAFETY_BLOCKED" in event_types
