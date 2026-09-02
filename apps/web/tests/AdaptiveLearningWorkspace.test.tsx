import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModelSelectorCard } from "../components/adaptation/ModelSelectorCard";
import { DataBatchPicker } from "../components/adaptation/DataBatchPicker";
import { AdaptationConfigurator } from "../components/adaptation/AdaptationConfigurator";
import { CandidateComparisonMatrix } from "../components/adaptation/CandidateComparisonMatrix";
import { PromotionPanel } from "../components/adaptation/PromotionPanel";
import { VersionChainGraph } from "../components/adaptation/VersionChainGraph";
import { DriftMonitorDashboard } from "../components/adaptation/DriftMonitorDashboard";
import {
  ModelVersion,
  AdaptationDataBatch,
  AdaptationPolicy,
  CandidateComparison,
  AdaptationRun,
  DriftObservation,
} from "@neuromove/contracts";

const mockModel: ModelVersion = {
  version_id: "ver_test_01",
  model_id: "mdl_baseline_sub-001_v1",
  parent_model_id: null,
  version_number: 1,
  scope: "SUBJECT",
  subject_id: "sub-001",
  status: "ACTIVE_RESEARCH",
  is_active: true,
  adaptation_id: null,
  model_family: "LDA",
  representation: "CSP_LOG_POWER",
  task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
  metrics: {
    accuracy: 0.85,
    balanced_accuracy: 0.85,
    f1: 0.84,
  },
  artifact_checksum_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  created_at: new Date().toISOString(),
};

const mockBatch: AdaptationDataBatch = {
  batch_id: "adb_test_batch_01",
  name: "Candidate Batch Alpha",
  subject_id: "sub-001",
  source_mode: "SIMULATION",
  trial_count: 12,
  class_distribution: { LEFT_IMAGERY: 6, RIGHT_IMAGERY: 6 },
  quality_summary: {
    total_trials: 12,
    valid_trials: 12,
    rejected_trials: 0,
    warn_trials: 0,
    valid_ratio: 1.0,
    rejection_ratio: 0.0,
    is_sufficient: true,
  },
  source_fingerprint: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
  created_at: new Date().toISOString(),
};

const mockPolicy: AdaptationPolicy = {
  policy_id: "pol_conservative_subject_v1",
  policy_version: "ADAPTATION_POLICY_V1",
  name: "Conservative Subject Adaptation Policy",
  description: "Strict regression guard",
  mode: "BATCH_ADAPTATION",
  scope: "SUBJECT",
  min_new_trials: 10,
  min_trials_per_class: 4,
  max_rejection_ratio: 0.4,
  retention_strategy: "BASELINE_PLUS_NEW",
  imbalance_policy: "WARN",
  max_allowed_regression: 0.02,
  min_promoted_balanced_accuracy: 0.6,
  min_validation_samples: 6,
  validation_strategy: "PROTECTED_HOLDOUT",
  random_state: 42,
  created_at: new Date().toISOString(),
};

const mockComparison: CandidateComparison = {
  incumbent_model_id: "mdl_baseline_sub-001_v1",
  candidate_model_id: "pmdl_adapt_test_v2",
  task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
  validation_sample_count: 10,
  incumbent_balanced_accuracy: 0.8,
  candidate_balanced_accuracy: 0.88,
  delta_balanced_accuracy: 0.08,
  incumbent_f1: 0.79,
  candidate_f1: 0.87,
  delta_f1: 0.08,
  incumbent_accuracy: 0.8,
  candidate_accuracy: 0.88,
  delta_accuracy: 0.08,
  chance_level: 0.5,
  incumbent_confusion_matrix: {
    labels: ["LEFT_IMAGERY", "RIGHT_IMAGERY"],
    matrix: [[4, 1], [1, 4]],
    normalized_matrix: [[0.8, 0.2], [0.2, 0.8]],
  },
  candidate_confusion_matrix: {
    labels: ["LEFT_IMAGERY", "RIGHT_IMAGERY"],
    matrix: [[5, 0], [1, 4]],
    normalized_matrix: [[1.0, 0.0], [0.2, 0.8]],
  },
  error_analysis: {
    fixed_errors: 1,
    new_errors: 0,
    persistent_errors: 1,
  },
  is_regression: false,
  regression_amount: 0.0,
};

describe("Phase 14 Adaptive Learning Frontend Components", () => {
  it("renders ModelSelectorCard with active model KPIs", () => {
    const handleSelect = vi.fn();
    render(
      <ModelSelectorCard
        models={[mockModel]}
        selectedModelId={mockModel.model_id}
        onSelectModel={handleSelect}
        isResearchMode={true}
      />
    );

    expect(screen.getByText("Incumbent Base Model")).toBeDefined();
    expect(screen.getByText("Active Research")).toBeDefined();
    expect(screen.getAllByText("85.0%").length).toBeGreaterThanOrEqual(1);
  });


  it("renders DataBatchPicker and toggles selection", () => {
    const handleToggle = vi.fn();
    const handleSynth = vi.fn();
    render(
      <DataBatchPicker
        batches={[mockBatch]}
        selectedBatchIds={[mockBatch.batch_id]}
        onToggleBatch={handleToggle}
        onSynthesizeBatch={handleSynth}
        isResearchMode={false}
      />
    );

    expect(screen.getByText("Candidate Batch Alpha")).toBeDefined();
    expect(screen.getByText("12 valid trials")).toBeDefined();

    fireEvent.click(screen.getByText("Candidate Batch Alpha"));
    expect(handleToggle).toHaveBeenCalledWith("adb_test_batch_01");
  });

  it("renders AdaptationConfigurator and handles retention change", () => {
    const handleSelectPol = vi.fn();
    const handleChangeRet = vi.fn();
    const handleRunPrev = vi.fn();
    const handleStart = vi.fn();

    render(
      <AdaptationConfigurator
        policies={[mockPolicy]}
        selectedPolicyId={mockPolicy.policy_id}
        onSelectPolicy={handleSelectPol}
        retentionStrategy="BASELINE_PLUS_NEW"
        onChangeRetentionStrategy={handleChangeRet}
        preview={null}
        isLoadingPreview={false}
        onRunPreview={handleRunPrev}
        onStartAdaptation={handleStart}
        isStarting={false}
        isResearchMode={true}
      />
    );

    expect(screen.getByText("Adaptation Governance & Policy")).toBeDefined();
    fireEvent.click(screen.getByText("New Data Only"));
    expect(handleChangeRet).toHaveBeenCalledWith("NEW_DATA_ONLY");
  });

  it("renders CandidateComparisonMatrix with benchmark deltas and error migration", () => {
    render(
      <CandidateComparisonMatrix
        comparison={mockComparison}
        isResearchMode={true}
      />
    );

    expect(
      screen.getByText("Incumbent vs. Candidate Benchmark Comparison")
    ).toBeDefined();
    expect(screen.getAllByText(/\+8\.0%/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("+1")).toBeDefined(); // fixed errors
    expect(screen.getByText("Performance Improved / Guard Satisfied")).toBeDefined();
  });

  it("renders PromotionPanel with deterministic checklist", () => {
    const mockRun: AdaptationRun = {
      adaptation_id: "adapt_test_01",
      base_model_id: "mdl_baseline_sub-001_v1",
      candidate_model_id: "pmdl_adapt_test_v2",
      policy_id: "pol_conservative_subject_v1",
      scope: "SUBJECT",
      subject_id: "sub-001",
      data_batch_ids: ["adb_test_batch_01"],
      status: "APPROVAL_PENDING",
      training_composition: {
        base_retained_count: 8,
        new_count: 6,
        total_count: 14,
        fingerprint: "hash_tr",
      },
      validation_composition: {
        protected_count: 8,
        fingerprint: "hash_val",
      },
      leakage_check: {
        overlap_count: 0,
        is_leakage_safe: true,
      },
      incumbent_metrics: { accuracy: 0.8, balanced_accuracy: 0.8, f1: 0.8 },
      candidate_metrics: { accuracy: 0.88, balanced_accuracy: 0.88, f1: 0.88 },
      comparison: mockComparison,
      promotion_eligibility: {
        is_eligible: true,
        criteria_results: [
          {
            criterion_name: "Zero Data Leakage Invariant",
            expected_rule: "0 overlap",
            observed_value: 0,
            passed: true,
          },
        ],
        failure_reasons: [],
      },
      started_at: new Date().toISOString(),
    };

    const handlePromote = vi.fn();
    const handleReject = vi.fn();

    render(
      <PromotionPanel
        currentRun={mockRun}
        onPromote={handlePromote}
        onReject={handleReject}
        isProcessing={false}
        isResearchMode={true}
      />
    );

    expect(screen.getByText(/Zero Data Leakage Invariant/)).toBeDefined();
    expect(
      screen.getByText("Approve & Promote to Active Research")
    ).toBeDefined();
  });


  it("renders VersionChainGraph with version nodes", () => {
    const handleRollback = vi.fn();
    render(
      <VersionChainGraph
        versions={[mockModel]}
        onRollback={handleRollback}
        isProcessing={false}
        isResearchMode={true}
      />
    );

    expect(
      screen.getByText("Model Version Lineage & Rollback Management")
    ).toBeDefined();
    expect(screen.getByText("v1")).toBeDefined();
    expect(screen.getByText("ACTIVE")).toBeDefined();
  });

  it("renders DriftMonitorDashboard with research status badge", () => {
    const mockDrift: DriftObservation = {
      observation_id: "drf_test_01",
      subject_id: "sub-001",
      dataset_id: null,
      window_label: "Window_Recent",
      feature_shift_score: 0.08,
      class_distribution_shift: 0.05,
      signal_quality_score: 0.95,
      prediction_entropy: null,
      status: "STABLE",
      thresholds: { feature_shift_threshold: 0.35, class_shift_threshold: 0.25 },
      details: {},
      created_at: new Date().toISOString(),
    };

    const handleRefresh = vi.fn();
    render(
      <DriftMonitorDashboard
        driftData={mockDrift}
        onRefreshDrift={handleRefresh}
        isRefreshing={false}
        isResearchMode={true}
      />
    );

    expect(
      screen.getByText("Electrophysiological Distribution Drift Monitor")
    ).toBeDefined();
    expect(screen.getByText("Stable (No Shift)")).toBeDefined();
  });
});
