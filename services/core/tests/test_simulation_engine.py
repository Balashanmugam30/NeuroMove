"""Unit tests for NeuroMove Simulation Engine."""

from datetime import UTC, datetime

import pytest

from neuromove.domain.enums import (
    ConnectionState,
    Intent,
    OperatingMode,
)
from neuromove.simulation.clock import ClockMode, SimulationClock
from neuromove.simulation.config import SimulationConfig
from neuromove.simulation.eeg_generator import SyntheticEEGGenerator
from neuromove.simulation.fault_injector import FaultInjector, FaultType
from neuromove.simulation.obstacle_simulator import ObstacleSimulator
from neuromove.simulation.prediction_generator import SyntheticPredictionGenerator
from neuromove.simulation.robot_simulator import RobotSimulator
from neuromove.simulation.scenarios import SCENARIOS, list_scenarios


def test_simulation_clock_progression() -> None:
    """Verify simulation clock starts, pauses, resumes, and advances."""
    t0 = datetime(2026, 8, 31, 10, 0, 0, tzinfo=UTC)
    clock = SimulationClock(start_time=t0, speed=2.0)
    assert clock.now() == t0
    assert not clock.is_running

    t1 = clock.step(0.5)
    assert (t1 - t0).total_seconds() == 0.5
    assert clock.mode == ClockMode.STEP

    clock.reset(start_time=t0)
    assert clock.elapsed_seconds() == 0.0


def test_synthetic_eeg_generator_smr_modulation() -> None:
    """Verify synthetic EEG generator produces multi-channel samples and modulates SMR power."""
    cfg = SimulationConfig(seed=42, channels=["C3", "Cz", "C4"], sample_rate_hz=250)
    gen = SyntheticEEGGenerator(cfg)

    # 1. Baseline Rest
    gen.set_intent(Intent.NONE)
    chunk_rest = gen.generate_samples(count=50)
    assert chunk_rest.sample_count == 50
    assert len(chunk_rest.samples["C3"]) == 50
    assert chunk_rest.mode == OperatingMode.SIMULATION

    # 2. Right Intent -> C3 desynchronization (lower variance/amplitude than C4)
    gen.set_intent(Intent.RIGHT)
    chunk_right = gen.generate_samples(count=250)
    c3_power = sum(abs(v) for v in chunk_right.samples["C3"]) / 250.0
    c4_power = sum(abs(v) for v in chunk_right.samples["C4"]) / 250.0
    # C3 is desynchronized during right hand imagery
    assert c3_power < c4_power

    # 3. Left Intent -> C4 desynchronization (lower variance/amplitude than C3)
    gen.set_intent(Intent.LEFT)
    chunk_left = gen.generate_samples(count=250)
    c3_power_l = sum(abs(v) for v in chunk_left.samples["C3"]) / 250.0
    c4_power_l = sum(abs(v) for v in chunk_left.samples["C4"]) / 250.0
    # C4 is desynchronized during left hand imagery
    assert c4_power_l < c3_power_l


def test_signal_quality_simulation() -> None:
    """Verify synthetic signal quality metrics and disconnection handling."""
    gen = SyntheticEEGGenerator(SimulationConfig(seed=100))
    sq_nominal = gen.compute_signal_quality()
    assert sq_nominal.overall_score >= 0.70
    assert sq_nominal.is_acceptable

    # Simulate lead-off / disconnect
    gen.set_disconnected(True)
    chunk_disc = gen.generate_samples(count=10)
    assert all(v == 0.0 for v in chunk_disc.samples["C3"])
    sq_disc = gen.compute_signal_quality()
    assert sq_disc.overall_score == 0.0
    assert not sq_disc.is_acceptable
    assert "LEAD_OFF" in sq_disc.artifact_flags


def test_prediction_generator_probabilities_sum_to_one() -> None:
    """Verify class probabilities are normalized and sum to 1.0."""
    pred_gen = SyntheticPredictionGenerator(seed=42)
    for intent in [Intent.LEFT, Intent.RIGHT, Intent.FORWARD, Intent.NONE, Intent.UNCERTAIN]:
        pred = pred_gen.generate_prediction(target_intent=intent, profile="HIGH")
        total_p = sum(pred.class_probabilities.values())
        assert pytest.approx(total_p, abs=1e-3) == 1.0
        assert pred.model_id == "simulator.synthetic-decoder"
        if intent != Intent.UNCERTAIN:
            assert pred.neural_confidence >= 0.70


def test_obstacle_simulator() -> None:
    """Verify independent obstacle telemetry detection."""
    obs_sim = ObstacleSimulator(seed=42)
    obs = obs_sim.sample()
    assert not obs.obstacle_present
    assert obs.direction == "NONE"

    obs_sim.set_obstacle("RIGHT", 35.0)
    obs_hazard = obs_sim.sample()
    assert obs_hazard.obstacle_present
    assert obs_hazard.direction == "RIGHT"
    assert obs_hazard.distance_cm < 40.0


def test_robot_simulator_kinematics() -> None:
    """Verify virtual 2D robot kinematics and command responses."""
    rb = RobotSimulator()
    assert rb.motion_state == "IDLE"

    # Forward
    rb.apply_intent_command(Intent.FORWARD, approved=True)
    assert rb.motion_state == "FORWARD"
    assert rb.linear_velocity_mps > 0.0

    # Step simulation
    rb.step(dt_seconds=1.0)
    st = rb.get_state()
    assert st.linear_velocity_mps > 0.0
    assert st.connection_state == ConnectionState.CONNECTED

    # Blocked intent
    rb.apply_intent_command(Intent.RIGHT, approved=False)
    assert rb.motion_state == "STOPPED"
    assert rb.linear_velocity_mps == 0.0


def test_scenarios_listing() -> None:
    """Verify all 9 standard predefined scenarios exist."""
    scenarios = list_scenarios()
    assert len(scenarios) == 9
    assert "idle" in SCENARIOS
    assert "right-turn" in SCENARIOS
    assert "left-turn" in SCENARIOS
    assert "low-confidence" in SCENARIOS
    assert "right-obstacle" in SCENARIOS
    assert "emergency" in SCENARIOS
    assert "eeg-disconnect" in SCENARIOS
    assert "robot-disconnect" in SCENARIOS
    assert "full-demo" in SCENARIOS


def test_fault_injector() -> None:
    """Verify fault injection mechanics."""
    fi = FaultInjector()
    assert not fi.is_active(FaultType.EEG_DISCONNECT)
    fi.inject(FaultType.EEG_DISCONNECT)
    assert fi.is_active(FaultType.EEG_DISCONNECT)
    assert "EEG_DISCONNECT" in fi.active_faults()
    fi.clear(FaultType.EEG_DISCONNECT)
    assert not fi.is_active(FaultType.EEG_DISCONNECT)
