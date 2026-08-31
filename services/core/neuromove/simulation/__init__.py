"""NeuroMove Deterministic Simulation Package."""

from neuromove.simulation.clock import ClockMode, SimulationClock
from neuromove.simulation.config import SimulationConfig
from neuromove.simulation.eeg_generator import EEGChunk, EEGWindow, SyntheticEEGGenerator
from neuromove.simulation.fault_injector import FaultInjector, FaultType
from neuromove.simulation.obstacle_simulator import ObstacleData, ObstacleSimulator
from neuromove.simulation.prediction_generator import SyntheticPredictionGenerator
from neuromove.simulation.robot_simulator import RobotSimulator
from neuromove.simulation.runner import SimulationEngine, SimulationStatus, simulation_engine
from neuromove.simulation.scenarios import (
    SCENARIOS,
    ScenarioStep,
    SimulationScenario,
    get_scenario,
    list_scenarios,
)

__all__ = [
    "ClockMode",
    "SimulationClock",
    "SimulationConfig",
    "SyntheticEEGGenerator",
    "EEGChunk",
    "EEGWindow",
    "SyntheticPredictionGenerator",
    "ObstacleSimulator",
    "ObstacleData",
    "RobotSimulator",
    "FaultInjector",
    "FaultType",
    "SimulationScenario",
    "ScenarioStep",
    "SCENARIOS",
    "get_scenario",
    "list_scenarios",
    "SimulationEngine",
    "SimulationStatus",
    "simulation_engine",
]
