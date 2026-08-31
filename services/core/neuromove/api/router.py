"""API Endpoint Router for NeuroMove Control Station."""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from ..config.settings import get_settings
from ..database.health import get_database_status
from ..domain.enums import (
    ComponentStatus,
    ConnectionState,
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
from .schemas import (
    CalibrationStartRequest,
    CalibrationStartResponse,
    EEGLatestResponse,
    EEGSpectrumResponse,
    EmergencyStopResponse,
)

api_router = APIRouter(prefix="/api")


@api_router.get("/system/status", response_model=SystemStatus, tags=["System"])
def get_system_status() -> SystemStatus:
    """Return diagnostic health and connectivity report for the local Control Station."""
    settings = get_settings()

    db_status = get_database_status()
    safety_state = default_safety_state_machine.get_safety_state()

    components = ComponentHealth(
        api=ComponentStatus.HEALTHY,
        database=db_status,
        eeg=ComponentStatus.NOT_CONNECTED,
        robot=ComponentStatus.NOT_CONNECTED,
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


@api_router.get("/safety/state", response_model=SafetyState, tags=["Safety"])
def get_safety_state() -> SafetyState:
    """Retrieve current validated state and risk indicators from the safety state machine."""
    return default_safety_state_machine.get_safety_state()


@api_router.post("/emergency/stop", response_model=EmergencyStopResponse, tags=["Safety"])
def post_emergency_stop() -> EmergencyStopResponse:
    """Trigger immediate emergency stop across all local actuators and state machines."""
    default_safety_state_machine.trigger_emergency_stop(reason="Operator API emergency halt")
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


@api_router.get("/eeg/latest", response_model=EEGLatestResponse, tags=["EEG"])
def get_eeg_latest() -> EEGLatestResponse:
    """Return latest raw/filtered EEG epoch."""
    settings = get_settings()
    return EEGLatestResponse(
        timestamp=utc_now(),
        channels=["C3", "Cz", "C4"],
        sampling_rate_hz=250,
        samples=[],
        signal_quality=SignalQuality(
            overall_score=0.0,
            c3_impedance_kohm=0.0,
            c4_impedance_kohm=0.0,
            cz_impedance_kohm=0.0,
            is_acceptable=False,
        ),
        is_live_stream=False,
        mode=settings.neuromove_mode,
    )


@api_router.get("/eeg/spectrum", response_model=EEGSpectrumResponse, tags=["EEG"])
def get_eeg_spectrum() -> EEGSpectrumResponse:
    """Return spectral analysis and ERD/ERS power metrics."""
    return EEGSpectrumResponse(
        timestamp=utc_now(),
        frequencies_hz=[],
        mu_band_power={"C3": 0.0, "Cz": 0.0, "C4": 0.0},
        beta_band_power={"C3": 0.0, "Cz": 0.0, "C4": 0.0},
        erd_ers_percent={"C3": 0.0, "C4": 0.0},
    )


@api_router.get("/robot/state", response_model=RobotState, tags=["Robot"])
def get_robot_state() -> RobotState:
    """Return physical or simulated mobility platform status."""
    settings = get_settings()
    return RobotState(
        connection=ConnectionState.DISCONNECTED,
        battery_percentage=0.0,
        linear_velocity_mps=0.0,
        angular_velocity_radps=0.0,
        emergency_stop_triggered=default_safety_state_machine.current_state
        == RuntimeState.EMERGENCY,
        mode=settings.neuromove_mode,
    )


@api_router.get("/user/profile", response_model=UserProfile, tags=["User"])
def get_user_profile() -> UserProfile:
    """Retrieve active operator profile."""
    return UserProfile(
        user_id="U001",
        name="Research Operator",
        experience_level="expert",
        total_sessions=0,
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
    """Test command validation without motor execution in Phase 01."""
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


# WebSocket Route Stubs
ws_router = APIRouter(prefix="/ws")


@ws_router.websocket("/live")
async def ws_live_endpoint(websocket: WebSocket) -> None:
    """Real-time live telemetry stream WebSocket."""
    await websocket.accept()
    try:
        await websocket.send_json(
            {
                "type": "CONNECTION_ESTABLISHED",
                "message": "NeuroMove Live WebSocket connected (SIMULATION mode).",
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        pass


@ws_router.websocket("/eeg")
async def ws_eeg_endpoint(websocket: WebSocket) -> None:
    """Real-time high-frequency raw EEG streaming socket."""
    await websocket.accept()
    try:
        await websocket.send_json(
            {
                "type": "EEG_DISCONNECTED",
                "message": "Hardware acquisition offline.",
            }
        )
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        pass


@ws_router.websocket("/robot")
async def ws_robot_endpoint(websocket: WebSocket) -> None:
    """Real-time robot telemetry and odometry stream socket."""
    await websocket.accept()
    try:
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        pass


@ws_router.websocket("/safety")
async def ws_safety_endpoint(websocket: WebSocket) -> None:
    """Real-time safety state and alert event stream socket."""
    await websocket.accept()
    try:
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        pass
