"""High-level platform unit smoke tests."""

import neuromove
from neuromove.domain.enums import OperatingMode, RuntimeState
from neuromove.events.envelope import generate_event_id
from neuromove.safety.state_machine import SafetyStateMachine


def test_neuromove_package_root_imports() -> None:
    assert neuromove.__version__ == "0.1.0"
    assert OperatingMode.SIMULATION.value == "SIMULATION"


def test_smoke_safety_init() -> None:
    sm = SafetyStateMachine(mode=OperatingMode.SIMULATION)
    assert sm.current_state == RuntimeState.IDLE
    assert generate_event_id().startswith("evt_")
