import { z } from "zod";
import { NormalizedLabelSchema } from "./epoching";

export const ClassificationTaskSchema = z.object({
  task_id: z.string(),
  task_name: z.string(),
  description: z.string(),
  class_labels: z.array(NormalizedLabelSchema),
  label_mapping: z.record(NormalizedLabelSchema, z.number()),
  version: z.string().default("1.0.0"),
});
export type ClassificationTask = z.infer<typeof ClassificationTaskSchema>;

export const CSPCovEstSchema = z.enum(["concat", "epoch"]);
export type CSPCovEst = z.infer<typeof CSPCovEstSchema>;

export const CSPComponentOrderSchema = z.enum(["mutual_info", "alternate"]);
export type CSPComponentOrder = z.infer<typeof CSPComponentOrderSchema>;

export const CSPConfigSchema = z.object({
  csp_version: z.string().default("MNE_CSP_V1"),
  n_components: z.number().int().min(2).max(32).default(4),
  cov_est: CSPCovEstSchema.default("concat"),
  log: z.boolean().default(true),
  norm_trace: z.boolean().default(false),
  regularization: z.union([z.number(), z.string()]).nullable().default(null),
  component_order: CSPComponentOrderSchema.default("mutual_info"),
  transform_into: z.enum(["average_power", "csp_space"]).default("average_power"),
});
export type CSPConfig = z.infer<typeof CSPConfigSchema>;

export const ClassifierTypeSchema = z.enum([
  "LDA",
  "SVM_LINEAR",
  "SVM_RBF",
  "DUMMY",
]);
export type ClassifierType = z.infer<typeof ClassifierTypeSchema>;

export const ClassifierConfigSchema = z.object({
  classifier_id: z.string(),
  classifier_type: ClassifierTypeSchema,
  solver: z.enum(["svd", "lsqr", "eigen"]).default("svd"),
  shrinkage: z.union([z.number(), z.string()]).nullable().default(null),
  kernel: z.enum(["linear", "rbf"]).default("linear"),
  c_param: z.number().default(1.0),
  gamma: z.union([z.number(), z.string()]).default("scale"),
  dummy_strategy: z.enum(["prior", "most_frequent", "uniform"]).default("prior"),
  random_state: z.number().nullable().default(42),
  version: z.string().default("1.0.0"),
});
export type ClassifierConfig = z.infer<typeof ClassifierConfigSchema>;

export const EvaluationProtocolSchema = z.enum([
  "LEAVE_ONE_SUBJECT_OUT",
  "GROUP_K_FOLD",
  "STRATIFIED_GROUP_K_FOLD",
  "WITHIN_SUBJECT_K_FOLD",
]);
export type EvaluationProtocol = z.infer<typeof EvaluationProtocolSchema>;

export const EvaluationModeSchema = z.enum([
  "INTER_SUBJECT",
  "INTRA_SUBJECT",
  "CROSS_SESSION",
]);
export type EvaluationMode = z.infer<typeof EvaluationModeSchema>;

export const DecoderPipelineConfigSchema = z.object({
  pipeline_version: z.string().default("DECODER_PIPELINE_V1"),
  task_id: z.string(),
  epoch_set_id: z.string(),
  channels: z.array(z.string()).default([]),
  csp_config: CSPConfigSchema,
  classifier_config: ClassifierConfigSchema,
  evaluation_protocol: EvaluationProtocolSchema.default("LEAVE_ONE_SUBJECT_OUT"),
  evaluation_mode: EvaluationModeSchema.default("INTER_SUBJECT"),
  n_splits: z.number().int().min(2).max(50).default(5),
  scale_features: z.boolean().default(false),
  random_state: z.number().default(42),
  config_hash: z.string().optional(),
});
export type DecoderPipelineConfig = z.infer<typeof DecoderPipelineConfigSchema>;

export const ConfusionMatrixDataSchema = z.object({
  labels: z.array(z.string()),
  matrix: z.array(z.array(z.number())),
  normalized_matrix: z.array(z.array(z.number())),
});
export type ConfusionMatrixData = z.infer<typeof ConfusionMatrixDataSchema>;

export const CVFoldResultSchema = z.object({
  fold_id: z.number(),
  train_subjects: z.array(z.string()),
  test_subjects: z.array(z.string()),
  train_epochs: z.number(),
  test_epochs: z.number(),
  accuracy: z.number(),
  balanced_accuracy: z.number(),
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
  confusion_matrix: ConfusionMatrixDataSchema,
});
export type CVFoldResult = z.infer<typeof CVFoldResultSchema>;

export const PerSubjectMetricSchema = z.object({
  subject_id: z.string(),
  epoch_count: z.number(),
  accuracy: z.number(),
  balanced_accuracy: z.number(),
  f1: z.number(),
});
export type PerSubjectMetric = z.infer<typeof PerSubjectMetricSchema>;

export const MetricStatsSchema = z.object({
  mean: z.number(),
  std: z.number(),
  median: z.number(),
  min: z.number(),
  max: z.number(),
});
export type MetricStats = z.infer<typeof MetricStatsSchema>;

export const ClassificationMetricsSchema = z.object({
  accuracy: MetricStatsSchema,
  balanced_accuracy: MetricStatsSchema,
  precision: MetricStatsSchema,
  recall: MetricStatsSchema,
  f1: MetricStatsSchema,
  chance_level: z.number().default(0.5),
  class_distribution: z.record(z.string(), z.number()),
  confusion_matrix: ConfusionMatrixDataSchema,
  per_subject_metrics: z.array(PerSubjectMetricSchema),
  per_fold_results: z.array(CVFoldResultSchema),
});
export type ClassificationMetrics = z.infer<typeof ClassificationMetricsSchema>;

export const CSPPatternDataSchema = z.object({
  channels: z.array(z.string()),
  n_components: z.number(),
  patterns: z.array(z.array(z.number())),
  filters: z.array(z.array(z.number())),
  eigenvalues: z.array(z.number()).optional(),
});
export type CSPPatternData = z.infer<typeof CSPPatternDataSchema>;

export const ModelStatusSchema = z.enum([
  "ACTIVE_RESEARCH",
  "ARCHIVED",
  "INVALID",
]);
export type ModelStatus = z.infer<typeof ModelStatusSchema>;

export const ModelManifestSchema = z.object({
  model_id: z.string(),
  pipeline_version: z.string().default("DECODER_PIPELINE_V1"),
  task: ClassificationTaskSchema,
  dataset_id: z.string().optional(),
  source_epoch_set_id: z.string(),
  subjects: z.array(z.string()),
  channels: z.array(z.string()),
  sampling_rate_hz: z.number(),
  csp_config: CSPConfigSchema,
  classifier_config: ClassifierConfigSchema,
  evaluation_protocol: EvaluationProtocolSchema,
  evaluation_mode: EvaluationModeSchema,
  metrics: ClassificationMetricsSchema,
  csp_patterns: CSPPatternDataSchema.optional(),
  artifact_file_path: z.string(),
  artifact_checksum_sha256: z.string(),
  config_hash: z.string(),
  status: ModelStatusSchema.default("ACTIVE_RESEARCH"),
  software_versions: z.record(z.string(), z.string()),
  created_at: z.string(),
});
export type ModelManifest = z.infer<typeof ModelManifestSchema>;

export const ModelSummarySchema = z.object({
  model_id: z.string(),
  task_id: z.string(),
  dataset_id: z.string().optional(),
  source_epoch_set_id: z.string(),
  classifier_type: ClassifierTypeSchema,
  n_components: z.number(),
  evaluation_protocol: EvaluationProtocolSchema,
  accuracy_mean: z.number(),
  balanced_accuracy_mean: z.number(),
  f1_mean: z.number(),
  status: ModelStatusSchema,
  artifact_file_path: z.string(),
  artifact_checksum_sha256: z.string(),
  created_at: z.string(),
});
export type ModelSummary = z.infer<typeof ModelSummarySchema>;

export const DecoderRunStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export type DecoderRunStatus = z.infer<typeof DecoderRunStatusSchema>;

export const DecoderRunSchema = z.object({
  run_id: z.string(),
  model_id: z.string().nullable().optional(),
  task_id: z.string(),
  epoch_set_id: z.string(),
  config: DecoderPipelineConfigSchema,
  status: DecoderRunStatusSchema,
  started_at: z.string(),
  finished_at: z.string().nullable().optional(),
  metrics: ClassificationMetricsSchema.nullable().optional(),
  error_message: z.string().nullable().optional(),
});
export type DecoderRun = z.infer<typeof DecoderRunSchema>;

export const BenchmarkRequestSchema = z.object({
  pipeline_config: DecoderPipelineConfigSchema,
});
export type BenchmarkRequest = z.infer<typeof BenchmarkRequestSchema>;

export const BenchmarkPreviewSchema = z.object({
  valid: z.boolean(),
  task_id: z.string(),
  epoch_set_id: z.string(),
  total_epochs: z.number(),
  eligible_epochs: z.number(),
  excluded_epochs: z.number(),
  class_distribution: z.record(z.string(), z.number()),
  subjects_found: z.array(z.string()),
  subject_count: z.number(),
  channels: z.array(z.string()),
  sampling_rate_hz: z.number(),
  protocol: EvaluationProtocolSchema,
  expected_folds: z.number(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});
export type BenchmarkPreview = z.infer<typeof BenchmarkPreviewSchema>;

export const PredictionRequestSchema = z.object({
  model_id: z.string(),
  epoch_set_id: z.string().optional(),
  epoch_id: z.string().optional(),
  trial_data: z.array(z.array(z.number())).optional(), // (channels x times)
});
export type PredictionRequest = z.infer<typeof PredictionRequestSchema>;

export const PredictionResponseSchema = z.object({
  prediction_id: z.string(),
  model_id: z.string(),
  task_id: z.string(),
  predicted_label: NormalizedLabelSchema,
  predicted_class_index: z.number(),
  decision_score: z.record(z.string(), z.number()).optional(),
  probabilities: z.record(z.string(), z.number()).optional(),
  source_epoch_id: z.string().optional(),
  source_subject_id: z.string().optional(),
  true_label: NormalizedLabelSchema.optional(),
  operating_mode: z.enum(["SIMULATION", "REPLAY", "RESEARCH"]).default("RESEARCH"),
  created_at: z.string(),
});
export type PredictionResponse = z.infer<typeof PredictionResponseSchema>;
