import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchConfigurator } from "../components/lab/SearchConfigurator";
import { SearchCandidateTable } from "../components/lab/SearchCandidateTable";
import { ErrorAnalysisTable } from "../components/lab/ErrorAnalysisTable";
import { ModelComparisonTable } from "../components/lab/ModelComparisonTable";
import { AblationStudyView } from "../components/lab/AblationStudyView";
import { ModelCardViewer } from "../components/lab/ModelCardViewer";
import {
  SearchConfig,
  SearchCandidateResult,
  ErrorAnalysisResult,
  ModelComparisonResult,
  AblationStudyResult,
  ModelCard,
} from "@neuromove/contracts";

describe("Phase 12: AI Model Laboratory Frontend Test Suite", () => {
  describe("SearchConfigurator Component", () => {
    it("renders search mode options and triggers onChange on mode change", () => {
      const initialConfig: SearchConfig = {
        search_type: "NONE",
        param_grid: {},
        scoring: "balanced_accuracy",
        inner_cv_splits: 3,
        n_iter: 10,
      };

      const handleChange = vi.fn();
      render(
        <SearchConfigurator
          modelFamily="SVM_LINEAR"
          config={initialConfig}
          onChange={handleChange}
        />
      );

      expect(screen.getByText("Inner CV Hyperparameter Search")).toBeInTheDocument();
      expect(screen.getByText("Fixed Baseline")).toBeInTheDocument();
      expect(screen.getByText("Grid Search")).toBeInTheDocument();
      expect(screen.getByText("Random Search")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Grid Search"));
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          search_type: "GRID",
        })
      );
    });
  });

  describe("SearchCandidateTable Component", () => {
    it("renders candidate ranks, parameters, and selected winner badge", () => {
      const mockCandidates: SearchCandidateResult[] = [
        {
          candidate_id: "cand_001",
          parameters: { c_param: 1.0 },
          mean_inner_score: 0.85,
          std_inner_score: 0.04,
          rank: 1,
        },
        {
          candidate_id: "cand_002",
          parameters: { c_param: 0.1 },
          mean_inner_score: 0.75,
          std_inner_score: 0.06,
          rank: 2,
        },
      ];

      render(<SearchCandidateTable candidates={mockCandidates} />);

      expect(screen.getByText("cand_001")).toBeInTheDocument();
      expect(screen.getByText("85.0%")).toBeInTheDocument();
      expect(screen.getByText("Selected")).toBeInTheDocument();
      expect(screen.getByText("cand_002")).toBeInTheDocument();
      expect(screen.getByText("75.0%")).toBeInTheDocument();
    });
  });

  describe("ErrorAnalysisTable Component", () => {
    it("renders error summary metrics, confused pairs, and difficult subjects", () => {
      const mockAnalysis: ErrorAnalysisResult = {
        total_errors: 12,
        overall_error_rate: 0.2,
        most_confused_pairs: [
          {
            true_label: "LEFT_IMAGERY",
            predicted_label: "RIGHT_IMAGERY",
            count: 12,
          },
        ],
        difficult_subjects: [
          {
            subject_id: "sub_02",
            error_rate: 0.45,
            total_samples: 20,
            z_score: 1.45,
          },
        ],
        difficult_sessions: [
          {
            subject_id: "sub_02",
            session_id: "session_01",
            error_rate: 0.5,
            total_samples: 10,
          },
        ],
        misclassified_epoch_ids: ["ep_001", "ep_002"],
      };

      render(<ErrorAnalysisTable analysis={mockAnalysis} />);

      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText("20.0%")).toBeInTheDocument();
      expect(screen.getByText("LEFT_IMAGERY")).toBeInTheDocument();
      expect(screen.getByText("RIGHT_IMAGERY")).toBeInTheDocument();
      expect(screen.getAllByText("sub_02").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("z = +1.45")).toBeInTheDocument();
    });

  });

  describe("ModelComparisonTable Component", () => {
    it("renders comparison matrix with side-by-side metrics", () => {
      const mockComparison: ModelComparisonResult = {
        comparison_id: "cmp_001",
        comparison_name: "LDA vs Linear SVM",
        common_task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
        common_protocol: "LEAVE_ONE_SUBJECT_OUT",
        common_dataset_id: "synthetic_sim_v1",
        entries: [
          {
            experiment_id: "exp_lda_001",
            model_family: "LDA",
            representation: "CSP_LOG_POWER",
            parameters: {},
            metrics: {
              accuracy: { mean: 0.85, std: 0.05, median: 0.85, min: 0.7, max: 0.9 },
              balanced_accuracy: { mean: 0.82, std: 0.05, median: 0.82, min: 0.7, max: 0.9 },
              precision: { mean: 0.82, std: 0.05, median: 0.82, min: 0.7, max: 0.9 },
              recall: { mean: 0.82, std: 0.05, median: 0.82, min: 0.7, max: 0.9 },
              f1: { mean: 0.79, std: 0.05, median: 0.79, min: 0.7, max: 0.9 },
              chance_level: 0.5,
              class_distribution: { LEFT_IMAGERY: 30, RIGHT_IMAGERY: 30 },
              confusion_matrix: {
                labels: ["LEFT_IMAGERY", "RIGHT_IMAGERY"],
                matrix: [[24, 6], [6, 24]],
                normalized_matrix: [[0.8, 0.2], [0.2, 0.8]],
              },
              per_subject_metrics: [],
              per_fold_results: [],
            },
          },
        ],
        created_at: new Date().toISOString(),
      };

      render(<ModelComparisonTable comparison={mockComparison} />);

      expect(screen.getByText("LDA vs Linear SVM")).toBeInTheDocument();
      expect(screen.getByText("LDA")).toBeInTheDocument();
      expect(screen.getByText("82.0%")).toBeInTheDocument();
      expect(screen.getByText("79.0%")).toBeInTheDocument();
      expect(screen.getByText("85.0%")).toBeInTheDocument();
    });

  });

  describe("AblationStudyView Component", () => {
    it("renders ablation runner and variant deltas", () => {
      const mockAblation: AblationStudyResult = {
        ablation_id: "abl_001",
        name: "Ablation Study: CSP_COMPONENTS",
        ablation_variable: "CSP_COMPONENTS",
        baseline_experiment_id: "exp_001",
        baseline_metrics: {
          accuracy: { mean: 0.8, std: 0.05, median: 0.8, min: 0.7, max: 0.9 },
          balanced_accuracy: { mean: 0.8, std: 0.05, median: 0.8, min: 0.7, max: 0.9 },
          precision: { mean: 0.8, std: 0.05, median: 0.8, min: 0.7, max: 0.9 },
          recall: { mean: 0.8, std: 0.05, median: 0.8, min: 0.7, max: 0.9 },
          f1: { mean: 0.8, std: 0.05, median: 0.8, min: 0.7, max: 0.9 },
          chance_level: 0.5,
          class_distribution: { LEFT_IMAGERY: 30, RIGHT_IMAGERY: 30 },
          confusion_matrix: {
            labels: ["LEFT_IMAGERY", "RIGHT_IMAGERY"],
            matrix: [[24, 6], [6, 24]],
            normalized_matrix: [[0.8, 0.2], [0.2, 0.8]],
          },
          per_subject_metrics: [],
          per_fold_results: [],
        },
        variants: [
          {
            variant_name: "CSP_2_components",
            param_value: 2,
            metrics: {
              accuracy: { mean: 0.85, std: 0.04, median: 0.85, min: 0.8, max: 0.9 },
              balanced_accuracy: { mean: 0.85, std: 0.04, median: 0.85, min: 0.8, max: 0.9 },
              precision: { mean: 0.85, std: 0.04, median: 0.85, min: 0.8, max: 0.9 },
              recall: { mean: 0.85, std: 0.04, median: 0.85, min: 0.8, max: 0.9 },
              f1: { mean: 0.85, std: 0.04, median: 0.85, min: 0.8, max: 0.9 },
              chance_level: 0.5,
              class_distribution: {},
              confusion_matrix: { labels: [], matrix: [], normalized_matrix: [] },
              per_subject_metrics: [],
              per_fold_results: [],
            },
            delta_balanced_accuracy: 0.05,
            delta_f1: 0.03,
            experiment_id: "exp_v1",
          },
        ],
        created_at: new Date().toISOString(),
      };

      const handleRun = vi.fn();
      render(
        <AblationStudyView
          ablationResult={mockAblation}
          onRunAblation={handleRun}
          isSubmitting={false}
        />
      );

      expect(screen.getByText("Controlled Variable Ablation")).toBeInTheDocument();
      expect(screen.getByText("Ablation Study: CSP_COMPONENTS")).toBeInTheDocument();
      expect(screen.getByText("CSP_2_components")).toBeInTheDocument();
      expect(screen.getByText("+5.0%")).toBeInTheDocument();
      expect(screen.getByText("+3.0%")).toBeInTheDocument();
    });

  });

  describe("ModelCardViewer Component", () => {
    it("renders model card structured summary and SHA-256 provenance checksum", () => {
      const mockCard: ModelCard = {
        model_id: "mdl_exp_001",
        experiment_id: "exp_001",
        intended_use: "Offline research motor imagery intention decoding benchmark.",
        training_data_summary: "Evaluated across 3 subjects (60 trials).",
        task: {
          task_id: "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
          task_name: "Left Hand vs Right Hand Motor Imagery",
          description: "Binary sensorimotor decoding.",
          class_labels: ["LEFT_IMAGERY", "RIGHT_IMAGERY"],
          label_mapping: { LEFT_IMAGERY: 0, RIGHT_IMAGERY: 1 },
          version: "1.0.0",
        },
        feature_representation: "CSP_LOG_POWER",
        model_family: "LDA",
        validation_protocol: "LEAVE_ONE_SUBJECT_OUT (INTER_SUBJECT)",
        metrics_summary: {
          balanced_accuracy_mean: 0.82,
          balanced_accuracy_std: 0.04,
          accuracy_mean: 0.85,
          accuracy_std: 0.03,
          f1_mean: 0.81,
          f1_std: 0.04,
          chance_level: 0.5,
        },
        known_limitations: ["Evaluated on offline recorded EEG."],
        failure_modes: ["Impedance spikes."],
        provenance_chain: {},
        software_versions: { mne: "1.9.0", scikit_learn: "1.6.0" },
        artifact_checksum_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        markdown_content: "# Model Card: mdl_exp_001\n\nProvenanced Model Artifact.",
        created_at: new Date().toISOString(),
      };

      render(<ModelCardViewer modelCard={mockCard} />);

      expect(screen.getByText("mdl_exp_001")).toBeInTheDocument();
      expect(
        screen.getByText("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
      ).toBeInTheDocument();
      expect(screen.getByText("82.0%")).toBeInTheDocument();
      expect(screen.getByText("85.0%")).toBeInTheDocument();
      expect(screen.getByText("81.0%")).toBeInTheDocument();
    });

  });
});
