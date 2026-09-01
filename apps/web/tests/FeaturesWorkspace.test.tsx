import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EpochSegmentor } from "../components/features/EpochSegmentor";
import { EpochVisualizer } from "../components/features/EpochVisualizer";
import { FeatureTable } from "../components/features/FeatureTable";
import { CovarianceViewer } from "../components/features/CovarianceViewer";
import { ClassDistributionCard } from "../components/features/ClassDistributionCard";
import {
  EpochRecord,
  EpochSignalResponse,
  EpochSummary,
  FeatureSet,
  CovarianceSet,
} from "@neuromove/contracts";

const mockSummary: EpochSummary = {
  epoch_set_id: "ep_12345678_abcd_test01",
  epoching_version: "EEG_EPOCHING_V1",
  config_hash: "12345678abcd",
  source_kind: "SYNTHETIC",
  sampling_rate_hz: 250.0,
  channel_names: ["Fc5", "C3", "Cz", "C4"],
  tmin: -1.0,
  tmax: 4.0,
  total_events: 3,
  mapped_events: 3,
  valid_epochs: 3,
  rejected_epochs: 0,
  rejection_counts: {},
  label_distribution: { LEFT_IMAGERY: 2, RIGHT_IMAGERY: 1 },
  artifact_file_path: "data/epochs/ep_test.fif",
  artifact_checksum_sha256: "deadbeef12345678",
  created_at: "2026-09-01T00:00:00Z",
};

const mockRecords: EpochRecord[] = [
  {
    epoch_id: "ep_001",
    epoch_set_id: "ep_12345678_abcd_test01",
    trial_id: "trl_001",
    event_id: "evt_001",
    subject_id: "sub_01",
    label: "LEFT_IMAGERY",
    onset_seconds: 1.0,
    qc_status: "VALID",
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    epoch_id: "ep_002",
    epoch_set_id: "ep_12345678_abcd_test01",
    trial_id: "trl_002",
    event_id: "evt_002",
    subject_id: "sub_01",
    label: "RIGHT_IMAGERY",
    onset_seconds: 4.0,
    qc_status: "VALID",
    created_at: "2026-09-01T00:00:00Z",
  },
];

const mockSignal: EpochSignalResponse = {
  epoch_id: "ep_001",
  trial_id: "trl_001",
  label: "LEFT_IMAGERY",
  sampling_rate_hz: 250.0,
  channels: ["C3", "Cz", "C4"],
  time_points: [-1.0, -0.5, 0.0, 0.5, 1.0],
  signals: {
    C3: [0.0, 1.0, 2.0, 1.5, 0.5],
    Cz: [0.5, 0.8, 1.2, 0.9, 0.4],
    C4: [1.0, 2.0, 3.0, 2.5, 1.0],
  },
  cue_onset_relative_seconds: 0.0,
  baseline_window: [-1.0, 0.0],
  analysis_window: [0.5, 4.0],
  qc_status: "VALID",
};

const mockFeatureSet: FeatureSet = {
  feature_set_id: "feat_87654321_ep_test01",
  feature_version: "EEG_FEATURES_V1",
  config_hash: "87654321abcd",
  source_epoch_set_id: "ep_12345678_abcd_test01",
  subject_ids: ["sub_01"],
  session_ids: ["session_01"],
  run_ids: [],
  trial_ids: ["trl_001", "trl_002"],
  labels: ["LEFT_IMAGERY", "RIGHT_IMAGERY"],
  feature_names: ["C3_mu_abs", "C4_mu_abs", "mu_lateralization_c3_c4"],
  row_count: 2,
  feature_count: 3,
  label_distribution: { LEFT_IMAGERY: 1, RIGHT_IMAGERY: 1 },
  artifact_file_path: "data/features/feat_test.npz",
  artifact_checksum_sha256: "beefdead87654321",
  created_at: "2026-09-01T00:00:00Z",
  software_versions: { mne: "1.9.0", numpy: "2.2.0" },
};

const mockCovarianceSet: CovarianceSet = {
  covariance_set_id: "cov_test01",
  epoch_set_id: "ep_12345678_abcd_test01",
  channels: ["C3", "Cz", "C4"],
  shape: [2, 3, 3],
  regularization: "NORMALIZED",
  matrices: [
    {
      epoch_id: "ep_001",
      label: "LEFT_IMAGERY",
      channels: ["C3", "Cz", "C4"],
      matrix: [
        [0.4, 0.1, 0.05],
        [0.1, 0.35, 0.1],
        [0.05, 0.1, 0.25],
      ],
      trace: 1.0,
      is_symmetric: true,
      is_positive_semi_definite: true,
    },
  ],
  artifact_file_path: "data/features/cov_test.npz",
  artifact_checksum_sha256: "feedface12345678",
  created_at: "2026-09-01T00:00:00Z",
};

describe("EpochSegmentor Component", () => {
  it("renders configuration controls and handles button triggers", () => {
    const handleRun = vi.fn().mockResolvedValue(undefined);
    const handlePreview = vi.fn().mockResolvedValue({
      valid: true,
      events_discovered: 3,
      mapped_events: 3,
      unmapped_events: 0,
      invalid_events: 0,
      expected_epochs: 3,
      sampling_rate_hz: 250.0,
      tmin: -1.0,
      tmax: 4.0,
      baseline: [-1.0, 0.0],
      analysis_window: [0.5, 4.0],
      labels_found: ["LEFT_IMAGERY", "RIGHT_IMAGERY"],
      warnings: [],
      errors: [],
    });

    render(
      <EpochSegmentor
        onRunEpoching={handleRun}
        onPreviewEpoching={handlePreview}
        isLoading={false}
      />
    );

    expect(screen.getByText("Motor-Imagery Epoch Segmentation")).toBeDefined();
    expect(screen.getByText("Synthetic Simulation")).toBeDefined();

    const runBtn = screen.getByText("Run Epoch Segmentation");
    fireEvent.click(runBtn);
    expect(handleRun).toHaveBeenCalled();
  });
});

describe("EpochVisualizer Component", () => {
  it("renders trial dropdown and epoch labels", () => {
    const handleSignal = vi.fn().mockResolvedValue(mockSignal);

    render(
      <EpochVisualizer
        records={mockRecords}
        onFetchSignal={handleSignal}
      />
    );

    expect(screen.getByText("Epoch Waveform Inspection")).toBeDefined();
    expect(screen.getByText("Cue Onset (t=0s)")).toBeDefined();
  });
});

describe("FeatureTable Component", () => {
  it("renders feature matrix data rows and handles CSV export click", () => {
    const handleCsv = vi.fn();
    const mockRows = [
      {
        trial_id: "trl_001",
        subject_id: "sub_01",
        label: "LEFT_IMAGERY",
        C3_mu_abs: 12.3456,
        C4_mu_abs: 8.7654,
        mu_lateralization_c3_c4: -0.1695,
      },
    ];

    render(
      <FeatureTable
        featureSet={mockFeatureSet}
        dataRows={mockRows}
        onDownloadCsv={handleCsv}
      />
    );

    expect(screen.getByText("Extracted Feature Matrix")).toBeDefined();
    expect(screen.getByText("trl_001")).toBeDefined();
    expect(screen.getByText("LEFT_IMAGERY")).toBeDefined();

    const downloadBtn = screen.getByText("Download CSV");
    fireEvent.click(downloadBtn);
    expect(handleCsv).toHaveBeenCalled();
  });
});

describe("CovarianceViewer Component", () => {
  it("renders covariance matrix grid and symmetry badges", () => {
    render(<CovarianceViewer covarianceSet={mockCovarianceSet} />);

    expect(screen.getByText("Spatial Covariance Representation (CSP-Ready)")).toBeDefined();
    expect(screen.getByText("Symmetric: YES")).toBeDefined();
    expect(screen.getByText("PSD: YES")).toBeDefined();
  });
});

describe("ClassDistributionCard Component", () => {
  it("renders distribution breakdown and leakage invariant badges", () => {
    render(
      <ClassDistributionCard
        epochSummary={mockSummary}
        featureSet={mockFeatureSet}
      />
    );

    expect(screen.getByText("Trial Class Distribution & Lineage")).toBeDefined();
    expect(screen.getAllByText("Preserved").length).toBe(2);
    expect(screen.getByText("Enforced")).toBeDefined();
  });
});

