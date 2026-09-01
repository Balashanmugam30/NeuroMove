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


