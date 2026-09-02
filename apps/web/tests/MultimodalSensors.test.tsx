import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeviceMatrixPanel } from "../components/sensors/DeviceMatrixPanel";
import { SyncAlignmentPanel } from "../components/sensors/SyncAlignmentPanel";
import { SensorQualityPanel } from "../components/sensors/SensorQualityPanel";
import { MultimodalSignalOscilloscope } from "../components/sensors/MultimodalSignalOscilloscope";
import { SensorFusionPanel } from "../components/sensors/SensorFusionPanel";
import { ContextEnginePanel } from "../components/sensors/ContextEnginePanel";
import { MultimodalPipelineFlow } from "../components/sensors/MultimodalPipelineFlow";
import { MultimodalFaultLab } from "../components/sensors/MultimodalFaultLab";
import { MultimodalScenariosPanel } from "../components/sensors/MultimodalScenariosPanel";
import MultimodalSensorsPage from "../app/sensors/page";
import type {
  SensorDeviceDescriptor,
  SensorHealthSnapshot,
  MultimodalSyncState,
  FusionResult,
  MultimodalContext,
} from "@neuromove/contracts";

vi.mock("@/lib/api-client", () => ({
  fetchSensorDevices: vi.fn().mockResolvedValue([
    {
      device_id: "sensor_eeg_sim",
      name: "Simulated 8-Channel EEG Cap",
      modality: "EEG",
      source: "SIMULATED",
      channel_count: 8,
      channel_names: ["F3", "F4", "C3", "Cz", "C4", "P3", "Pz", "P4"],
      default_sampling_rate: 250,
      protocol: "LSL_VIRTUAL",
      is_available: true,
      is_connected: true,
    },
    {
      device_id: "sensor_imu_sim",
      name: "Simulated 6-DOF Head/Chassis IMU",
      modality: "IMU",
      source: "SIMULATED",
      channel_count: 6,
      channel_names: ["AX", "AY", "AZ", "GX", "GY", "GZ"],
      default_sampling_rate: 100,
      protocol: "I2C_VIRTUAL",
      is_available: true,
      is_connected: true,
    },
  ]),
  fetchSensorsHealth: vi.fn().mockResolvedValue({
    sensor_eeg_sim: {
      sensor_id: "sensor_eeg_sim",
      modality: "EEG",
      sampling_rate: 250,
      packet_loss_rate: 0.0,
      is_healthy: true,
      channels: [
        {
          channel_name: "C3",
          modality: "EEG",
          qc_status: "VALID",
          mean_amplitude: 12.4,
          snr_db: 24.5,
          flatline_rate: 0.0,
          saturation_rate: 0.0,
          dropout_rate: 0.0,
          is_usable: true,
        },
      ],
      active_anomalies: [],
    },
  }),
  fetchSensorsSyncState: vi.fn().mockResolvedValue({
    session_id: "session_01",
    global_session_time_iso: "2026-01-01T12:00:00Z",
    status: "SYNCHRONIZED",
    primary_clock_sensor_id: "sensor_eeg_sim",
    estimated_offsets_ms: { sensor_eeg_sim: 0.0, sensor_imu_sim: 2.5 },
    estimated_drifts_ppm: { sensor_eeg_sim: 0.0, sensor_imu_sim: 12.0 },
    max_jitter_ms: 0.45,
    alignment_quality_pct: 100.0,
    total_discontinuities: 0,
    is_aligned: true,
  }),
  fetchSensorScenarios: vi.fn().mockResolvedValue([
    { id: "SCENARIO_A", name: "EEG + IMU Healthy Synchronized Baseline" },
    { id: "SCENARIO_B", name: "EEG Only Standalone Operation" },
  ]),
  connectSensorDevice: vi.fn().mockResolvedValue({ device_id: "s1", connected: true }),
  disconnectSensorDevice: vi.fn().mockResolvedValue({ device_id: "s1", disconnected: true }),
  calibrateSensorDevice: vi.fn().mockResolvedValue({ is_calibrated: true, is_ready: true }),
  startSensorSession: vi.fn().mockResolvedValue({ session_id: "s_start" }),
  stopSensorSession: vi.fn().mockResolvedValue({ status: "STOPPED" }),
  fetchMultimodalFrame: vi.fn().mockResolvedValue({
    packets: {},
    context: {
      context_id: "ctx_1",
      timestamp: "2026-01-01T12:00:00Z",
      session_id: "s1",
      motion_state: "STATIONARY",
      motion_contamination_state: "MOTION_QUIET",
      peripheral_activation: false,
      ocular_artifact_detected: false,
      contact_present: true,
      pulse_bpm: null,
      context_confidence: 0.92,
      is_movement_valid: true,
      is_eeg_contaminated: false,
      is_stale: false,
      participating_sensors: ["sensor_eeg_sim"],
      active_contradictions: [],
    },
    fusion: {
      fusion_id: "fuse_1",
      timestamp: "2026-01-01T12:00:00Z",
      strategy: "RULE_BASED_CONTEXT",
      participating_sensor_ids: ["sensor_eeg_sim", "sensor_imu_sim"],
      participating_modalities: ["EEG", "IMU"],
      evidence: [],
      alignment_quality: 1.0,
      has_contradiction: false,
      contradiction_outcome: "NOMINAL",
      fused_context_score: 0.90,
      context_confidence: 0.92,
      is_valid: true,
    },
    sync: {
      session_id: "s1",
      global_session_time_iso: "2026-01-01T12:00:00Z",
      status: "SYNCHRONIZED",
      primary_clock_sensor_id: "sensor_eeg_sim",
      sensor_offsets_ms: {},
      sensor_drift_ppm: {},
      max_jitter_ms: 0.2,
      alignment_quality_pct: 100.0,
      total_discontinuities: 0,
      is_aligned: true,
    },
  }),
  processSensorInference: vi.fn().mockResolvedValue({
    is_authorized: true,
    hil_dispatched: true,
    safety_verdict: "AUTHORIZED",
    final_confidence: 0.92,
    sync_status: "SYNCHRONIZED",
    motion_state: "STATIONARY",
    has_contradiction: false,
  }),
  injectSensorFault: vi.fn().mockResolvedValue({ injected: true }),
  clearSensorFaults: vi.fn().mockResolvedValue({ status: "CLEARED" }),
  runSensorScenario: vi.fn().mockResolvedValue({ passed: true, scenario_id: "SCENARIO_A" }),
  resetMultimodalService: vi.fn().mockResolvedValue({ status: "RESET" }),
}));

describe("Phase 23 Multimodal Sensors Frontend Components", () => {
  const mockDevices: SensorDeviceDescriptor[] = [
    {
      device_id: "sensor_eeg_sim",
      name: "Simulated 8-Channel EEG Cap",
      modality: "EEG",
      source: "SIMULATED",
      channel_count: 8,
      channel_names: ["F3", "F4", "C3", "Cz", "C4", "P3", "Pz", "P4"],
      default_sampling_rate: 250,
      protocol: "LSL_VIRTUAL",
      is_available: true,
      is_connected: true,
    },
    {
      device_id: "sensor_imu_sim",
      name: "Simulated 6-DOF IMU",
      modality: "IMU",
      source: "SIMULATED",
      channel_count: 6,
      channel_names: ["AX", "AY", "AZ", "GX", "GY", "GZ"],
      default_sampling_rate: 100,
      protocol: "I2C_VIRTUAL",
      is_available: true,
      is_connected: false,
    },
  ];

  const mockHealths: Record<string, SensorHealthSnapshot> = {
    sensor_eeg_sim: {
      sensor_id: "sensor_eeg_sim",
      modality: "EEG",
      sampling_rate: 250,
      packet_loss_rate: 0.0,
      is_healthy: true,
      channels: [
        {
          channel_name: "C3",
          modality: "EEG",
          qc_status: "VALID",
          mean_amplitude: 12.4,
          snr_db: 24.5,
          flatline_rate: 0.0,
          saturation_rate: 0.0,
          dropout_rate: 0.0,
          is_usable: true,
        },
      ],
      active_anomalies: [],
    },
  };

  it("renders DeviceMatrixPanel with devices and modality filters", () => {
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const onCalibrate = vi.fn();

    render(
      <DeviceMatrixPanel
        devices={mockDevices}
        healths={mockHealths}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onCalibrate={onCalibrate}
      />
    );

    expect(screen.getByText("Multimodal Sensor Matrix")).toBeDefined();
    expect(screen.getByText("Simulated 8-Channel EEG Cap")).toBeDefined();
    expect(screen.getByText("Simulated 6-DOF IMU")).toBeDefined();
    expect(screen.getAllByText("EEG").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("IMU").length).toBeGreaterThanOrEqual(1);
  });

  it("handles connect and disconnect button clicks in DeviceMatrixPanel", async () => {
    const onConnect = vi.fn().mockResolvedValue(undefined);
    const onDisconnect = vi.fn().mockResolvedValue(undefined);
    const onCalibrate = vi.fn().mockResolvedValue(undefined);

    render(
      <DeviceMatrixPanel
        devices={mockDevices}
        healths={mockHealths}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onCalibrate={onCalibrate}
      />
    );

    const disconnectBtn = screen.getByText("Disconnect");
    fireEvent.click(disconnectBtn);
    expect(onDisconnect).toHaveBeenCalledWith("sensor_eeg_sim");

    const connectBtn = screen.getByText("Connect Sensor");
    fireEvent.click(connectBtn);
    expect(onConnect).toHaveBeenCalledWith("sensor_imu_sim");
  });

  it("renders SyncAlignmentPanel with synchronized metrics and drift table", () => {
    const syncState: MultimodalSyncState = {
      session_id: "s1",
      global_session_time_iso: "2026-01-01T12:00:00Z",
      status: "SYNCHRONIZED",
      primary_clock_sensor_id: "sensor_eeg_sim",
      estimated_offsets_ms: { sensor_eeg_sim: 0.0, sensor_imu_sim: 3.4 },
      estimated_drifts_ppm: { sensor_eeg_sim: 0.0, sensor_imu_sim: 15.2 },
      max_jitter_ms: 0.42,
      alignment_quality_pct: 100.0,
      total_discontinuities: 0,
      is_aligned: true,
    };

    render(<SyncAlignmentPanel syncState={syncState} />);

    expect(screen.getByText("Multi-Clock Synchronization & Drift")).toBeDefined();
    expect(screen.getByText("SYNCHRONIZED")).toBeDefined();
    expect(screen.getByText("100.0%")).toBeDefined();
    expect(screen.getByText("0.42 ms")).toBeDefined();
    expect(screen.getByText("sensor_imu_sim")).toBeDefined();
  });

  it("renders SensorQualityPanel with channel quality", () => {
    render(<SensorQualityPanel healths={mockHealths} />);

    expect(screen.getByText("Sensor Quality Control & Health Matrix")).toBeDefined();
    expect(screen.getByText("C3")).toBeDefined();
    expect(screen.getByText("Healthy")).toBeDefined();
  });

  it("renders MultimodalSignalOscilloscope with waveforms", () => {
    const packets = {
      sensor_eeg_sim: {
        sensor_id: "sensor_eeg_sim",
        modality: "EEG",
        sequence_number: 42,
        sample_count: 10,
        channel_names: ["C3", "C4"],
        units: "uV",
        data: [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]],
      },
    };

    render(<MultimodalSignalOscilloscope packets={packets} isStreaming={true} />);

    expect(screen.getByText("Multimodal Signal Oscilloscope")).toBeDefined();
    expect(screen.getByText("LIVE STREAMING")).toBeDefined();
    expect(screen.getByText("C3")).toBeDefined();
    expect(screen.getByText("C4")).toBeDefined();
  });

  it("renders SensorFusionPanel with modulated confidence and cross-sensor evidence", () => {
    const fusion: FusionResult = {
      fusion_id: "fuse_test",
      timestamp: "2026-01-01T12:00:00Z",
      strategy: "RULE_BASED_CONTEXT",
      participating_sensor_ids: ["sensor_eeg_sim", "sensor_imu_sim"],
      participating_modalities: ["EEG", "IMU"],
      evidence: [
        {
          evidence_id: "ev_1",
          timestamp: "2026-01-01T12:00:00Z",
          sensor_id: "sensor_imu_sim",
          modality: "IMU",
          feature_name: "motion_stability",
          feature_value: 0.02,
          confidence: 0.95,
          interpretation: "Stationary head context",
        },
      ],
      alignment_quality: 1.0,
      has_contradiction: false,
      contradiction_outcome: "NOMINAL",
      fused_context_score: 0.92,
      context_confidence: 0.94,
      is_valid: true,
    };

    render(<SensorFusionPanel fusionResult={fusion} />);

    expect(screen.getByText("Deterministic Sensor Fusion Engine")).toBeDefined();
    expect(screen.getByText("94.0%")).toBeDefined();
    expect(screen.getByText("0.920")).toBeDefined();
    expect(screen.getByText("Stationary head context")).toBeDefined();
  });

  it("renders ContextEnginePanel with motion state and ocular blink indicators", () => {
    const context: MultimodalContext = {
      context_id: "ctx_test",
      timestamp: "2026-01-01T12:00:00Z",
      session_id: "s1",
      motion_state: "STATIONARY",
      motion_contamination_state: "MOTION_QUIET",
      peripheral_activation: false,
      ocular_artifact_detected: false,
      contact_present: true,
      pulse_bpm: 72,
      context_confidence: 0.92,
      is_movement_valid: true,
      is_eeg_contaminated: false,
      is_stale: false,
      participating_sensors: ["sensor_eeg_sim"],
      active_contradictions: [],
    };

    render(<ContextEnginePanel context={context} />);

    expect(screen.getByText("Neurophysiology Context Engine")).toBeDefined();
    expect(screen.getByText("CONTEXT VALID")).toBeDefined();
    expect(screen.getByText("STATIONARY")).toBeDefined();
    expect(screen.getByText("SEATED / ENGAGED")).toBeDefined();
  });

  it("renders MultimodalPipelineFlow canonical stages", () => {
    render(<MultimodalPipelineFlow />);

    expect(screen.getByText("Canonical Multimodal Pipeline Architecture")).toBeDefined();
    expect(screen.getByText("1. Sensor Streams")).toBeDefined();
    expect(screen.getByText("2. Sync & Clock")).toBeDefined();
    expect(screen.getByText("3. QC Engine")).toBeDefined();
    expect(screen.getByText("4. Sensor Fusion")).toBeDefined();
    expect(screen.getByText("5. Context Engine")).toBeDefined();
    expect(screen.getByText("6. Safety (Phase 17)")).toBeDefined();
    expect(screen.getByText("7. HIL (Phase 20)")).toBeDefined();
  });

  it("renders MultimodalFaultLab and allows fault injection", async () => {
    const onInject = vi.fn().mockResolvedValue(undefined);
    const onClear = vi.fn().mockResolvedValue(undefined);

    render(<MultimodalFaultLab onInjectFault={onInject} onClearFaults={onClear} />);

    expect(screen.getByText("Resilience Fault Laboratory")).toBeDefined();
    expect(screen.getByText("IMU Motion Burst")).toBeDefined();
    expect(screen.getByText("EOG Blink Pulse")).toBeDefined();

    const clearBtn = screen.getByText("Clear All Faults");
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });

  it("renders MultimodalScenariosPanel and runs scenarios", async () => {
    const scenarios = [
      { id: "SCENARIO_A", name: "EEG + IMU Healthy Synchronized Baseline" },
      { id: "SCENARIO_K", name: "Authorized End-to-End HIL Dispatch" },
    ];
    const onRun = vi.fn().mockResolvedValue({ passed: true, scenario_id: "SCENARIO_A" });

    render(<MultimodalScenariosPanel scenarios={scenarios} onRunScenario={onRun} />);

    expect(screen.getByText("12 Golden Verification Scenarios")).toBeDefined();
    expect(screen.getByText("EEG + IMU Healthy Synchronized Baseline")).toBeDefined();
    expect(screen.getByText("Authorized End-to-End HIL Dispatch")).toBeDefined();

    const runBtn = screen.getAllByText("Run Test")[0];
    fireEvent.click(runBtn);
    expect(onRun).toHaveBeenCalledWith("SCENARIO_A");
  });

  it("renders full MultimodalSensorsPage without crashing", async () => {
    render(<MultimodalSensorsPage />);

    await waitFor(() => {
      expect(screen.getByText("Multimodal Sensors & Fusion Engine")).toBeDefined();
    });

    expect(screen.getByText("Start Multimodal Stream")).toBeDefined();
    expect(screen.getByText("Reset Service")).toBeDefined();
  });
});
