import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PipelineConfigurator } from "../components/preprocessing/PipelineConfigurator";
import { SignalComparisonPanel } from "../components/preprocessing/SignalComparisonPanel";
import { StageAuditCard } from "../components/preprocessing/StageAuditCard";
import {
  PreprocessingConfig,
  PreprocessingResult,
  PreprocessingSignalResponse,
  PreprocessingStageAudit,
} from "@neuromove/contracts";

const mockConfig: PreprocessingConfig = {
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

const mockResult: PreprocessingResult = {
  result_id: "pre_5c162ad331ee_default",
  pipeline_version: "EEG_PREPROCESSING_V1",
  config_hash: "5c162ad331ee6af3",
  source_kind: "SYNTHETIC",
  input_sample_rate_hz: 250.0,
  output_sample_rate_hz: 250.0,
  input_channels: ["Fc5", "C3", "Cz", "C4"],
  output_channels: ["Fc5", "C3", "Cz", "C4"],
  duration_seconds: 10.0,
  event_count: 3,
  artifact_file_path: "data/processed/mock.fif",
  artifact_checksum_sha256: "a1b2c3d4e5f67890a1b2c3d4e5f67890",
  integrity_report: {
    sample_count: 2500,
    channel_count: 4,
    nan_count: 0,
    inf_count: 0,
    min_amplitude_uv: -42.5,
    max_amplitude_uv: 38.2,
    flatline_channels: [],
    amplitude_outlier_candidates: 0,
    status: "HEALTHY",
  },
  stage_audit: [
    {
      stage: "VALIDATE",
      status: "COMPLETED",
      started_at: "2026-09-01T00:00:00Z",
      completed_at: "2026-09-01T00:00:00Z",
      duration_ms: 1.2,
      parameters: { channels: 4 },
      warnings: [],
    },
    {
      stage: "REFERENCE",
      status: "COMPLETED",
      started_at: "2026-09-01T00:00:00Z",
      completed_at: "2026-09-01T00:00:00Z",
      duration_ms: 2.4,
      parameters: { reference: "average" },
      warnings: [],
    },
    {
      stage: "FILTER",
      status: "COMPLETED",
      started_at: "2026-09-01T00:00:00Z",
      completed_at: "2026-09-01T00:00:00Z",
      duration_ms: 8.5,
      parameters: { highpass_hz: 0.5, lowpass_hz: 40.0 },
      warnings: [],
    },
  ],
  warnings: [],
  software_versions: { mne: "1.12.1" },
  created_at: "2026-09-01T00:00:00Z",
};

const mockSignal: PreprocessingSignalResponse = {
  result_id: "pre_5c162ad331ee_default",
  sampling_rate_hz: 250.0,
  channels: ["Fc5", "C3", "Cz", "C4"],
  timestamps: [0.0, 0.004, 0.008],
  signals: {
    C3: [12.0, 14.5, 13.2],
    Cz: [5.0, 4.8, 5.2],
    C4: [15.0, 16.2, 14.8],
    Fc5: [8.0, 8.5, 9.1],
  },
  events: [],
};

describe("Phase 09 Preprocessing & DSP Workspace Components", () => {
  it("renders PipelineConfigurator and handles preset changes", () => {
    const handleChange = vi.fn();
    render(
      <PipelineConfigurator
        config={mockConfig}
        preview={null}
        onChange={handleChange}
      />
    );

    expect(screen.getByText(/Zero-Phase Band-Pass Filter/i)).toBeInTheDocument();
    expect(screen.getByText(/Spatial Reference Transformation/i)).toBeInTheDocument();
    expect(screen.getByText(/Line-Noise Notch Filter/i)).toBeInTheDocument();
    expect(screen.getByText(/Temporal Resampling Stage/i)).toBeInTheDocument();

    // Click Mu/Beta preset
    const presetBtn = screen.getByText(/Mu\/Beta Band/i);
    fireEvent.click(presetBtn);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ highpass_hz: 8.0, lowpass_hz: 30.0 })
    );
  });

  it("renders SignalComparisonPanel with dual signals and integrity metrics", () => {
    const handleSelectChannel = vi.fn();
    render(
      <SignalComparisonPanel
        result={mockResult}
        rawSignal={mockSignal}
        procSignal={mockSignal}
        selectedChannel="C3"
        onSelectChannel={handleSelectChannel}
      />
    );

    expect(screen.getByText(/Raw Signal \(C3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Preprocessed Signal \(C3\)/i)).toBeInTheDocument();
    expect(screen.getByText("HEALTHY")).toBeInTheDocument();
    expect(screen.getByText("-42.5 to 38.2 μV")).toBeInTheDocument();

    // Switch channel to C4
    const c4Btn = screen.getByRole("button", { name: "C4" });
    fireEvent.click(c4Btn);
    expect(handleSelectChannel).toHaveBeenCalledWith("C4");
  });

  it("renders StageAuditCard and displays stage execution times", () => {
    render(
      <StageAuditCard
        audits={mockResult.stage_audit}
        manifest={null}
        pipelineVersion="EEG_PREPROCESSING_V1"
      />
    );

    expect(screen.getByText(/Pipeline Execution Stage Audit/i)).toBeInTheDocument();
    expect(screen.getByText("VALIDATE")).toBeInTheDocument();
    expect(screen.getByText("REFERENCE")).toBeInTheDocument();
    expect(screen.getByText("FILTER")).toBeInTheDocument();
    expect(screen.getByText("8.5 ms")).toBeInTheDocument();
  });
});
