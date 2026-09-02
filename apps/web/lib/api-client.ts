import {
  SystemStatus,
  SystemStatusSchema,
  SafetyState,
  SafetyStateSchema,
  RobotState,
  RobotStateSchema,
  EmergencyStopResponse,
  EmergencyStopResponseSchema,
  SimulationStatus,
  SimulationStatusSchema,
  SimulationScenario,
  SimulationScenarioSchema,
  PSDRequest,
  PSDResponse,
  PSDResponseSchema,
  BandPowerRequest,
  BandPowerResponse,
  BandPowerResponseSchema,
  TFRRequest,
  TFRResponse,
  TFRResponseSchema,
  EEGChannelSummary,
  EEGChannelSummarySchema,
  DatasetDefinition,
  DatasetDefinitionSchema,
  DatasetSubject,
  DatasetSubjectSchema,
  DatasetRecording,
  DatasetRecordingSchema,
  DatasetManifest,
  DatasetManifestSchema,
  IngestionQualityReport,
  IngestionQualityReportSchema,
  DatasetSignalResponse,
  DatasetSignalResponseSchema,
  PreprocessingConfig,
  PreprocessingConfigSchema,
  PreprocessingRequest,
  PreprocessingPreview,
  PreprocessingPreviewSchema,
  PreprocessingResult,
  PreprocessingResultSchema,
  PreprocessingManifest,
  PreprocessingManifestSchema,
  PreprocessingSignalResponse,
  PreprocessingSignalResponseSchema,
  NormalizedEvent,
  NormalizedEventSchema,
  EpochingRequest,
  EpochingPreview,
  EpochingPreviewSchema,
  EpochSummary,
  EpochSummarySchema,
  EpochRecord,
  EpochRecordSchema,
  EpochSignalResponse,
  EpochSignalResponseSchema,
  EpochManifest,
  EpochManifestSchema,
  FeatureExtractionRequest,
  FeaturePreview,
  FeaturePreviewSchema,
  FeatureSet,
  FeatureSetSchema,
  CovarianceSet,
  CovarianceSetSchema,
  FeatureManifest,
  FeatureManifestSchema,
  ClassificationTask,
  ClassificationTaskSchema,
  DecoderPipelineConfig,
  BenchmarkPreview,
  BenchmarkPreviewSchema,
  ModelManifest,
  ModelManifestSchema,
  ModelSummary,
  ModelSummarySchema,
  DecoderRun,
  DecoderRunSchema,
  PredictionRequest,
  PredictionResponse,
  PredictionResponseSchema,
  ExperimentConfig,
  ExperimentSummary,
  ExperimentSummarySchema,
  ExperimentPreview,
  ExperimentPreviewSchema,
  ExperimentDetail,
  ExperimentDetailSchema,
  OutOfFoldPredictionSet,
  OutOfFoldPredictionSetSchema,
  ErrorAnalysisResult,
  ErrorAnalysisResultSchema,
  AblationStudyResult,
  AblationStudyResultSchema,
  ModelComparisonResult,
  ModelComparisonResultSchema,

  ModelCard,
  ModelCardSchema,

  SubjectProfile,
  SubjectProfileSchema,
  CreateSubjectProfileRequest,
  CalibrationProtocol,
  CalibrationProtocolSchema,
  CalibrationSession,
  CalibrationSessionSchema,
  CalibrationTrial,

  CalibrationTrialSchema,
  CalibrationReport,
  CalibrationReportSchema,
  PersonalizationConfig,
  PersonalizedExperimentResult,
  PersonalizedExperimentResultSchema,
  PersonalizedModel,
  PersonalizedModelSchema,
  CalibrationHistoryItem,
  CalibrationHistoryItemSchema,
  AdaptationPolicy,
  AdaptationPolicySchema,
  CreateAdaptationPolicyRequest,
  AdaptationDataBatch,
  AdaptationDataBatchSchema,
  ModelVersion,
  ModelVersionSchema,
  AdaptationPreviewRequest,
  AdaptationPreview,
  AdaptationPreviewSchema,
  StartAdaptationRunRequest,
  AdaptationRun,
  AdaptationRunSchema,
  PromotionDecision,
  PromotionDecisionSchema,
  RollbackEvent,
  RollbackEventSchema,
  DriftObservation,
  DriftObservationSchema,
  AdaptationManifest,
  AdaptationManifestSchema,

  ConfidenceConfig,
  ConfidenceConfigSchema,
  ConfidenceCalibrationProfile,
  ConfidenceCalibrationProfileSchema,
  CalibrationMetrics,
  CalibrationMetricsSchema,
  ConfidenceInput,
  ConfidenceDecision,
  ConfidenceDecisionSchema,
  TemporalConfirmationState,
  TemporalConfirmationStateSchema,
  TemporalConfirmationDecision,
  TemporalConfirmationDecisionSchema,
  Phase16IntentHandoffPayload,
  Phase16IntentHandoffPayloadSchema,
  ConfidenceHistoryRecord,

  ConfidenceHistoryRecordSchema,
  TemporalConfirmationEvent,
  TemporalConfirmationEventSchema,

  IntentPolicy,
  IntentPolicySchema,
  IntentRecord,
  IntentRecordSchema,

  IntentStateTransition,
  IntentStateTransitionSchema,
  IntentStateSnapshot,
  IntentStateSnapshotSchema,
  IntentIngestRequest,
  IntentCancelRequest,
  IntentCompleteRequest,
  IntentResetRequest,
  IntentScenarioResponse,
  IntentScenarioResponseSchema,
} from "@neuromove/contracts";









import { z } from "zod";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function fetchSystemStatus(): Promise<SystemStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/system/status`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    return SystemStatusSchema.parse(data);
  } catch {
    return {
      service: "neuromove-core",
      status: "offline",
      version: "0.1.0",
      mode: "SIMULATION",
      timestamp: new Date().toISOString(),
      components: {
        api: "unavailable",
        database: "not_initialized",
        eeg: "not_connected",
        robot: "not_connected",
        safety: "ready",
      },
    };
  }
}

export async function fetchSafetyState(): Promise<SafetyState> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/safety/state`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return SafetyStateSchema.parse(data);
  } catch {
    return {
      runtime_state: "IDLE",
      last_decision: "STOP",
      risk_level: "SAFE",
      emergency_active: false,
      fault_code: null,
      reason_code: "SYS_IDLE",
      reason: "Safe local fallback default.",
      updated_at: new Date().toISOString(),
    };
  }
}

export async function fetchRobotState(): Promise<RobotState> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/robot/state`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return RobotStateSchema.parse(data);
  } catch {
    return {
      connection_state: "DISCONNECTED",
      motion_state: "STOPPED",
      heading_deg: 0,
      battery_pct: 0,
      left_motor_pwm: 0,
      right_motor_pwm: 0,
      linear_velocity_mps: 0,
      angular_velocity_radps: 0,
      emergency_stop_triggered: false,
      last_heartbeat: null,
      mode: "SIMULATION",
    };
  }
}

export async function triggerEmergencyStop(): Promise<EmergencyStopResponse> {
  const res = await fetch(`${API_BASE_URL}/api/emergency/stop`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return EmergencyStopResponseSchema.parse(data);
}

// --- Simulation Engine API Operations (Phase 03) ---

export async function fetchSimulationStatus(): Promise<SimulationStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/simulation/status`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return SimulationStatusSchema.parse(data);
  } catch {
    return {
      is_running: false,
      is_paused: false,
      mode: "SIMULATION",
      scenario_id: "right-turn",
      scenario_name: "2. Right Turn Motor Imagery",
      seed: 42,
      speed: 1.0,
      elapsed_seconds: 0,
      total_duration_seconds: 10,
      current_intent: "NONE",
      current_cue: "REST",
      runtime_state: "IDLE",
      safety_decision: "STOP",
      active_faults: [],
    };
  }
}

export async function fetchSimulationScenarios(): Promise<SimulationScenario[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/simulation/scenarios`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return z.array(SimulationScenarioSchema).parse(data);
  } catch {
    return [
      {
        scenario_id: "idle",
        name: "1. Baseline Idle & Rest",
        description: "Continuous baseline resting state with zero obstacles.",
        seed: 42,
        duration_seconds: 8,
        trials_count: 1,
        expected_behavior: "Safe IDLE state.",
        steps: [],
      },
      {
        scenario_id: "right-turn",
        name: "2. Right Turn Motor Imagery",
        description: "Standard Graz trial: Fixation -> Right Cue -> High confidence RIGHT.",
        seed: 42,
        duration_seconds: 10,
        trials_count: 1,
        expected_behavior: "Confirmed RIGHT intent.",
        steps: [],
      },
    ];
  }
}

export async function startSimulation(
  scenario_id: string,
  seed?: number,
  speed?: number
): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario_id, seed, speed }),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}

export async function pauseSimulation(): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/pause`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}

export async function resumeSimulation(): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/resume`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}

export async function setSimulationSpeed(speed: number): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/speed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ speed }),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}

export async function stopSimulation(): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/stop`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}

export async function resetSimulation(): Promise<SimulationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/simulation/reset`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return SimulationStatusSchema.parse(data);
}

// --- EEG Laboratory API Functions (Phase 07) ---

export async function fetchPSD(request: PSDRequest): Promise<PSDResponse> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/psd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return PSDResponseSchema.parse(data);
}

export async function fetchBandPower(
  request: BandPowerRequest
): Promise<BandPowerResponse> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/band-power`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return BandPowerResponseSchema.parse(data);
}

export async function fetchTFR(request: TFRRequest): Promise<TFRResponse> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/tfr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return TFRResponseSchema.parse(data);
}

export async function fetchEEGChannels(): Promise<EEGChannelSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/channels`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(EEGChannelSummarySchema).parse(data);
}

export function getExportPsdUrl(): string {
  return `${API_BASE_URL}/api/eeg/export/psd`;
}

export function getExportBandPowerUrl(): string {
  return `${API_BASE_URL}/api/eeg/export/band-power`;
}

export function getExportAnalysisUrl(sessionId?: string): string {
  const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  return `${API_BASE_URL}/api/eeg/export/analysis${query}`;
}

// --- Public EEG Dataset Endpoints ---

export async function fetchDatasets(): Promise<DatasetDefinition[]> {
  const res = await fetch(`${API_BASE_URL}/api/datasets`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(DatasetDefinitionSchema).parse(data);
}

export async function fetchDatasetDetails(
  datasetId: string
): Promise<DatasetDefinition> {
  const res = await fetch(`${API_BASE_URL}/api/datasets/${datasetId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return DatasetDefinitionSchema.parse(data);
}

export async function fetchDatasetSubjects(
  datasetId: string
): Promise<DatasetSubject[]> {
  const res = await fetch(`${API_BASE_URL}/api/datasets/${datasetId}/subjects`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(DatasetSubjectSchema).parse(data);
}

export async function fetchDatasetRecordings(
  datasetId: string,
  subjectId?: string,
  task?: string
): Promise<DatasetRecording[]> {
  const params = new URLSearchParams();
  if (subjectId) params.append("subject_id", subjectId);
  if (task) params.append("task", task);
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(
    `${API_BASE_URL}/api/datasets/${datasetId}/recordings${query}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(DatasetRecordingSchema).parse(data);
}

export async function fetchDatasetRecording(
  datasetId: string,
  recordingId: string
): Promise<DatasetRecording> {
  const res = await fetch(
    `${API_BASE_URL}/api/datasets/${datasetId}/recordings/${recordingId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return DatasetRecordingSchema.parse(data);
}

export async function fetchDatasetSignal(
  datasetId: string,
  recordingId: string,
  channels?: string[],
  startSec?: number,
  durationSec?: number
): Promise<DatasetSignalResponse> {
  const params = new URLSearchParams();
  if (channels && channels.length > 0) params.append("channels", channels.join(","));
  if (startSec !== undefined) params.append("start_sec", startSec.toString());
  if (durationSec !== undefined) params.append("duration_sec", durationSec.toString());
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(
    `${API_BASE_URL}/api/datasets/${datasetId}/recordings/${recordingId}/signal${query}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return DatasetSignalResponseSchema.parse(data);
}

export async function downloadDatasetRun(
  datasetId: string,
  subjectId: string,
  runId: string
): Promise<DatasetRecording[]> {
  const res = await fetch(`${API_BASE_URL}/api/datasets/${datasetId}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject_ids: [subjectId],
      run_ids: [runId],
    }),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(DatasetRecordingSchema).parse(data);
}

export async function verifyDataset(datasetId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/datasets/${datasetId}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId }),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function fetchDatasetManifest(
  datasetId: string
): Promise<DatasetManifest> {
  const res = await fetch(`${API_BASE_URL}/api/datasets/${datasetId}/manifest`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return DatasetManifestSchema.parse(data);
}

export async function fetchDatasetQualityReport(
  datasetId: string
): Promise<IngestionQualityReport> {
  const res = await fetch(
    `${API_BASE_URL}/api/datasets/${datasetId}/quality-report`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return IngestionQualityReportSchema.parse(data);
}

// --- Preprocessing & DSP API Operations (Phase 09) ---

export async function fetchDefaultPreprocessingConfig(): Promise<PreprocessingConfig> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/eeg/preprocessing/config/default`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return PreprocessingConfigSchema.parse(data);
  } catch {
    return {
      pipeline_version: "EEG_PREPROCESSING_V1",
      reference_type: "average",
      reference_channels: [],
      highpass_hz: 0.5,
      lowpass_hz: 40.0,
      notch: { enabled: false, frequencies_hz: [50.0], notch_width_hz: 2.0 },
      resample: { enabled: false, target_hz: null, anti_aliasing: true },
      bad_channels: [],
      artifact_method: "NONE",
      ica_config: {
        enabled: false,
        n_components: 15,
        method: "fastica",
        random_state: 42,
        fit_channels: [],
        excluded_components: [],
      },
    };
  }
}

export async function previewPreprocessingPipeline(
  request: PreprocessingRequest
): Promise<PreprocessingPreview> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/preprocessing/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return PreprocessingPreviewSchema.parse(data);
}

export async function runPreprocessingPipeline(
  request: PreprocessingRequest
): Promise<PreprocessingResult> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/preprocessing/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return PreprocessingResultSchema.parse(data);
}

export async function fetchPreprocessingResults(
  limit: number = 20
): Promise<PreprocessingResult[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/eeg/preprocessing/results?limit=${limit}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return z.array(PreprocessingResultSchema).parse(data);
  } catch {
    return [];
  }
}

export async function fetchPreprocessingResult(
  resultId: string
): Promise<PreprocessingResult> {
  const res = await fetch(
    `${API_BASE_URL}/api/eeg/preprocessing/results/${resultId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return PreprocessingResultSchema.parse(data);
}

export async function fetchPreprocessingSignal(
  resultId: string,
  channels?: string[],
  startSec?: number,
  durationSec?: number
): Promise<PreprocessingSignalResponse> {
  const params = new URLSearchParams();
  if (channels && channels.length > 0) params.append("channels", channels.join(","));
  if (startSec !== undefined) params.append("start_sec", startSec.toString());
  if (durationSec !== undefined) params.append("duration_sec", durationSec.toString());
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(
    `${API_BASE_URL}/api/eeg/preprocessing/results/${resultId}/signal${query}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return PreprocessingSignalResponseSchema.parse(data);
}

export async function fetchPreprocessingManifest(
  resultId: string
): Promise<PreprocessingManifest> {
  const res = await fetch(
    `${API_BASE_URL}/api/eeg/preprocessing/results/${resultId}/manifest`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return PreprocessingManifestSchema.parse(data);
}

export async function fitICA(
  request: PreprocessingRequest,
  nComponents: number = 15,
  randomState: number = 42
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/preprocessing/ica/fit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      n_components: nComponents,
      random_state: randomState,
    }),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

// --- Motor-Imagery Epoching & Feature API Functions (Phase 10) ---

export async function normalizeEvents(
  request: EpochingRequest
): Promise<NormalizedEvent[]> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/events/normalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(NormalizedEventSchema).parse(data);
}

export async function previewEpoching(
  request: EpochingRequest
): Promise<EpochingPreview> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/epochs/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return EpochingPreviewSchema.parse(data);
}

export async function runEpoching(
  request: EpochingRequest
): Promise<EpochSummary> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/epochs/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return EpochSummarySchema.parse(data);
}

export async function listEpochSets(limit: number = 50): Promise<EpochSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/epochs?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(EpochSummarySchema).parse(data);
}

export const fetchEpochSets = listEpochSets;


export async function fetchEpochSummary(
  epochSetId: string
): Promise<EpochSummary> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/epochs/${epochSetId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return EpochSummarySchema.parse(data);
}

export async function fetchEpochRecords(
  epochSetId: string,
  limit: number = 100
): Promise<EpochRecord[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/eeg/epochs/${epochSetId}/records?limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(EpochRecordSchema).parse(data);
}

export async function fetchEpochSignal(
  epochSetId: string,
  epochId: string
): Promise<EpochSignalResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/eeg/epochs/${epochSetId}/records/${epochId}/signal`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return EpochSignalResponseSchema.parse(data);
}

export async function fetchEpochManifest(
  epochSetId: string
): Promise<EpochManifest> {
  const res = await fetch(
    `${API_BASE_URL}/api/eeg/epochs/${epochSetId}/manifest`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return EpochManifestSchema.parse(data);
}

export async function previewFeatures(
  request: FeatureExtractionRequest
): Promise<FeaturePreview> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/features/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return FeaturePreviewSchema.parse(data);
}

export async function extractFeatures(
  request: FeatureExtractionRequest
): Promise<FeatureSet> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/features/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return FeatureSetSchema.parse(data);
}

export async function listFeatureSets(
  limit: number = 50
): Promise<FeatureSet[]> {
  const res = await fetch(`${API_BASE_URL}/api/eeg/features?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(FeatureSetSchema).parse(data);
}

export async function fetchFeatureSet(
  featureSetId: string
): Promise<FeatureSet> {
  const res = await fetch(
    `${API_BASE_URL}/api/eeg/features/${featureSetId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return FeatureSetSchema.parse(data);
}

export async function fetchFeatureData(
  featureSetId: string,
  limit: number = 100
): Promise<Record<string, any>[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/eeg/features/${featureSetId}/data?limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function fetchCovarianceSet(
  featureSetId: string
): Promise<CovarianceSet> {
  const res = await fetch(
    `${API_BASE_URL}/api/eeg/features/${featureSetId}/covariance`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return CovarianceSetSchema.parse(data);
}

export async function fetchFeatureManifest(
  featureSetId: string
): Promise<FeatureManifest> {
  const res = await fetch(
    `${API_BASE_URL}/api/eeg/features/${featureSetId}/manifest`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return FeatureManifestSchema.parse(data);
}

// --- Classical Decoding & Model Endpoints (Phase 11) ---

export async function fetchClassificationTasks(): Promise<ClassificationTask[]> {
  const res = await fetch(`${API_BASE_URL}/api/models/classical/tasks`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(ClassificationTaskSchema).parse(data);
}

export async function previewDecoderBenchmark(
  config: DecoderPipelineConfig
): Promise<BenchmarkPreview> {
  const res = await fetch(`${API_BASE_URL}/api/models/classical/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return BenchmarkPreviewSchema.parse(data);
}

export async function runDecoderBenchmark(
  config: DecoderPipelineConfig
): Promise<ModelManifest> {
  const res = await fetch(`${API_BASE_URL}/api/models/classical/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
    cache: "no-store",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return ModelManifestSchema.parse(data);
}

export async function fetchDecoderRuns(
  limit: number = 50
): Promise<DecoderRun[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/models/classical/runs?limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(DecoderRunSchema).parse(data);
}

export async function fetchDecoderModels(
  limit: number = 50,
  taskId?: string
): Promise<ModelSummary[]> {
  const url = new URL(`${API_BASE_URL}/api/models/classical/models`);
  url.searchParams.set("limit", limit.toString());
  if (taskId) url.searchParams.set("task_id", taskId);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(ModelSummarySchema).parse(data);
}

export async function fetchDecoderModelManifest(
  modelId: string
): Promise<ModelManifest> {
  const res = await fetch(
    `${API_BASE_URL}/api/models/classical/models/${modelId}/manifest`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return ModelManifestSchema.parse(data);
}

export async function predictDecoderEpoch(
  req: PredictionRequest
): Promise<PredictionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/models/classical/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    cache: "no-store",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return PredictionResponseSchema.parse(data);
}

// --- Phase 12: AI Model Laboratory API Functions ---

export async function fetchAiExperiments(): Promise<ExperimentSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/ai/experiments`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(ExperimentSummarySchema).parse(data);
}

export async function previewAiExperiment(
  config: ExperimentConfig
): Promise<ExperimentPreview> {
  const res = await fetch(`${API_BASE_URL}/api/ai/experiments/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return ExperimentPreviewSchema.parse(data);
}

export async function runAiExperiment(
  config: ExperimentConfig
): Promise<ExperimentDetail> {
  const res = await fetch(`${API_BASE_URL}/api/ai/experiments/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return ExperimentDetailSchema.parse(data);
}

export async function fetchAiExperimentDetail(
  experimentId: string
): Promise<ExperimentDetail> {
  const res = await fetch(
    `${API_BASE_URL}/api/ai/experiments/${experimentId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return ExperimentDetailSchema.parse(data);
}

export async function fetchAiExperimentPredictions(
  experimentId: string
): Promise<OutOfFoldPredictionSet> {
  const res = await fetch(
    `${API_BASE_URL}/api/ai/experiments/${experimentId}/predictions`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return OutOfFoldPredictionSetSchema.parse(data);
}

export async function fetchAiExperimentErrors(
  experimentId: string
): Promise<ErrorAnalysisResult> {
  const res = await fetch(
    `${API_BASE_URL}/api/ai/experiments/${experimentId}/errors`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return ErrorAnalysisResultSchema.parse(data);
}

export async function runAiAblationStudy(payload: {
  baseline_experiment_config: ExperimentConfig;
  ablation_variable: string;
}): Promise<AblationStudyResult> {
  const res = await fetch(`${API_BASE_URL}/api/ai/ablations/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return AblationStudyResultSchema.parse(data);
}

export async function compareAiModels(payload: {
  comparison_name: string;
  experiment_ids: string[];
}): Promise<ModelComparisonResult> {
  const res = await fetch(`${API_BASE_URL}/api/ai/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return ModelComparisonResultSchema.parse(data);
}

export async function fetchAiModelCard(modelId: string): Promise<ModelCard> {
  const res = await fetch(`${API_BASE_URL}/api/ai/models/${modelId}/card`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return ModelCardSchema.parse(data);
}

export async function batchPredictAiModel(payload: {
  model_id: string;
  epoch_set_id: string;
}): Promise<{
  model_id: string;
  epoch_set_id: string;
  total_epochs: number;
  predictions: number[];
  probabilities?: number[][];
  timestamp: string;
}> {
  const res = await fetch(`${API_BASE_URL}/api/ai/batch-predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  return res.json();
}

// --- Phase 13: Personalized Motor-Imagery Calibration & Adaptation ---

export async function fetchSubjectProfiles(): Promise<SubjectProfile[]> {
  const res = await fetch(`${API_BASE_URL}/api/calibration/profiles`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(SubjectProfileSchema).parse(data);
}

export async function createSubjectProfile(
  payload: CreateSubjectProfileRequest
): Promise<SubjectProfile> {
  const res = await fetch(`${API_BASE_URL}/api/calibration/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return SubjectProfileSchema.parse(data);
}

export async function fetchCalibrationProtocols(): Promise<CalibrationProtocol[]> {
  const res = await fetch(`${API_BASE_URL}/api/calibration/protocols`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(CalibrationProtocolSchema).parse(data);
}

export async function startCalibrationSession(payload: {
  profile_id: string;
  subject_id: string;
  protocol?: CalibrationProtocol;
  source_mode?: string;
}): Promise<{ session: CalibrationSession; trials: CalibrationTrial[] }> {
  const res = await fetch(`${API_BASE_URL}/api/calibration/sessions/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return {
    session: CalibrationSessionSchema.parse(data.session),
    trials: z.array(CalibrationTrialSchema).parse(data.trials),
  };
}

export async function fetchCalibrationSession(
  calibrationId: string
): Promise<CalibrationSession> {
  const res = await fetch(
    `${API_BASE_URL}/api/calibration/sessions/${calibrationId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return CalibrationSessionSchema.parse(data);
}

export async function pauseCalibrationSession(
  calibrationId: string,
  reason?: string
): Promise<CalibrationSession> {
  const res = await fetch(
    `${API_BASE_URL}/api/calibration/sessions/${calibrationId}/pause`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return CalibrationSessionSchema.parse(data);
}

export async function resumeCalibrationSession(
  calibrationId: string
): Promise<CalibrationSession> {
  const res = await fetch(
    `${API_BASE_URL}/api/calibration/sessions/${calibrationId}/resume`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return CalibrationSessionSchema.parse(data);
}

export async function abortCalibrationSession(
  calibrationId: string,
  reason?: string
): Promise<CalibrationSession> {
  const res = await fetch(
    `${API_BASE_URL}/api/calibration/sessions/${calibrationId}/abort`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return CalibrationSessionSchema.parse(data);
}

export async function advanceSimulationTrial(
  calibrationId: string
): Promise<CalibrationSession> {
  const res = await fetch(
    `${API_BASE_URL}/api/calibration/sessions/${calibrationId}/advance-simulation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return CalibrationSessionSchema.parse(data);
}

export async function fetchCalibrationTrials(
  calibrationId: string
): Promise<CalibrationTrial[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/calibration/sessions/${calibrationId}/trials`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(CalibrationTrialSchema).parse(data);
}

export async function fetchCalibrationReport(
  calibrationId: string
): Promise<CalibrationReport> {
  const res = await fetch(
    `${API_BASE_URL}/api/calibration/sessions/${calibrationId}/report`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return CalibrationReportSchema.parse(data);
}

export async function runPersonalization(
  payload: PersonalizationConfig
): Promise<PersonalizedExperimentResult> {
  const res = await fetch(`${API_BASE_URL}/api/calibration/personalize/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return PersonalizedExperimentResultSchema.parse(data);
}

export async function fetchPersonalizedModel(
  modelId: string
): Promise<PersonalizedModel> {
  const res = await fetch(
    `${API_BASE_URL}/api/calibration/personalize/models/${modelId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return PersonalizedModelSchema.parse(data);
}

export async function fetchSubjectCalibrationHistory(
  subjectId: string
): Promise<CalibrationHistoryItem[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/calibration/history/${subjectId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(CalibrationHistoryItemSchema).parse(data);
}

// --- Phase 14: Adaptive Learning & Controlled Model Update Endpoints ---

export async function fetchAdaptationPolicies(): Promise<AdaptationPolicy[]> {
  const res = await fetch(`${API_BASE_URL}/api/adaptation/policies`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(AdaptationPolicySchema).parse(data);
}

export async function createAdaptationPolicy(
  payload: CreateAdaptationPolicyRequest
): Promise<AdaptationPolicy> {
  const res = await fetch(`${API_BASE_URL}/api/adaptation/policies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return AdaptationPolicySchema.parse(data);
}

export async function fetchAdaptationBatches(
  subjectId?: string
): Promise<AdaptationDataBatch[]> {
  const query = subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/adaptation/batches${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(AdaptationDataBatchSchema).parse(data);
}

export async function createAdaptationBatch(payload: {
  name: string;
  subject_id?: string;
  trial_count?: number;
  source_mode?: string;
}): Promise<AdaptationDataBatch> {
  const res = await fetch(`${API_BASE_URL}/api/adaptation/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return AdaptationDataBatchSchema.parse(data);
}

export async function fetchAdaptationPreview(
  payload: AdaptationPreviewRequest
): Promise<AdaptationPreview> {
  const res = await fetch(`${API_BASE_URL}/api/adaptation/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return AdaptationPreviewSchema.parse(data);
}

export async function runAdaptationExperiment(
  payload: StartAdaptationRunRequest
): Promise<AdaptationRun> {
  const res = await fetch(`${API_BASE_URL}/api/adaptation/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return AdaptationRunSchema.parse(data);
}

export async function fetchAdaptationRuns(
  subjectId?: string
): Promise<AdaptationRun[]> {
  const query = subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/adaptation/runs${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(AdaptationRunSchema).parse(data);
}

export async function fetchAdaptationRun(
  adaptationId: string
): Promise<AdaptationRun> {
  const res = await fetch(
    `${API_BASE_URL}/api/adaptation/runs/${adaptationId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return AdaptationRunSchema.parse(data);
}

export async function fetchAdaptationManifest(
  adaptationId: string
): Promise<AdaptationManifest> {
  const res = await fetch(
    `${API_BASE_URL}/api/adaptation/runs/${adaptationId}/manifest`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return AdaptationManifestSchema.parse(data);
}

export async function fetchAdaptationModels(
  scope?: string,
  subjectId?: string
): Promise<ModelVersion[]> {
  const params = new URLSearchParams();
  if (scope) params.append("scope", scope);
  if (subjectId) params.append("subject_id", subjectId);
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${API_BASE_URL}/api/adaptation/models${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(ModelVersionSchema).parse(data);
}

export async function fetchModelVersionChain(
  modelId: string
): Promise<ModelVersion[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/adaptation/models/${modelId}/versions`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(ModelVersionSchema).parse(data);
}

export async function promoteCandidateModel(payload: {
  adaptation_id: string;
  operator_notes?: string;
}): Promise<{ promoted_model: ModelVersion; decision: PromotionDecision }> {
  const res = await fetch(`${API_BASE_URL}/api/adaptation/promote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return {
    promoted_model: ModelVersionSchema.parse(data.promoted_model),
    decision: PromotionDecisionSchema.parse(data.decision),
  };
}

export async function rejectCandidateModel(payload: {
  adaptation_id: string;
  rejection_reason: string;
}): Promise<{ rejected_model: ModelVersion; decision: PromotionDecision }> {
  const res = await fetch(`${API_BASE_URL}/api/adaptation/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return {
    rejected_model: ModelVersionSchema.parse(data.rejected_model),
    decision: PromotionDecisionSchema.parse(data.decision),
  };
}

export async function rollbackModel(payload: {
  target_model_id: string;
  reason: string;
}): Promise<{ active_model: ModelVersion; rollback_event: RollbackEvent }> {
  const res = await fetch(`${API_BASE_URL}/api/adaptation/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return {
    active_model: ModelVersionSchema.parse(data.active_model),
    rollback_event: RollbackEventSchema.parse(data.rollback_event),
  };
}

export async function fetchDriftDiagnostics(
  subjectId?: string,
  injectShift?: boolean
): Promise<DriftObservation> {
  const params = new URLSearchParams();
  if (subjectId) params.append("subject_id", subjectId);
  if (injectShift) params.append("inject_shift", "true");
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${API_BASE_URL}/api/adaptation/drift${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return DriftObservationSchema.parse(data);
}

// ============================================================================
// Phase 15: Confidence Estimation & Temporal Confirmation Operations
// ============================================================================

export async function fetchConfidenceConfig(
  subjectId?: string,
  modelVersionId?: string
): Promise<ConfidenceConfig> {
  const params = new URLSearchParams();
  if (subjectId) params.append("subject_id", subjectId);
  if (modelVersionId) params.append("model_version_id", modelVersionId);
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${API_BASE_URL}/api/confidence/config${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return ConfidenceConfigSchema.parse(data);
}

export async function updateConfidenceConfig(
  config: Partial<ConfidenceConfig>
): Promise<ConfidenceConfig> {
  const res = await fetch(`${API_BASE_URL}/api/confidence/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return ConfidenceConfigSchema.parse(data);
}

export async function evaluateConfidence(
  payload: ConfidenceInput
): Promise<{
  decision: ConfidenceDecision;
  temporal: TemporalConfirmationDecision;
  handoff: Phase16IntentHandoffPayload;
}> {
  const res = await fetch(`${API_BASE_URL}/api/confidence/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return {
    decision: ConfidenceDecisionSchema.parse(data.decision),
    temporal: TemporalConfirmationDecisionSchema.parse(data.temporal),
    handoff: Phase16IntentHandoffPayloadSchema.parse(data.handoff),
  };
}

export async function resetTemporalState(
  reason?: string
): Promise<{ status: string; reason: string }> {
  const res = await fetch(`${API_BASE_URL}/api/confidence/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: reason || "MANUAL_RESET" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function fetchConfidenceState(): Promise<{
  state: TemporalConfirmationState;
  config: ConfidenceConfig;
}> {
  const res = await fetch(`${API_BASE_URL}/api/confidence/state`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return {
    state: TemporalConfirmationStateSchema.parse(data.state),
    config: ConfidenceConfigSchema.parse(data.config),
  };
}

export async function fetchConfidenceHistory(
  limit: number = 50,
  subjectId?: string
): Promise<ConfidenceHistoryRecord[]> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (subjectId) params.append("subject_id", subjectId);

  const res = await fetch(
    `${API_BASE_URL}/api/confidence/history?${params.toString()}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(ConfidenceHistoryRecordSchema).parse(data);
}

export async function fetchTemporalEvents(
  limit: number = 50
): Promise<TemporalConfirmationEvent[]> {
  const params = new URLSearchParams({ limit: limit.toString() });
  const res = await fetch(
    `${API_BASE_URL}/api/confidence/events?${params.toString()}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(TemporalConfirmationEventSchema).parse(data);
}

export async function fetchCalibrationProfile(
  modelVersionId: string = "v1"
): Promise<ConfidenceCalibrationProfile> {
  const res = await fetch(
    `${API_BASE_URL}/api/confidence/calibration?model_version_id=${modelVersionId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return ConfidenceCalibrationProfileSchema.parse(data);
}

export async function calibrateModel(payload: {
  model_version_id: string;
  uncalibrated_scores: number[];
  labels: number[];
  method?: string;
  scope?: string;
  subject_id?: string;
  dataset_reference?: string;
}): Promise<ConfidenceCalibrationProfile> {
  const res = await fetch(`${API_BASE_URL}/api/confidence/calibrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return ConfidenceCalibrationProfileSchema.parse(data);
}

export async function fetchConfidenceMetrics(
  modelVersionId: string = "v1"
): Promise<CalibrationMetrics> {
  const res = await fetch(
    `${API_BASE_URL}/api/confidence/metrics?model_version_id=${modelVersionId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return CalibrationMetricsSchema.parse(data);
}

export async function runConfidenceScenario(
  scenarioId: string
): Promise<{ scenario_id: string; executed_at: string; results: any[] }> {
  const res = await fetch(
    `${API_BASE_URL}/api/confidence/simulation/scenarios`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_id: scenarioId }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  return res.json();
}

// --- Phase 16: Canonical Intent State Machine & Lifecycle Endpoints ---

export async function fetchIntentState(): Promise<IntentStateSnapshot> {
  const res = await fetch(`${API_BASE_URL}/api/intent/state`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return IntentStateSnapshotSchema.parse(data);
}

export async function fetchCurrentIntent(): Promise<IntentRecord | null> {
  const res = await fetch(`${API_BASE_URL}/api/intent/current`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  if (!data) return null;
  return IntentRecordSchema.parse(data);
}

export async function fetchIntentHistory(
  limit: number = 50,
  intentId?: string
): Promise<IntentStateTransition[]> {
  const query = intentId ? `&intent_id=${encodeURIComponent(intentId)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/intent/history?limit=${limit}${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(IntentStateTransitionSchema).parse(data);
}

export async function fetchIntentRecords(
  limit: number = 50,
  state?: string,
  subjectId?: string
): Promise<IntentRecord[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (state) params.set("state", state);
  if (subjectId) params.set("subject_id", subjectId);
  const res = await fetch(`${API_BASE_URL}/api/intent/records?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return z.array(IntentRecordSchema).parse(data);
}

export async function fetchIntentPolicy(): Promise<IntentPolicy> {
  const res = await fetch(`${API_BASE_URL}/api/intent/policy`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  return IntentPolicySchema.parse(data);
}

export async function updateIntentPolicy(
  policy: Partial<IntentPolicy>
): Promise<IntentPolicy> {
  const res = await fetch(`${API_BASE_URL}/api/intent/policy`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(policy),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return IntentPolicySchema.parse(data);
}

export async function ingestIntentHandoff(
  payload: IntentIngestRequest
): Promise<IntentStateSnapshot> {
  const res = await fetch(`${API_BASE_URL}/api/intent/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return IntentStateSnapshotSchema.parse(data);
}

export async function cancelIntent(
  payload?: IntentCancelRequest
): Promise<IntentStateSnapshot> {
  const res = await fetch(`${API_BASE_URL}/api/intent/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return IntentStateSnapshotSchema.parse(data);
}

export async function completeIntent(
  payload?: IntentCompleteRequest
): Promise<IntentStateSnapshot> {
  const res = await fetch(`${API_BASE_URL}/api/intent/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return IntentStateSnapshotSchema.parse(data);
}

export async function resetIntentState(
  payload?: IntentResetRequest
): Promise<IntentStateSnapshot> {
  const res = await fetch(`${API_BASE_URL}/api/intent/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return IntentStateSnapshotSchema.parse(data);
}

export async function runIntentScenario(
  scenarioId: string
): Promise<IntentScenarioResponse> {
  const res = await fetch(`${API_BASE_URL}/api/intent/simulation/scenarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario_id: scenarioId }),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return IntentScenarioResponseSchema.parse(data);
}


