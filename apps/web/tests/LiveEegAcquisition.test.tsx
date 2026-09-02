import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AcquisitionDevicePanel,
  LiveSignalWaveformPanel,
  ChannelQcMatrixPanel,
  StreamQualityTelemetryPanel,
  EegCalibrationPanel,
  LivePipelineInspector,
  E2EScenariosLab,
} from "../components/eeg-live";
import {
  EegDeviceDescriptor,
  EegChannelHealthSnapshot,
  EegStreamHealthSnapshot,
  EegCalibrationSnapshot,
  EegLiveInferenceSummary,
  EegE2EResult,
} from "@neuromove/contracts";

const mockDevices: EegDeviceDescriptor[] = [
  {
    device_id: "sim_eeg_01",
    name: "Synthetic Motor-Imagery Generator",
    source_type: "SIMULATOR",
    vendor: "NeuroMove Simulation Lab",
    model: "Sim-MI-v1",
    firmware_version: "1.0.0-sim",
    protocol: "INTERNAL_RING_BUFFER",
    channel_count: 8,
    supported_sampling_rates: [250, 500],
    default_sampling_rate: 250,
    adc_resolution_bits: 24,
    is_available: true,
    is_connected: true,
    connection_path: "memory://internal",
  },
  {
    device_id: "phys_eeg_bioamp",
    name: "BioAmp ADC Physical Receiver",
    source_type: "PHYSICAL",
    vendor: "BioAmp / UpsideDownLabs",
    model: "EXG-ADC-8CH",
    protocol: "SERIAL_STREAM",
    channel_count: 8,
    supported_sampling_rates: [250, 500, 1000],
    default_sampling_rate: 250,
    adc_resolution_bits: 24,
    is_available: false,
    is_connected: false,
    connection_path: undefined,
  },
];

const mockChannelSnapshots: EegChannelHealthSnapshot[] = [
  {
    channel_name: "C3",
    qc_status: "HEALTHY",
    mean_amp_uv: 0.2,
    std_amp_uv: 14.5,
    min_amp_uv: -45.0,
    max_amp_uv: 48.0,
    variance: 210.25,
    packet_loss_rate: 0.0,
    is_healthy: true,
  },
  {
    channel_name: "Cz",
    qc_status: "HEALTHY",
    mean_amp_uv: -0.1,
    std_amp_uv: 12.0,
    min_amp_uv: -38.0,
    max_amp_uv: 41.0,
    variance: 144.0,
    packet_loss_rate: 0.0,
    is_healthy: true,
  },
  {
    channel_name: "C4",
    qc_status: "HEALTHY",
    mean_amp_uv: 0.5,
    std_amp_uv: 15.1,
    min_amp_uv: -50.0,
    max_amp_uv: 52.0,
    variance: 228.01,
    packet_loss_rate: 0.0,
    is_healthy: true,
  },
];

const mockStreamHealth: EegStreamHealthSnapshot = {
  session_id: "sess_01",
  state: "STREAMING",
  source_type: "SIMULATOR",
  sample_rate: 250,
  samples_received: 5000,
  samples_dropped: 0,
  buffer_fill_pct: 12.5,
  packet_loss_pct: 0.0,
  mean_latency_ms: 2.1,
  clock_drift_ms: 0.15,
  degraded_channel_count: 0,
  is_nominal: true,
  timestamp: new Date().toISOString(),
};

const mockCalibration: EegCalibrationSnapshot = {
  calibration_id: "cal_01",
  session_id: "sess_01",
  subject_id: "sub-01",
  state: "CALIBRATED",
  baseline_duration_sec: 10.0,
  baseline_mean_uv: { C3: 0.1, Cz: -0.2, C4: 0.3 },
  baseline_std_uv: { C3: 14.2, Cz: 12.1, C4: 15.0 },
  channel_health: { C3: "HEALTHY", Cz: "HEALTHY", C4: "HEALTHY" },
  manifest_hash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
  is_ready: true,
  created_at: new Date().toISOString(),
};

const mockInference: EegLiveInferenceSummary = {
  inference_id: "inf_01",
  timestamp: new Date().toISOString(),
  predicted_class: "MOVE_FORWARD",
  predicted_probability: 0.89,
  calibrated_confidence: 0.89,
  confidence_policy: "TEMPORAL_CONFIRMATION",
  temporal_confirmation_state: "CONFIRMED",
  intent_state: "EXECUTING",
  safety_decision: "AUTHORIZED",
  will_transmit: true,
  transport_status: "COMMAND_ACCEPTED",
  lineage_hash: "lineage_hash_1234567890abcdef",
};

const mockScenarioResult: EegE2EResult = {
  result_id: "res_sc_a",
  experiment_id: "exp_sc_a",
  scenario_id: "SCENARIO_A",
  stage_results: { acquisition: true, calibration: true, safety: true, hil: true },
  predicted_intent: "TURN_RIGHT",
  confidence_score: 0.88,
  safety_decision: "AUTHORIZED",
  hil_status: "COMMAND_ACCEPTED",
  latency_breakdown_ms: { dsp: 1.2, inference: 2.1, hil: 2.5 },
  passed: true,
  timestamp: new Date().toISOString(),
};

describe("Phase 21 Live EEG Acquisition Frontend Tests", () => {
  // 1. AcquisitionDevicePanel Tests
  it("renders AcquisitionDevicePanel with source selection and non-actuation banner", () => {
    const onSelectSource = vi.fn();
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const onDiscover = vi.fn();

    render(
      <AcquisitionDevicePanel
        activeSource="SIMULATOR"
        activeDeviceId="sim_eeg_01"
        connectionState="STREAMING"
        devices={mockDevices}
        onSelectSource={onSelectSource}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onDiscover={onDiscover}
      />
    );

    expect(screen.getByText("EEG Acquisition Source & Device Interface")).toBeInTheDocument();
    expect(screen.getByText("Synthetic Simulator")).toBeInTheDocument();
    expect(screen.getByText("Recorded Fixture")).toBeInTheDocument();
    expect(screen.getByText("Physical BioAmp")).toBeInTheDocument();
    expect(screen.getByText(/Laboratory Ingestion Boundary/i)).toBeInTheDocument();
  });

  it("triggers source selection callback when tab is clicked", () => {
    const onSelectSource = vi.fn();
    render(
      <AcquisitionDevicePanel
        activeSource="SIMULATOR"
        activeDeviceId="sim_eeg_01"
        connectionState="STREAMING"
        devices={mockDevices}
        onSelectSource={onSelectSource}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onDiscover={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Recorded Fixture"));
    expect(onSelectSource).toHaveBeenCalledWith("RECORDED");
  });

  // 2. LiveSignalWaveformPanel Tests
  it("renders LiveSignalWaveformPanel with oscilloscope canvas and channel toggles", () => {
    const onToggle = vi.fn();
    render(
      <LiveSignalWaveformPanel
        waveformData={{
          channels: ["C3", "Cz", "C4"],
          sample_count: 100,
          sampling_rate: 250,
          data: [[1.0], [2.0], [3.0]],
          timestamp: new Date().toISOString(),
        }}
        isStreaming={true}
        onToggleStream={onToggle}
      />
    );

    expect(screen.getByText("Live Multi-Channel EEG Oscilloscope")).toBeInTheDocument();
    expect(screen.getByText("Freeze Stream")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Freeze Stream"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // 3. ChannelQcMatrixPanel Tests
  it("renders ChannelQcMatrixPanel with 8-channel status cards and fault buttons", () => {
    const onInject = vi.fn();
    render(
      <ChannelQcMatrixPanel
        channelSnapshots={mockChannelSnapshots}
        onInjectFault={onInject}
      />
    );

    expect(screen.getByText("Channel Signal Quality & Impedance Matrix")).toBeInTheDocument();
    expect(screen.getByText("Fault C3")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Fault C3"));
    expect(onInject).toHaveBeenCalledWith("FLATLINE_CHANNEL", { channel: "C3" });
  });

  // 4. StreamQualityTelemetryPanel Tests
  it("renders StreamQualityTelemetryPanel with buffer fill, latency, and drift", () => {
    render(<StreamQualityTelemetryPanel health={mockStreamHealth} />);

    expect(screen.getByText("Stream Integrity & Clock Synchronization Telemetry")).toBeInTheDocument();
    expect(screen.getByText("STREAM NOMINAL")).toBeInTheDocument();
    expect(screen.getByText("12.5%")).toBeInTheDocument();
    expect(screen.getByText("2.1 ms")).toBeInTheDocument();
    expect(screen.getByText("0.15 ms")).toBeInTheDocument();
  });

  // 5. EegCalibrationPanel Tests
  it("renders EegCalibrationPanel with 4-step setup and manifest hash", () => {
    const onCalibrate = vi.fn();
    render(
      <EegCalibrationPanel
        calibration={mockCalibration}
        onRunCalibration={onCalibrate}
      />
    );

    expect(screen.getByText("Live EEG Calibration & Readiness Gate")).toBeInTheDocument();
    expect(screen.getByText("CALIBRATION READY")).toBeInTheDocument();
    expect(screen.getByText(/1. Ingestion/i)).toBeInTheDocument();
    expect(screen.getByText(/4. Gate Authorization/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Run Calibration"));
    expect(onCalibrate).toHaveBeenCalledTimes(1);
  });

  // 6. LivePipelineInspector Tests
  it("renders LivePipelineInspector with 8-stage lineage and intent stimulation buttons", () => {
    const onInference = vi.fn();
    render(
      <LivePipelineInspector
        inferenceSummary={mockInference}
        onRunInference={onInference}
      />
    );

    expect(screen.getByText("End-to-End Live Neurophysiology Pipeline Lineage")).toBeInTheDocument();
    expect(screen.getByText("Trigger Forward")).toBeInTheDocument();
    expect(screen.getByText("Trigger Stop")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Trigger Forward"));
    expect(onInference).toHaveBeenCalledWith("MOVE_FORWARD");
  });

  // 7. E2EScenariosLab Tests
  it("renders E2EScenariosLab with 10 Golden Scenarios and run buttons", () => {
    const onRun = vi.fn();
    const onRunAll = vi.fn();
    render(
      <E2EScenariosLab
        scenarioResults={{ SCENARIO_A: mockScenarioResult }}
        onRunScenario={onRun}
        onRunAllScenarios={onRunAll}
      />
    );

    expect(screen.getByText("Phase 21 Golden E2E Verification Scenarios")).toBeInTheDocument();
    expect(screen.getByText("Run All 10 Scenarios")).toBeInTheDocument();
    expect(screen.getByText("Synthetic Simulator Full E2E Pipeline")).toBeInTheDocument();
    expect(screen.getByText("PASSED")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Run All 10 Scenarios"));
    expect(onRunAll).toHaveBeenCalledTimes(1);
  });
});
