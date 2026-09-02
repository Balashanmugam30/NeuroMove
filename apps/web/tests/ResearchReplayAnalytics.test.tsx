import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ManifestInspector,
  ReplayStageTimeline,
  ScientificMetricsPanel,
  LatencyPercentileChart,
  AblationSweepWorkspace,
  RobustnessStressTest,
  ReproducibilityAuditPanel,
  GoldenScenariosRunner,
  ArtifactExportHub,
} from "../components/research";
import {
  AblationRun,
  LatencyAnalytics,
  MetricResult,
  ReproducibilityResult,
  ReproducibilityStatus,
  ResearchArtifact,
  ResearchExperiment,
  RobustnessRun,
  StageResult,
} from "@neuromove/contracts";

const mockExperiment: ResearchExperiment = {
  experiment_id: "exp_test_01",
  title: "Motor Imagery Benchmark Test",
  description: "Reference offline evaluation benchmark",
  analysis_type: "BENCHMARK",
  status: "READY",
  replay_mode: "DETERMINISTIC_ACCELERATED",
  source_session_ids: ["sess_01"],
  dataset_id: "ds_01",
  grouping_strategy: "GROUP_BY_SUBJECT",
  manifest: {
    manifest_id: "man_01",
    experiment_id: "exp_test_01",
    app_version: "1.0.0",
    git_commit: "63c8584",
    source_session_ids: ["sess_01"],
    source_checksums: { sess_01: "chk_01" },
    channel_names: ["C3", "Cz", "C4", "Pz"],
    sampling_rate: 250,
    montage: "10_20_STANDARD",
    clock_config: {},
    qc_config: {},
    dsp_config: { lowcut: 8.0, highcut: 30.0 },
    epoch_config: {},
    feature_config: {},
    csp_config: {},
    model_id: "lda_csp_mi_v1",
    model_version: "1.0.0",
    personalization_profile: {},
    adaptation_state: {},
    confidence_policy: {},
    intent_policy: {},
    safety_policy: {},
    hil_profile: {},
    seed: 42,
    numerical_tolerances: {},
    analysis_parameters: {},
    export_version: "1.0.0",
    is_sealed: true,
    manifest_hash: "3a7b9c4d8e1f029384756abcdef1234567890abcdef1234567890abcdef123456",
    created_at: new Date().toISOString(),
    sealed_at: new Date().toISOString(),
  },
  stages: [
    {
      stage: "SOURCE",
      status: "PASSED",
      input_count: 20,
      output_count: 20,
      rejected_count: 0,
      latency_ms: 0.5,
      configuration_hash: "cfg_01",
      stage_checksum: "src_checksum_123456",
      warnings: [],
      errors: [],
      metadata: {},
      timestamp: new Date().toISOString(),
    },
    {
      stage: "ACQUISITION",
      status: "PASSED",
      input_count: 20,
      output_count: 20,
      rejected_count: 0,
      latency_ms: 1.2,
      configuration_hash: "cfg_01",
      stage_checksum: "acq_checksum_123456",
      warnings: [],
      errors: [],
      metadata: {},
      timestamp: new Date().toISOString(),
    },
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockMetrics: MetricResult = {
  metric_id: "met_01",
  experiment_id: "exp_test_01",
  accuracy: 0.92,
  balanced_accuracy: 0.915,
  precision_macro: 0.91,
  recall_macro: 0.92,
  f1_macro: 0.915,
  per_class_precision: { MOVE_FORWARD: 0.94, TURN_LEFT: 0.90 },
  per_class_recall: { MOVE_FORWARD: 0.93, TURN_LEFT: 0.91 },
  per_class_f1: { MOVE_FORWARD: 0.935, TURN_LEFT: 0.905 },
  confusion_matrix: {
    matrix_id: "cm_01",
    experiment_id: "exp_test_01",
    classes: ["MOVE_FORWARD", "TURN_LEFT"],
    matrix: [[10, 1], [1, 8]],
    normalized_matrix: [[0.91, 0.09], [0.11, 0.89]],
    total_samples: 20,
  },
  expected_calibration_error: 0.038,
  brier_score: 0.065,
  total_trials: 20,
  evaluated_trials: 20,
  rejected_trials: 0,
  rejection_rate: 0.0,
  evaluated_at: new Date().toISOString(),
};

const mockLatency: LatencyAnalytics = {
  per_stage: {
    SOURCE: { min_ms: 0.3, max_ms: 0.8, mean_ms: 0.5, median_ms: 0.5, p50_ms: 0.5, p90_ms: 0.7, p95_ms: 0.8, p99_ms: 0.8, sample_count: 20 },
    ACQUISITION: { min_ms: 1.0, max_ms: 1.5, mean_ms: 1.2, median_ms: 1.2, p50_ms: 1.2, p90_ms: 1.4, p95_ms: 1.5, p99_ms: 1.5, sample_count: 20 },
  },
  total_pipeline: {
    min_ms: 8.0,
    max_ms: 18.0,
    mean_ms: 14.0,
    median_ms: 13.8,
    p50_ms: 13.8,
    p90_ms: 16.5,
    p95_ms: 17.2,
    p99_ms: 18.0,
    sample_count: 20,
  },
};

const mockAudit: ReproducibilityResult = {
  audit_id: "aud_01",
  baseline_experiment_id: "exp_test_01",
  status: "PASS",
  source_hash_match: true,
  manifest_hash_match: true,
  stage_hashes_match: true,
  metrics_match: true,
  result_hash_match: true,
  max_metric_deviation: 0.0,
  deviations: {},
  tamper_detected: false,
  explanation: "Reproducibility PASSED: Exact byte-for-byte deterministic hash match.",
  audited_at: new Date().toISOString(),
};

describe("Phase 22 — Research Replay, Provenance & Scientific Analytics Frontend", () => {
  // 1. Manifest Inspector
  it("renders sealed manifest hash and configuration parameters", () => {
    render(<ManifestInspector experiment={mockExperiment} />);
    expect(screen.getByText("Immutable Manifest & Provenance")).toBeDefined();
    expect(screen.getByText("Sealed")).toBeDefined();
    expect(screen.getByText(/3a7b9c4d8e1f0293/)).toBeDefined();
    expect(screen.getByText("250 Hz")).toBeDefined();
  });

  it("triggers seal callback when unsealed", () => {
    const unsealedExp = {
      ...mockExperiment,
      manifest: { ...mockExperiment.manifest, is_sealed: false },
    };
    const onSeal = vi.fn();
    render(<ManifestInspector experiment={unsealedExp} onSeal={onSeal} />);
    const sealBtn = screen.getByText("Seal Manifest");
    fireEvent.click(sealBtn);
    expect(onSeal).toHaveBeenCalled();
  });

  // 2. Replay Stage Timeline
  it("renders 15-stage canonical timeline with execution badges", () => {
    render(<ReplayStageTimeline stages={mockExperiment.stages} />);
    expect(screen.getByText("15-Stage Canonical Pipeline Replay")).toBeDefined();
    expect(screen.getByText("SOURCE")).toBeDefined();
    expect(screen.getByText("ACQUISITION")).toBeDefined();
    expect(screen.getByText("HIL")).toBeDefined();
    expect(screen.getByText("2 / 15 Stages Verified")).toBeDefined();
  });

  it("selects stage when clicked on stage card", () => {
    const onSelect = vi.fn();
    render(<ReplayStageTimeline stages={mockExperiment.stages} onSelectStage={onSelect} />);
    const sourceBtn = screen.getByText("SOURCE");
    fireEvent.click(sourceBtn);
    expect(onSelect).toHaveBeenCalledWith("SOURCE");
  });

  // 3. Scientific Metrics Panel
  it("renders accuracy, F1-score, ECE calibration, and confusion matrix", () => {
    render(<ScientificMetricsPanel metrics={mockMetrics} />);
    expect(screen.getByText("Scientific Evaluation & Calibration Metrics")).toBeDefined();
    expect(screen.getByText("92.0%")).toBeDefined();
    expect(screen.getByText("0.9150")).toBeDefined();
    expect(screen.getByText("0.0380")).toBeDefined();
    expect(screen.getByText("Confusion Matrix")).toBeDefined();
  });

  it("renders empty state when metrics are absent", () => {
    render(<ScientificMetricsPanel metrics={null} />);
    expect(screen.getByText("No Evaluation Metrics Available")).toBeDefined();
  });

  // 4. Latency Percentile Chart
  it("renders latency percentiles breakdown table and summary cards", () => {
    render(<LatencyPercentileChart latency={mockLatency} />);
    expect(screen.getByText("End-to-End Pipeline Latency Percentiles")).toBeDefined();
    expect(screen.getByText("13.8 ms")).toBeDefined();
    expect(screen.getByText("16.5 ms")).toBeDefined();
    expect(screen.getByText("17.2 ms")).toBeDefined();
  });

  // 5. Ablation Studies
  it("renders ablation configuration workspace and handles launch", async () => {
    const onRunAblation = vi.fn().mockResolvedValue(undefined);
    render(<AblationSweepWorkspace experiment={mockExperiment} onRunAblation={onRunAblation} />);
    expect(screen.getByText("Controlled Ablation Studies")).toBeDefined();
    const runBtn = screen.getByText("Run Ablation Experiment");
    fireEvent.click(runBtn);
    expect(onRunAblation).toHaveBeenCalledWith("CHANNEL_DROPOUT", expect.any(Object));
  });

  it("renders ablation history records with deltas", () => {
    const mockHistory: AblationRun[] = [
      {
        ablation_id: "abl_01",
        parent_experiment_id: "exp_test_01",
        child_experiment_id: "exp_child_01",
        ablation_type: "CHANNEL_DROPOUT",
        parameter_delta: { channels: ["C3"] },
        baseline_accuracy: 0.92,
        ablated_accuracy: 0.84,
        accuracy_delta: -0.08,
        baseline_f1: 0.91,
        ablated_f1: 0.83,
        f1_delta: -0.08,
        created_at: new Date().toISOString(),
      },
    ];
    render(
      <AblationSweepWorkspace
        experiment={mockExperiment}
        onRunAblation={vi.fn()}
        ablationHistory={mockHistory}
      />
    );
    expect(screen.getByText("exp_child_01")).toBeDefined();
    expect(screen.getByText("-8.0%")).toBeDefined();
  });

  // 6. Robustness Stress Tests
  it("renders robustness perturbation sweep launcher and results", async () => {
    const onRunSweep = vi.fn().mockResolvedValue(undefined);
    const mockSweep: RobustnessRun[] = [
      {
        robustness_id: "rob_01",
        parent_experiment_id: "exp_test_01",
        perturbation_type: "ADDITIVE_NOISE",
        perturbation_level: 0.1,
        seed: 42,
        resulting_accuracy: 0.89,
        resulting_f1: 0.88,
        qc_degraded_rate: 0.1,
        rejection_rate: 0.05,
        created_at: new Date().toISOString(),
      },
    ];
    render(
      <RobustnessStressTest
        onRunSweep={onRunSweep}
        sweepResults={mockSweep}
      />
    );
    expect(screen.getByText("Systematic Robustness & Perturbation Sweeps")).toBeDefined();
    expect(screen.getByText("Level 10%")).toBeDefined();
    expect(screen.getByText("89.0%")).toBeDefined();
  });

  // 7. Reproducibility Audit Panel
  it("renders PASS status and sub-check verdicts", () => {
    render(<ReproducibilityAuditPanel audit={mockAudit} onRunAudit={vi.fn()} />);
    expect(screen.getByText("Reproducibility & Tamper Verification")).toBeDefined();
    expect(screen.getByText("PASS")).toBeDefined();
    expect(screen.getByText(/Exact byte-for-byte/)).toBeDefined();
  });

  // 8. 12 Golden Scenarios Runner
  it("renders all 12 Golden Scenarios and allows triggering individual scenario", async () => {
    const onRunScenario = vi.fn().mockResolvedValue({ passed: true, scenario: "SCENARIO_A" });
    render(<GoldenScenariosRunner onRunScenario={onRunScenario} />);
    expect(screen.getByText("12 Golden Verification Scenarios (A through L)")).toBeDefined();
    expect(screen.getByText("Scenario A — Deterministic Replay Twice")).toBeDefined();
    expect(screen.getByText("Scenario L — Parent Immutability with Multiple Children")).toBeDefined();

    const runButtons = screen.getAllByText("Run");
    fireEvent.click(runButtons[0]);
    expect(onRunScenario).toHaveBeenCalledWith("SCENARIO_A");
  });

  // 9. Artifact Export Hub
  it("renders 6 export formats and handles download click", async () => {
    const mockArt: ResearchArtifact = {
      artifact_id: "art_01",
      experiment_id: "exp_test_01",
      artifact_type: "MANIFEST_JSON",
      checksum: "chk_manifest_12345",
      file_name: "exp_test_01_manifest.json",
      content_json: "{}",
      generated_time: new Date().toISOString(),
      generator_version: "1.0.0",
    };
    const onExport = vi.fn().mockResolvedValue(mockArt);
    render(<ArtifactExportHub experimentId="exp_test_01" onExport={onExport} />);
    expect(screen.getByText("Scientific Artifact Exports & Reports")).toBeDefined();
    expect(screen.getByText("Sealed Manifest JSON")).toBeDefined();
    expect(screen.getByText("Classification Metrics CSV")).toBeDefined();
    expect(screen.getByText("Scientific Summary Markdown")).toBeDefined();

    const dlBtns = screen.getAllByText("Download");
    fireEvent.click(dlBtns[0]);
    expect(onExport).toHaveBeenCalledWith("MANIFEST_JSON");
  });

  // 10. Reproducibility FAIL and APPROXIMATE states
  it("renders FAIL status and tamper alert in reproducibility panel", () => {
    const failAudit: ReproducibilityResult = {
      ...mockAudit,
      status: "FAIL",
      tamper_detected: true,
      source_hash_match: false,
      explanation: "Reproducibility FAILED: Source dataset/session checksum mismatch detected.",
    };
    render(<ReproducibilityAuditPanel audit={failAudit} onRunAudit={vi.fn()} />);
    expect(screen.getAllByText("FAIL").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Source dataset\/session checksum mismatch/)).toBeDefined();
  });

  it("renders APPROXIMATE status in reproducibility panel", () => {
    const approxAudit: ReproducibilityResult = {
      ...mockAudit,
      status: "APPROXIMATE",
      max_metric_deviation: 0.00005,
      explanation: "Reproducibility APPROXIMATE: All metrics match within numerical tolerance.",
    };
    render(<ReproducibilityAuditPanel audit={approxAudit} onRunAudit={vi.fn()} />);
    expect(screen.getByText("APPROXIMATE")).toBeDefined();
    expect(screen.getByText("0.000050")).toBeDefined();
  });

  // 11. Empty state testing
  it("renders empty state in LatencyPercentileChart when latency is null", () => {
    render(<LatencyPercentileChart latency={null} />);
    expect(screen.getByText("No Latency Telemetry Available")).toBeDefined();
  });

  it("renders child lineage banner when parent_experiment_id is present", () => {
    const childExp: ResearchExperiment = {
      ...mockExperiment,
      parent_experiment_id: "exp_parent_reference",
    };
    render(<ManifestInspector experiment={childExp} />);
    expect(screen.getByText(/Derived from parent/)).toBeDefined();
    expect(screen.getByText("exp_parent_reference")).toBeDefined();
  });

  it("renders bandpass filter inputs in AblationSweepWorkspace", () => {
    render(<AblationSweepWorkspace experiment={mockExperiment} onRunAblation={vi.fn()} />);
    const select = screen.getByDisplayValue("Channel Montage Reduction");
    fireEvent.change(select, { target: { value: "BANDPASS_FILTER" } });
    expect(screen.getByText("Bandpass Range (Hz)")).toBeDefined();
  });

  it("handles Run All 12 Scenarios button click", async () => {
    const onRunScenario = vi.fn().mockResolvedValue({ passed: true });
    render(<GoldenScenariosRunner onRunScenario={onRunScenario} />);
    const runAllBtn = screen.getByText("Run All 12 Scenarios");
    fireEvent.click(runAllBtn);
    expect(onRunScenario).toHaveBeenCalled();
  });

  it("handles amplitude gain scaling in RobustnessStressTest", () => {
    render(<RobustnessStressTest onRunSweep={vi.fn()} />);
    const select = screen.getByDisplayValue("Gaussian Additive Noise (0.1–1.0x)");
    fireEvent.change(select, { target: { value: "AMPLITUDE_SCALING" } });
    expect(screen.getByDisplayValue("Amplitude Gain Scaling (1.1–2.0x)")).toBeDefined();
  });
});
