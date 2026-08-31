"""API Endpoint Router for NeuroMove Control Station."""

import uuid
from typing import Any

from fastapi import APIRouter, WebSocket, status
from pydantic import BaseModel, Field

from ..config.settings import get_settings
from ..database.health import get_database_status
from ..domain.enums import (
    ComponentStatus,
    RuntimeState,
    SafetyDecision,
)
from ..domain.models import (
    CommandPayload,
    ComponentHealth,
    RobotState,
    SafetyState,
    SignalQuality,
    SystemStatus,
    UserProfile,
    utc_now,
)
from ..safety.state_machine import default_safety_state_machine
from ..simulation.runner import SimulationStatus, simulation_engine
from ..simulation.scenarios import SimulationScenario, list_scenarios
from ..transport.connection_registry import connection_registry
from ..transport.models import TransportDiagnostics
from .schemas import (
    CalibrationStartRequest,
    CalibrationStartResponse,
    EEGLatestResponse,
    EEGSpectrumResponse,
    EmergencyStopResponse,
)
from .ws_manager import ws_manager

api_router = APIRouter(prefix="/api")


# --- System Diagnostic & Health ---


@api_router.get("/system/status", response_model=SystemStatus, tags=["System"])
def get_system_status() -> SystemStatus:
    """Return diagnostic health and connectivity report for the local Control Station."""
    settings = get_settings()

    db_status = get_database_status()
    safety_state = default_safety_state_machine.get_safety_state()

    components = ComponentHealth(
        api=ComponentStatus.HEALTHY,
        database=db_status,
        eeg=ComponentStatus.HEALTHY
        if simulation_engine.clock.is_running
        else ComponentStatus.NOT_CONNECTED,
        robot=ComponentStatus.HEALTHY
        if simulation_engine.clock.is_running
        else ComponentStatus.NOT_CONNECTED,
        safety=ComponentStatus.READY
        if not safety_state.emergency_active
        else ComponentStatus.DEGRADED,
    )

    return SystemStatus(
        service="neuromove-core",
        status="ok",
        version="0.1.0",
        mode=settings.neuromove_mode,
        timestamp=utc_now(),
        components=components,
    )


# --- Simulation Control Endpoints (Phase 03) ---


class SimulationStartRequest(BaseModel):
    scenario_id: str = Field(default="right-turn", description="Predefined scenario ID to run")
    seed: int | None = Field(default=None, description="Optional random seed for reproducibility")
    speed: float | None = Field(default=None, ge=0.1, le=20.0, description="Clock speed multiplier")


class SimulationSpeedRequest(BaseModel):
    speed: float = Field(
        default=1.0, ge=0.1, le=20.0, description="Clock speed multiplier (1x, 2x, 5x, 10x)"
    )


class SimulationStepRequest(BaseModel):
    delta_seconds: float = Field(
        default=0.1, ge=0.01, le=5.0, description="Time delta to advance simulation"
    )


@api_router.get("/simulation/status", response_model=SimulationStatus, tags=["Simulation"])
def get_simulation_status() -> SimulationStatus:
    """Return live status of the deterministic simulation engine."""
    return simulation_engine.get_status()


@api_router.get(
    "/simulation/scenarios", response_model=list[SimulationScenario], tags=["Simulation"]
)
def get_simulation_scenarios() -> list[SimulationScenario]:
    """List all available predefined simulation scenarios."""
    return list_scenarios()


@api_router.post("/simulation/start", response_model=SimulationStatus, tags=["Simulation"])
def start_simulation(payload: SimulationStartRequest) -> SimulationStatus:
    """Initialize and run a scenario."""
    status_res = simulation_engine.start_scenario(payload.scenario_id, seed=payload.seed)
    if payload.speed is not None:
        status_res = simulation_engine.set_speed(payload.speed)
    return status_res


@api_router.post("/simulation/pause", response_model=SimulationStatus, tags=["Simulation"])
def pause_simulation() -> SimulationStatus:
    """Pause simulation clock."""
    return simulation_engine.pause()


@api_router.post("/simulation/resume", response_model=SimulationStatus, tags=["Simulation"])
def resume_simulation() -> SimulationStatus:
    """Resume simulation clock."""
    return simulation_engine.resume()


@api_router.post("/simulation/speed", response_model=SimulationStatus, tags=["Simulation"])
def set_simulation_speed(payload: SimulationSpeedRequest) -> SimulationStatus:
    """Change simulation clock speed."""
    return simulation_engine.set_speed(payload.speed)


@api_router.post("/simulation/stop", response_model=SimulationStatus, tags=["Simulation"])
def stop_simulation() -> SimulationStatus:
    """Stop active simulation."""
    return simulation_engine.stop()


@api_router.post("/simulation/reset", response_model=SimulationStatus, tags=["Simulation"])
def reset_simulation() -> SimulationStatus:
    """Reset simulation engine state completely."""
    return simulation_engine.reset()


@api_router.post("/simulation/step", response_model=SimulationStatus, tags=["Simulation"])
def step_simulation(payload: SimulationStepRequest) -> SimulationStatus:
    """Advance simulation deterministically by exact delta_seconds."""
    simulation_engine.step(payload.delta_seconds)
    return simulation_engine.get_status()


@api_router.post(
    "/simulation/scenario/{scenario_id}/run", response_model=SimulationStatus, tags=["Simulation"]
)
def run_scenario_endpoint(scenario_id: str) -> SimulationStatus:
    """Convenience endpoint to launch a specific scenario."""
    return simulation_engine.start_scenario(scenario_id)


# --- Safety State Machine ---


@api_router.get("/safety/state", response_model=SafetyState, tags=["Safety"])
def get_safety_state() -> SafetyState:
    """Retrieve current validated state and risk indicators from the safety state machine."""
    return default_safety_state_machine.get_safety_state()


@api_router.post("/emergency/stop", response_model=EmergencyStopResponse, tags=["Safety"])
def post_emergency_stop() -> EmergencyStopResponse:
    """Trigger immediate emergency stop across all local actuators and state machines."""
    default_safety_state_machine.trigger_emergency_stop(reason="Operator API emergency halt")
    simulation_engine.robot_simulator.emergency_stop_triggered = True
    return EmergencyStopResponse(
        success=True,
        state=RuntimeState.EMERGENCY,
        timestamp=utc_now(),
        message="Emergency stop successfully engaged. System in safe fail-closed state.",
    )


@api_router.post("/safety/reset", response_model=SafetyState, tags=["Safety"])
def post_safety_reset() -> SafetyState:
    """Reset system from Emergency or Fault state back to safe IDLE."""
    default_safety_state_machine.reset_to_idle(reason="Operator API reset request")
    return default_safety_state_machine.get_safety_state()


# --- Real-Time Telemetry & EEG ---


@api_router.get("/eeg/latest", response_model=EEGLatestResponse, tags=["EEG"])
def get_eeg_latest() -> EEGLatestResponse:
    """Return latest raw/filtered EEG epoch."""
    settings = get_settings()
    sq = simulation_engine.eeg_generator.compute_signal_quality()
    return EEGLatestResponse(
        timestamp=utc_now(),
        channels=simulation_engine.config.channels,
        sampling_rate_hz=simulation_engine.config.sample_rate_hz,
        samples=[],
        signal_quality=SignalQuality(
            overall_score=sq.overall_score,
            c3_impedance_kohm=sq.channels.get("C3", 0.0),
            c4_impedance_kohm=sq.channels.get("C4", 0.0),
            cz_impedance_kohm=sq.channels.get("Cz", 0.0),
            is_acceptable=sq.is_acceptable,
        ),
        is_live_stream=simulation_engine.clock.is_running,
        mode=settings.neuromove_mode,
    )


@api_router.get("/eeg/spectrum", response_model=EEGSpectrumResponse, tags=["EEG"])
def get_eeg_spectrum() -> EEGSpectrumResponse:
    """Return spectral analysis and ERD/ERS power metrics."""
    return EEGSpectrumResponse(
        timestamp=utc_now(),
        frequencies_hz=[8.0, 10.0, 12.0, 16.0, 20.0, 24.0],
        mu_band_power={"C3": 12.4, "Cz": 8.1, "C4": 14.2},
        beta_band_power={"C3": 5.1, "Cz": 4.0, "C4": 5.6},
        erd_ers_percent={
            "C3": -35.0 if simulation_engine.last_intent == "RIGHT" else 5.0,
            "C4": -40.0 if simulation_engine.last_intent == "LEFT" else 5.0,
        },
    )


@api_router.get("/robot/state", response_model=RobotState, tags=["Robot"])
def get_robot_state() -> RobotState:
    """Return physical or simulated mobility platform status."""
    return simulation_engine.robot_simulator.get_state()


@api_router.get("/user/profile", response_model=UserProfile, tags=["User"])
def get_user_profile() -> UserProfile:
    """Retrieve active operator profile."""
    return UserProfile(
        user_id="usr_001",
        display_label="Research Operator",
        status="active",
    )


@api_router.post(
    "/calibration/start",
    response_model=CalibrationStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Calibration"],
)
def start_calibration(payload: CalibrationStartRequest) -> CalibrationStartResponse:
    """Initiate a structured calibration session."""
    session_id = f"cal_{uuid.uuid4().hex[:8]}"
    return CalibrationStartResponse(
        session_id=session_id,
        status="initiated",
        message=f"Calibration session '{payload.session_name}' prepared for {payload.trials_per_class} trials.",
        started_at=utc_now(),
    )


@api_router.post("/calibration/stop", tags=["Calibration"])
def stop_calibration() -> dict[str, str]:
    """Halt active calibration session."""
    return {"status": "stopped", "message": "Calibration run halted."}


@api_router.post("/command/test", tags=["Robot"])
def test_command(payload: CommandPayload) -> dict[str, Any]:
    """Test command validation without motor execution."""
    if not default_safety_state_machine.is_safe_to_actuate:
        return {
            "status": "blocked",
            "reason": f"System state '{default_safety_state_machine.current_state.value}' is not EXECUTING or safe.",
            "decision": SafetyDecision.BLOCKED.value,
        }

    return {
        "status": "simulated",
        "intent": payload.intent.value,
        "linear_velocity": payload.linear_velocity_mps,
        "angular_velocity": payload.angular_velocity_radps,
        "safety_decision": SafetyDecision.APPROVED.value,
    }


# --- Transport & Realtime Diagnostics (Phase 04) ---


@api_router.get(
    "/transport/diagnostics",
    response_model=TransportDiagnostics,
    tags=["System"],
)
def get_transport_diagnostics() -> TransportDiagnostics:
    """Return real-time WebSocket transport metrics and connection telemetry."""
    return connection_registry.get_diagnostics()


# --- WebSocket Stream Endpoints ---

ws_router = APIRouter(prefix="/ws")


@ws_router.websocket("/live")
async def ws_live_endpoint(websocket: WebSocket) -> None:
    """Real-time live telemetry stream WebSocket."""
    await ws_manager.connect_live(websocket)


@ws_router.websocket("/eeg")
async def ws_eeg_endpoint(websocket: WebSocket) -> None:
    """Real-time high-frequency synthetic EEG streaming socket."""
    await ws_manager.connect_eeg(websocket)


@ws_router.websocket("/robot")
async def ws_robot_endpoint(websocket: WebSocket) -> None:
    """Real-time robot telemetry and odometry stream socket."""
    await ws_manager.connect_robot(websocket)


@ws_router.websocket("/safety")
async def ws_safety_endpoint(websocket: WebSocket) -> None:
    """Real-time safety state and alert event stream socket."""
    await ws_manager.connect_safety(websocket)


@ws_router.websocket("/stream")
async def ws_multiplexed_endpoint(websocket: WebSocket) -> None:
    """Multiplexed real-time WebSocket carrying all subscribed channels."""
    await ws_manager.connect_all(websocket)
