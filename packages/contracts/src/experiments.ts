import { z } from "zod";
import {
  ClassificationTaskSchema,
  CSPConfigSchema,
  ClassificationMetricsSchema,
  EvaluationProtocolSchema,
  EvaluationModeSchema,
} from "./decoding";

// 1. Core Enumerations
export const ModelFamilySchema = z.enum([
  "DUMMY",
  "LDA",
  "SVM_LINEAR",
  "SVM_RBF",
  "LOGISTIC_REGRESSION",
  "RANDOM_FOREST",
]);
export type ModelFamily = z.infer<typeof ModelFamilySchema>;

export const FeatureRepresentationSchema = z.enum([
  "CSP_LOG_POWER",
  "BAND_POWER",
  "LOG_BAND_POWER",
  "COVARIANCE",
]);
export type FeatureRepresentation = z.infer<typeof FeatureRepresentationSchema>;

export const SearchTypeSchema = z.enum(["NONE", "GRID", "RANDOM"]);
export type SearchType = z.infer<typeof SearchTypeSchema>;

export const ExperimentStatusSchema = z.enum([
  "DRAFT",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "ARCHIVED",
]);
export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>;

export const ExperimentStageSchema = z.enum([
  "VALIDATING_DATA",
  "BUILDING_FOLDS",
  "SEARCHING",
  "FITTING",
  "EVALUATING",
  "ANALYZING",
  "PERSISTING",
  "COMPLETE",
]);
export type ExperimentStage = z.infer<typeof ExperimentStageSchema>;

// 2. Hyperparameter Search Schemas
export const SearchConfigSchema = z.object({
  search_type: SearchTypeSchema.default("NONE"),
  n_iter: z.number().int().positive().default(10),
  param_grid: z.record(z.string(), z.array(z.any())).default({}),
  scoring: z.string().default("balanced_accuracy"),
  inner_cv_splits: z.number().int().min(2).default(3),
});
export type SearchConfig = z.infer<typeof SearchConfigSchema>;

export const SearchCandidateResultSchema = z.object({
  candidate_id: z.string(),
  parameters: z.record(z.string(), z.any()),
  mean_inner_score: z.number(),
  std_inner_score: z.number(),
  rank: z.number().int().positive(),
});
export type SearchCandidateResult = z.infer<typeof SearchCandidateResultSchema>;

export const SearchResultSchema = z.object({
  search_type: SearchTypeSchema,
  total_candidates: z.number().int().nonnegative(),
  best_parameters: z.record(z.string(), z.any()),
  best_inner_score: z.number(),
  candidates: z.array(SearchCandidateResultSchema),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

// 3. Fold Assignment Schema
export const FoldAssignmentSchema = z.object({
  fold_id: z.number().int().positive(),
  train_subjects: z.array(z.string()),
  test_subjects: z.array(z.string()),
  train_epoch_count: z.number().int().nonnegative(),
  test_epoch_count: z.number().int().nonnegative(),
  train_class_counts: z.record(z.string(), z.number().int().nonnegative()),
  test_class_counts: z.record(z.string(), z.number().int().nonnegative()),
  fold_hash: z.string(),
  inner_search_result: SearchResultSchema.nullable().optional(),
});
export type FoldAssignment = z.infer<typeof FoldAssignmentSchema>;

// 4. Out-of-Fold Prediction Schemas
export const OutOfFoldPredictionRecordSchema = z.object({
  epoch_id: z.string(),
  subject_id: z.string(),
  session_id: z.string().default("session_01"),
  run_id: z.string().default("run_01"),
  true_label: z.string(),
  predicted_label: z.string(),
  is_correct: z.boolean(),
  decision_score: z.number().nullable().default(null),
  probability_vector: z.record(z.string(), z.number()).nullable().default(null),
  fold_id: z.number().int().positive(),
  model_id: z.string(),
  experiment_id: z.string(),
});
export type OutOfFoldPredictionRecord = z.infer<typeof OutOfFoldPredictionRecordSchema>;

export const OutOfFoldPredictionSetSchema = z.object({
  experiment_id: z.string(),
  total_predictions: z.number().int().nonnegative(),
  coverage_percentage: z.number().min(0).max(100),
  predictions: z.array(OutOfFoldPredictionRecordSchema),
});
export type OutOfFoldPredictionSet = z.infer<typeof OutOfFoldPredictionSetSchema>;

// 5. Per-Session Metrics Schema
export const PerSessionMetricSchema = z.object({
  subject_id: z.string(),
  session_id: z.string(),
  epoch_count: z.number().int().positive(),
  accuracy: z.number().min(0).max(1),
  balanced_accuracy: z.number().min(0).max(1),
  f1: z.number().min(0).max(1),
});
export type PerSessionMetric = z.infer<typeof PerSessionMetricSchema>;

// 6. Error Analysis Schema
export const ConfusedClassPairSchema = z.object({
  true_label: z.string(),
  predicted_label: z.string(),
  count: z.number().int().nonnegative(),
});
export type ConfusedClassPair = z.infer<typeof ConfusedClassPairSchema>;

export const DifficultSubjectSchema = z.object({
  subject_id: z.string(),
  error_rate: z.number().min(0).max(1),
  total_samples: z.number().int().positive(),
  z_score: z.number(),
});
export type DifficultSubject = z.infer<typeof DifficultSubjectSchema>;

export const DifficultSessionSchema = z.object({
  subject_id: z.string(),
  session_id: z.string(),
  error_rate: z.number().min(0).max(1),
  total_samples: z.number().int().positive(),
});
export type DifficultSession = z.infer<typeof DifficultSessionSchema>;

export const ErrorAnalysisResultSchema = z.object({
  total_errors: z.number().int().nonnegative(),
  overall_error_rate: z.number().min(0).max(1),
  most_confused_pairs: z.array(ConfusedClassPairSchema),
  difficult_subjects: z.array(DifficultSubjectSchema),
  difficult_sessions: z.array(DifficultSessionSchema),
  misclassified_epoch_ids: z.array(z.string()),
});
export type ErrorAnalysisResult = z.infer<typeof ErrorAnalysisResultSchema>;

// 7. Canonical Experiment Configuration Schema
export const ExperimentConfigSchema = z.object({
  experiment_version: z.literal("AI_EXPERIMENT_V1").default("AI_EXPERIMENT_V1"),
  dataset_id: z.string(),
  epoch_set_id: z.string(),
  task_id: z.string().default("LEFT_VS_RIGHT_MOTOR_IMAGERY_V1"),
  representation: FeatureRepresentationSchema.default("CSP_LOG_POWER"),
  model_family: ModelFamilySchema.default("LDA"),
  model_config: z.record(z.string(), z.any()).default({}),
  csp_config: CSPConfigSchema.default({
    csp_version: "MNE_CSP_V1",
    n_components: 4,
    cov_est: "concat",
    log: true,
    norm_trace: false,
    regularization: null,
    component_order: "mutual_info",
    transform_into: "average_power",
  }),
  evaluation_protocol: EvaluationProtocolSchema.default("LEAVE_ONE_SUBJECT_OUT"),
  evaluation_mode: EvaluationModeSchema.default("INTER_SUBJECT"),
  n_splits: z.number().int().min(2).default(5),
  scale_features: z.boolean().default(false),
  search_config: SearchConfigSchema.default({
    search_type: "NONE",
    n_iter: 10,
    param_grid: {},
    scoring: "balanced_accuracy",
    inner_cv_splits: 3,
  }),
  channels: z.array(z.string()).default([]),
  random_state: z.number().int().default(42),
});
export type ExperimentConfig = z.infer<typeof ExperimentConfigSchema>;

// 8. Ablation Study Schemas
export const AblationVariantConfigSchema = z.object({
  variant_name: z.string(),
  param_value: z.any(),
  config: ExperimentConfigSchema,
});
export type AblationVariantConfig = z.infer<typeof AblationVariantConfigSchema>;

export const AblationConfigSchema = z.object({
  ablation_id: z.string(),
  name: z.string(),
  description: z.string(),
  baseline_experiment_config: ExperimentConfigSchema,
  ablation_variable: z.string(),
  variants: z.array(AblationVariantConfigSchema),
});
export type AblationConfig = z.infer<typeof AblationConfigSchema>;

export const AblationVariantResultSchema = z.object({
  variant_name: z.string(),
  param_value: z.any(),
  metrics: ClassificationMetricsSchema,
  delta_balanced_accuracy: z.number(),
  delta_f1: z.number(),
  experiment_id: z.string(),
});
export type AblationVariantResult = z.infer<typeof AblationVariantResultSchema>;

export const AblationStudyResultSchema = z.object({
  ablation_id: z.string(),
  name: z.string(),
  ablation_variable: z.string(),
  baseline_experiment_id: z.string(),
  baseline_metrics: ClassificationMetricsSchema,
  variants: z.array(AblationVariantResultSchema),
  created_at: z.string(),
});
export type AblationStudyResult = z.infer<typeof AblationStudyResultSchema>;

// 9. Model Card Schema
export const ModelCardSchema = z.object({
  model_id: z.string(),
  experiment_id: z.string(),
  intended_use: z.string(),
  training_data_summary: z.string(),
  task: ClassificationTaskSchema,
  feature_representation: FeatureRepresentationSchema,
  model_family: ModelFamilySchema,
  validation_protocol: z.string(),
  metrics_summary: z.record(z.string(), z.number()),
  known_limitations: z.array(z.string()),
  failure_modes: z.array(z.string()),
  provenance_chain: z.record(z.string(), z.any()),
  software_versions: z.record(z.string(), z.string()),
  artifact_checksum_sha256: z.string(),
  markdown_content: z.string(),
  created_at: z.string(),
});
export type ModelCard = z.infer<typeof ModelCardSchema>;

// 10. Model Comparison Schemas
export const ModelComparisonRequestSchema = z.object({
  comparison_name: z.string().default("Model Benchmark Comparison"),
  experiment_ids: z.array(z.string()).min(2),
});
export type ModelComparisonRequest = z.infer<typeof ModelComparisonRequestSchema>;

export const ModelComparisonEntrySchema = z.object({
  experiment_id: z.string(),
  model_family: ModelFamilySchema,
  representation: FeatureRepresentationSchema,
  parameters: z.record(z.string(), z.any()),
  metrics: ClassificationMetricsSchema,
});
export type ModelComparisonEntry = z.infer<typeof ModelComparisonEntrySchema>;

export const ModelComparisonResultSchema = z.object({
  comparison_id: z.string(),
  comparison_name: z.string(),
  common_task_id: z.string(),
  common_protocol: z.string(),
  common_dataset_id: z.string(),
  entries: z.array(ModelComparisonEntrySchema),
  created_at: z.string(),
});
export type ModelComparisonResult = z.infer<typeof ModelComparisonResultSchema>;

// 11. Experiment Run & Summary Schemas
export const ExperimentRunSchema = z.object({
  run_id: z.string(),
  experiment_id: z.string(),
  stage: ExperimentStageSchema,
  progress: z.number().min(0).max(100),
  status: ExperimentStatusSchema,
  error_message: z.string().nullable().default(null),
  started_at: z.string(),
  completed_at: z.string().nullable().default(null),
});
export type ExperimentRun = z.infer<typeof ExperimentRunSchema>;

export const ExperimentSummarySchema = z.object({
  experiment_id: z.string(),
  dataset_id: z.string(),
  epoch_set_id: z.string(),
  task_id: z.string(),
  model_family: ModelFamilySchema,
  representation: FeatureRepresentationSchema,
  evaluation_protocol: EvaluationProtocolSchema,
  balanced_accuracy_mean: z.number(),
  f1_mean: z.number(),
  accuracy_mean: z.number(),
  status: ExperimentStatusSchema,
  has_search: z.boolean(),
  created_at: z.string(),
});
export type ExperimentSummary = z.infer<typeof ExperimentSummarySchema>;

export const ExperimentPreviewSchema = z.object({
  valid: z.boolean(),
  experiment_id: z.string(),
  dataset_id: z.string(),
  epoch_set_id: z.string(),
  task_id: z.string(),
  representation: FeatureRepresentationSchema,
  model_family: ModelFamilySchema,
  total_epochs: z.number().int().nonnegative(),
  eligible_epochs: z.number().int().nonnegative(),
  excluded_epochs: z.number().int().nonnegative(),
  class_distribution: z.record(z.string(), z.number().int().nonnegative()),
  subjects: z.array(z.string()),
  subject_count: z.number().int().nonnegative(),
  channels: z.array(z.string()),
  expected_outer_folds: z.number().int().nonnegative(),
  search_candidate_count: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});
export type ExperimentPreview = z.infer<typeof ExperimentPreviewSchema>;

// 12. Experiment Detailed Result
export const ExperimentDetailSchema = z.object({
  experiment_id: z.string(),
  config: ExperimentConfigSchema,
  config_hash: z.string(),
  status: ExperimentStatusSchema,
  task: ClassificationTaskSchema,
  dataset_id: z.string(),
  epoch_set_id: z.string(),
  subjects: z.array(z.string()),
  channels: z.array(z.string()),
  sampling_rate_hz: z.number(),
  folds: z.array(FoldAssignmentSchema),
  metrics: ClassificationMetricsSchema,
  per_session_metrics: z.array(PerSessionMetricSchema),
  error_analysis: ErrorAnalysisResultSchema,
  model_id: z.string(),
  artifact_file_path: z.string(),
  artifact_checksum_sha256: z.string(),
  software_versions: z.record(z.string(), z.string()),
  created_at: z.string(),
});
export type ExperimentDetail = z.infer<typeof ExperimentDetailSchema>;
