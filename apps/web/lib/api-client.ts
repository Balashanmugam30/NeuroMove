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






