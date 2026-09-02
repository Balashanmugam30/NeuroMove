"""API Endpoint Router for NeuroMove Control Station."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, WebSocket, status
from pydantic import BaseModel, Field

from ..analysis.models import (
    BandPowerRequest,
    BandPowerResponse,
    EEGChannelSummary,
    PSDRequest,
    PSDResponse,
    TFRRequest,
    TFRResponse,
)
from ..analysis.service import analysis_service
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


# --- EEG Laboratory & MNE Spectral Analysis Endpoints (Phase 07) ---


@api_router.post("/eeg/psd", response_model=PSDResponse, tags=["EEG Laboratory"])
def compute_eeg_psd(request: PSDRequest) -> PSDResponse:
    """Compute Power Spectral Density using modern MNE Welch or Multitaper methods."""
    return analysis_service.compute_psd(request)


@api_router.post("/eeg/band-power", response_model=BandPowerResponse, tags=["EEG Laboratory"])
def compute_eeg_band_power(request: BandPowerRequest) -> BandPowerResponse:
    """Compute integrated frequency band powers and Mu ERD lateralization index."""
    return analysis_service.compute_band_power(request)


@api_router.post("/eeg/tfr", response_model=TFRResponse, tags=["EEG Laboratory"])
def compute_eeg_tfr(request: TFRRequest) -> TFRResponse:
    """Compute Morlet wavelet Time-Frequency Representation (spectrogram)."""
    return analysis_service.compute_tfr(request)


@api_router.get("/eeg/channels", response_model=list[EEGChannelSummary], tags=["EEG Laboratory"])
def get_eeg_channels() -> list[EEGChannelSummary]:
    """Return 10-20 standard channel topology coordinates and diagnostic status."""
    return analysis_service.get_channels_summary()


@api_router.post("/eeg/export/psd", tags=["EEG Laboratory"])
def export_psd_csv(request: PSDRequest) -> Response:
    """Export PSD results as CSV with research provenance header."""
    csv_data = analysis_service.export_psd_csv(request)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=neuromove_psd_export.csv"},
    )


@api_router.post("/eeg/export/band-power", tags=["EEG Laboratory"])
def export_band_power_csv(request: BandPowerRequest) -> Response:
    """Export Band Power results as CSV with research provenance header."""
    csv_data = analysis_service.export_band_power_csv(request)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=neuromove_bandpower_export.csv"},
    )


@api_router.get("/eeg/export/analysis", tags=["EEG Laboratory"])
def export_analysis_json(session_id: str | None = None) -> dict[str, Any]:
    """Export complete EEG laboratory analysis snapshot as JSON with provenance."""
    return analysis_service.export_analysis_json(session_id=session_id)


# --- Public EEG Datasets & Research Workspace ---


@api_router.get("/datasets", tags=["Datasets"])
def list_datasets() -> list[Any]:
    """List all registered public and local research datasets."""
    from neuromove.datasets.service import get_dataset_service

    return get_dataset_service().get_datasets()


@api_router.get("/datasets/{dataset_id}", tags=["Datasets"])
def get_dataset_details(dataset_id: str) -> Any:
    """Retrieve full metadata and local caching status for a dataset."""
    from neuromove.datasets.service import get_dataset_service

    return get_dataset_service().get_dataset(dataset_id)


@api_router.get("/datasets/{dataset_id}/subjects", tags=["Datasets"])
def list_dataset_subjects(dataset_id: str) -> list[Any]:
    """List all participant subjects in a dataset."""
    from neuromove.datasets.service import get_dataset_service

    return get_dataset_service().get_subjects(dataset_id)


@api_router.get("/datasets/{dataset_id}/recordings", tags=["Datasets"])
def list_dataset_recordings(
    dataset_id: str,
    subject_id: str | None = None,
    task: str | None = None,
) -> list[Any]:
    """List recordings with optional subject and task filtering."""
    from neuromove.datasets.service import get_dataset_service

    return get_dataset_service().get_recordings(
        dataset_id=dataset_id, subject_id=subject_id, task=task
    )


@api_router.get("/datasets/{dataset_id}/recordings/{recording_id}", tags=["Datasets"])
def get_dataset_recording(dataset_id: str, recording_id: str) -> Any:
    """Retrieve canonical metadata, channel topology, and event markers for a recording."""
    from neuromove.datasets.service import get_dataset_service

    return get_dataset_service().get_recording(dataset_id, recording_id)


@api_router.get("/datasets/{dataset_id}/recordings/{recording_id}/signal", tags=["Datasets"])
def get_dataset_recording_signal(
    dataset_id: str,
    recording_id: str,
    channels: str | None = None,
    start_sec: float = 0.0,
    duration_sec: float = 4.0,
) -> Any:
    """Extract multi-channel time-series signal snippet for interactive EEG Lab replay."""
    from neuromove.datasets.service import get_dataset_service

    ch_list = [c.strip() for c in channels.split(",")] if channels else ["C3", "Cz", "C4"]
    return get_dataset_service().get_signal(
        dataset_id=dataset_id,
        recording_id=recording_id,
        channels=ch_list,
        start_sec=start_sec,
        duration_sec=duration_sec,
    )


@api_router.post("/datasets/{dataset_id}/download", tags=["Datasets"])
def download_dataset_recordings(
    dataset_id: str,
    payload: dict[str, Any] | None = None,
) -> list[Any]:
    """Trigger explicit download and verification of requested subjects/runs."""
    from neuromove.datasets.service import get_dataset_service

    sub_ids = payload.get("subject_ids") if payload else None
    run_ids = payload.get("run_ids") if payload else None
    return get_dataset_service().download_recordings(
        dataset_id=dataset_id, subject_ids=sub_ids, run_ids=run_ids
    )


@api_router.post("/datasets/{dataset_id}/verify", tags=["Datasets"])
def verify_dataset_integrity(dataset_id: str) -> dict[str, Any]:
    """Execute SHA-256 integrity verification across cached dataset files."""
    from neuromove.datasets.service import get_dataset_service

    return get_dataset_service().verify_dataset(dataset_id)


@api_router.get("/datasets/{dataset_id}/manifest", tags=["Datasets"])
def get_dataset_manifest(dataset_id: str) -> Any:
    """Retrieve full dataset reproducibility manifest."""
    from neuromove.datasets.service import get_dataset_service

    return get_dataset_service().get_manifest(dataset_id)


@api_router.get("/datasets/{dataset_id}/quality-report", tags=["Datasets"])
def get_dataset_quality_report(dataset_id: str) -> Any:
    """Retrieve scientific ingestion quality report."""
    from neuromove.datasets.service import get_dataset_service

    return get_dataset_service().get_quality_report(dataset_id)


# --- EEG Preprocessing & DSP Endpoints ---


def get_preprocessing_service() -> Any:
    from neuromove.preprocessing.service import PreprocessingService

    return PreprocessingService()


@api_router.get("/eeg/preprocessing/config/default", tags=["Preprocessing"])
def get_default_preprocessing_config() -> Any:
    """Retrieve canonical default preprocessing configuration."""
    from neuromove.preprocessing.models import PreprocessingConfig

    return PreprocessingConfig()


@api_router.post("/eeg/preprocessing/preview", tags=["Preprocessing"])
def post_preprocessing_preview(payload: dict[str, Any]) -> Any:
    """Validate configuration parameters and return preview execution graph."""
    from neuromove.preprocessing.models import PreprocessingRequest

    req = PreprocessingRequest(**payload)
    return get_preprocessing_service().preview_pipeline(req)


@api_router.post("/eeg/preprocessing/run", tags=["Preprocessing"])
def post_preprocessing_run(payload: dict[str, Any]) -> Any:
    """Execute complete preprocessing pipeline non-destructively and persist artifact."""
    from neuromove.preprocessing.models import PreprocessingRequest

    req = PreprocessingRequest(**payload)
    return get_preprocessing_service().run_preprocessing(req)


@api_router.get("/eeg/preprocessing/results", tags=["Preprocessing"])
def list_preprocessing_results(limit: int = 50) -> Any:
    """List recent preprocessing results."""
    return get_preprocessing_service().list_results(limit=limit)


@api_router.get("/eeg/preprocessing/results/{result_id}", tags=["Preprocessing"])
def get_preprocessing_result(result_id: str) -> Any:
    """Retrieve preprocessed result details and stage audit."""
    res = get_preprocessing_service().get_result(result_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preprocessing result '{result_id}' not found.",
        )
    return res


@api_router.get("/eeg/preprocessing/results/{result_id}/signal", tags=["Preprocessing"])
def get_preprocessing_signal(
    result_id: str,
    channels: str | None = Query(default=None),
    start_sec: float = Query(default=0.0),
    duration_sec: float = Query(default=5.0),
) -> Any:
    """Extract sliced time-series signal from preprocessed artifact for comparison."""
    ch_list = [c.strip() for c in channels.split(",")] if channels else None
    try:
        return get_preprocessing_service().get_result_signal(
            result_id=result_id,
            channels=ch_list,
            start_sec=start_sec,
            duration_sec=duration_sec,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preprocessing artifact '{result_id}' not found.",
        ) from exc


@api_router.get("/eeg/preprocessing/results/{result_id}/manifest", tags=["Preprocessing"])
def get_preprocessing_manifest(result_id: str) -> Any:
    """Export complete JSON reproducibility manifest for a preprocessing result."""
    try:
        return get_preprocessing_service().get_manifest(result_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preprocessing result '{result_id}' not found.",
        ) from exc


@api_router.post("/eeg/preprocessing/ica/fit", tags=["Preprocessing"])
def post_fit_ica(payload: dict[str, Any]) -> Any:
    """Fit ICA on source recording and return components for inspection."""
    from neuromove.preprocessing.models import PreprocessingRequest
    from neuromove.preprocessing.pipeline import fit_ica_decomposition

    req = PreprocessingRequest(**payload)
    svc = get_preprocessing_service()
    raw, _, _ = svc._get_source_raw(req)
    n_comp = payload.get("n_components", 15)
    rnd_state = payload.get("random_state", 42)
    return fit_ica_decomposition(raw, n_components=n_comp, random_state=rnd_state)


# --- Motor-Imagery Epoching & Feature Endpoints (Phase 10) ---


@api_router.post("/eeg/events/normalize", tags=["Epoching"])
def post_normalize_events(payload: dict[str, Any]) -> Any:
    """Discover, map, and validate events from source recording."""
    from ..epoching.events import normalize_events
    from ..epoching.models import EpochingRequest
    from ..features.service import get_epoching_feature_service

    req = EpochingRequest(**payload)
    svc = get_epoching_feature_service()
    raw, _, _, session_id, _ = svc._get_source_raw(req)
    mapping = req.mapping_config
    return normalize_events(raw, mapping_config=mapping, session_id=session_id)


@api_router.post("/eeg/epochs/preview", tags=["Epoching"])
def post_epochs_preview(payload: dict[str, Any]) -> Any:
    """Preview motor-imagery epoching segmentation parameters and trial counts."""
    from ..epoching.models import EpochingRequest
    from ..features.service import get_epoching_feature_service

    req = EpochingRequest(**payload)
    return get_epoching_feature_service().preview_epoching(req)


@api_router.post("/eeg/epochs/run", tags=["Epoching"])
def post_epochs_run(payload: dict[str, Any]) -> Any:
    """Execute motor-imagery trial epoching and save MNE Epochs artifact."""
    from ..epoching.models import EpochingRequest
    from ..features.service import get_epoching_feature_service

    req = EpochingRequest(**payload)
    return get_epoching_feature_service().run_epoching(req)


@api_router.get("/eeg/epochs", tags=["Epoching"])
def list_epoch_sets(limit: int = 50) -> Any:
    """List recent epoch sets."""
    from ..features.service import get_epoching_feature_service

    return get_epoching_feature_service().list_epoch_sets(limit=limit)


@api_router.get("/eeg/epochs/{epoch_set_id}", tags=["Epoching"])
def get_epoch_set(epoch_set_id: str) -> Any:
    """Retrieve summary and QC distribution for an epoch set."""
    from ..features.service import get_epoching_feature_service

    summary = get_epoching_feature_service().get_epoch_summary(epoch_set_id)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Epoch set '{epoch_set_id}' not found.",
        )
    return summary


@api_router.get("/eeg/epochs/{epoch_set_id}/records", tags=["Epoching"])
def get_epoch_records(epoch_set_id: str, limit: int = 100) -> Any:
    """Retrieve individual epoch records."""
    from ..features.service import get_epoching_feature_service

    return get_epoching_feature_service().list_epoch_records(epoch_set_id, limit=limit)


@api_router.get("/eeg/epochs/{epoch_set_id}/records/{epoch_id}/signal", tags=["Epoching"])
def get_epoch_record_signal(epoch_set_id: str, epoch_id: str) -> Any:
    """Retrieve time-series slice for an epoch waveform visualizer."""
    from ..features.service import get_epoching_feature_service

    try:
        return get_epoching_feature_service().get_epoch_signal(epoch_set_id, epoch_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Epoch '{epoch_id}' not found in set '{epoch_set_id}'.",
        ) from exc


@api_router.get("/eeg/epochs/{epoch_set_id}/manifest", tags=["Epoching"])
def get_epoch_manifest(epoch_set_id: str) -> Any:
    """Export complete JSON reproducibility manifest for an epoch set."""
    from ..features.service import get_epoching_feature_service

    try:
        return get_epoching_feature_service().get_epoch_manifest(epoch_set_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Epoch set '{epoch_set_id}' manifest not found.",
        ) from exc


@api_router.post("/eeg/features/preview", tags=["Features"])
def post_features_preview(payload: dict[str, Any]) -> Any:
    """Validate feature configuration against epoch set."""
    from ..features.models import FeatureExtractionRequest
    from ..features.service import get_epoching_feature_service

    req = FeatureExtractionRequest(**payload)
    try:
        return get_epoching_feature_service().preview_features(req)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Epoch set '{req.epoch_set_id}' not found.",
        ) from exc


@api_router.post("/eeg/features/run", tags=["Features"])
def post_features_run(payload: dict[str, Any]) -> Any:
    """Extract multi-band spectral features and covariance matrices."""
    from ..features.models import FeatureExtractionRequest
    from ..features.service import get_epoching_feature_service

    req = FeatureExtractionRequest(**payload)
    try:
        return get_epoching_feature_service().extract_features(req)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Epoch set '{req.epoch_set_id}' not found.",
        ) from exc


@api_router.get("/eeg/features", tags=["Features"])
def list_feature_sets(limit: int = 50) -> Any:
    """List recent feature sets."""
    from ..features.service import get_epoching_feature_service

    return get_epoching_feature_service().list_feature_sets(limit=limit)


@api_router.get("/eeg/features/{feature_set_id}", tags=["Features"])
def get_feature_set_record(feature_set_id: str) -> Any:
    """Retrieve summary metadata for a feature set."""
    from ..features.service import get_epoching_feature_service

    feat_set = get_epoching_feature_service().get_feature_set(feature_set_id)
    if not feat_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Feature set '{feature_set_id}' not found.",
        )
    return feat_set


@api_router.get("/eeg/features/{feature_set_id}/data", tags=["Features"])
def get_feature_matrix_data(feature_set_id: str, limit: int = 100) -> Any:
    """Retrieve row data from feature set."""
    from ..features.service import get_epoching_feature_service

    try:
        return get_epoching_feature_service().get_feature_data(feature_set_id, limit=limit)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Feature artifact '{feature_set_id}' not found.",
        ) from exc


@api_router.get("/eeg/features/{feature_set_id}/covariance", tags=["Features"])
def get_feature_covariance_data(feature_set_id: str) -> Any:
    """Retrieve spatial covariance matrices for CSP."""
    from ..features.service import get_epoching_feature_service

    try:
        return get_epoching_feature_service().get_covariance_set(feature_set_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Feature covariance '{feature_set_id}' not found.",
        ) from exc


@api_router.get("/eeg/features/{feature_set_id}/manifest", tags=["Features"])
def get_feature_manifest(feature_set_id: str) -> Any:
    """Export complete JSON manifest for a feature set."""
    from ..features.service import get_epoching_feature_service

    try:
        return get_epoching_feature_service().get_feature_manifest(feature_set_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Feature set '{feature_set_id}' not found.",
        ) from exc


@api_router.get("/eeg/features/{feature_set_id}/export/csv", tags=["Features"])
def get_feature_csv_export(feature_set_id: str) -> Any:
    """Download CSV file of extracted features."""
    from fastapi.responses import FileResponse

    from ..features.service import get_epoching_feature_service

    try:
        csv_path = get_epoching_feature_service().feature_storage.get_csv_export_path(
            feature_set_id
        )
        return FileResponse(
            path=str(csv_path),
            media_type="text/csv",
            filename=f"{feature_set_id}.csv",
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CSV export for '{feature_set_id}' not found.",
        ) from exc


# --- Classical Decoding & Model Endpoints (Phase 11) ---


@api_router.get("/models/classical/tasks", tags=["Models"])
def list_classification_tasks() -> Any:
    """Retrieve available motor-imagery classification tasks."""
    from ..decoding.tasks import get_canonical_tasks

    return get_canonical_tasks()


@api_router.post("/models/classical/preview", tags=["Models"])
def post_benchmark_preview(payload: dict[str, Any]) -> Any:
    """Validate decoding pipeline configuration, class balance, and expected CV folds."""
    from ..decoding.models import DecoderPipelineConfig
    from ..decoding.service import get_classical_decoding_service

    config = DecoderPipelineConfig(**payload)
    return get_classical_decoding_service().preview_benchmark(config)


@api_router.post("/models/classical/train", tags=["Models"])
def post_benchmark_train(payload: dict[str, Any]) -> Any:
    """Execute cross-validated CSP decoding benchmark and register model artifact."""
    from ..decoding.models import DecoderPipelineConfig
    from ..decoding.service import get_classical_decoding_service

    config = DecoderPipelineConfig(**payload)
    try:
        return get_classical_decoding_service().run_benchmark(config)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Decoding benchmark execution failed: {exc}",
        ) from exc


@api_router.get("/models/classical/runs", tags=["Models"])
def list_decoder_runs(limit: int = 50) -> Any:
    """List recent decoding benchmark runs."""
    from ..decoding.service import get_classical_decoding_service

    return get_classical_decoding_service().list_runs(limit=limit)


@api_router.get("/models/classical/models", tags=["Models"])
def list_decoder_models(limit: int = 50, task_id: str | None = None) -> Any:
    """List registered decoder models."""
    from ..decoding.service import get_classical_decoding_service

    return get_classical_decoding_service().list_models(limit=limit, task_id=task_id)


@api_router.get("/models/classical/models/{model_id}/manifest", tags=["Models"])
def get_decoder_model_manifest(model_id: str) -> Any:
    """Retrieve full provenance manifest for a trained decoder."""
    from ..decoding.service import get_classical_decoding_service

    try:
        return get_classical_decoding_service().get_model_manifest(model_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_id}' not found.",
        ) from exc


@api_router.get("/models/classical/models/{model_id}/export/csv", tags=["Models"])
def get_decoder_csv_export(model_id: str) -> Any:
    """Download CSV file of model performance metrics."""
    from fastapi.responses import FileResponse

    from ..decoding.service import get_classical_decoding_service

    try:
        csv_path = get_classical_decoding_service().decoder_storage.get_csv_export_path(model_id)
        return FileResponse(
            path=str(csv_path),
            media_type="text/csv",
            filename=f"{model_id}_metrics.csv",
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CSV export for '{model_id}' not found.",
        ) from exc


@api_router.post("/models/classical/predict", tags=["Models"])
def post_decoder_predict(payload: dict[str, Any]) -> Any:
    """Execute offline or replay prediction for a single trial."""
    from ..decoding.models import PredictionRequest
    from ..decoding.service import get_classical_decoding_service

    req = PredictionRequest(**payload)
    try:
        return get_classical_decoding_service().predict_epoch(req)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Prediction failed: {exc}",
        ) from exc


# --- Phase 12: AI Model Laboratory Endpoints ---

_ai_model_lab_service = None


def get_ai_model_lab_service():
    global _ai_model_lab_service
    if _ai_model_lab_service is None:
        from ..experiments.service import AIModelLabService

        _ai_model_lab_service = AIModelLabService()
    return _ai_model_lab_service


@api_router.get("/ai/experiments", tags=["AI Model Laboratory"])
def get_ai_experiments() -> list[Any]:
    """List summary of all registered experiments."""
    return get_ai_model_lab_service().list_experiments()


@api_router.post("/ai/experiments/preview", tags=["AI Model Laboratory"])
def post_ai_experiment_preview(payload: dict[str, Any]) -> Any:
    """Pre-flight check for dataset compatibility, fold calculation, and search size."""
    from ..experiments.models import ExperimentConfig

    cfg = ExperimentConfig(**payload)
    return get_ai_model_lab_service().preview_experiment(cfg)


@api_router.post("/ai/experiments/run", tags=["AI Model Laboratory"])
def post_ai_experiment_run(payload: dict[str, Any]) -> Any:
    """Execute full group-aware / nested cross-validation experiment."""
    from ..experiments.models import ExperimentConfig

    cfg = ExperimentConfig(**payload)
    try:
        return get_ai_model_lab_service().run_experiment(cfg)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Experiment execution failed: {exc}",
        ) from exc


@api_router.get("/ai/experiments/{experiment_id}", tags=["AI Model Laboratory"])
def get_ai_experiment_detail(experiment_id: str) -> Any:
    """Retrieve full experiment detail and metrics."""
    try:
        return get_ai_model_lab_service().get_experiment(experiment_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@api_router.get("/ai/experiments/{experiment_id}/predictions", tags=["AI Model Laboratory"])
def get_ai_experiment_predictions(experiment_id: str) -> Any:
    """Fetch out-of-fold sample-level prediction records."""
    return get_ai_model_lab_service().get_experiment_predictions(experiment_id)


@api_router.get("/ai/experiments/{experiment_id}/errors", tags=["AI Model Laboratory"])
def get_ai_experiment_errors(experiment_id: str) -> Any:
    """Fetch out-of-fold error analysis (confused pairs, difficult subjects/sessions)."""
    return get_ai_model_lab_service().get_experiment_errors(experiment_id)


@api_router.post("/ai/ablations/run", tags=["AI Model Laboratory"])
def post_ai_ablation_run(payload: dict[str, Any]) -> Any:
    """Execute a controlled single-variable ablation study."""
    from ..experiments.models import ExperimentConfig

    baseline_payload = payload.get("baseline_experiment_config", {})
    ablation_var = payload.get("ablation_variable", "CSP_COMPONENTS")
    baseline_cfg = ExperimentConfig(**baseline_payload)
    try:
        return get_ai_model_lab_service().run_ablation_study(
            baseline_config=baseline_cfg, ablation_variable=ablation_var
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ablation execution failed: {exc}",
        ) from exc


@api_router.post("/ai/compare", tags=["AI Model Laboratory"])
def post_ai_compare_models(payload: dict[str, Any]) -> Any:
    """Compare multiple experiments under identical task and fold conditions."""
    cmp_name = payload.get("comparison_name", "Model Comparison")
    exp_ids = payload.get("experiment_ids", [])
    try:
        return get_ai_model_lab_service().compare_experiments(
            comparison_name=cmp_name, experiment_ids=exp_ids
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Comparison failed: {exc}",
        ) from exc


@api_router.get("/ai/models/{model_id}/card", tags=["AI Model Laboratory"])
def get_ai_model_card(model_id: str) -> Any:
    """Retrieve structured JSON and Markdown Model Card."""
    try:
        return get_ai_model_lab_service().get_model_card(model_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@api_router.post("/ai/batch-predict", tags=["AI Model Laboratory"])
def post_ai_batch_predict(payload: dict[str, Any]) -> Any:
    """Execute batch inference across an epoch set for offline replay evaluation."""
    model_id = payload.get("model_id", "")
    epoch_set_id = payload.get("epoch_set_id", "")
    try:
        return get_ai_model_lab_service().predict_batch(
            model_id=model_id, epoch_set_id=epoch_set_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch prediction failed: {exc}",
        ) from exc


# --- Phase 13: Personalized Motor-Imagery Calibration & Adaptation ---


@api_router.get("/calibration/profiles", tags=["Personalized Calibration"])
def get_subject_profiles() -> list[Any]:
    """List all registered pseudonymous subject profiles."""
    from ..calibration.service import get_calibration_service

    return get_calibration_service().list_subject_profiles()


@api_router.post("/calibration/profiles", tags=["Personalized Calibration"])
def post_create_subject_profile(payload: dict[str, Any]) -> Any:
    """Create or register a pseudonymous subject profile."""
    from ..calibration.models import CreateSubjectProfileRequest
    from ..calibration.service import get_calibration_service

    try:
        req = CreateSubjectProfileRequest(**payload)
        return get_calibration_service().create_subject_profile(req)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create subject profile: {exc}",
        ) from exc


@api_router.get("/calibration/profiles/{subject_id}", tags=["Personalized Calibration"])
def get_subject_profile_by_id(subject_id: str) -> Any:
    """Retrieve subject profile by subject ID."""
    from ..calibration.service import get_calibration_service

    profile = get_calibration_service().get_subject_profile(subject_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject profile '{subject_id}' not found.",
        )
    return profile


@api_router.get("/calibration/protocols", tags=["Personalized Calibration"])
def get_calibration_protocols() -> list[Any]:
    """Retrieve available declarative calibration protocols."""
    from ..calibration.protocol import CalibrationProtocolEngine

    return [CalibrationProtocolEngine.get_default_protocol()]


@api_router.post("/calibration/sessions/start", tags=["Personalized Calibration"])
def post_start_calibration_session(payload: dict[str, Any]) -> Any:
    """Initialize and arm a calibration session with deterministic trial schedule."""
    from ..calibration.models import StartCalibrationSessionRequest
    from ..calibration.service import get_calibration_service

    try:
        req = StartCalibrationSessionRequest(**payload)
        session, trials = get_calibration_service().start_session(req)
        return {"session": session, "trials": trials}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to start calibration session: {exc}",
        ) from exc


@api_router.get("/calibration/sessions/{calibration_id}", tags=["Personalized Calibration"])
def get_calibration_session_by_id(calibration_id: str) -> Any:
    """Retrieve calibration session state and summary."""
    from ..calibration.service import get_calibration_service

    session = get_calibration_service().get_session(calibration_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Calibration session '{calibration_id}' not found.",
        )
    return session


@api_router.post("/calibration/sessions/{calibration_id}/pause", tags=["Personalized Calibration"])
def post_pause_calibration_session(
    calibration_id: str, payload: dict[str, Any] | None = None
) -> Any:
    """Pause an in-progress calibration session."""
    from ..calibration.service import get_calibration_service

    reason = payload.get("reason", "User requested pause") if payload else "User requested pause"
    try:
        return get_calibration_service().pause_session(calibration_id, reason=reason)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to pause session: {exc}",
        ) from exc


@api_router.post("/calibration/sessions/{calibration_id}/resume", tags=["Personalized Calibration"])
def post_resume_calibration_session(calibration_id: str) -> Any:
    """Resume a paused calibration session."""
    from ..calibration.service import get_calibration_service

    try:
        return get_calibration_service().resume_session(calibration_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to resume session: {exc}",
        ) from exc


@api_router.post("/calibration/sessions/{calibration_id}/abort", tags=["Personalized Calibration"])
def post_abort_calibration_session(
    calibration_id: str, payload: dict[str, Any] | None = None
) -> Any:
    """Abort a calibration session and preserve recorded trials."""
    from ..calibration.service import get_calibration_service

    reason = (
        payload.get("reason", "Operator aborted calibration")
        if payload
        else "Operator aborted calibration"
    )
    try:
        return get_calibration_service().abort_session(calibration_id, reason=reason)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to abort session: {exc}",
        ) from exc


@api_router.post(
    "/calibration/sessions/{calibration_id}/advance-simulation", tags=["Personalized Calibration"]
)
def post_advance_simulation_trial(calibration_id: str) -> Any:
    """Step forward one trial in simulation mode."""
    from ..calibration.service import get_calibration_service

    try:
        return get_calibration_service().advance_simulation(calibration_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to advance simulation: {exc}",
        ) from exc


@api_router.get("/calibration/sessions/{calibration_id}/trials", tags=["Personalized Calibration"])
def get_calibration_trials_by_id(calibration_id: str) -> list[Any]:
    """Retrieve all trials for a calibration session."""
    from ..calibration.service import get_calibration_service

    return get_calibration_service().get_trials(calibration_id)


@api_router.get("/calibration/sessions/{calibration_id}/report", tags=["Personalized Calibration"])
def get_calibration_report_by_id(calibration_id: str) -> Any:
    """Generate and retrieve structured calibration report."""
    from ..calibration.service import get_calibration_service

    try:
        return get_calibration_service().generate_calibration_report(calibration_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to generate report: {exc}",
        ) from exc


@api_router.post("/calibration/personalize/run", tags=["Personalized Calibration"])
def post_run_personalization(payload: dict[str, Any]) -> Any:
    """Execute leakage-safe subject-specific training, held-out evaluation, and generic benchmarking."""
    from ..calibration.models import PersonalizationConfig
    from ..calibration.service import get_calibration_service

    try:
        config = PersonalizationConfig(**payload)
        return get_calibration_service().run_personalization(config)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Personalization failed: {exc}",
        ) from exc


@api_router.get("/calibration/personalize/models/{model_id}", tags=["Personalized Calibration"])
def get_personalized_model_by_id(model_id: str) -> Any:
    """Retrieve personalized model metadata."""
    from ..calibration.service import get_calibration_service

    model = get_calibration_service().get_personalized_model(model_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personalized model '{model_id}' not found.",
        )
    return model


@api_router.get("/calibration/history/{subject_id}", tags=["Personalized Calibration"])
def get_subject_calibration_history(subject_id: str) -> list[Any]:
    """Fetch chronological calibration session history for a subject."""
    from ..calibration.service import get_calibration_service

    return get_calibration_service().get_subject_history(subject_id)


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
