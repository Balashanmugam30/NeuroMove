import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskSelector } from "../components/models/TaskSelector";
import { PipelineConfigurator } from "../components/models/PipelineConfigurator";
import { BenchmarkRunner } from "../components/models/BenchmarkRunner";
import { MetricsCard } from "../components/models/MetricsCard";
import { ConfusionMatrixViewer } from "../components/models/ConfusionMatrixViewer";
import { PerSubjectBarChart } from "../components/models/PerSubjectBarChart";
import { CSPPatternViewer } from "../components/models/CSPPatternViewer";
import { ModelRegistryTable } from "../components/models/ModelRegistryTable";
import { ModelDetailDrawer } from "../components/models/ModelDetailDrawer";
import {
  ClassificationTask,
  DecoderPipelineConfig,
  BenchmarkPreview,
  ClassificationMetrics,
  CSPPatternData,
  ModelSummary,
  ModelManifest,
} from "@neuromove/contracts";

const mockTasks: ClassificationTask[] = [
  {
    task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
    task_name: "Left Hand vs Right Hand Motor Imagery",
    description: "Binary sensorimotor rhythm decoding for contralateral motor cortex activation.",
    class_labels: ["LEFT_IMAGERY", "RIGHT_IMAGERY"],
    label_mapping: { LEFT_IMAGERY: 0, RIGHT_IMAGERY: 1 },
    version: "1.0.0",
  },
  {
    task_id: "FEET_VS_FISTS_V1",
    task_name: "Feet vs Bilateral Fists Motor Imagery",
    description: "Sagittal vs lateral sensorimotor rhythm modulation.",
    class_labels: ["FEET_IMAGERY", "BOTH_FISTS_IMAGERY"],
    label_mapping: { FEET_IMAGERY: 0, BOTH_FISTS_IMAGERY: 1 },
    version: "1.0.0",
  },
];

const mockConfig: DecoderPipelineConfig = {
  pipeline_version: "DECODER_PIPELINE_V1",
  task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
  epoch_set_id: "ep_test_01",
  channels: ["Fc5", "C3", "Cz", "C4"],
  csp_config: {
    csp_version: "MNE_CSP_V1",
    n_components: 4,
    cov_est: "concat",
    log: true,
    norm_trace: false,
    regularization: null,
    component_order: "mutual_info",
    transform_into: "average_power",
  },
  classifier_config: {
    classifier_id: "lda_1",
    classifier_type: "LDA",
    solver: "svd",
    shrinkage: null,
    kernel: "linear",
    c_param: 1.0,
    gamma: "scale",
    dummy_strategy: "prior",
    random_state: 42,
    version: "1.0.0",
  },
  evaluation_protocol: "LEAVE_ONE_SUBJECT_OUT",
  evaluation_mode: "INTER_SUBJECT",
  n_splits: 5,
  scale_features: false,
  random_state: 42,
};

const mockMetrics: ClassificationMetrics = {
  accuracy: { mean: 0.88, std: 0.04, median: 0.88, min: 0.82, max: 0.94 },
  balanced_accuracy: { mean: 0.875, std: 0.035, median: 0.875, min: 0.82, max: 0.94 },
  precision: { mean: 0.89, std: 0.04, median: 0.89, min: 0.83, max: 0.95 },
  recall: { mean: 0.88, std: 0.04, median: 0.88, min: 0.82, max: 0.94 },
  f1: { mean: 0.88, std: 0.04, median: 0.88, min: 0.82, max: 0.94 },
  chance_level: 0.5,
  class_distribution: { LEFT_IMAGERY: 20, RIGHT_IMAGERY: 20 },
  confusion_matrix: {
    labels: ["LEFT_IMAGERY", "RIGHT_IMAGERY"],
    matrix: [
      [18, 2],
      [3, 17],
    ],
    normalized_matrix: [
      [0.9, 0.1],
      [0.15, 0.85],
    ],
  },
  per_subject_metrics: [
    { subject_id: "sub_01", epoch_count: 14, accuracy: 0.92, balanced_accuracy: 0.92, f1: 0.92 },
    { subject_id: "sub_02", epoch_count: 13, accuracy: 0.85, balanced_accuracy: 0.85, f1: 0.85 },
    { subject_id: "sub_03", epoch_count: 13, accuracy: 0.85, balanced_accuracy: 0.85, f1: 0.85 },
  ],
  per_fold_results: [
    {
      fold_id: 1,
      train_subjects: ["sub_02", "sub_03"],
      test_subjects: ["sub_01"],
      train_epochs: 26,
      test_epochs: 14,
      accuracy: 0.92,
      balanced_accuracy: 0.92,
      precision: 0.92,
      recall: 0.92,
      f1: 0.92,
      confusion_matrix: {
        labels: ["LEFT_IMAGERY", "RIGHT_IMAGERY"],
        matrix: [[7, 0], [1, 6]],
        normalized_matrix: [[1.0, 0.0], [0.14, 0.86]],
      },
    },
  ],
};

const mockPatterns: CSPPatternData = {
  channels: ["Fc5", "C3", "Cz", "C4"],
  n_components: 2,
  patterns: [
    [0.72, 0.65, -0.12, -0.68],
    [-0.12, -0.68, 0.05, 0.79],
  ],
  filters: [
    [0.55, 0.48, -0.09, -0.52],
    [-0.09, -0.52, 0.04, 0.61],
  ],
  eigenvalues: [0.82, 0.18],
};

const mockModelSummaries: ModelSummary[] = [
  {
    model_id: "mdl_csp_lda_1234abcd",
    task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
    dataset_id: "physionet_motor_imagery",
    source_epoch_set_id: "ep_test_01",
    classifier_type: "LDA",
    n_components: 4,
    evaluation_protocol: "LEAVE_ONE_SUBJECT_OUT",
    accuracy_mean: 0.88,
    balanced_accuracy_mean: 0.875,
    f1_mean: 0.88,
    status: "ACTIVE_RESEARCH",
    artifact_file_path: "models/classical/mdl_csp_lda_1234abcd.joblib",
    artifact_checksum_sha256: "fedcba9876543210",
    created_at: "2026-09-01T00:00:00Z",
  },
];

const mockManifest: ModelManifest = {
  model_id: "mdl_csp_lda_1234abcd",
  pipeline_version: "DECODER_PIPELINE_V1",
  task: mockTasks[0],
  dataset_id: "physionet_motor_imagery",
  source_epoch_set_id: "ep_test_01",
  subjects: ["sub_01", "sub_02", "sub_03"],
  channels: ["Fc5", "C3", "Cz", "C4"],
  sampling_rate_hz: 250.0,
  csp_config: mockConfig.csp_config,
  classifier_config: mockConfig.classifier_config,
  evaluation_protocol: "LEAVE_ONE_SUBJECT_OUT",
  evaluation_mode: "INTER_SUBJECT",
  metrics: mockMetrics,
  csp_patterns: mockPatterns,
  artifact_file_path: "models/classical/mdl_csp_lda_1234abcd.joblib",
  artifact_checksum_sha256: "fedcba987654321012345678abcdef01",
  config_hash: "1234abcd5678",
  status: "ACTIVE_RESEARCH",
  software_versions: {
    mne: "1.12.1",
    scikit_learn: "1.9.0",
    numpy: "2.2.0",
  },
  created_at: "2026-09-01T00:00:00Z",
};

describe("Phase 11 Classical Decoding UI Components", () => {
  it("renders TaskSelector and handles selection", () => {
    const onSelect = vi.fn();
    render(
      <TaskSelector
        tasks={mockTasks}
        selectedTaskId="LEFT_VS_RIGHT_MOTOR_IMAGERY_V1"
        onSelectTask={onSelect}
      />
    );

    expect(screen.getByText("Left Hand vs Right Hand Motor Imagery")).toBeDefined();
    expect(screen.getByText("Feet vs Bilateral Fists Motor Imagery")).toBeDefined();

    fireEvent.click(screen.getByText("Feet vs Bilateral Fists Motor Imagery"));
    expect(onSelect).toHaveBeenCalledWith("FEET_VS_FISTS_V1");
  });

  it("renders PipelineConfigurator and updates hyperparameters", () => {
    const onChange = vi.fn();
    render(
      <PipelineConfigurator
        config={mockConfig}
        onChange={onChange}
        availableEpochSets={[
          { epoch_set_id: "ep_test_01", total_events: 40, source_kind: "RECORDED" },
        ]}
      />
    );

    expect(screen.getByText("2. Pipeline Hyperparameters & Cross-Validation")).toBeDefined();
    // Click CSP component button 6
    fireEvent.click(screen.getByText("6"));
    expect(onChange).toHaveBeenCalled();
  });

  it("renders BenchmarkRunner with preview statistics", () => {
    const preview: BenchmarkPreview = {
      valid: true,
      task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
      epoch_set_id: "ep_test_01",
      total_epochs: 50,
      eligible_epochs: 40,
      excluded_epochs: 10,
      class_distribution: { LEFT_IMAGERY: 20, RIGHT_IMAGERY: 20 },
      subjects_found: ["sub_01", "sub_02"],
      subject_count: 2,
      channels: ["C3", "Cz", "C4"],
      sampling_rate_hz: 250,
      protocol: "LEAVE_ONE_SUBJECT_OUT",
      expected_folds: 2,
      warnings: [],
      errors: [],
    };
    const onRun = vi.fn();

    render(
      <BenchmarkRunner
        preview={preview}
        isRunning={false}
        onRunBenchmark={onRun}
      />
    );

    expect(screen.getByText("40 / 50")).toBeDefined();
    expect(screen.getByText("10 (rest/unmapped)")).toBeDefined();

    const runBtn = screen.getByRole("button", { name: /Run Benchmark/i });
    fireEvent.click(runBtn);
    expect(onRun).toHaveBeenCalled();
  });

  it("renders MetricsCard with statistical breakdown", () => {
    render(
      <MetricsCard
        metrics={mockMetrics}
        taskName="Left Hand vs Right Hand"
        classifierName="LDA (4 CSP)"
      />
    );

    expect(screen.getByText("87.5%")).toBeDefined();
    expect(screen.getAllByText("88.0%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Chance Level: 50.0%")).toBeDefined();

  });

  it("renders ConfusionMatrixViewer and toggles normalization", () => {
    render(<ConfusionMatrixViewer data={mockMetrics.confusion_matrix} />);

    expect(screen.getByText("Aggregate Confusion Matrix")).toBeDefined();
    expect(screen.getByText("18")).toBeDefined();

    const normBtn = screen.getByRole("button", { name: /Normalized \(%\)/i });
    fireEvent.click(normBtn);
    expect(screen.getByText("90.0%")).toBeDefined();
  });

  it("renders PerSubjectBarChart with subject bars and chance line", () => {
    render(
      <PerSubjectBarChart
        data={mockMetrics.per_subject_metrics}
        chanceLevel={0.5}
      />
    );

    expect(screen.getByText("sub_01")).toBeDefined();
    expect(screen.getByText("sub_02")).toBeDefined();
    expect(screen.getByText("92.0% bal acc (92.0% raw)")).toBeDefined();
  });

  it("renders CSPPatternViewer with spatial weights", () => {
    render(<CSPPatternViewer patterns={mockPatterns} />);

    expect(screen.getByText("CSP Component #1")).toBeDefined();
    expect(screen.getAllByText("Fc5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("0.720")).toBeDefined();
  });


  it("renders ModelRegistryTable and triggers manifest inspection", () => {
    const onSelect = vi.fn();
    render(
      <ModelRegistryTable
        models={mockModelSummaries}
        onSelectModel={onSelect}
      />
    );

    expect(screen.getByText("mdl_csp_lda_1234abcd")).toBeDefined();
    const manifestBtn = screen.getByRole("button", { name: /Manifest/i });
    fireEvent.click(manifestBtn);
    expect(onSelect).toHaveBeenCalledWith("mdl_csp_lda_1234abcd");
  });

  it("renders ModelDetailDrawer with cryptographic checksum and software stack", () => {
    const onClose = vi.fn();
    render(<ModelDetailDrawer manifest={mockManifest} onClose={onClose} />);

    expect(screen.getByText("Model Provenance & Lineage")).toBeDefined();
    expect(screen.getByText(/SHA-256: fedcba987654321012345678abcdef01/)).toBeDefined();
    expect(screen.getByText("1.12.1")).toBeDefined();
  });
});
