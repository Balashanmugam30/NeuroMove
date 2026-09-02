import uuid
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Query, Response, WebSocket, status
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


# --- Actuation Emergency Stop ---


@api_router.post("/emergency/stop", response_model=EmergencyStopResponse, tags=["Safety"])
def post_emergency_stop() -> EmergencyStopResponse:
    """Trigger immediate emergency stop across all local actuators and state machines."""
    from ..safety.service import default_safety_service

    default_safety_state_machine.trigger_emergency_stop(reason="Operator API emergency halt")
    default_safety_service.assert_emergency_stop(
        reason="Operator API emergency halt", asserted_by="OPERATOR"
    )
    simulation_engine.robot_simulator.emergency_stop_triggered = True
    return EmergencyStopResponse(
        success=True,
        state=RuntimeState.EMERGENCY,
        timestamp=utc_now(),
        message="Emergency stop successfully engaged. System in safe fail-closed state.",
    )


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


# --- Phase 14: Adaptive Learning & Controlled Model Update Endpoints ---


@api_router.get("/adaptation/policies", tags=["Adaptive Learning"])
def get_adaptation_policies() -> list[Any]:
    """List all available adaptation policies."""
    from ..adaptation.service import get_adaptation_service

    return get_adaptation_service().list_policies()


@api_router.post("/adaptation/policies", tags=["Adaptive Learning"])
def post_create_adaptation_policy(payload: dict[str, Any]) -> Any:
    """Create a new declarative adaptation policy."""
    from ..adaptation.models import CreateAdaptationPolicyRequest
    from ..adaptation.service import get_adaptation_service

    req = CreateAdaptationPolicyRequest(**payload)
    return get_adaptation_service().create_policy(req)


@api_router.get("/adaptation/batches", tags=["Adaptive Learning"])
def get_adaptation_batches(subject_id: str | None = None) -> list[Any]:
    """List registered candidate data batches."""
    from ..adaptation.service import get_adaptation_service

    return get_adaptation_service().list_batches(subject_id)


@api_router.post("/adaptation/batches", tags=["Adaptive Learning"])
def post_create_adaptation_batch(payload: dict[str, Any]) -> Any:
    """Register or synthesize candidate data batch."""
    from ..adaptation.service import get_adaptation_service

    svc = get_adaptation_service()
    name = payload.get("name", "Candidate Batch")
    subject_id = payload.get("subject_id", "sub-001")
    import random

    n_trials = payload.get("trial_count", 10)
    batch_seed = payload.get("random_state") or random.randint(1000, 999999)

    # Synthesize realistic signals for candidate batch
    X, y, ids = svc.synthesize_eeg_trials(
        n_trials_per_class=max(3, n_trials // 2),
        subject_id=subject_id,
        seed=batch_seed,
    )

    batch = svc.create_data_batch(
        name=name,
        epoch_ids=ids,
        labels=y.tolist(),
        subject_id=subject_id,
        source_mode=payload.get("source_mode", "SIMULATION"),
        signals=X,
    )
    return batch


@api_router.post("/adaptation/preview", tags=["Adaptive Learning"])
def post_adaptation_preview(payload: dict[str, Any]) -> Any:
    """Compute pre-flight compatibility and data composition preview."""
    from ..adaptation.models import AdaptationPreviewRequest
    from ..adaptation.service import get_adaptation_service

    try:
        req = AdaptationPreviewRequest(**payload)
        return get_adaptation_service().compute_preview(
            base_model_id=req.base_model_id,
            data_batch_ids=req.data_batch_ids,
            policy_id=req.policy_id,
            scope=req.scope,
            subject_id=req.subject_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Preview failed: {exc}",
        ) from exc


@api_router.post("/adaptation/run", tags=["Adaptive Learning"])
def post_start_adaptation_run(payload: dict[str, Any]) -> Any:
    """Execute controlled adaptation experiment under zero data leakage constraints."""
    from ..adaptation.models import StartAdaptationRunRequest
    from ..adaptation.service import get_adaptation_service

    try:
        req = StartAdaptationRunRequest(**payload)
        return get_adaptation_service().run_adaptation(
            base_model_id=req.base_model_id,
            data_batch_ids=req.data_batch_ids,
            policy_id=req.policy_id,
            scope=req.scope,
            subject_id=req.subject_id,
            notes=req.notes,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adaptation run failed: {exc}",
        ) from exc


@api_router.get("/adaptation/runs", tags=["Adaptive Learning"])
def get_adaptation_runs(subject_id: str | None = None) -> list[Any]:
    """List historical adaptation runs."""
    from ..adaptation.service import get_adaptation_service

    return get_adaptation_service().list_runs(subject_id)


@api_router.get("/adaptation/runs/{adaptation_id}", tags=["Adaptive Learning"])
def get_adaptation_run_by_id(adaptation_id: str) -> Any:
    """Fetch details of a specific adaptation run."""
    from ..adaptation.service import get_adaptation_service

    run = get_adaptation_service().get_run(adaptation_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Adaptation run '{adaptation_id}' not found.",
        )
    return run


@api_router.get("/adaptation/runs/{adaptation_id}/manifest", tags=["Adaptive Learning"])
def get_adaptation_manifest_by_id(adaptation_id: str) -> Any:
    """Export cryptographic provenance manifest for an adaptation run."""
    from ..adaptation.service import get_adaptation_service

    manifest = get_adaptation_service().get_manifest(adaptation_id)
    if not manifest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manifest for adaptation run '{adaptation_id}' not found.",
        )
    return manifest


@api_router.get("/adaptation/models", tags=["Adaptive Learning"])
def get_adaptation_models(
    scope: str | None = None,
    subject_id: str | None = None,
) -> list[Any]:
    """List versioned models."""
    from ..adaptation.models import AdaptationScope
    from ..adaptation.service import get_adaptation_service

    scope_enum = AdaptationScope(scope) if scope else None
    return get_adaptation_service().list_models(scope=scope_enum, subject_id=subject_id)


@api_router.get("/adaptation/models/{model_id}/versions", tags=["Adaptive Learning"])
def get_model_versions_by_id(model_id: str) -> list[Any]:
    """Retrieve version lineage chain for a model."""
    from ..adaptation.service import get_adaptation_service

    return get_adaptation_service().get_model_versions(model_id)


@api_router.post("/adaptation/promote", tags=["Adaptive Learning"])
def post_promote_candidate(payload: dict[str, Any]) -> Any:
    """Explicitly promote a validated candidate model to active research status."""
    from ..adaptation.models import PromoteCandidateRequest
    from ..adaptation.service import get_adaptation_service

    try:
        req = PromoteCandidateRequest(**payload)
        promoted, decision = get_adaptation_service().promote_candidate(
            adaptation_id=req.adaptation_id,
            operator_notes=req.operator_notes,
        )
        return {"promoted_model": promoted, "decision": decision}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Promotion failed: {exc}",
        ) from exc


@api_router.post("/adaptation/reject", tags=["Adaptive Learning"])
def post_reject_candidate(payload: dict[str, Any]) -> Any:
    """Explicitly reject a candidate model with operator rationale."""
    from ..adaptation.models import RejectCandidateRequest
    from ..adaptation.service import get_adaptation_service

    try:
        req = RejectCandidateRequest(**payload)
        rejected, decision = get_adaptation_service().reject_candidate(
            adaptation_id=req.adaptation_id,
            rejection_reason=req.rejection_reason,
        )
        return {"rejected_model": rejected, "decision": decision}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rejection failed: {exc}",
        ) from exc


@api_router.post("/adaptation/rollback", tags=["Adaptive Learning"])
def post_rollback_model(payload: dict[str, Any]) -> Any:
    """Roll back active model pointer to a previous validated model version."""
    from ..adaptation.models import RollbackRequest
    from ..adaptation.service import get_adaptation_service

    try:
        req = RollbackRequest(**payload)
        active_ver, event = get_adaptation_service().rollback(
            target_model_id=req.target_model_id,
            reason=req.reason,
        )
        return {"active_model": active_ver, "rollback_event": event}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rollback failed: {exc}",
        ) from exc


@api_router.get("/adaptation/drift", tags=["Adaptive Learning"])
def get_drift_diagnostics(
    subject_id: str | None = "sub-001",
    inject_shift: bool = False,
) -> Any:
    """Run research diagnostic distribution drift evaluation."""
    from ..adaptation.service import get_adaptation_service

    return get_adaptation_service().run_drift_diagnostics(
        subject_id=subject_id,
        inject_shift=inject_shift,
    )


# ============================================================================
# Phase 15: Confidence Estimation & Temporal Confirmation Endpoints
# ============================================================================


@api_router.get("/confidence/config", tags=["Confidence & Temporal Confirmation"])
def get_confidence_configuration(
    subject_id: str | None = Query(None),
    model_version_id: str | None = Query(None),
) -> Any:
    """Retrieve active confidence estimation and temporal gating configuration."""
    from ..confidence.service import get_confidence_service

    return get_confidence_service().get_config(
        subject_id=subject_id,
        model_version_id=model_version_id,
    )


@api_router.put("/confidence/config", tags=["Confidence & Temporal Confirmation"])
def update_confidence_configuration(payload: dict[str, Any]) -> Any:
    """Update confidence estimation and temporal confirmation policies."""
    from ..confidence.models import ConfidenceConfig
    from ..confidence.service import get_confidence_service

    try:
        config = ConfidenceConfig(**payload)
        return get_confidence_service().update_config(config)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid configuration payload: {exc}",
        ) from exc


@api_router.post("/confidence/evaluate", tags=["Confidence & Temporal Confirmation"])
def evaluate_confidence(payload: dict[str, Any]) -> Any:
    """Evaluate single prediction through multi-factor gating and temporal confirmation engine."""
    from ..confidence.models import ConfidenceInput
    from ..confidence.service import get_confidence_service

    try:
        inp = ConfidenceInput(**payload)
        decision, temporal, handoff = get_confidence_service().evaluate_prediction(inp)
        return {
            "decision": decision,
            "temporal": temporal,
            "handoff": handoff,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Evaluation failed: {exc}",
        ) from exc


@api_router.post("/confidence/reset", tags=["Confidence & Temporal Confirmation"])
def reset_temporal_state(payload: dict[str, Any] | None = None) -> Any:
    """Explicitly reset temporal confirmation accumulation state."""
    from ..confidence.models import TemporalResetReason
    from ..confidence.service import get_confidence_service

    reason_str = payload.get("reason", "MANUAL_RESET") if payload else "MANUAL_RESET"
    try:
        reason = TemporalResetReason(reason_str)
    except ValueError:
        reason = TemporalResetReason.MANUAL_RESET

    get_confidence_service().reset_temporal_state(reason)
    return {"status": "RESET", "reason": reason.value}


@api_router.get("/confidence/state", tags=["Confidence & Temporal Confirmation"])
def get_confidence_state() -> Any:
    """Retrieve current temporal confirmation state."""
    from ..confidence.service import get_confidence_service

    svc = get_confidence_service()
    return {
        "state": svc.temporal_engine.state,
        "config": svc.config,
    }


@api_router.get("/confidence/history", tags=["Confidence & Temporal Confirmation"])
def get_confidence_history(
    limit: int = Query(50, ge=1, le=500),
    subject_id: str | None = Query(None),
) -> Any:
    """Retrieve historical confidence evaluations and confirmation transitions."""
    from ..confidence.service import get_confidence_service

    return get_confidence_service().storage.get_history(
        limit=limit,
        subject_id=subject_id,
    )


@api_router.get("/confidence/events", tags=["Confidence & Temporal Confirmation"])
def get_temporal_events(limit: int = Query(50, ge=1, le=500)) -> Any:
    """Retrieve audit history of temporal confirmation state changes."""
    from ..confidence.service import get_confidence_service

    return get_confidence_service().storage.get_temporal_events(limit=limit)


@api_router.get("/confidence/calibration", tags=["Confidence & Temporal Confirmation"])
def get_calibration_profile(model_version_id: str = Query("v1")) -> Any:
    """Retrieve active calibration profile for model checkpoint."""
    from ..confidence.models import CalibrationMethod, CalibrationScope
    from ..confidence.service import get_confidence_service

    svc = get_confidence_service()
    profile = svc.storage.get_calibration_profile(model_version_id)
    if not profile:
        # Generate baseline demonstration profile
        y_true = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1]
        raw_scores = [0.85, 0.20, 0.78, 0.92, 0.15, 0.35, 0.88, 0.22, 0.91, 0.30, 0.79, 0.84]
        profile = svc.calibrate_model(
            model_version_id=model_version_id,
            uncalibrated_scores=raw_scores,
            labels=y_true,
            method=CalibrationMethod.PLATT,
            scope=CalibrationScope.MODEL,
            dataset_reference="baseline_validation_set",
        )
    return profile


@api_router.post("/confidence/calibrate", tags=["Confidence & Temporal Confirmation"])
def post_calibrate_model(payload: dict[str, Any]) -> Any:
    """Fit a new calibration profile on validation dataset."""
    from ..confidence.models import CalibrationMethod, CalibrationScope
    from ..confidence.service import get_confidence_service

    model_version_id = payload.get("model_version_id", "v1")
    uncalibrated_scores = payload.get("uncalibrated_scores", [0.85, 0.20, 0.78, 0.92, 0.15, 0.35])
    labels = payload.get("labels", [1, 0, 1, 1, 0, 0])
    method_str = payload.get("method", "PLATT")
    scope_str = payload.get("scope", "GLOBAL")

    try:
        profile = get_confidence_service().calibrate_model(
            model_version_id=model_version_id,
            uncalibrated_scores=uncalibrated_scores,
            labels=labels,
            method=CalibrationMethod(method_str),
            scope=CalibrationScope(scope_str),
            subject_id=payload.get("subject_id"),
            dataset_reference=payload.get("dataset_reference", "custom_validation_set"),
        )
        return profile
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Calibration fitting failed: {exc}",
        ) from exc


@api_router.get("/confidence/metrics", tags=["Confidence & Temporal Confirmation"])
def get_confidence_metrics(model_version_id: str = Query("v1")) -> Any:
    """Retrieve statistical reliability curve and Brier/ECE research evaluation metrics."""
    from ..confidence.calibrator import ConfidenceCalibrator
    from ..confidence.service import get_confidence_service

    profile = get_confidence_service().storage.get_calibration_profile(model_version_id)
    if profile:
        return profile.calibration_metrics

    # Fallback default evaluation metrics
    y_true = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1]
    y_prob = [0.85, 0.20, 0.78, 0.92, 0.15, 0.35, 0.88, 0.22, 0.91, 0.30, 0.79, 0.84]
    return ConfidenceCalibrator.calculate_calibration_metrics(y_true, y_prob)


@api_router.post("/confidence/simulation/scenarios", tags=["Confidence & Temporal Confirmation"])
def run_confidence_scenario(payload: dict[str, Any]) -> Any:
    """Run deterministic research verification scenario (A through H)."""
    from ..confidence.service import get_confidence_service

    scenario_id = payload.get("scenario_id", "SCENARIO_A_STABLE_HIGH_CONFIDENCE")
    return get_confidence_service().run_deterministic_scenario(scenario_id)


# --- Phase 16: Canonical Intent State Machine & Lifecycle Endpoints ---


@api_router.get("/intent/state", tags=["Canonical Intent State Machine"])
def get_intent_state() -> Any:
    """Retrieve current authoritative intent state snapshot and transition count."""
    from ..intent.service import get_intent_service

    return get_intent_service().get_snapshot()


@api_router.get("/intent/current", tags=["Canonical Intent State Machine"])
def get_current_intent() -> Any:
    """Retrieve current active or candidate intent record, if any."""
    from ..intent.service import get_intent_service

    return get_intent_service().get_current_intent()


@api_router.get("/intent/history", tags=["Canonical Intent State Machine"])
def get_intent_transition_history(
    limit: int = Query(50, ge=1, le=500),
    intent_id: str | None = Query(None),
) -> Any:
    """Retrieve immutable transition history log."""
    from ..intent.service import get_intent_service

    return get_intent_service().storage.get_transition_history(limit=limit, intent_id=intent_id)


@api_router.get("/intent/records", tags=["Canonical Intent State Machine"])
def get_intent_records(
    limit: int = Query(50, ge=1, le=500),
    state: str | None = Query(None),
    subject_id: str | None = Query(None),
) -> Any:
    """Retrieve historical intent records."""
    from ..intent.models import IntentLifecycleState
    from ..intent.service import get_intent_service

    st = IntentLifecycleState(state) if state else None
    return get_intent_service().storage.get_intent_records(
        limit=limit, state=st, subject_id=subject_id
    )


@api_router.get("/intent/policy", tags=["Canonical Intent State Machine"])
def get_intent_policy() -> Any:
    """Retrieve active intent lifecycle configuration policy."""
    from ..intent.service import get_intent_service

    return get_intent_service().get_policy()


@api_router.put("/intent/policy", tags=["Canonical Intent State Machine"])
def update_intent_policy(policy_data: dict[str, Any]) -> Any:
    """Update intent lifecycle policy configuration."""
    from ..intent.models import IntentPolicy
    from ..intent.service import get_intent_service

    try:
        updated = IntentPolicy(**policy_data)
        return get_intent_service().update_policy(updated)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid intent policy payload: {exc}",
        ) from exc


@api_router.post("/intent/ingest", tags=["Canonical Intent State Machine"])
def ingest_intent_handoff(payload: dict[str, Any]) -> Any:
    """Ingest authoritative Phase 15 handoff or prediction evidence into intent state machine."""
    from ..intent.models import IntentIngestRequest
    from ..intent.service import get_intent_service

    try:
        req = IntentIngestRequest(**payload)
        snapshot = get_intent_service().ingest_handoff(req)
        return snapshot
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to ingest intent handoff: {exc}",
        ) from exc


@api_router.post("/intent/cancel", tags=["Canonical Intent State Machine"])
def cancel_intent(payload: dict[str, Any] | None = None) -> Any:
    """Explicitly cancel active, confirmed, or candidate intent."""
    from ..intent.models import IntentCancelRequest
    from ..intent.service import get_intent_service

    req = IntentCancelRequest(**(payload or {}))
    return get_intent_service().cancel_intent(req)


@api_router.post("/intent/complete", tags=["Canonical Intent State Machine"])
def complete_intent(payload: dict[str, Any] | None = None) -> Any:
    """Mark active intent lifecycle as completed (software lifecycle completion only)."""
    from ..intent.models import IntentCompleteRequest
    from ..intent.service import get_intent_service

    try:
        req = IntentCompleteRequest(**(payload or {}))
        return get_intent_service().complete_intent(req)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@api_router.post("/intent/reset", tags=["Canonical Intent State Machine"])
def reset_intent_state(payload: dict[str, Any] | None = None) -> Any:
    """Reset state machine to NO_INTENT while preserving historical audit log."""
    from ..intent.models import IntentResetRequest
    from ..intent.service import get_intent_service

    req = IntentResetRequest(**(payload or {}))
    return get_intent_service().reset_state(req)


@api_router.get("/intent/{intent_id}", tags=["Canonical Intent State Machine"])
def get_intent_by_id(intent_id: str) -> Any:
    """Retrieve detailed record for a specific intent ID."""
    from ..intent.service import get_intent_service

    rec = get_intent_service().storage.get_intent_record(intent_id)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Intent record '{intent_id}' not found",
        )
    return rec


@api_router.post("/intent/simulation/scenarios", tags=["Canonical Intent State Machine"])
def run_intent_scenario(payload: dict[str, Any]) -> Any:
    """Execute deterministic research lifecycle verification scenarios (A through L)."""
    from ..intent.service import get_intent_service

    scenario_id = payload.get("scenario_id", "SCENARIO_A_NORMAL_LIFECYCLE")
    return get_intent_service().run_scenario(scenario_id)


# --- Phase 17 Safety Arbitration & Authorization Gate ---


class SafetyEvaluateBody(BaseModel):
    intent_snapshot: dict[str, Any] | None = None
    context_override: dict[str, Any] | None = None
    policy_id: str | None = None


class SafetyHoldBody(BaseModel):
    operator_id: str | None = None
    reason: str | None = None


class SafetyEmergencyStopBody(BaseModel):
    reason: str | None = None
    asserted_by: str | None = None


class SafetyResetBody(BaseModel):
    operator_id: str | None = None
    clear_lockout: bool = False


class SafetyLockoutBody(BaseModel):
    reason: str
    operator_id: str | None = None


class SafetyScenarioBody(BaseModel):
    scenario_id: str


@api_router.get("/safety/state", tags=["Safety Arbitration"])
@api_router.get("/safety/current", tags=["Safety Arbitration"])
def get_current_safety_snapshot() -> Any:
    """Return authoritative singleton snapshot of software execution authorization gate."""
    from ..safety.service import default_safety_service

    return default_safety_service.get_current_snapshot()


@api_router.get("/safety/policy", tags=["Safety Arbitration"])
def get_safety_policy() -> Any:
    """Fetch active versioned safety arbitration policy."""
    from ..safety.service import default_safety_service

    return default_safety_service.get_active_policy()


@api_router.put("/safety/policy", tags=["Safety Arbitration"])
def update_safety_policy(policy_data: dict[str, Any]) -> Any:
    """Update active safety arbitration policy."""
    from ..safety.policies import SafetyPolicy
    from ..safety.service import default_safety_service

    new_policy = SafetyPolicy(**policy_data)
    return default_safety_service.update_policy(new_policy)


@api_router.post("/safety/evaluate", tags=["Safety Arbitration"])
def evaluate_safety_intent(payload: SafetyEvaluateBody) -> Any:
    """Execute deterministic software safety arbitration against intent snapshot."""
    from ..safety.service import default_safety_service

    return default_safety_service.evaluate_intent(
        intent_snapshot=payload.intent_snapshot,
        context_override=payload.context_override,
        policy_id=payload.policy_id,
    )


@api_router.get("/safety/history", tags=["Safety Arbitration"])
def get_safety_evaluation_history(
    limit: int = Query(default=100, ge=1, le=500),
    decision: str | None = Query(default=None),
) -> list[Any]:
    """Retrieve historical safety evaluation records."""
    from ..safety.service import default_safety_service

    return default_safety_service.get_evaluation_history(limit=limit, decision=decision)


@api_router.get("/safety/transitions", tags=["Safety Arbitration"])
def get_safety_transition_history(
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Any]:
    """Retrieve audit log of state machine transitions."""
    from ..safety.service import default_safety_service

    return default_safety_service.get_transition_history(limit=limit)


@api_router.post("/safety/hold", tags=["Safety Arbitration"])
def assert_operator_hold(payload: SafetyHoldBody | None = None) -> Any:
    """Engage manual operator hold."""
    from ..safety.service import default_safety_service

    body = payload or SafetyHoldBody()
    return default_safety_service.assert_operator_hold(
        operator_id=body.operator_id, reason=body.reason
    )


@api_router.post("/safety/release-hold", tags=["Safety Arbitration"])
def release_operator_hold(payload: SafetyHoldBody | None = None) -> Any:
    """Release manual operator hold."""
    from ..safety.service import default_safety_service

    body = payload or SafetyHoldBody()
    return default_safety_service.release_operator_hold(operator_id=body.operator_id)


@api_router.post("/safety/emergency-stop", tags=["Safety Arbitration"])
def assert_safety_emergency_stop(payload: SafetyEmergencyStopBody | None = None) -> Any:
    """Assert software emergency stop (dominates all execution authorization)."""
    from ..safety.service import default_safety_service

    body = payload or SafetyEmergencyStopBody()
    return default_safety_service.assert_emergency_stop(
        reason=body.reason, asserted_by=body.asserted_by
    )


@api_router.post("/safety/clear-emergency-stop", tags=["Safety Arbitration"])
def clear_safety_emergency_stop(payload: SafetyEmergencyStopBody | None = None) -> Any:
    """Clear software emergency stop and move to RESET_PENDING."""
    from ..safety.service import default_safety_service

    body = payload or SafetyEmergencyStopBody()
    return default_safety_service.clear_emergency_stop(operator_id=body.asserted_by)


@api_router.post("/safety/reset", tags=["Safety Arbitration"])
def reset_safety_state(payload: SafetyResetBody | None = None) -> Any:
    """Execute complete safety reset sequence to return to SAFE_IDLE."""
    from ..safety.service import default_safety_service

    body = payload or SafetyResetBody()
    return default_safety_service.execute_reset(
        operator_id=body.operator_id, clear_lockout=body.clear_lockout
    )


@api_router.post("/safety/lockout", tags=["Safety Arbitration"])
def assert_safety_lockout(payload: SafetyLockoutBody) -> Any:
    """Engage software lockout state."""
    from ..safety.service import default_safety_service

    return default_safety_service.assert_lockout(
        reason=payload.reason, operator_id=payload.operator_id
    )


@api_router.post("/safety/unlock", tags=["Safety Arbitration"])
def unlock_safety_lockout(payload: SafetyResetBody | None = None) -> Any:
    """Unlock lockout state and transition to RESET_PENDING."""
    from ..safety.service import default_safety_service

    body = payload or SafetyResetBody()
    return default_safety_service.unlock(operator_id=body.operator_id)


@api_router.get("/safety/rules", tags=["Safety Arbitration"])
def list_safety_rules() -> list[dict[str, Any]]:
    """List all registered deterministic safety rules and categories."""
    from ..safety.rules import DEFAULT_SAFETY_RULES

    return [
        {
            "rule_id": r.rule_id,
            "category": r.category,
            "precedence_rank": int(r.precedence_rank),
            "description": (r.__doc__ or "").strip(),
        }
        for r in DEFAULT_SAFETY_RULES
    ]


@api_router.get("/safety/diagnostics", tags=["Safety Arbitration"])
def get_safety_diagnostics() -> Any:
    """Return operational metrics and failure statistics for safety arbitration."""
    from ..safety.service import default_safety_service

    return default_safety_service.get_diagnostics()


@api_router.post("/safety/simulation/scenarios", tags=["Safety Arbitration"])
def run_safety_scenario(payload: SafetyScenarioBody) -> Any:
    """Run deterministic research safety scenario (A through O)."""
    from ..safety.service import default_safety_service

    return default_safety_service.run_scenario(payload.scenario_id)


# --- Phase 18: Failure Injection, Fault-Tolerance & Resilience Laboratory ---


@api_router.get("/resilience/status", tags=["Resilience & Fault Laboratory"])
def get_resilience_status() -> Any:
    """Return live authoritative status of the resilience lab."""
    from ..resilience.service import default_resilience_service

    return default_resilience_service.get_status()


@api_router.get("/resilience/faults", tags=["Resilience & Fault Laboratory"])
def get_resilience_faults() -> Any:
    """List all currently active injected faults."""
    from ..resilience.service import default_resilience_service

    return default_resilience_service.injector.get_active_faults()


@api_router.post("/resilience/faults/inject", tags=["Resilience & Fault Laboratory"])
def inject_resilience_fault(payload: dict[str, Any]) -> Any:
    """Inject a parameterized, controlled fault into the live test harness."""
    from ..resilience.models import FaultInjectionRequest
    from ..resilience.service import default_resilience_service

    req = FaultInjectionRequest(**payload)
    return default_resilience_service.inject_fault(req)


@api_router.post("/resilience/faults/{fault_id}/clear", tags=["Resilience & Fault Laboratory"])
def clear_resilience_fault(fault_id: str) -> Any:
    """Clear an active fault by ID."""
    from ..resilience.service import default_resilience_service

    cleared = default_resilience_service.clear_fault(fault_id)
    if not cleared:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fault {fault_id} not found among active faults.",
        )
    return {"status": "cleared", "fault": cleared}


@api_router.get("/resilience/experiments", tags=["Resilience & Fault Laboratory"])
def get_resilience_experiments(limit: int = Query(50, ge=1, le=200)) -> Any:
    """List historical resilience experiments."""
    from ..resilience.service import default_resilience_service

    return default_resilience_service.storage.list_experiments(limit=limit)


@api_router.post("/resilience/experiments", tags=["Resilience & Fault Laboratory"])
def create_resilience_experiment(payload: dict[str, Any]) -> Any:
    """Execute a custom resilience experiment with manifest and recovery."""
    from ..resilience.faults import create_fault_definition
    from ..resilience.models import FaultType
    from ..resilience.service import default_resilience_service

    scenario_id = payload.get("scenario_id", "CUSTOM_EXPERIMENT")
    name = payload.get("name", "Custom Fault Experiment")
    seed = payload.get("seed", 42)
    fault_types = payload.get("fault_types", ["STREAM_DELAY"])

    fault_sequence = [create_fault_definition(FaultType(ft)) for ft in fault_types]
    return default_resilience_service.run_experiment(
        scenario_id=scenario_id,
        name=name,
        fault_sequence=fault_sequence,
        seed=seed,
    )


@api_router.get("/resilience/experiments/{experiment_id}", tags=["Resilience & Fault Laboratory"])
def get_resilience_experiment(experiment_id: str) -> Any:
    """Retrieve full details of an executed experiment."""
    from ..resilience.service import default_resilience_service

    exp = default_resilience_service.storage.get_experiment(experiment_id)
    if not exp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment {experiment_id} not found.",
        )
    return exp


@api_router.post(
    "/resilience/experiments/{experiment_id}/replay", tags=["Resilience & Fault Laboratory"]
)
def replay_resilience_experiment(experiment_id: str) -> Any:
    """Replay an experiment deterministically from its immutable manifest."""
    from ..resilience.service import default_resilience_service

    try:
        matched, original, chk = default_resilience_service.replay.replay_experiment(experiment_id)
        return {
            "experiment_id": experiment_id,
            "deterministic_parity": matched,
            "manifest_checksum": chk,
            "original_status": original.status,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@api_router.get("/resilience/invariants", tags=["Resilience & Fault Laboratory"])
def get_resilience_invariants() -> Any:
    """Return the suite of 14 platform invariants evaluated under fault injection."""
    from ..resilience.invariants import InvariantEngine
    from ..resilience.service import default_resilience_service

    snap = default_resilience_service.observer.capture_snapshot()
    return InvariantEngine.evaluate_all(
        baseline=snap,
        current=snap,
        active_faults=[],
    )


@api_router.get("/resilience/metrics", tags=["Resilience & Fault Laboratory"])
def get_resilience_metrics() -> Any:
    """Return operational reliability and fail-closed certification metrics."""
    from ..resilience.service import default_resilience_service

    return default_resilience_service.storage.get_metrics()


@api_router.get("/resilience/checkpoints", tags=["Resilience & Fault Laboratory"])
def get_resilience_checkpoints(experiment_id: str | None = None) -> Any:
    """List recovery checkpoints captured before/after experiments."""
    from ..resilience.service import default_resilience_service

    return default_resilience_service.storage.list_checkpoints(experiment_id=experiment_id)


@api_router.post("/resilience/reset-lab", tags=["Resilience & Fault Laboratory"])
def reset_resilience_lab() -> Any:
    """Emergency reset clearing all active faults and restoring baseline health."""
    from ..resilience.service import default_resilience_service

    cleared = default_resilience_service.reset_lab()
    return {"status": "reset_complete", "cleared_faults_count": cleared}


@api_router.post("/resilience/scenarios/run", tags=["Resilience & Fault Laboratory"])
def run_resilience_scenario(payload: dict[str, Any]) -> Any:
    """Execute a canonical scenario from the failure registry (A—Z, AA—AH)."""
    from ..resilience.service import default_resilience_service

    scenario_id = payload.get("scenario_id", "SCENARIO_A")
    try:
        return default_resilience_service.run_scenario(scenario_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# --- Phase 19: ESP32 Protocol & Command Transport Endpoints ---


@api_router.get("/transport/status", tags=["Command Transport & ESP32 Protocol"])
def get_transport_status() -> Any:
    """Return live authoritative status of the transport layer and link health."""
    from ..transport_protocol.service import default_transport_service

    return default_transport_service.get_status()


@api_router.get("/transport/devices", tags=["Command Transport & ESP32 Protocol"])
def get_transport_devices() -> list[Any]:
    """Retrieve registered simulated/real endpoint devices."""
    from ..transport_protocol.service import default_transport_service

    return default_transport_service.storage.get_devices()


@api_router.get("/transport/devices/{device_id}", tags=["Command Transport & ESP32 Protocol"])
def get_transport_device(device_id: str) -> Any:
    """Retrieve detail of a registered endpoint device."""
    from ..transport_protocol.service import default_transport_service

    devices = default_transport_service.storage.get_devices()
    for d in devices:
        if d.get("device_id") == device_id:
            return d
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Device '{device_id}' not found",
    )


@api_router.get("/transport/capabilities", tags=["Command Transport & ESP32 Protocol"])
def get_transport_capabilities() -> Any:
    """Retrieve negotiated device capabilities."""
    from ..transport_protocol.service import default_transport_service

    return [c.value for c in default_transport_service.adapter.capabilities()]


@api_router.get("/transport/connection", tags=["Command Transport & ESP32 Protocol"])
def get_transport_connection() -> Any:
    """Retrieve current connection state and heartbeat status."""
    from ..transport_protocol.service import default_transport_service

    status_obj = default_transport_service.get_status()
    return {
        "connection_state": status_obj.connection_state.value,
        "heartbeat": status_obj.heartbeat.model_dump(),
        "device_id": status_obj.device.device_id if status_obj.device else None,
    }


@api_router.get("/transport/commands", tags=["Command Transport & ESP32 Protocol"])
def get_transport_commands(limit: int = 50, command_status: str | None = None) -> list[Any]:
    """Retrieve recent commands with optional status filter."""
    from ..transport_protocol.service import default_transport_service

    return default_transport_service.storage.get_commands(limit=limit, status=command_status)


@api_router.get("/transport/commands/{command_id}", tags=["Command Transport & ESP32 Protocol"])
def get_transport_command(command_id: str) -> Any:
    """Retrieve specific command lifecycle audit record."""
    from ..transport_protocol.service import default_transport_service

    cmd = default_transport_service.storage.get_command(command_id)
    if not cmd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Command '{command_id}' not found",
        )
    return cmd


@api_router.get("/transport/trace", tags=["Command Transport & ESP32 Protocol"])
def get_transport_trace(limit: int = 100) -> list[Any]:
    """Retrieve development/research protocol packet capture trace."""
    from ..transport_protocol.service import default_transport_service

    return default_transport_service.storage.get_traces(limit=limit)


@api_router.post("/transport/negotiate", tags=["Command Transport & ESP32 Protocol"])
def post_transport_negotiate(payload: dict[str, Any]) -> Any:
    """Initiate 3-way protocol handshake and version negotiation."""
    from ..transport_protocol.service import default_transport_service

    version = payload.get("protocol_version", "1.0")
    session_id = payload.get("session_id", "sess-01")
    compat, ver, reason = default_transport_service.negotiate(version, session_id)
    return {
        "success": compat,
        "negotiated_version": ver,
        "reason": reason,
        "connection_state": default_transport_service.connection_state.value,
    }


@api_router.post("/transport/commands/validate", tags=["Command Transport & ESP32 Protocol"])
def post_transport_commands_validate(payload: dict[str, Any]) -> Any:
    """Validate Phase 17 ExecutionAuthorization before frame construction."""
    from ..transport_protocol.models import ExecutionAuthorization
    from ..transport_protocol.service import default_transport_service

    auth = ExecutionAuthorization.model_validate(payload)
    is_valid, reason_code, msg = default_transport_service.validate_command_authorization(auth)
    return {
        "valid": is_valid,
        "reason_code": reason_code,
        "message": msg,
    }


@api_router.post("/transport/commands/send", tags=["Command Transport & ESP32 Protocol"])
def post_transport_commands_send(payload: dict[str, Any]) -> Any:
    """Validate Phase 17 authorization, construct envelope, transmit frame to adapter."""
    from ..transport_protocol.models import ExecutionAuthorization
    from ..transport_protocol.service import default_transport_service

    auth = ExecutionAuthorization.model_validate(payload)
    return default_transport_service.send_authorized_command(auth)


@api_router.post(
    "/transport/commands/{command_id}/cancel", tags=["Command Transport & ESP32 Protocol"]
)
def post_transport_command_cancel(command_id: str) -> Any:
    """Cancel an in-flight command."""
    from ..transport_protocol.service import default_transport_service

    return default_transport_service.cancel_command(command_id)


@api_router.get("/transport/metrics", tags=["Command Transport & ESP32 Protocol"])
def get_transport_metrics() -> Any:
    """Retrieve aggregated transport diagnostic metrics."""
    from ..transport_protocol.service import default_transport_service

    return default_transport_service.storage.get_metrics()


@api_router.get("/transport/heartbeats", tags=["Command Transport & ESP32 Protocol"])
def get_transport_heartbeats() -> Any:
    """Retrieve current heartbeat status and trigger a heartbeat ping."""
    from ..transport_protocol.service import default_transport_service

    return default_transport_service.ping_heartbeat()


@api_router.post("/transport/simulation/reset", tags=["Command Transport & ESP32 Protocol"])
def post_transport_simulation_reset() -> Any:
    """Reset the transport simulator and clear audit registries."""
    from ..transport_protocol.service import default_transport_service

    default_transport_service.reset_simulation()
    return {"status": "SUCCESS", "message": "Simulation reset completed"}


@api_router.post("/transport/simulation/fault", tags=["Command Transport & ESP32 Protocol"])
def post_transport_simulation_fault(payload: dict[str, Any]) -> Any:
    """Configure simulated endpoint fault parameters (drop, delay, corrupt, disconnect)."""
    from ..transport_protocol.service import default_transport_service

    if hasattr(default_transport_service.adapter, "simulator"):
        default_transport_service.adapter.simulator.set_faults(
            drop_next=payload.get("drop_next", False),
            delay_ms=float(payload.get("delay_ms", 0.0)),
            corrupt_crc=payload.get("corrupt_crc", False),
            drop_ack=payload.get("drop_ack", False),
            disconnect=payload.get("disconnect", False),
            skew_seconds=float(payload.get("skew_seconds", 0.0)),
        )
        return {"status": "SUCCESS", "faults": payload}
    return {"status": "IGNORED", "message": "Adapter does not support simulation faults"}


@api_router.post("/transport/simulation/reconnect", tags=["Command Transport & ESP32 Protocol"])
def post_transport_simulation_reconnect() -> Any:
    """Trigger simulator reconnection and renegotiation."""
    from ..transport_protocol.service import default_transport_service

    success = default_transport_service.reconnect()
    return {"status": "SUCCESS" if success else "FAILED", "connected": success}


@api_router.get("/transport/scenarios", tags=["Command Transport & ESP32 Protocol"])
def get_transport_scenarios() -> list[Any]:
    """List all canonical transport verification scenarios (A through T)."""
    from ..transport_protocol.service import default_transport_service

    return default_transport_service.scenario_registry.list_scenarios()


@api_router.post("/transport/scenarios/run", tags=["Command Transport & ESP32 Protocol"])
def post_transport_scenarios_run(payload: dict[str, Any]) -> Any:
    """Execute a canonical deterministic scenario (A through T)."""
    from ..transport_protocol.service import default_transport_service

    scenario_id = payload.get("scenario_id", "SCENARIO_A")
    try:
        return default_transport_service.scenario_registry.run_scenario(scenario_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# ============================================================================
# Phase 20: Hardware-in-the-Loop & ESP32 Adapter Endpoints
# ============================================================================


@api_router.get("/hardware/status", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def get_hardware_status() -> Any:
    """Retrieve top-level status of the Hardware-in-the-Loop laboratory."""
    from ..hardware_hil.service import default_hardware_service

    return default_hardware_service.get_status().model_dump()


@api_router.get("/hardware/devices", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def get_hardware_devices() -> list[dict[str, Any]]:
    """Retrieve registered hardware and simulated devices."""
    from ..hardware_hil.service import default_hardware_service

    return default_hardware_service.storage.list_devices()


@api_router.get("/hardware/devices/{device_id}", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def get_hardware_device_by_id(device_id: str) -> Any:
    """Retrieve device metadata by ID."""
    from ..hardware_hil.service import default_hardware_service

    devices = default_hardware_service.storage.list_devices()
    for d in devices:
        if d.get("device_id") == device_id:
            return d
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail=f"Device {device_id} not found"
    )


@api_router.get("/hardware/ports", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def get_hardware_ports() -> list[dict[str, Any]]:
    """Discover available communication ports without opening them."""
    from ..hardware_hil.service import default_hardware_service

    ports = default_hardware_service.list_ports()
    return [p.model_dump() for p in ports]


@api_router.get("/hardware/sessions", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def get_hardware_sessions() -> list[dict[str, Any]]:
    """Retrieve historical hardware sessions."""
    from ..hardware_hil.service import default_hardware_service

    status_data = default_hardware_service.get_status()
    if status_data.session_id:
        return [
            {
                "session_id": status_data.session_id,
                "device_id": status_data.device.device_id if status_data.device else "esp32_sim_01",
                "boot_id": status_data.boot_id or "boot_01",
                "device_mode": status_data.active_mode,
                "protocol_version": "1.0",
                "firmware_version": "0.1.0",
                "connected_at": utc_now().isoformat(),
                "status": "ACTIVE",
                "sequence_base": 0,
            }
        ]
    return []


@api_router.get("/hardware/health", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def get_hardware_health() -> Any:
    """Retrieve multi-factor health telemetry for the hardware boundary."""
    from ..hardware_hil.service import default_hardware_service

    return default_hardware_service.get_health().model_dump()


@api_router.get("/hardware/capabilities", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def get_hardware_capabilities() -> list[str]:
    """Retrieve advertised capabilities of the active hardware adapter."""
    from ..hardware_hil.service import default_hardware_service

    return [
        str(c.value if hasattr(c, "value") else c)
        for c in default_hardware_service.adapter.capabilities()
    ]


@api_router.get("/hardware/diagnostics", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def get_hardware_diagnostics(limit: int = 50) -> list[dict[str, Any]]:
    """Retrieve recent diagnostic events."""
    from ..hardware_hil.service import default_hardware_service

    return default_hardware_service.storage.list_diagnostics(limit=limit)


@api_router.post("/hardware/discover", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def post_hardware_discover() -> list[dict[str, Any]]:
    """Enumerate available serial and virtual ports."""
    from ..hardware_hil.service import default_hardware_service

    ports = default_hardware_service.list_ports()
    return [p.model_dump() for p in ports]


@api_router.post("/hardware/connect", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def post_hardware_connect(payload: dict[str, Any]) -> Any:
    """Connect to a designated endpoint mode (SIMULATOR, VIRTUAL_SERIAL, HIL_ESP32)."""
    from ..hardware_hil.models import HardwareEndpointMode
    from ..hardware_hil.service import default_hardware_service

    mode_str = payload.get("device_mode", "SIMULATOR")
    port = payload.get("port")
    baud_rate = payload.get("baud_rate", 115200)

    try:
        mode = HardwareEndpointMode(mode_str)
        success = default_hardware_service.set_endpoint_mode(
            mode=mode, port=port, baud_rate=baud_rate
        )
        return {
            "success": success,
            "device_mode": mode.value,
            "status": default_hardware_service.get_status().model_dump(),
        }
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@api_router.post("/hardware/disconnect", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def post_hardware_disconnect() -> Any:
    """Disconnect from active hardware endpoint."""
    from ..hardware_hil.models import HardwareConnectionState
    from ..hardware_hil.service import default_hardware_service

    default_hardware_service.adapter.disconnect()
    default_hardware_service.state_machine.reset()
    return {"status": "DISCONNECTED", "connection_state": HardwareConnectionState.DISCONNECTED}


@api_router.post("/hardware/negotiate", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def post_hardware_negotiate(payload: dict[str, Any]) -> Any:
    """Perform protocol handshake negotiation."""
    from ..hardware_hil.service import default_hardware_service

    version = payload.get("client_protocol_version", "1.0")
    session_id = payload.get(
        "session_id", default_hardware_service.active_session_id or "sess_hw_01"
    )
    success, negotiated, reason = default_hardware_service.adapter.negotiate(version, session_id)
    return {
        "success": success,
        "negotiated_version": negotiated,
        "reason": reason,
        "capabilities": [
            str(c.value if hasattr(c, "value") else c)
            for c in default_hardware_service.adapter.capabilities()
        ],
    }


@api_router.post("/hardware/hil/validate", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def post_hardware_hil_validate(payload: dict[str, Any]) -> Any:
    """Pre-flight validate an execution authorization contract before hardware framing."""
    from ..transport_protocol.commands import validate_authorization
    from ..transport_protocol.models import ExecutionAuthorization

    try:
        auth = ExecutionAuthorization(**payload)
        is_valid, reason_code, message = validate_authorization(auth)
        return {
            "valid": is_valid,
            "reason_code": reason_code,
            "message": message,
            "will_transmit": is_valid,
        }
    except Exception as exc:
        return {
            "valid": False,
            "reason_code": "MALFORMED_AUTHORIZATION",
            "message": str(exc),
            "will_transmit": False,
        }


@api_router.post("/hardware/hil/run", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def post_hardware_hil_run(payload: dict[str, Any]) -> Any:
    """Execute an authorized execution command over the active hardware adapter."""
    from ..hardware_hil.service import default_hardware_service
    from ..transport_protocol.models import CommandType, ExecutionAuthorization

    try:
        cmd_type_str = payload.get("command_type", "EXECUTE_INTENT")
        intent_class = payload.get("intent_class", "MOVE_FORWARD")
        subject_id = payload.get("subject_id", "sub-01")
        auth_data = payload.get("authorization", {})

        auth = ExecutionAuthorization(**auth_data)
        cmd_type = CommandType(cmd_type_str)

        result = default_hardware_service.send_command(
            command_type=cmd_type,
            intent_class=intent_class,
            authorization=auth,
            subject_id=subject_id,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@api_router.post("/hardware/hil/reconnect", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def post_hardware_hil_reconnect() -> Any:
    """Trigger clean reconnection and renegotiate session."""
    from ..hardware_hil.service import default_hardware_service

    default_hardware_service.adapter.disconnect()
    default_hardware_service.state_machine.reset()
    default_hardware_service._initialize_default_state()
    return default_hardware_service.get_status().model_dump()


@api_router.post("/hardware/hil/reboot", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def post_hardware_hil_reboot() -> Any:
    """Trigger cold reboot on endpoint and resynchronize session."""
    from ..hardware_hil.service import default_hardware_service

    new_boot = default_hardware_service.reboot_device()
    return {
        "status": "REBOOTED",
        "new_boot_id": new_boot,
        "hardware_status": default_hardware_service.get_status().model_dump(),
    }


@api_router.get("/hardware/hil/experiments", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def get_hardware_hil_experiments(limit: int = 50) -> list[dict[str, Any]]:
    """List historical HIL experiments."""
    from ..hardware_hil.service import default_hardware_service

    return default_hardware_service.storage.list_experiments(limit=limit)


@api_router.get(
    "/hardware/hil/experiments/{experiment_id}", tags=["Hardware-in-the-Loop & ESP32 Adapter"]
)
def get_hardware_hil_experiment_by_id(experiment_id: str) -> Any:
    """Retrieve experiment details by ID."""
    from ..hardware_hil.service import default_hardware_service

    exps = default_hardware_service.storage.list_experiments(limit=100)
    for exp in exps:
        if exp.get("experiment_id") == experiment_id:
            return exp
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail=f"Experiment {experiment_id} not found"
    )


@api_router.post(
    "/hardware/hil/experiments/{experiment_id}/replay",
    tags=["Hardware-in-the-Loop & ESP32 Adapter"],
)
def post_hardware_hil_experiment_replay(experiment_id: str) -> Any:
    """Replay a recorded HIL scenario experiment."""
    from ..hardware_hil.service import default_hardware_service

    exps = default_hardware_service.storage.list_experiments(limit=100)
    target = next((e for e in exps if e.get("experiment_id") == experiment_id), None)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Experiment {experiment_id} not found"
        )

    scenario_id = target.get("scenario_id", "SCENARIO_A")
    result = default_hardware_service.run_scenario(scenario_id)
    return {
        "replayed_experiment_id": experiment_id,
        "scenario_id": scenario_id,
        "result": result.model_dump(),
    }


@api_router.post("/hardware/hil/reset", tags=["Hardware-in-the-Loop & ESP32 Adapter"])
def post_hardware_hil_reset() -> Any:
    """Reset the entire Hardware-in-the-Loop laboratory to initial state."""
    from ..hardware_hil.service import default_hardware_service

    default_hardware_service.adapter.close()
    default_hardware_service._initialize_default_state()
    return default_hardware_service.get_status().model_dump()


# ============================================================================
# Real EEG / BioAmp Acquisition Endpoints (Phase 21)
# ============================================================================


@api_router.get("/eeg/acquisition/status", tags=["Real EEG & BioAmp Acquisition"])
def get_eeg_acquisition_status() -> Any:
    """Return active EEG acquisition status and stream health."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    return {
        "active_source": default_eeg_acquisition_service.active_source,
        "active_device_id": default_eeg_acquisition_service.active_device_id,
        "session_id": default_eeg_acquisition_service.active_session_id,
        "health": default_eeg_acquisition_service.get_stream_health().model_dump(),
    }


@api_router.get("/eeg/acquisition/devices", tags=["Real EEG & BioAmp Acquisition"])
def get_eeg_acquisition_devices() -> Any:
    """List all discovered physical, synthetic, and recorded acquisition devices."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    return [d.model_dump() for d in default_eeg_acquisition_service.discover_devices()]


@api_router.get("/eeg/acquisition/channels", tags=["Real EEG & BioAmp Acquisition"])
def get_eeg_acquisition_channels() -> Any:
    """Return per-channel signal quality diagnostics on recent sample window."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    return [ch.model_dump() for ch in default_eeg_acquisition_service.get_channel_health()]


@api_router.get("/eeg/acquisition/health", tags=["Real EEG & BioAmp Acquisition"])
def get_eeg_acquisition_health() -> Any:
    """Return aggregate acquisition stream health snapshot."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    return default_eeg_acquisition_service.get_stream_health().model_dump()


@api_router.get("/eeg/acquisition/diagnostics", tags=["Real EEG & BioAmp Acquisition"])
def get_eeg_acquisition_diagnostics(limit: int = 50) -> Any:
    """Retrieve recent acquisition diagnostics."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    return [d.model_dump() for d in default_eeg_acquisition_service.storage.get_diagnostics(limit)]


@api_router.get("/eeg/acquisition/waveforms", tags=["Real EEG & BioAmp Acquisition"])
def get_eeg_acquisition_waveforms(window_samples: int = 500) -> Any:
    """Extract downsampled multi-channel waveform window for oscilloscope visualization."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    return default_eeg_acquisition_service.get_waveform_window(window_samples)


@api_router.get("/eeg/acquisition/calibration", tags=["Real EEG & BioAmp Acquisition"])
def get_eeg_acquisition_calibration() -> Any:
    """Return latest calibration and baseline snapshot."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    snap = default_eeg_acquisition_service.calibration_workflow.get_latest_snapshot()
    return snap.model_dump() if snap else None


@api_router.get("/eeg/acquisition/experiments", tags=["Real EEG & BioAmp Acquisition"])
def get_eeg_acquisition_experiments(limit: int = 50) -> Any:
    """Retrieve historical E2E acquisition scenario experiments."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    return [e.model_dump() for e in default_eeg_acquisition_service.storage.get_experiments(limit)]


@api_router.post("/eeg/acquisition/discover", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_discover() -> Any:
    """Trigger safe discovery of EEG acquisition endpoints."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    return [d.model_dump() for d in default_eeg_acquisition_service.discover_devices()]


@api_router.post("/eeg/acquisition/source", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_source(payload: dict[str, Any]) -> Any:
    """Switch active acquisition mode (PHYSICAL, SIMULATOR, RECORDED)."""
    from ..eeg_acquisition.models import EegAcquisitionSource
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    src_str = payload.get("source_type", "SIMULATOR")
    src = EegAcquisitionSource(src_str)
    dev_id = payload.get("device_id")
    success = default_eeg_acquisition_service.set_source_mode(src, dev_id)
    return {"success": success, "active_source": default_eeg_acquisition_service.active_source}


@api_router.post("/eeg/acquisition/connect", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_connect(payload: dict[str, Any] | None = None) -> Any:
    """Connect to target EEG acquisition device."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    dev_id = payload.get("device_id") if payload else None
    success = default_eeg_acquisition_service.adapter.connect(dev_id)
    return {"success": success, "state": default_eeg_acquisition_service.adapter.get_status()}


@api_router.post("/eeg/acquisition/disconnect", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_disconnect() -> Any:
    """Disconnect active EEG acquisition device."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    success = default_eeg_acquisition_service.adapter.disconnect()
    return {"success": success, "state": default_eeg_acquisition_service.adapter.get_status()}


@api_router.post("/eeg/acquisition/start", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_start() -> Any:
    """Start streaming EEG sample chunks."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    success = default_eeg_acquisition_service.adapter.start_stream()
    return {"success": success, "state": default_eeg_acquisition_service.adapter.get_status()}


@api_router.post("/eeg/acquisition/pause", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_pause() -> Any:
    """Pause active EEG stream."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    success = default_eeg_acquisition_service.adapter.pause()
    return {"success": success, "state": default_eeg_acquisition_service.adapter.get_status()}


@api_router.post("/eeg/acquisition/resume", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_resume() -> Any:
    """Resume paused EEG stream."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    success = default_eeg_acquisition_service.adapter.resume()
    return {"success": success, "state": default_eeg_acquisition_service.adapter.get_status()}


@api_router.post("/eeg/acquisition/stop", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_stop() -> Any:
    """Stop active EEG stream."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    success = default_eeg_acquisition_service.adapter.stop_stream()
    return {"success": success, "state": default_eeg_acquisition_service.adapter.get_status()}


@api_router.post("/eeg/acquisition/calibrate", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_calibrate() -> Any:
    """Execute baseline calibration on buffered EEG window."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    return default_eeg_acquisition_service.run_calibration().model_dump()


@api_router.post("/eeg/acquisition/inference", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_inference(payload: dict[str, Any] | None = None) -> Any:
    """Execute full live pipeline inference from buffered EEG window."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    override = payload.get("override_intent") if payload else None
    return default_eeg_acquisition_service.run_live_inference(override_intent=override).model_dump()


@api_router.post("/eeg/acquisition/scenario/{scenario_id}", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_scenario(scenario_id: str) -> Any:
    """Run one of the 10 Golden E2E Verification Scenarios (SCENARIO_A to SCENARIO_J)."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    return default_eeg_acquisition_service.run_scenario(scenario_id).model_dump()


@api_router.post("/eeg/acquisition/fault-injection", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_fault_injection(payload: dict[str, Any]) -> Any:
    """Inject a simulated hardware/stream fault for resilience testing."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    fault_type = payload.get("fault_type", "FLATLINE_CHANNEL")
    params = payload.get("params", {})
    success = default_eeg_acquisition_service.inject_fault(fault_type, params)
    return {"success": success, "fault_type": fault_type}


@api_router.post("/eeg/acquisition/reset", tags=["Real EEG & BioAmp Acquisition"])
def post_eeg_acquisition_reset() -> Any:
    """Reset the EEG acquisition subsystem."""
    from ..eeg_acquisition.service import default_eeg_acquisition_service

    default_eeg_acquisition_service._initialize_default_state()
    return default_eeg_acquisition_service.get_stream_health().model_dump()


# ============================================================================
# Phase 22: Deterministic Replay, Research Analytics & Evaluation Endpoints
# ============================================================================

from neuromove.research_analytics.models import (
    AnalysisType,
    ArtifactType,
    GroupingStrategy,
    ReplayMode,
)
from neuromove.research_analytics.scenarios import ResearchGoldenScenarios
from neuromove.research_analytics.service import default_research_service


@api_router.get("/research/experiments", tags=["Research Analytics"])
def get_research_experiments() -> Any:
    """List all registered research experiments."""
    return [exp.model_dump() for exp in default_research_service.list_experiments()]


@api_router.post("/research/experiments", tags=["Research Analytics"])
def post_create_research_experiment(payload: dict[str, Any]) -> Any:
    """Create a new research experiment with immutable initial manifest."""
    title = payload.get("title", "Research Replay Experiment")
    description = payload.get("description", "Evaluation study")
    analysis_type = AnalysisType(payload.get("analysis_type", "BENCHMARK"))
    replay_mode = ReplayMode(payload.get("replay_mode", "DETERMINISTIC_ACCELERATED"))
    dataset_id = payload.get("dataset_id")
    sources = payload.get("source_session_ids")
    seed = payload.get("seed", 42)

    exp = default_research_service.create_experiment(
        title=title,
        description=description,
        analysis_type=analysis_type,
        replay_mode=replay_mode,
        dataset_id=dataset_id,
        source_session_ids=sources,
        seed=seed,
    )
    return exp.model_dump()


@api_router.get("/research/experiments/{experiment_id}", tags=["Research Analytics"])
def get_research_experiment(experiment_id: str) -> Any:
    """Get research experiment by ID."""
    exp = default_research_service.get_experiment(experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
    return exp.model_dump()


@api_router.post("/research/experiments/{experiment_id}/seal", tags=["Research Analytics"])
def post_seal_research_experiment(experiment_id: str) -> Any:
    """Seal an experiment manifest, freezing parameters and computing immutable SHA-256 hash."""
    try:
        sealed = default_research_service.seal_experiment(experiment_id)
        return sealed.model_dump()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@api_router.post("/research/experiments/{experiment_id}/run", tags=["Research Analytics"])
def post_run_research_experiment(experiment_id: str, payload: dict[str, Any] | None = None) -> Any:
    """Execute deterministic multi-stage replay and generate full analytical metrics."""
    trials = payload.get("trial_count", 40) if payload else 40
    checkpoint_id = payload.get("checkpoint_id") if payload else None
    try:
        res = default_research_service.run_experiment(
            experiment_id=experiment_id,
            trial_count=trials,
            checkpoint_id=checkpoint_id,
        )
        return res.model_dump()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@api_router.get("/research/experiments/{experiment_id}/stages", tags=["Research Analytics"])
def get_research_experiment_stages(experiment_id: str) -> Any:
    """Get all 15 pipeline stage results for an experiment."""
    exp = default_research_service.get_experiment(experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
    return [stg.model_dump() for stg in exp.stages]


@api_router.get("/research/experiments/{experiment_id}/metrics", tags=["Research Analytics"])
def get_research_experiment_metrics(experiment_id: str) -> Any:
    """Get scientific classification and calibration metrics for an experiment."""
    exp = default_research_service.get_experiment(experiment_id)
    if not exp or not exp.metrics:
        raise HTTPException(status_code=404, detail="Metrics not available")
    return exp.metrics.model_dump()


@api_router.get("/research/experiments/{experiment_id}/latency", tags=["Research Analytics"])
def get_research_experiment_latency(experiment_id: str) -> Any:
    """Get per-stage and total pipeline latency percentiles for an experiment."""
    exp = default_research_service.get_experiment(experiment_id)
    if not exp or not exp.latency_analytics:
        raise HTTPException(status_code=404, detail="Latency analytics not available")
    return exp.latency_analytics.model_dump()


@api_router.get("/research/experiments/{experiment_id}/reproducibility", tags=["Research Analytics"])
def get_research_experiment_reproducibility(experiment_id: str) -> Any:
    """Get reproducibility audit results for an experiment."""
    exp = default_research_service.get_experiment(experiment_id)
    if not exp or not exp.reproducibility:
        raise HTTPException(status_code=404, detail="Reproducibility audit not available")
    return exp.reproducibility.model_dump()


@api_router.post("/research/experiments/{experiment_id}/ablation", tags=["Research Analytics"])
def post_run_ablation(experiment_id: str, payload: dict[str, Any]) -> Any:
    """Execute ablation study, spawning an immutable child experiment."""
    ablation_type = payload.get("ablation_type", "CHANNEL_DROPOUT")
    parameter_delta = payload.get("parameter_delta", {})
    try:
        child, abl_rec = default_research_service.run_ablation(
            parent_experiment_id=experiment_id,
            ablation_type=ablation_type,
            parameter_delta=parameter_delta,
        )
        return {
            "child_experiment": child.model_dump(),
            "ablation_record": abl_rec.model_dump(),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@api_router.post("/research/experiments/{experiment_id}/robustness", tags=["Research Analytics"])
def post_run_robustness(experiment_id: str, payload: dict[str, Any]) -> Any:
    """Execute robustness sweep across perturbation levels."""
    perturbation_type = payload.get("perturbation_type", "ADDITIVE_NOISE")
    levels = payload.get("levels", [0.1, 0.25, 0.5, 0.75, 1.0])
    seed = payload.get("seed", 42)
    runs = default_research_service.run_robustness_sweep(
        parent_experiment_id=experiment_id,
        perturbation_type=perturbation_type,
        levels=levels,
        seed=seed,
    )
    return [r.model_dump() for r in runs]


@api_router.post("/research/comparisons", tags=["Research Analytics"])
def post_run_comparison(payload: dict[str, Any]) -> Any:
    """Execute comparative benchmarking between two experiments."""
    b_id = payload.get("baseline_experiment_id", "")
    c_id = payload.get("candidate_experiment_id", "")
    comp_type = payload.get("comparison_type", "MODEL_VS_MODEL")
    try:
        res = default_research_service.run_comparison(
            baseline_id=b_id,
            candidate_id=c_id,
            comparison_type=comp_type,
        )
        return res.model_dump()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@api_router.post("/research/reproducibility/check", tags=["Research Analytics"])
def post_check_reproducibility(payload: dict[str, Any]) -> Any:
    """Audit reproducibility by rerunning baseline experiment under identical parameters."""
    base_id = payload.get("baseline_experiment_id", "")
    try:
        audit = default_research_service.check_reproducibility(baseline_experiment_id=base_id)
        return audit.model_dump()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@api_router.post("/research/export", tags=["Research Analytics"])
def post_export_artifact(payload: dict[str, Any]) -> Any:
    """Generate and return a checksummed export artifact."""
    exp_id = payload.get("experiment_id", "")
    art_type = ArtifactType(payload.get("artifact_type", "MANIFEST_JSON"))
    try:
        art = default_research_service.export_artifact(experiment_id=exp_id, artifact_type=art_type)
        return art.model_dump()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@api_router.post("/research/scenarios/{scenario_id}", tags=["Research Analytics"])
def post_run_research_scenario(scenario_id: str) -> Any:
    """Run one of the 12 Golden Verification Scenarios (A through L)."""
    scenarios = ResearchGoldenScenarios(service=default_research_service)
    method_map = {
        "SCENARIO_A": scenarios.run_scenario_a_deterministic_replay_twice,
        "SCENARIO_B": scenarios.run_scenario_b_tampered_source,
        "SCENARIO_C": scenarios.run_scenario_c_changed_preprocessing_child_manifest,
        "SCENARIO_D": scenarios.run_scenario_d_model_comparison,
        "SCENARIO_E": scenarios.run_scenario_e_personalized_vs_generic_no_leakage,
        "SCENARIO_F": scenarios.run_scenario_f_channel_ablation,
        "SCENARIO_G": scenarios.run_scenario_g_robustness_sweep,
        "SCENARIO_H": scenarios.run_scenario_h_confidence_analysis,
        "SCENARIO_I": scenarios.run_scenario_i_safety_replay_non_transmission,
        "SCENARIO_J": scenarios.run_scenario_j_authorized_replay_hil_ack,
        "SCENARIO_K": scenarios.run_scenario_k_restart_reproducibility,
        "SCENARIO_L": scenarios.run_scenario_l_multiple_children_parent_unchanged,
    }

    handler = method_map.get(scenario_id.upper())
    if not handler:
        raise HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")
    return handler()


@api_router.post("/research/reset", tags=["Research Analytics"])
def post_reset_research_lab() -> Any:
    """Reset the research analytics laboratory state."""
    default_research_service.reset_lab()
    return {"status": "RESET_SUCCESSFUL"}


# ============================================================================
# Phase 23: Advanced Multimodal Sensors & Sensor Fusion Endpoints
# ============================================================================


@api_router.get("/sensors/devices", tags=["Multimodal Sensors"])
def get_sensor_devices(modality: str | None = Query(None)) -> Any:
    """List all discovered/registered multimodal sensor devices."""
    from neuromove.domain.enums import SensorModality
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    mod_enum = SensorModality(modality.upper()) if modality else None
    devices = service.list_devices(mod_enum)
    return [d.model_dump() for d in devices]


@api_router.get("/sensors/devices/{device_id}", tags=["Multimodal Sensors"])
def get_sensor_device(device_id: str) -> Any:
    """Get descriptor for a specific sensor device."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    desc = service.get_device(device_id)
    if not desc:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    return desc.model_dump()


@api_router.post("/sensors/devices/{device_id}/connect", tags=["Multimodal Sensors"])
def post_connect_sensor(device_id: str) -> Any:
    """Connect to a physical or simulated sensor device."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    success = service.connect_device(device_id)
    return {"device_id": device_id, "connected": success}


@api_router.post("/sensors/devices/{device_id}/disconnect", tags=["Multimodal Sensors"])
def post_disconnect_sensor(device_id: str) -> Any:
    """Disconnect a sensor device."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    success = service.disconnect_device(device_id)
    return {"device_id": device_id, "disconnected": success}


@api_router.post("/sensors/devices/{device_id}/configure", tags=["Multimodal Sensors"])
def post_configure_sensor(device_id: str, payload: dict[str, Any] = Body(...)) -> Any:
    """Configure sensor sampling rate and channel map."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    success = service.configure_device(
        device_id=device_id,
        sampling_rate=payload.get("sampling_rate"),
        channel_names=payload.get("channel_names"),
    )
    return {"device_id": device_id, "configured": success}


@api_router.post("/sensors/devices/{device_id}/calibrate", tags=["Multimodal Sensors"])
def post_calibrate_sensor(device_id: str) -> Any:
    """Execute baseline calibration for a sensor device."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    snapshot = service.calibrate_device(device_id)
    return snapshot.model_dump()


@api_router.get("/sensors/health", tags=["Multimodal Sensors"])
def get_sensors_health() -> Any:
    """Get real-time quality and health snapshots for active sensors."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    healths = service.get_health_snapshot()
    return {k: v.model_dump() for k, v in healths.items()}


@api_router.get("/sensors/sync", tags=["Multimodal Sensors"])
def get_sensors_sync_state() -> Any:
    """Get current multimodal synchronization and alignment state."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    state = service.sync_coordinator.get_sync_state()
    return state.model_dump()


@api_router.post("/sensors/session/start", tags=["Multimodal Sensors"])
def post_start_sensor_session(payload: dict[str, Any] = Body(...)) -> Any:
    """Start synchronized multimodal recording / streaming session."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    session_id = payload.get("session_id", f"session_{int(datetime.now(UTC).timestamp())}")
    sensor_ids = payload.get("sensor_ids")
    session = service.start_session(session_id, sensor_ids)
    return session.model_dump()


@api_router.post("/sensors/session/stop", tags=["Multimodal Sensors"])
def post_stop_sensor_session() -> Any:
    """Stop active multimodal session."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    service.stop_session()
    return {"status": "STOPPED"}


@api_router.get("/sensors/frame", tags=["Multimodal Sensors"])
def get_multimodal_frame(
    chunk_size: int = 10,
    candidate_intent: str = "FORWARD",
    eeg_confidence: float = 0.90,
) -> Any:
    """Acquire one synchronized multimodal frame with QC, contradiction, and fusion context."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    packets, context, fusion, sync = service.read_multimodal_frame(
        chunk_size=chunk_size,
        candidate_intent=candidate_intent,
        eeg_confidence=eeg_confidence,
    )
    return {
        "packets": {k: v.model_dump() for k, v in packets.items()},
        "context": context.model_dump(),
        "fusion": fusion.model_dump(),
        "sync": sync.model_dump(),
    }


@api_router.post("/sensors/inference", tags=["Multimodal Sensors"])
def post_process_inference_frame(payload: dict[str, Any] = Body(...)) -> Any:
    """Run full canonical pipeline (Acquisition -> Sync -> QC -> Fusion -> Context -> Intent -> Safety -> HIL)."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    return service.process_inference_frame(
        candidate_intent=payload.get("candidate_intent", "FORWARD"),
        eeg_confidence=float(payload.get("eeg_confidence", 0.90)),
    )


@api_router.post("/sensors/fault/inject", tags=["Multimodal Sensors"])
def post_inject_sensor_fault(payload: dict[str, Any] = Body(...)) -> Any:
    """Inject simulated anomaly or fault into target sensor."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    sensor_id = payload.get("sensor_id", "sensor_imu_sim")
    fault_type = payload.get("fault_type", "MOTION_BURST")
    success = service.inject_fault(sensor_id, fault_type)
    return {"sensor_id": sensor_id, "fault_type": fault_type, "injected": success}


@api_router.post("/sensors/fault/clear", tags=["Multimodal Sensors"])
def post_clear_sensor_faults(payload: dict[str, Any] = Body(default={})) -> Any:
    """Clear active faults on sensors."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    service.clear_faults(payload.get("sensor_id"))
    return {"status": "FAULTS_CLEARED"}


@api_router.get("/sensors/analytics", tags=["Multimodal Sensors"])
def get_sensors_analytics() -> Any:
    """Get multimodal analytics summary metrics."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    return service.get_analytics_summary().model_dump()


@api_router.get("/sensors/scenarios", tags=["Multimodal Sensors"])
def get_sensor_scenarios() -> Any:
    """List all 12 Phase 23 Golden Scenarios."""
    return [
        {"id": "SCENARIO_A", "name": "EEG + IMU Healthy Synchronized Baseline"},
        {"id": "SCENARIO_B", "name": "EEG Only Standalone Operation"},
        {"id": "SCENARIO_C", "name": "IMU Disconnection Handling"},
        {"id": "SCENARIO_D", "name": "Timestamp Drift & Desynchronization"},
        {"id": "SCENARIO_E", "name": "Contradictory Movement Context Hold"},
        {"id": "SCENARIO_F", "name": "Channel Dropout Quality Fault"},
        {"id": "SCENARIO_G", "name": "EMG Peripheral Activation Context"},
        {"id": "SCENARIO_H", "name": "EOG Ocular Artifact Indicator"},
        {"id": "SCENARIO_I", "name": "Deterministic Multimodal Fixture Replay"},
        {"id": "SCENARIO_J", "name": "Multimodal Fault Recovery & Recalibration"},
        {"id": "SCENARIO_K", "name": "Authorized End-to-End HIL Dispatch (Non-Actuation Enforced)"},
        {"id": "SCENARIO_L", "name": "Unsafe Multimodal State (Zero Transmission)"},
    ]


@api_router.post("/sensors/scenarios/{scenario_id}/run", tags=["Multimodal Sensors"])
def post_run_sensor_scenario(scenario_id: str) -> Any:
    """Run a specific Phase 23 Golden Scenario."""
    from neuromove.multimodal_sensors.scenarios import MultimodalGoldenScenarios

    scenarios = MultimodalGoldenScenarios()
    res = scenarios.run_scenario(scenario_id)
    if not res.get("passed") and "Unknown scenario" in res.get("error", ""):
        raise HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")
    return res


@api_router.post("/sensors/reset", tags=["Multimodal Sensors"])
def post_reset_multimodal_service() -> Any:
    """Reset multimodal service to clean baseline."""
    from neuromove.multimodal_sensors.service import MultimodalSensorService

    service = MultimodalSensorService.get_instance()
    service.reset_service()
    return {"status": "RESET_SUCCESSFUL"}


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


@ws_router.websocket("/resilience")
async def ws_resilience_endpoint(websocket: WebSocket) -> None:
    """Real-time resilience laboratory and fault lifecycle socket."""
    await ws_manager.connect_resilience(websocket)


@ws_router.websocket("/transport")
async def ws_transport_endpoint(websocket: WebSocket) -> None:
    """Real-time command transport and protocol telemetry socket."""
    await ws_manager.connect_transport(websocket)


@ws_router.websocket("/hardware")
async def ws_hardware_endpoint(websocket: WebSocket) -> None:
    """Real-time Hardware-in-the-Loop and ESP32 telemetry socket."""
    await ws_manager.connect_hardware(websocket)


@ws_router.websocket("/eeg/acquisition")
async def ws_eeg_acquisition_endpoint(websocket: WebSocket) -> None:
    """Real-time Real EEG / BioAmp Acquisition stream socket."""
    await ws_manager.connect_eeg_acquisition(websocket)


@ws_router.websocket("/research")
async def ws_research_endpoint(websocket: WebSocket) -> None:
    """Real-time Research Replay & Analytics telemetry stream socket."""
    await ws_manager.connect_research(websocket)


@ws_router.websocket("/sensors")
async def ws_sensors_endpoint(websocket: WebSocket) -> None:
    """Real-time Multimodal Sensors & Fusion telemetry stream socket."""
    await ws_manager.connect_sensors(websocket)


@ws_router.websocket("/product")
async def ws_product_endpoint(websocket: WebSocket) -> None:
    """Real-time Product Level Aggregation stream socket."""
    await ws_manager.connect_product(websocket)


@ws_router.websocket("/stream")
async def ws_multiplexed_endpoint(websocket: WebSocket) -> None:
    """Multiplexed real-time WebSocket carrying all subscribed channels."""
    await ws_manager.connect_all(websocket)


# ============================================================================
# Phase 24.1: Final Competition Product Foundation & Demo Orchestration
# ============================================================================

from ..product.service import default_product_service


@api_router.get("/product/status", tags=["Product Platform"])
def get_product_system_status() -> dict[str, Any]:
    """Return unified aggregated system status across all subsystems."""
    return default_product_service.get_system_status().model_dump()


@api_router.get("/product/session", tags=["Product Platform"])
def get_product_session() -> dict[str, Any]:
    """Retrieve current unified product session metadata."""
    return default_product_service.get_session().model_dump()


@api_router.post("/product/session/reset", tags=["Product Platform"])
def post_reset_product_session() -> dict[str, Any]:
    """Clean reset of product session state and demo orchestrator."""
    return default_product_service.reset_session().model_dump()


@api_router.get("/product/demo/scenarios", tags=["Product Platform"])
def get_product_demo_scenarios() -> list[dict[str, Any]]:
    """List 6 Golden Demonstration Scenarios."""
    return [sc.model_dump() for sc in default_product_service.list_demo_scenarios()]


@api_router.post("/product/demo/start", tags=["Product Platform"])
def post_start_demo_scenario(payload: dict[str, Any]) -> dict[str, Any]:
    """Initialize a guided demonstration run."""
    scenario_id = payload.get("scenario_id", "PRODUCT_A")
    return default_product_service.start_demo_scenario(scenario_id).model_dump()


@api_router.post("/product/demo/step", tags=["Product Platform"])
def post_advance_demo_step(payload: dict[str, Any]) -> dict[str, Any]:
    """Advance a single step in the active demonstration run."""
    run_id = payload.get("run_id")
    if not run_id:
        active = default_product_service.get_active_demo_run()
        if not active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active demonstration run found.",
            )
    try:
        return default_product_service.advance_demo_step(run_id).model_dump()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@api_router.post("/product/demo/run", tags=["Product Platform"])
def post_execute_demo_scenario(payload: dict[str, Any]) -> dict[str, Any]:
    """Execute full 9-step scenario and return sealed result."""
    scenario_id = payload.get("scenario_id", "PRODUCT_A")
    return default_product_service.execute_demo_scenario(scenario_id).model_dump()


@api_router.get("/product/demo/active", tags=["Product Platform"])
def get_active_demo_run() -> dict[str, Any] | None:
    """Get active demonstration run if any."""
    active = default_product_service.get_active_demo_run()
    return active.model_dump() if active else None


@api_router.get("/product/demo/result/{run_id}", tags=["Product Platform"])
def get_demo_result(run_id: str) -> dict[str, Any]:
    """Retrieve sealed demonstration result by run ID."""
    res = default_product_service.get_demo_result(run_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Demo result for run {run_id} not found.",
        )
    return res.model_dump()


@api_router.post("/product/demo/reset", tags=["Product Platform"])
def post_reset_demo() -> dict[str, str]:
    """Reset active demo run state."""
    default_product_service.reset_demo()
    return {"status": "RESET"}


