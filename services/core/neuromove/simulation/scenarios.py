"""NeuroMove Predefined Simulation Scenarios.

Declarative scenario specifications governing deterministic session runs.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from neuromove.domain.enums import Intent


class ScenarioStep(BaseModel):
    """A discrete temporal step in a simulated scenario."""

    time_seconds: float
    cue: str = "REST"
    target_intent: Intent = Intent.NONE
    confidence_profile: str = "HIGH"
    obstacle_direction: str = "NONE"
    obstacle_distance_cm: float = 200.0
    inject_fault: str | None = None
    trigger_emergency: bool = False
    description: str = ""


class SimulationScenario(BaseModel):
    """Complete declarative scenario definition."""

    scenario_id: str
    name: str
    description: str
    seed: int = 42
    duration_seconds: float = 12.0
    trials_count: int = 1
    expected_behavior: str = ""
    steps: list[ScenarioStep] = Field(default_factory=list)


# 9 Standard Canonical Scenarios
SCENARIOS: dict[str, SimulationScenario] = {
    "idle": SimulationScenario(
        scenario_id="idle",
        name="1. Baseline Idle & Rest",
        description="Continuous baseline resting state with zero obstacles and stationary robot.",
        seed=42,
        duration_seconds=8.0,
        trials_count=1,
        expected_behavior="Resting mu rhythm, zero mobility commands, safe IDLE state maintained.",
        steps=[
            ScenarioStep(
                time_seconds=0.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Resting baseline EEG",
            ),
            ScenarioStep(
                time_seconds=4.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Continuous rest verification",
            ),
        ],
    ),
    "right-turn": SimulationScenario(
        scenario_id="right-turn",
        name="2. Right Turn Motor Imagery",
        description="Standard Graz trial: Fixation -> Right Cue -> C3 mu desynchronization -> High confidence RIGHT prediction.",
        seed=42,
        duration_seconds=10.0,
        trials_count=1,
        expected_behavior="C3 ERD desynchronization, 0.92 neural confidence, confirmed RIGHT intent, virtual right rotation.",
        steps=[
            ScenarioStep(
                time_seconds=0.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Pre-cue resting baseline",
            ),
            ScenarioStep(
                time_seconds=2.0,
                cue="ARROW_RIGHT",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Visual cue presentation",
            ),
            ScenarioStep(
                time_seconds=3.5,
                cue="IMAGERY_RIGHT",
                target_intent=Intent.RIGHT,
                confidence_profile="HIGH",
                description="Motor imagery execution window",
            ),
            ScenarioStep(
                time_seconds=7.5,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Post-trial relaxation",
            ),
        ],
    ),
    "left-turn": SimulationScenario(
        scenario_id="left-turn",
        name="3. Left Turn Motor Imagery",
        description="Standard Graz trial: Fixation -> Left Cue -> C4 mu desynchronization -> High confidence LEFT prediction.",
        seed=43,
        duration_seconds=10.0,
        trials_count=1,
        expected_behavior="C4 ERD desynchronization, 0.91 neural confidence, confirmed LEFT intent, virtual left rotation.",
        steps=[
            ScenarioStep(
                time_seconds=0.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Pre-cue resting baseline",
            ),
            ScenarioStep(
                time_seconds=2.0,
                cue="ARROW_LEFT",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Visual cue presentation",
            ),
            ScenarioStep(
                time_seconds=3.5,
                cue="IMAGERY_LEFT",
                target_intent=Intent.LEFT,
                confidence_profile="HIGH",
                description="Motor imagery execution window",
            ),
            ScenarioStep(
                time_seconds=7.5,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Post-trial relaxation",
            ),
        ],
    ),
    "low-confidence": SimulationScenario(
        scenario_id="low-confidence",
        name="4. Low Confidence & Ambiguity",
        description="Simulated noisy EEG with unstable classification resulting in below-threshold UNCERTAIN intent.",
        seed=44,
        duration_seconds=9.0,
        trials_count=1,
        expected_behavior="High noise, unstable probabilities, confidence below gate threshold, safe hold maintained.",
        steps=[
            ScenarioStep(
                time_seconds=0.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Baseline rest",
            ),
            ScenarioStep(
                time_seconds=2.0,
                cue="ARROW_RIGHT",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Visual cue presentation",
            ),
            ScenarioStep(
                time_seconds=3.5,
                cue="IMAGERY_RIGHT",
                target_intent=Intent.UNCERTAIN,
                confidence_profile="UNCERTAIN",
                inject_fault="NOISY_EEG",
                description="Noisy imagery execution producing uncertain prediction",
            ),
            ScenarioStep(
                time_seconds=7.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Trial conclusion",
            ),
        ],
    ),
    "right-obstacle": SimulationScenario(
        scenario_id="right-obstacle",
        name="5. Right Proximity Obstacle Hazard",
        description="Confirmed RIGHT intent while an obstacle hazard appears on the right perimeter (35 cm).",
        seed=45,
        duration_seconds=10.0,
        trials_count=1,
        expected_behavior="RIGHT intent confirmed, right obstacle detected, safety arbitrator issues BLOCKED decision.",
        steps=[
            ScenarioStep(
                time_seconds=0.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Baseline rest",
            ),
            ScenarioStep(
                time_seconds=2.0,
                cue="ARROW_RIGHT",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Visual cue",
            ),
            ScenarioStep(
                time_seconds=3.5,
                cue="IMAGERY_RIGHT",
                target_intent=Intent.RIGHT,
                confidence_profile="HIGH",
                obstacle_direction="RIGHT",
                obstacle_distance_cm=35.0,
                description="Right imagery with right obstacle intrusion",
            ),
            ScenarioStep(
                time_seconds=7.5,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Rest and obstacle cleared",
            ),
        ],
    ),
    "emergency": SimulationScenario(
        scenario_id="emergency",
        name="6. Immediate Emergency Stop Trigger",
        description="Active mobility trial interrupted by an operator emergency stop trigger.",
        seed=46,
        duration_seconds=8.0,
        trials_count=1,
        expected_behavior="Instant EMERGENCY state transition, zero-velocity override issued, all commands blocked.",
        steps=[
            ScenarioStep(
                time_seconds=0.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Nominal operation",
            ),
            ScenarioStep(
                time_seconds=2.0,
                cue="ARROW_RIGHT",
                target_intent=Intent.RIGHT,
                confidence_profile="HIGH",
                description="Movement trial start",
            ),
            ScenarioStep(
                time_seconds=4.0,
                cue="REST",
                target_intent=Intent.NONE,
                trigger_emergency=True,
                description="Emergency stop triggered by operator",
            ),
        ],
    ),
    "eeg-disconnect": SimulationScenario(
        scenario_id="eeg-disconnect",
        name="7. EEG Lead-Off & Disconnect",
        description="Continuous EEG streaming interrupted by sudden lead-off / serial disconnect.",
        seed=47,
        duration_seconds=8.0,
        trials_count=1,
        expected_behavior="Dropped samples flagged, signal quality drops to 0.0, system enters safe FAULT hold.",
        steps=[
            ScenarioStep(
                time_seconds=0.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Nominal stream",
            ),
            ScenarioStep(
                time_seconds=3.0,
                cue="REST",
                target_intent=Intent.NONE,
                inject_fault="EEG_DISCONNECT",
                description="Electrode lead-off injected",
            ),
            ScenarioStep(
                time_seconds=6.0,
                cue="REST",
                target_intent=Intent.NONE,
                description="Connection restored",
            ),
        ],
    ),
    "robot-disconnect": SimulationScenario(
        scenario_id="robot-disconnect",
        name="8. Robot Telemetry Timeout",
        description="Robot serial link timeout simulating hardware disconnection.",
        seed=48,
        duration_seconds=8.0,
        trials_count=1,
        expected_behavior="Robot connection state becomes DISCONNECTED, safety arbitrator inhibits all commands.",
        steps=[
            ScenarioStep(
                time_seconds=0.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Nominal connected robot",
            ),
            ScenarioStep(
                time_seconds=3.0,
                cue="REST",
                target_intent=Intent.NONE,
                inject_fault="ROBOT_DISCONNECT",
                description="Serial link timeout injected",
            ),
            ScenarioStep(
                time_seconds=6.0,
                cue="REST",
                target_intent=Intent.NONE,
                description="Robot link recovered",
            ),
        ],
    ),
    "full-demo": SimulationScenario(
        scenario_id="full-demo",
        name="9. Comprehensive End-to-End Demo",
        description="Multi-phase progression: READY -> Right Turn -> Obstacle encounter -> Forward -> Emergency Stop.",
        seed=42,
        duration_seconds=16.0,
        trials_count=2,
        expected_behavior="Complete validation of all subsystem state transitions and safety gates.",
        steps=[
            ScenarioStep(
                time_seconds=0.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="System online in READY state",
            ),
            ScenarioStep(
                time_seconds=2.0,
                cue="ARROW_RIGHT",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Trial 1: Right cue",
            ),
            ScenarioStep(
                time_seconds=3.5,
                cue="IMAGERY_RIGHT",
                target_intent=Intent.RIGHT,
                confidence_profile="HIGH",
                description="Right imagery confirmed & executing",
            ),
            ScenarioStep(
                time_seconds=7.0,
                cue="REST",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Trial 1 complete, rest window",
            ),
            ScenarioStep(
                time_seconds=9.0,
                cue="ARROW_FORWARD",
                target_intent=Intent.NONE,
                confidence_profile="HIGH",
                description="Trial 2: Forward cue",
            ),
            ScenarioStep(
                time_seconds=10.5,
                cue="IMAGERY_FORWARD",
                target_intent=Intent.FORWARD,
                confidence_profile="HIGH",
                obstacle_direction="FRONT",
                obstacle_distance_cm=40.0,
                description="Forward imagery blocked by front obstacle",
            ),
            ScenarioStep(
                time_seconds=13.0,
                cue="REST",
                target_intent=Intent.NONE,
                trigger_emergency=True,
                description="Emergency stop conclusion",
            ),
        ],
    ),
}


def get_scenario(scenario_id: str) -> SimulationScenario | None:
    """Retrieve predefined scenario by ID."""
    return SCENARIOS.get(scenario_id)


def list_scenarios() -> list[SimulationScenario]:
    """List all available predefined simulation scenarios."""
    return list(SCENARIOS.values())
